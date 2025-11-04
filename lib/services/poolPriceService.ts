/**
 * Uniswap Pool State Price Service
 *
 * Reads Uniswap v3 pool state (ticks, sqrtPrice) to calculate accurate prices.
 * Uses pool state instead of swap-derived prices for more accuracy.
 *
 * Note: For production, consider using the univ3prices library or similar.
 */

import { ethers } from 'ethers';

const BASE_CHAIN_ID = 8453;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

const provider = ALCHEMY_API_KEY
  ? new ethers.AlchemyProvider(BASE_CHAIN_ID, ALCHEMY_API_KEY)
  : null;

// Uniswap V3 Pool Interface
const UNISWAP_V3_POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)'
];

// Uniswap V3 Factory (to find pools)
const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD'; // Base Uniswap V3 Factory

/**
 * Calculate price from sqrtPriceX96
 * price = (sqrtPriceX96 / 2^96)^2
 * Adjust for token decimals
 */
function calculatePriceFromSqrtPrice(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number
): number {
  // sqrtPriceX96 = sqrt(price) * 2^96
  // price = (sqrtPriceX96 / 2^96)^2
  const Q96 = BigInt('79228162514264337593543950336'); // 2^96
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrtPrice * sqrtPrice;

  // Adjust for decimals: price = (token1 / token0) * (10^decimals0 / 10^decimals1)
  const decimalAdjustment = Math.pow(10, token0Decimals) / Math.pow(10, token1Decimals);
  return price * decimalAdjustment;
}

/**
 * Get price from Uniswap V3 pool state
 * Returns null if pool not found or error occurs
 */
export async function getPoolPrice(
  token0Address: string,
  token1Address: string,
  poolAddress?: string
): Promise<{ price: number; confidence: number; source: string } | null> {
  if (!provider) {
    return null;
  }

  try {
    // If pool address not provided, we'd need to compute it from factory
    // For now, assume pool address is provided or we find it another way
    if (!poolAddress) {
      // TODO: Compute pool address from factory using CREATE2
      return null;
    }

    const pool = new ethers.Contract(
      poolAddress,
      UNISWAP_V3_POOL_ABI,
      provider
    );

    // Get pool slot0 data (includes sqrtPriceX96)
    const slot0 = await pool.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;

    // Get token addresses to determine decimals
    const token0 = await pool.token0();
    const token1 = await pool.token1();

    // Get token decimals (assuming standard ERC20)
    const token0Contract = new ethers.Contract(
      token0,
      ['function decimals() view returns (uint8)'],
      provider
    );
    const token1Contract = new ethers.Contract(
      token1,
      ['function decimals() view returns (uint8)'],
      provider
    );

    const token0Decimals = await token0Contract.decimals();
    const token1Decimals = await token1Contract.decimals();

    // Calculate price
    const price = calculatePriceFromSqrtPrice(
      sqrtPriceX96,
      Number(token0Decimals),
      Number(token1Decimals)
    );

    if (price <= 0 || !isFinite(price)) {
      return null;
    }

    // Determine which token is token0/token1 to return correct price
    const token0Lower = token0.toLowerCase();
    const token1Lower = token1.toLowerCase();
    const inputTokenLower = token0Address.toLowerCase();

    // If input token is token1, invert the price
    const finalPrice = inputTokenLower === token1Lower ? 1 / price : price;

    return {
      price: finalPrice,
      confidence: 0.85, // High confidence for pool-derived prices
      source: 'pool_derived'
    };
  } catch (error) {
    console.warn(`Could not get pool price for ${token0Address}/${token1Address}:`, error);
    return null;
  }
}

/**
 * Find Uniswap V3 pool address for a token pair
 * This is a simplified version - in production, use the factory's getPool function
 */
export async function findPoolAddress(
  token0: string,
  token1: string,
  fee: number = 3000 // Default fee tier (0.3%)
): Promise<string | null> {
  // TODO: Implement pool address lookup using Uniswap V3 Factory
  // This requires computing the CREATE2 address or calling the factory
  return null;
}

