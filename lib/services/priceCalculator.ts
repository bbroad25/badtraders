// lib/services/priceCalculator.ts
// Calculate price from swap amounts using base token (ETH/USDC) price

import { ethers } from 'ethers';
import { getCurrentPrice } from './priceService';
import { WETH_ADDRESS, USDC_ADDRESS } from '@/lib/utils/constants';

const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// Cache for base token prices (ETH/USDC)
const baseTokenPriceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get current USD price for base tokens (ETH, USDC)
 */
async function getBaseTokenPrice(tokenAddress: string): Promise<number> {
  const addrLower = tokenAddress.toLowerCase();

  // USDC is always ~$1
  if (addrLower === USDC_ADDRESS.toLowerCase()) {
    return 1.0;
  }

  // For ETH/WETH, get current price
  if (addrLower === WETH_ADDRESS.toLowerCase() || addrLower === NATIVE_ETH_ADDRESS) {
    const cacheKey = 'eth-price';
    const cached = baseTokenPriceCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.price;
    }

    // Get ETH price from Dexscreener (WETH on Base)
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/v2/tokens/${WETH_ADDRESS}`, {
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        const pairs = data?.pairs || [];
        if (pairs.length > 0) {
          const bestPair = pairs.reduce((best: any, pair: any) => {
            if (!best) return pair;
            const bestLiquidity = parseFloat(best.liquidity?.usd || '0');
            const pairLiquidity = parseFloat(pair.liquidity?.usd || '0');
            return pairLiquidity > bestLiquidity ? pair : best;
          }, null);

          if (bestPair?.priceUsd) {
            const price = parseFloat(bestPair.priceUsd);
            baseTokenPriceCache[cacheKey] = {
              price,
              timestamp: Date.now()
            };
            return price;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get ETH price, using fallback');
    }

    // Fallback: Use current ETH price (~$2500-3000 range)
    return 2800;
  }

  // Unknown base token, try to get price
  const price = await getCurrentPrice(tokenAddress);
  return price || 0;
}

/**
 * Calculate token price from swap amounts
 * This is the most accurate way - uses the actual swap ratio from the transaction
 */
export async function calculatePriceFromSwap(
  tokenAmount: bigint,
  baseTokenAmount: bigint,
  baseTokenAddress: string,
  tokenDecimals: number = 18,
  baseTokenDecimals: number = 18
): Promise<number | null> {
  try {
    // Validate inputs
    if (!tokenAmount || tokenAmount === BigInt(0)) {
      console.warn('calculatePriceFromSwap: tokenAmount is zero or missing');
      return null;
    }

    if (!baseTokenAmount || baseTokenAmount === BigInt(0)) {
      console.warn('calculatePriceFromSwap: baseTokenAmount is zero or missing');
      return null;
    }

    if (!baseTokenAddress) {
      console.warn('calculatePriceFromSwap: baseTokenAddress is missing');
      return null;
    }

    // Convert amounts to human-readable numbers
    const tokenAmountFloat = Number(ethers.formatUnits(tokenAmount, tokenDecimals));
    const baseTokenAmountFloat = Number(ethers.formatUnits(baseTokenAmount, baseTokenDecimals));

    if (tokenAmountFloat === 0 || baseTokenAmountFloat === 0 || !isFinite(tokenAmountFloat) || !isFinite(baseTokenAmountFloat)) {
      console.warn(`calculatePriceFromSwap: Invalid amounts - token: ${tokenAmountFloat}, base: ${baseTokenAmountFloat}`);
      return null;
    }

    // Price = baseTokenAmount / tokenAmount
    // This gives us price per token in base token units
    const priceInBaseToken = baseTokenAmountFloat / tokenAmountFloat;

    if (!isFinite(priceInBaseToken) || priceInBaseToken <= 0) {
      console.warn(`calculatePriceFromSwap: Invalid calculated price: ${priceInBaseToken}`);
      return null;
    }

    // Get USD price of base token
    const baseTokenPriceUsd = await getBaseTokenPrice(baseTokenAddress);

    if (!baseTokenPriceUsd || baseTokenPriceUsd <= 0) {
      console.warn(`calculatePriceFromSwap: Invalid base token price: ${baseTokenPriceUsd} for ${baseTokenAddress}`);
      return null;
    }

    // Convert to USD price
    const priceUsd = priceInBaseToken * baseTokenPriceUsd;

    if (!isFinite(priceUsd) || priceUsd <= 0) {
      console.warn(`calculatePriceFromSwap: Invalid final price: ${priceUsd}`);
      return null;
    }

    return priceUsd;
  } catch (error: any) {
    console.error('Error calculating price from swap:', error?.message || error);
    return null;
  }
}

/**
 * Get price at timestamp - calculates from swap amounts (most accurate)
 */
export async function getPriceAtTimestamp(
  tokenAddress: string,
  baseTokenAmount: bigint,
  baseTokenAddress: string,
  tokenAmount: bigint,
  timestamp: number,
  tokenDecimals: number = 18,
  baseTokenDecimals: number = 18
): Promise<number | null> {
  // Calculate from swap amounts (most accurate - uses actual swap ratio)
  const swapPrice = await calculatePriceFromSwap(
    tokenAmount,
    baseTokenAmount,
    baseTokenAddress,
    tokenDecimals,
    baseTokenDecimals
  );

  if (swapPrice && swapPrice > 0) {
    return swapPrice;
  }

  // Fallback: Try to get current price (approximation)
  const currentPrice = await getCurrentPrice(tokenAddress);
  return currentPrice;
}

