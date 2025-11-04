// lib/services/priceService.ts

const DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/v2';
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const BASE_CHAIN_ID = 8453;

// Simple price cache (in-memory, resets on restart)
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get current price for a token from Dexscreener
 */
async function getCurrentPriceFromDexscreener(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetch(`${DEXSCREENER_API_URL}/tokens/${tokenAddress}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const pairs = data?.pairs || [];

    if (pairs.length === 0) {
      return null;
    }

    // Get price from the most liquid pair (highest liquidity)
    const bestPair = pairs.reduce((best: any, pair: any) => {
      if (!best) return pair;
      const bestLiquidity = parseFloat(best.liquidity?.usd || '0');
      const pairLiquidity = parseFloat(pair.liquidity?.usd || '0');
      return pairLiquidity > bestLiquidity ? pair : best;
    }, null);

    if (!bestPair || !bestPair.priceUsd) {
      return null;
    }

    return parseFloat(bestPair.priceUsd);
  } catch (error) {
    console.error('Error fetching price from Dexscreener:', error);
    return null;
  }
}

/**
 * Get historical price at a specific timestamp
 * Note: Dexscreener doesn't have a direct historical API, so we'll use current price as approximation
 * For more accurate historical prices, you'd need to use a service like CoinGecko Pro or 0x API
 */
export async function getHistoricalPrice(
  tokenAddress: string,
  timestamp: number
): Promise<number | null> {
  const cacheKey = `${tokenAddress.toLowerCase()}-${timestamp}`;

  // Check cache first
  const cached = priceCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  // For historical prices, we'll use current price as approximation
  // In production, you'd want to use a proper historical price API
  // This is acceptable for a lightweight indexer where exact historical prices aren't critical
  const currentPrice = await getCurrentPriceFromDexscreener(tokenAddress);

  if (currentPrice) {
    priceCache[cacheKey] = {
      price: currentPrice,
      timestamp: Date.now()
    };
  }

  return currentPrice;
}

/**
 * Get current price for a token (with caching)
 */
export async function getCurrentPrice(tokenAddress: string): Promise<number | null> {
  const cacheKey = `${tokenAddress.toLowerCase()}-current`;

  const cached = priceCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  const price = await getCurrentPriceFromDexscreener(tokenAddress);

  if (price) {
    priceCache[cacheKey] = {
      price,
      timestamp: Date.now()
    };
  }

  return price;
}

