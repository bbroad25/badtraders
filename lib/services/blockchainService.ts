// lib/services/blockchainService.ts
import { ethers } from 'ethers';
import { PnlData } from '@/types/leaderboard';
import { BADTRADER_TOKEN_ADDRESS, UNISWAP_UNIVERSAL_ROUTER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_POOL_ABI, UNISWAP_ROUTER_ABI } from '@/lib/utils/constants';
import { query } from '@/lib/db/connection';
import { getPosition, calculateUnrealizedPnL } from './fifoAccounting';
import { getCurrentPrice } from './priceService';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Create provider only if API key exists, otherwise return empty results
// Base mainnet chain ID: 8453
const provider = ALCHEMY_API_KEY
  ? new ethers.AlchemyProvider(8453, ALCHEMY_API_KEY)
  : null;
const ELIGIBILITY_THRESHOLD = ethers.parseUnits("1000000", 18); // 1M tokens with 18 decimals

/**
 * Fetches all wallet addresses that hold at least 1M of the $BadTrader token.
 * Uses Alchemy's SDK for efficient token holder retrieval.
 * @returns {Promise<string[]>} An array of eligible wallet addresses.
 */
export async function getEligibleWallets(): Promise<string[]> {
  if (!ALCHEMY_API_KEY || !provider) {
    console.warn("ALCHEMY_API_KEY not set, returning empty wallet list");
    return [];
  }

  try {
    const response = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getTokenHolders',
        params: [{ contractAddress: BADTRADER_TOKEN_ADDRESS, pageSize: 1000 }],
      }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(`Alchemy API Error: ${data.error.message}`);
    }

    return data.result.holders
      .filter((holder: any) => BigInt(holder.balance) >= ELIGIBILITY_THRESHOLD)
      .map((holder: any) => holder.address);
  } catch (error) {
    console.error("Error fetching eligible wallets:", error);
    return [];
  }
}

/**
 * Calculates the net loss for a list of wallets using indexer data.
 * Queries positions table for realized + unrealized PnL.
 * @param {string[]} walletAddresses - The wallets to analyze.
 * @returns {Promise<PnlData[]>} A list of objects containing the address and its net loss.
 */
export async function getNetLossForWallets(walletAddresses: string[]): Promise<PnlData[]> {
  if (walletAddresses.length === 0) {
    return [];
  }

  // Get tracked tokens
  const trackedTokensResult = await query('SELECT token_address FROM tracked_tokens');
  const trackedTokens = trackedTokensResult.rows.map((r: any) => r.token_address.toLowerCase());

  if (trackedTokens.length === 0) {
    // No tracked tokens, return zeros
    return walletAddresses.map(address => ({ address, netLoss: 0 }));
  }

  // Calculate PnL for each wallet
  const pnlPromises = walletAddresses.map(async (address) => {
    try {
      const walletAddr = address.toLowerCase();
      let totalNetLoss = 0;

      // For each tracked token, get position and calculate PnL
      for (const tokenAddress of trackedTokens) {
        const position = await getPosition(walletAddr, tokenAddress);

        if (position) {
          // Get realized PnL
          const realizedPnL = parseFloat(position.realized_pnl_usd) || 0;

          // Get current price for unrealized PnL calculation
          const currentPrice = await getCurrentPrice(tokenAddress);
          if (currentPrice && currentPrice > 0) {
            const unrealizedPnL = await calculateUnrealizedPnL(walletAddr, tokenAddress, currentPrice);

            // Net loss = negative of total PnL (realized + unrealized)
            // If PnL is negative, it's a loss (positive value)
            const totalPnL = realizedPnL + unrealizedPnL;
            if (totalPnL < 0) {
              totalNetLoss += Math.abs(totalPnL);
            }
          } else {
            // If we can't get current price, just use realized PnL
            if (realizedPnL < 0) {
              totalNetLoss += Math.abs(realizedPnL);
            }
          }
        }
      }

      // Return net loss (only positive values - losses)
      return { address, netLoss: totalNetLoss };
    } catch (e) {
      console.error(`Could not calculate PnL for ${address} from indexer:`, e);
      return { address, netLoss: 0 };
    }
  });

  return Promise.all(pnlPromises);
}



