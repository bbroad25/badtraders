// lib/services/swapDecoder.ts
import { ethers } from 'ethers';
import { UNISWAP_UNIVERSAL_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, WETH_ADDRESS } from '@/lib/utils/constants';
import { query } from '@/lib/db/connection';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const BASE_CHAIN_ID = 8453;

const provider = ALCHEMY_API_KEY
  ? new ethers.AlchemyProvider(BASE_CHAIN_ID, ALCHEMY_API_KEY)
  : null;

// Standard ERC20 Transfer event ABI
const ERC20_TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// Uniswap Universal Router interface
const routerInterface = new ethers.Interface(UNISWAP_ROUTER_ABI);

export interface SwapDetails {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  side: 'BUY' | 'SELL';
  walletAddress: string;
}

/**
 * Get list of tracked token addresses from database
 */
async function getTrackedTokens(): Promise<string[]> {
  try {
    const result = await query('SELECT token_address FROM tracked_tokens');
    return result.rows.map((row: any) => row.token_address.toLowerCase());
  } catch (error) {
    console.error('Error getting tracked tokens:', error);
    return [];
  }
}

/**
 * Detect if a transaction is a swap involving tracked tokens
 */
export async function detectSwapTransaction(txHash: string): Promise<boolean> {
  if (!provider) {
    return false;
  }

  try {
    const trackedTokens = await getTrackedTokens();
    if (trackedTokens.length === 0) {
      return false;
    }

    const tx = await provider.getTransaction(txHash);
    if (!tx || !tx.to) {
      return false;
    }

    // Check if transaction interacts with Uniswap Router
    const routerAddress = UNISWAP_UNIVERSAL_ROUTER_ADDRESS.toLowerCase();
    if (tx.to.toLowerCase() !== routerAddress) {
      // Could be other DEX routers, check receipt for Transfer events
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return false;
      }

      // Check logs for Transfer events involving tracked tokens
      const transferInterface = new ethers.Interface(ERC20_TRANSFER_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = transferInterface.parseLog(log);
          if (parsed && parsed.name === 'Transfer') {
            const tokenAddress = log.address.toLowerCase();
            if (trackedTokens.includes(tokenAddress)) {
              return true;
            }
          }
        } catch {
          // Not a Transfer event, continue
        }
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error detecting swap transaction:', error);
    return false;
  }
}

/**
 * Decode swap from Alchemy transaction receipt
 */
export async function decodeSwapFromAlchemy(
  txHash: string,
  walletAddress: string
): Promise<SwapDetails | null> {
  if (!provider) {
    return null;
  }

  try {
    const trackedTokens = await getTrackedTokens();
    if (trackedTokens.length === 0) {
      return null;
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return null;
    }

    const transferInterface = new ethers.Interface(ERC20_TRANSFER_ABI);
    const walletAddr = walletAddress.toLowerCase();

    // Find all Transfer events involving the wallet
    // We need to check all transfers, not just tracked tokens, to detect swaps
    const allTransfers: Array<{
      token: string;
      from: string;
      to: string;
      amount: bigint;
    }> = [];

    for (const log of receipt.logs) {
      try {
        const parsed = transferInterface.parseLog(log);
        if (parsed && parsed.name === 'Transfer') {
          const tokenAddress = log.address.toLowerCase();
          const from = parsed.args.from.toLowerCase();
          const to = parsed.args.to.toLowerCase();
          const amount = parsed.args.value;

          // Check if wallet is involved (either sending or receiving)
          if (from === walletAddr || to === walletAddr) {
            allTransfers.push({
              token: tokenAddress,
              from,
              to,
              amount
            });
          }
        }
      } catch {
        // Not a Transfer event, continue
      }
    }

    // Look for transfers involving tracked tokens
    const trackedTokenTransfers = allTransfers.filter(t => trackedTokens.includes(t.token));

    if (trackedTokenTransfers.length === 0) {
      // No tracked token involved, not a swap we care about
      return null;
    }

    // For swaps, we typically have:
    // - BUY: Wallet receives tracked token, sends payment token (WETH/ETH)
    // - SELL: Wallet sends tracked token, receives payment token (WETH/ETH)

    let trackedTokenTransfer = trackedTokenTransfers[0];
    const trackedToken = trackedTokenTransfer.token;

    // Determine side based on wallet's role in the tracked token transfer
    const isReceivingTrackedToken = trackedTokenTransfer.to === walletAddr;
    const isSendingTrackedToken = trackedTokenTransfer.from === walletAddr;

    if (!isReceivingTrackedToken && !isSendingTrackedToken) {
      return null;
    }

    const side: 'BUY' | 'SELL' = isReceivingTrackedToken ? 'BUY' : 'SELL';
    const trackedTokenAmount = trackedTokenTransfer.amount;

    // Find the corresponding payment token transfer
    // For BUY: look for token being sent FROM wallet
    // For SELL: look for token being received BY wallet
    let paymentTokenTransfer = null;
    for (const transfer of allTransfers) {
      if (transfer.token === trackedToken) continue; // Skip tracked token transfer

      if (side === 'BUY' && transfer.from === walletAddr) {
        // Wallet is sending payment token
        paymentTokenTransfer = transfer;
        break;
      } else if (side === 'SELL' && transfer.to === walletAddr) {
        // Wallet is receiving payment token
        paymentTokenTransfer = transfer;
        break;
      }
    }

    // Build swap details
    if (side === 'BUY') {
      // Buying tracked token with payment token
      const paymentToken = paymentTokenTransfer?.token || WETH_ADDRESS.toLowerCase();
      const paymentAmount = paymentTokenTransfer?.amount || BigInt(0);

      return {
        tokenIn: paymentToken,
        tokenOut: trackedToken,
        amountIn: paymentAmount,
        amountOut: trackedTokenAmount,
        side: 'BUY',
        walletAddress: walletAddr
      };
    } else {
      // Selling tracked token for payment token
      const paymentToken = paymentTokenTransfer?.token || WETH_ADDRESS.toLowerCase();
      const paymentAmount = paymentTokenTransfer?.amount || BigInt(0);

      return {
        tokenIn: trackedToken,
        tokenOut: paymentToken,
        amountIn: trackedTokenAmount,
        amountOut: paymentAmount,
        side: 'SELL',
        walletAddress: walletAddr
      };
    }
  } catch (error) {
    console.error('Error decoding swap from Alchemy:', error);
    return null;
  }
}

/**
 * Extract swap details from decoded data
 * Main entry point using Alchemy-only decoding
 */
export async function extractSwapDetails(
  txHash: string,
  walletAddress: string
): Promise<SwapDetails | null> {
  // Use Alchemy for swap decoding
  return await decodeSwapFromAlchemy(txHash, walletAddress);
}

