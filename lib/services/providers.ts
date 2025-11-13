// lib/services/providers.ts
import { ethers } from 'ethers';

const BASE_CHAIN_ID = 8453;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const INFURA_API_KEY = process.env.INFURA_API_KEY;

let primaryProvider: ethers.Provider | null = null;
let fallbackProvider: ethers.Provider | null = null;

/**
 * Get primary provider (Alchemy preferred, Infura fallback)
 */
export function getPrimaryProvider(): ethers.Provider | null {
  if (primaryProvider) {
    return primaryProvider;
  }

  if (ALCHEMY_API_KEY) {
    primaryProvider = new ethers.AlchemyProvider(BASE_CHAIN_ID, ALCHEMY_API_KEY);
    return primaryProvider;
  }

  // Infura - DISABLED: Using Bitquery instead
  // if (INFURA_API_KEY) {
  //   primaryProvider = new ethers.InfuraProvider(BASE_CHAIN_ID, INFURA_API_KEY);
  //   return primaryProvider;
  // }

  return null;
}

/**
 * Get fallback provider (Infura if Alchemy is primary, vice versa)
 */
export function getFallbackProvider(): ethers.Provider | null {
  if (fallbackProvider) {
    return fallbackProvider;
  }

  // Infura - DISABLED: Using Bitquery instead
  // If Alchemy is primary, Infura fallback disabled
  // if (ALCHEMY_API_KEY && INFURA_API_KEY) {
  //   fallbackProvider = new ethers.InfuraProvider(BASE_CHAIN_ID, INFURA_API_KEY);
  //   return fallbackProvider;
  // }

  // If Infura was primary, use Alchemy as fallback (but Infura is disabled)
  // if (INFURA_API_KEY && ALCHEMY_API_KEY) {
  //   fallbackProvider = new ethers.AlchemyProvider(BASE_CHAIN_ID, ALCHEMY_API_KEY);
  //   return fallbackProvider;
  // }

  return null;
}

/**
 * Execute a provider call with automatic fallback
 */
export async function callWithFallback<T>(
  fn: (provider: ethers.Provider) => Promise<T>
): Promise<T> {
  const primary = getPrimaryProvider();
  const fallback = getFallbackProvider();

  if (!primary) {
    throw new Error('No RPC provider available');
  }

  try {
    return await fn(primary);
  } catch (error) {
    console.warn('Primary provider failed, trying fallback:', error);

    if (fallback) {
      try {
        return await fn(fallback);
      } catch (fallbackError) {
        console.error('Fallback provider also failed:', fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * Get current block number with fallback
 */
export async function getCurrentBlockNumber(): Promise<number> {
  return await callWithFallback(async (provider) => {
    return await provider.getBlockNumber();
  });
}

/**
 * Get transaction with fallback
 */
export async function getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
  return await callWithFallback(async (provider) => {
    return await provider.getTransaction(txHash);
  });
}

/**
 * Get transaction receipt with fallback
 */
export async function getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
  return await callWithFallback(async (provider) => {
    return await provider.getTransactionReceipt(txHash);
  });
}

/**
 * Get block with fallback
 */
export async function getBlock(blockNumber: number): Promise<ethers.Block | null> {
  return await callWithFallback(async (provider) => {
    return await provider.getBlock(blockNumber);
  });
}


