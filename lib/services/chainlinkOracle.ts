/**
 * Chainlink Oracle Integration for Base
 *
 * Uses Chainlink price feeds on Base for authoritative token prices.
 * Falls back to other methods if Chainlink feed is not available.
 */

import { ethers } from 'ethers';

const BASE_CHAIN_ID = 8453;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

const provider = ALCHEMY_API_KEY
  ? new ethers.AlchemyProvider(BASE_CHAIN_ID, ALCHEMY_API_KEY)
  : null;

// Chainlink Aggregator V3 Interface
const CHAINLINK_AGGREGATOR_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
  'function description() view returns (string)'
];

// Known Chainlink price feeds on Base
// Format: tokenAddress => Chainlink aggregator address
// Find addresses at: https://docs.chain.link/docs/data-feeds/price-feeds/addresses/?network=base
const CHAINLINK_FEEDS: Record<string, string> = {
  // ETH/USD feed on Base Mainnet (Low Market Risk)
  // Source: https://docs.chain.link/docs/data-feeds/price-feeds/addresses/?network=base
  'native-eth': '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', // ETH/USD aggregator
  // Add more feeds as discovered (e.g., specific token addresses)
};

/**
 * Get Chainlink price feed address for a token
 */
function getChainlinkFeedAddress(tokenAddress: string): string | null {
  const tokenLower = tokenAddress.toLowerCase();
  return CHAINLINK_FEEDS[tokenLower] || CHAINLINK_FEEDS[tokenAddress] || null;
}

/**
 * Get price from Chainlink oracle
 * Returns null if feed is not available or error occurs
 */
export async function getChainlinkPrice(
  tokenAddress: string,
  timestamp?: number
): Promise<{ price: number; confidence: number; source: string } | null> {
  if (!provider) {
    return null;
  }

  try {
    const feedAddress = getChainlinkFeedAddress(tokenAddress);
    if (!feedAddress) {
      return null; // No Chainlink feed available for this token
    }

    const aggregator = new ethers.Contract(
      feedAddress,
      CHAINLINK_AGGREGATOR_ABI,
      provider
    );

    // Get latest price
    const latestRoundData = await aggregator.latestRoundData();
    const answer = latestRoundData.answer;
    const decimals = await aggregator.decimals();

    // Convert to number (Chainlink returns scaled prices)
    const price = Number(ethers.formatUnits(answer, decimals));

    if (price <= 0 || !isFinite(price)) {
      return null;
    }

    // Check if price is stale (older than 1 hour)
    const updatedAt = Number(latestRoundData.updatedAt);
    const isStale = timestamp && (timestamp - updatedAt) > 3600;

    return {
      price,
      confidence: isStale ? 0.7 : 0.95, // High confidence if fresh, lower if stale
      source: 'chainlink'
    };
  } catch (error) {
    console.warn(`Could not get Chainlink price for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Check if Chainlink feed exists for a token
 */
export async function hasChainlinkFeed(tokenAddress: string): Promise<boolean> {
  const feedAddress = getChainlinkFeedAddress(tokenAddress);
  if (!feedAddress) {
    return false;
  }

  try {
    const aggregator = new ethers.Contract(
      feedAddress,
      CHAINLINK_AGGREGATOR_ABI,
      provider
    );
    // Try to call a method to verify the contract exists
    await aggregator.decimals();
    return true;
  } catch {
    return false;
  }
}

