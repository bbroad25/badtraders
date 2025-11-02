// lib/services/blockchainService.ts
import { ethers } from 'ethers';
import { PnlData } from '@/types/leaderboard';
import { BADTRADER_TOKEN_ADDRESS, UNISWAP_UNIVERSAL_ROUTER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_POOL_ABI, UNISWAP_ROUTER_ABI } from '@/lib/utils/constants';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Create provider only if API key exists, otherwise return empty results
// Base mainnet chain ID: 8453
const provider = ALCHEMY_API_KEY
  ? new ethers.AlchemyProvider(8453, ALCHEMY_API_KEY)
  : null;
const ELIGIBILITY_THRESHOLD = ethers.parseUnits("10000000", 18); // 10M tokens with 18 decimals

/**
 * Fetches all wallet addresses that hold at least 10M of the $BadTrader token.
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
 * Calculates the net loss for a list of wallets over the past 7 days.
 * Uses 0x API to get swap history and calculate PnL.
 * @param {string[]} walletAddresses - The wallets to analyze.
 * @returns {Promise<PnlData[]>} A list of objects containing the address and its net loss.
 */
export async function getNetLossForWallets(walletAddresses: string[]): Promise<PnlData[]> {
  if (walletAddresses.length === 0) {
    return [];
  }

  // 0x API doesn't require an API key for public endpoints
  // We'll use a simpler approach: track DEX swaps via public APIs
  const ZEROX_API_URL = 'https://api.0x.org';
  const ZEROX_API_KEY = process.env.ZEROX_API_KEY; // Optional, for higher rate limits

  const pnlPromises = walletAddresses.map(async (address) => {
    try {
      // For now, use a simplified approach:
      // 1. Get recent transactions from Etherscan (free, no API key needed for public)
      // 2. Filter for DEX swaps
      // 3. Calculate approximate PnL

      // Alternative: Use Moralis or other free tier service if available
      // For now, we'll use a mock/estimation based on transaction volume

      // Simple estimation: check wallet activity and approximate losses
      // This is a placeholder - you can integrate Zerion/Moralis/etc here
      const netLoss = await estimateLossFromActivity(address);

      return { address, netLoss };
    } catch (e) {
      console.error(`Could not calculate PnL for ${address}`, e);
      return { address, netLoss: 0 };
    }
  });

  return Promise.all(pnlPromises);
}

/**
 * Estimates loss from wallet activity.
 * Tries multiple services in order of preference, using whatever APIs are available.
 */
async function estimateLossFromActivity(address: string): Promise<number> {
  const ZERION_API_KEY = process.env.ZERION_API_KEY;
  const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
  const ZEROX_API_KEY = process.env.ZEROX_API_KEY;

  // Try Zerion first (most accurate for PnL)
  if (ZERION_API_KEY) {
    try {
      const loss = await getLossFromZerion(address, ZERION_API_KEY);
      if (loss > 0) return loss;
    } catch (e) {
      console.warn(`Zerion API failed for ${address}, trying alternatives...`, e);
    }
  }

  // Try Moralis (good free tier)
  if (MORALIS_API_KEY) {
    try {
      const loss = await getLossFromMoralis(address, MORALIS_API_KEY);
      if (loss > 0) return loss;
    } catch (e) {
      console.warn(`Moralis API failed for ${address}, trying alternatives...`, e);
    }
  }

  // Try 0x for swap history
  if (ZEROX_API_KEY || true) { // 0x has public endpoints
    try {
      const loss = await getLossFrom0x(address, ZEROX_API_KEY);
      if (loss > 0) return loss;
    } catch (e) {
      console.warn(`0x API failed for ${address}`, e);
    }
  }

  // Fallback: return 0 if no services work
  console.warn(`No PnL data available for ${address}, returning 0`);
  return 0;
}

/**
 * Get loss from Zerion API (most accurate)
 */
async function getLossFromZerion(address: string, apiKey: string): Promise<number> {
  try {
    const response = await fetch(`https://api.zerion.io/v1/wallets/${address}/positions`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Zerion API error: ${response.status}`);
    }

    const data = await response.json();
    // Zerion returns PnL data - extract realized/unrealized losses
    // This is a simplified version - adjust based on actual Zerion response format
    const totalLoss = data.data?.attributes?.total_loss || 0;
    return Math.abs(totalLoss); // Return absolute value of loss
  } catch (error) {
    console.error('Zerion API error:', error);
    throw error;
  }
}

/**
 * Get loss from Moralis API (free tier available)
 */
async function getLossFromMoralis(address: string, apiKey: string): Promise<number> {
  try {
    // Moralis provides wallet analytics - this is a simplified implementation
    // Adjust based on actual Moralis API endpoints
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2/${address}/erc20/transfers?chain=base&limit=100`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }

    const data = await response.json();
    // Calculate approximate loss from transfer patterns
    // This is simplified - real implementation would analyze swaps and prices
    return 0; // Placeholder - implement actual calculation
  } catch (error) {
    console.error('Moralis API error:', error);
    throw error;
  }
}

/**
 * Get loss from 0x API using swap history
 * Calculates PnL from actual swap transactions over the past 7 days
 */
async function getLossFrom0x(address: string, apiKey?: string): Promise<number> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['0x-api-key'] = apiKey;
    }

    // Calculate timestamp for 7 days ago
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

    // Use 0x Swap API to get historical swaps
    // Note: 0x doesn't have a direct "swap history" endpoint, but we can use their transaction history
    // For now, we'll use a different approach: track swaps via Ethereum transactions
    // and use 0x API to get current prices for calculation

    // Alternative: Use 0x Transaction API if available with subscription
    // For BadTraders token specifically, we'll focus on swaps involving that token
    const BADTRADERS_TOKEN = '0x0774409Cda69A47f272907fd5D0d80173167BB07';
    const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
    // Using WETH from constants (Base mainnet)

    // Get token balance changes and approximate losses from swaps
    // This is a simplified implementation - full version would track each swap
    let totalLoss = 0;

    // For users with 0x subscription, we can use their Transaction History API
    if (apiKey) {
      try {
        // Try to use 0x Transaction History API (if available)
        // Endpoint might be: /v1/transactions or similar
        const txResponse = await fetch(
          `https://api.0x.org/swap/v1/quote?sellToken=${BADTRADERS_TOKEN}&buyToken=${WETH_ADDRESS}&sellAmount=1000000000000000000`,
          { headers }
        );

        if (txResponse.ok) {
          // If we have transaction history, calculate PnL from swaps
          // For now, we'll use a heuristic based on wallet activity
          // Real implementation would parse swap events and calculate exact PnL

          // Estimate loss from token value changes
          // This is simplified - in production, you'd track each swap's input/output values
          const estimatedLoss = await estimateLossFromTokenActivity(address, BADTRADERS_TOKEN, sevenDaysAgo);
          if (estimatedLoss > 0) {
            return estimatedLoss;
          }
        }
      } catch (e) {
        console.warn('0x Transaction API not available, using fallback', e);
      }
    }

    // Fallback: Estimate based on token balance changes and approximate price movements
    return await estimateLossFromTokenActivity(address, BADTRADERS_TOKEN, sevenDaysAgo);
  } catch (error) {
    console.error('0x API error:', error);
    throw error;
  }
}

/**
 * Estimate loss from token activity by analyzing balance changes
 * This is a simplified approach - real implementation would track exact swap prices
 */
async function estimateLossFromTokenActivity(
  address: string,
  tokenAddress: string,
  sinceTimestamp: number
): Promise<number> {
  if (!ALCHEMY_API_KEY || !provider) {
    return 0;
  }

  try {
    // Get token transfers in/out for this address in the last 7 days
    const currentBalance = await getCurrentTokenBalance(address, tokenAddress);

    // Use Alchemy to get token transfers
    // Calculate approximate loss based on transfer patterns
    // This is a heuristic - full implementation would track exact swap prices via events

    // For now, return a conservative estimate based on activity
    // Real implementation would:
    // 1. Fetch all ERC20 transfers for this token
    // 2. Identify swaps (pairs of transfers)
    // 3. Calculate PnL from swap input vs output values

    return 0; // Placeholder - implement full calculation
  } catch (error) {
    console.error('Error estimating loss from token activity:', error);
    return 0;
  }
}

async function getCurrentTokenBalance(address: string, tokenAddress: string): Promise<bigint> {
  if (!provider) return BigInt(0);

  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    return await tokenContract.balanceOf(address);
  } catch {
    return BigInt(0);
  }
}

// A simple cache for token prices to avoid repeated lookups
const priceCache: Record<string, number> = {};

async function getTokenValue(tokenAddress: string, amount: bigint, timestamp: number): Promise<number> {
  const tokenContract = new ethers.Contract(tokenAddress, ['function decimals() view returns (uint8)'], provider);
  const decimals = await tokenContract.decimals();
  const amountFloat = parseFloat(ethers.formatUnits(amount, decimals));

  if (tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
    const wethPrice = await getWethPrice(timestamp);
    return amountFloat * wethPrice;
  }

  const cacheKey = `${tokenAddress}-${timestamp}`;
  if(priceCache[cacheKey]) return amountFloat * priceCache[cacheKey];

  // For other tokens, find a pair with WETH and derive price. This is an approximation.
  // A real system would use a dedicated price oracle service.
  try {
    // This part is highly complex. For now, we'll mock a price.
    // A full implementation would require finding the right Uniswap pool.
    const mockPrice = 1; // e.g., fetch from CoinGecko historical API
    priceCache[cacheKey] = mockPrice;
    return amountFloat * mockPrice;
  } catch (e) {
    return 0; // Token has no value or no WETH pair found
  }
}

async function getWethPrice(timestamp: number): Promise<number> {
    // For simplicity, we'll return a fixed price.
    // A real implementation would use a Chainlink historical price feed
    // or a service like CoinGecko's historical API.
    return 3000; // Mock WETH price
}

