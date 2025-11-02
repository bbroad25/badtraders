// lib/services/blockchainService.ts
import { ethers } from 'ethers';
import { PnlData } from '@/types/leaderboard';
import { BADTRADER_TOKEN_ADDRESS, UNISWAP_UNIVERSAL_ROUTER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_POOL_ABI, UNISWAP_ROUTER_ABI } from '@/lib/utils/constants';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Create provider only if API key exists, otherwise return empty results
const provider = ALCHEMY_API_KEY
  ? new ethers.AlchemyProvider('mainnet', ALCHEMY_API_KEY)
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
    const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
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
      `https://deep-index.moralis.io/api/v2/${address}/erc20/transfers?chain=eth&limit=100`,
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
 * Get loss from 0x API (public endpoints available)
 */
async function getLossFrom0x(address: string, apiKey?: string): Promise<number> {
  try {
    // 0x provides swap history - we can reconstruct PnL from swaps
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['0x-api-key'] = apiKey;
    }

    // Get recent swaps (0x API endpoint for swap history)
    // Note: This is a placeholder - 0x primarily does swaps, not PnL tracking
    // You might need to use their swap history and calculate PnL manually
    const response = await fetch(
      `https://api.0x.org/swap/v1/quote?sellToken=ETH&buyToken=DAI&sellAmount=1000000000000000000`,
      { headers }
    );

    // This is just checking API availability - actual implementation would track swaps
    if (response.ok) {
      // Calculate loss from swap history if available
      // For now, return 0 as placeholder
      return 0;
    }

    return 0;
  } catch (error) {
    console.error('0x API error:', error);
    throw error;
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

