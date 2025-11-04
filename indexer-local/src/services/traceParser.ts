/**
 * Transaction Trace Parser
 *
 * Parses transaction traces to extract exact swap amounts.
 * Critical for accurate price calculation, especially for routed swaps.
 *
 * Based on: mev-inspect-py, Blockscout patterns
 */

import { ethers } from 'ethers';

const BASE_CHAIN_ID = 8453;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

const provider = ALCHEMY_API_KEY
  ? new ethers.AlchemyProvider(BASE_CHAIN_ID, ALCHEMY_API_KEY)
  : null;

export interface TraceCall {
  from: string;
  to: string;
  value: string;
  input: string;
  output?: string;
  calls?: TraceCall[];
  type: 'call' | 'delegatecall' | 'staticcall' | 'create' | 'create2';
}

export interface SwapTrace {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  route: string[]; // Array of contract addresses in the swap route
  confidence: number; // 0-1, how confident we are in this extraction
}

/**
 * Get transaction trace from RPC
 */
export async function getTransactionTrace(txHash: string): Promise<TraceCall[] | null> {
  if (!provider || !ALCHEMY_API_KEY) {
    console.warn('Alchemy provider not available for trace parsing');
    return null;
  }

  try {
    // Use Alchemy's trace_transaction method
    const response = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'trace_transaction',
        params: [txHash]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error(`Error getting trace for ${txHash}:`, data.error);
      return null;
    }

    return data.result || null;
  } catch (error) {
    console.error(`Error fetching trace for ${txHash}:`, error);
    return null;
  }
}

/**
 * Extract swap information from trace
 *
 * This handles:
 * - Direct swaps (token → token)
 * - Routed swaps (token → intermediate → token)
 * - Aggregator swaps (0x, 1inch, etc.)
 */
export async function extractSwapFromTrace(
  txHash: string,
  walletAddress: string,
  trackedTokenAddress: string
): Promise<SwapTrace | null> {
  const traces = await getTransactionTrace(txHash);
  if (!traces || traces.length === 0) {
    return null;
  }

  const walletAddr = walletAddress.toLowerCase();
  const trackedToken = trackedTokenAddress.toLowerCase();

  // Common DEX/router addresses on Base
  const KNOWN_ROUTERS = [
    '0x2626664c2603336e57b271c5c0b26f421741e481', // Uniswap Universal Router
    '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // Uniswap Router V2
    '0x03f7724180aa6b939894b5ca4494786b2c36efb7', // Uniswap Router V3
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
    '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch Router
  ].map(addr => addr.toLowerCase());

  // ERC20 Transfer event signature
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  // Find all token transfers in the trace
  const transfers: Array<{
    from: string;
    to: string;
    token: string;
    amount: bigint;
  }> = [];

  // Recursively search trace for transfers
  function searchTrace(trace: TraceCall, depth: number = 0): void {
    // Check if this is a call to a token contract
    // We'd need to check the receipt logs for actual Transfer events
    // For now, we'll use a simpler approach with the receipt

    if (trace.calls) {
      trace.calls.forEach(call => searchTrace(call, depth + 1));
    }
  }

  // Get transaction receipt to find Transfer events
  try {
    const receipt = await provider!.getTransactionReceipt(txHash);
    if (!receipt) {
      return null;
    }

    const transferInterface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ]);

    // Parse all Transfer events
    for (const log of receipt.logs) {
      try {
        const parsed = transferInterface.parseLog(log);
        if (parsed && parsed.name === 'Transfer') {
          const from = parsed.args[0].toLowerCase();
          const to = parsed.args[1].toLowerCase();
          const amount = parsed.args[2];
          const token = log.address.toLowerCase();

          // Only track transfers involving the wallet or tracked token
          if (from === walletAddr || to === walletAddr || token === trackedToken) {
            transfers.push({
              from,
              to,
              token,
              amount
            });
          }
        }
      } catch {
        // Not a Transfer event, continue
      }
    }

    // Find the tracked token transfer
    const trackedTokenTransfer = transfers.find(t => t.token === trackedToken);
    if (!trackedTokenTransfer) {
      return null;
    }

    // Determine if this is a BUY or SELL
    const isBuy = trackedTokenTransfer.to === walletAddr;
    const isSell = trackedTokenTransfer.from === walletAddr;

    if (!isBuy && !isSell) {
      return null;
    }

    // Find the corresponding payment token transfer
    // For BUY: look for token being sent FROM wallet
    // For SELL: look for token being received BY wallet
    let paymentTokenTransfer = null;
    for (const transfer of transfers) {
      if (transfer.token === trackedToken) continue;

      if (isBuy && transfer.from === walletAddr) {
        paymentTokenTransfer = transfer;
        break;
      } else if (isSell && transfer.to === walletAddr) {
        paymentTokenTransfer = transfer;
        break;
      }
    }

    // Extract route from trace (simplified - would need deeper analysis)
    const route: string[] = [];
    function extractRoute(trace: TraceCall): void {
      if (KNOWN_ROUTERS.includes(trace.to.toLowerCase())) {
        route.push(trace.to);
      }
      if (trace.calls) {
        trace.calls.forEach(extractRoute);
      }
    }
    traces.forEach(extractRoute);

    // Build swap trace
    if (isBuy) {
      return {
        tokenIn: paymentTokenTransfer?.token || 'unknown',
        tokenOut: trackedToken,
        amountIn: paymentTokenTransfer?.amount || BigInt(0),
        amountOut: trackedTokenTransfer.amount,
        route,
        confidence: paymentTokenTransfer ? 0.9 : 0.5 // Higher confidence if we found payment token
      };
    } else {
      return {
        tokenIn: trackedToken,
        tokenOut: paymentTokenTransfer?.token || 'unknown',
        amountIn: trackedTokenTransfer.amount,
        amountOut: paymentTokenTransfer?.amount || BigInt(0),
        route,
        confidence: paymentTokenTransfer ? 0.9 : 0.5
      };
    }
  } catch (error) {
    console.error(`Error extracting swap from trace for ${txHash}:`, error);
    return null;
  }
}

/**
 * Get token decimals from contract
 */
export async function getTokenDecimals(tokenAddress: string): Promise<number> {
  if (!provider) {
    return 18; // Default
  }

  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function decimals() view returns (uint8)'],
      provider
    );
    const decimals = await tokenContract.decimals();
    return Number(decimals);
  } catch (error) {
    console.warn(`Could not get decimals for ${tokenAddress}, using default 18`);
    return 18;
  }
}

