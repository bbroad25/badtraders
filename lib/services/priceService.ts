// lib/services/priceService.ts
// Parallel price fetching from multiple sources with intelligent selection

const DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/v2';
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const ZEROX_API_URL = 'https://api.0x.org';
const BASE_CHAIN_ID = 8453;

// Price cache
const priceCache: Record<string, { price: number; timestamp: number; source: string }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get current price from Dexscreener (free, fast)
 */
async function getPriceFromDexscreener(tokenAddress: string): Promise<{ price: number; source: string } | null> {
  try {
    const response = await fetch(`${DEXSCREENER_API_URL}/tokens/${tokenAddress}`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) return null;

    const data = await response.json();
    const pairs = data?.pairs || [];
    if (pairs.length === 0) return null;

    const bestPair = pairs.reduce((best: any, pair: any) => {
      if (!best) return pair;
      const bestLiquidity = parseFloat(best.liquidity?.usd || '0');
      const pairLiquidity = parseFloat(pair.liquidity?.usd || '0');
      return pairLiquidity > bestLiquidity ? pair : best;
    }, null);

    if (!bestPair?.priceUsd) return null;

    return {
      price: parseFloat(bestPair.priceUsd),
      source: 'dexscreener'
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get price from 0x API (more accurate for swaps)
 */
async function getPriceFrom0x(tokenAddress: string): Promise<{ price: number; source: string } | null> {
  if (!ZEROX_API_KEY) return null;

  try {
    // Get quote for 1 WETH -> token
    const response = await fetch(
      `${ZEROX_API_URL}/swap/v1/quote?` +
      `buyToken=${tokenAddress}&` +
      `sellToken=0x4200000000000000000000000000000000000006&` + // WETH on Base
      `sellAmount=1000000000000000000&` + // 1 WETH
      `slippagePercentage=0.01`,
      {
        headers: { '0x-api-key': ZEROX_API_KEY },
        signal: AbortSignal.timeout(3000)
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.price && data.buyAmount) {
      const buyAmount = parseFloat(data.buyAmount) / 1e18;
      return {
        price: buyAmount,
        source: '0x'
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get current price - fetch from ALL sources in parallel, use best result
 */
export async function getCurrentPrice(tokenAddress: string): Promise<number | null> {
  const cacheKey = `${tokenAddress.toLowerCase()}-current`;

  // Check cache
  const cached = priceCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  // Fetch from all sources in parallel
  const [dexscreenerResult, zeroxResult] = await Promise.allSettled([
    getPriceFromDexscreener(tokenAddress),
    getPriceFrom0x(tokenAddress)
  ]);

  // Prefer Dexscreener (more reliable for current prices), fallback to 0x
  let result: { price: number; source: string } | null = null;

  if (dexscreenerResult.status === 'fulfilled' && dexscreenerResult.value) {
    result = dexscreenerResult.value;
  } else if (zeroxResult.status === 'fulfilled' && zeroxResult.value) {
    result = zeroxResult.value;
  }

  if (result && result.price > 0) {
    priceCache[cacheKey] = {
      price: result.price,
      timestamp: Date.now(),
      source: result.source
    };
    return result.price;
  }

  return null;
}

/**
 * Get historical price - use current price as approximation
 * (for true historical, would need CoinGecko Pro or similar)
 */
export async function getHistoricalPrice(
  tokenAddress: string,
  timestamp: number
): Promise<number | null> {
  const cacheKey = `${tokenAddress.toLowerCase()}-${timestamp}`;

  // Check cache
  const cached = priceCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  // For historical, use current price as approximation
  // (Better than nothing, and acceptable for lightweight indexer)
  const currentPrice = await getCurrentPrice(tokenAddress);

  if (currentPrice && currentPrice > 0) {
    priceCache[cacheKey] = {
      price: currentPrice,
      timestamp: Date.now(),
      source: 'approximation'
    };
  }

  return currentPrice;
}

/**
 * Get best price from all sources (parallel)
 */
export async function getBestPrice(tokenAddress: string): Promise<number | null> {
  return getCurrentPrice(tokenAddress);
}
