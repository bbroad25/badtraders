// lib/services/apiRouter.ts
// Intelligent API router that uses all available APIs in parallel for optimal performance

import { ethers } from 'ethers';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const INFURA_API_KEY = process.env.INFURA_API_KEY;
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const ZERION_API_KEY = process.env.ZERION_API_KEY;

const BASE_CHAIN_ID = 8453;

// Track which providers have failed auth to skip them
const failedAuthProviders = new Set<string>();

// Track rate-limited providers with backoff timestamps
const rateLimitedProviders = new Map<string, number>();

/**
 * Check if provider is rate limited and should be skipped
 */
function isRateLimited(providerName: string): boolean {
  const backoffUntil = rateLimitedProviders.get(providerName);
  if (!backoffUntil) return false;

  if (Date.now() < backoffUntil) {
    return true; // Still in backoff period
  }

  // Backoff expired, remove it
  rateLimitedProviders.delete(providerName);
  return false;
}

/**
 * Mark provider as rate limited with exponential backoff
 */
function markRateLimited(providerName: string, attempt: number = 1): void {
  // Exponential backoff: 2^attempt seconds (max 60 seconds)
  const backoffSeconds = Math.min(Math.pow(2, attempt), 60);
  const backoffUntil = Date.now() + (backoffSeconds * 1000);
  rateLimitedProviders.set(providerName, backoffUntil);
  console.warn(`[API Router] Provider ${providerName} rate limited - backing off for ${backoffSeconds}s`);
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.shortMessage || error?.message || error?.error?.message || String(error);
  const lowerMsg = errorMsg.toLowerCase();

  return lowerMsg.includes('rate limit') ||
         lowerMsg.includes('too many requests') ||
         lowerMsg.includes('compute units') ||
         lowerMsg.includes('exceeded') ||
         lowerMsg.includes('429') ||
         (error?.code === 429);
}

/**
 * Get all available providers (excluding ones that failed auth)
 */
export function getAvailableProviders(): Array<{ name: string; provider: ethers.Provider; priority: number }> {
  const providers: Array<{ name: string; provider: ethers.Provider; priority: number }> = [];

  if (ALCHEMY_API_KEY && !failedAuthProviders.has('alchemy') && !isRateLimited('alchemy')) {
    providers.push({
      name: 'alchemy',
      provider: new ethers.AlchemyProvider(BASE_CHAIN_ID, ALCHEMY_API_KEY),
      priority: 1
    });
  }

  // Infura - DISABLED: Using Bitquery instead
  // if (INFURA_API_KEY && !failedAuthProviders.has('infura') && !isRateLimited('infura')) {
  //   providers.push({
  //     name: 'infura',
  //     provider: new ethers.InfuraProvider(BASE_CHAIN_ID, INFURA_API_KEY),
  //     priority: 2
  //   });
  // }

  return providers.sort((a, b) => a.priority - b.priority);
}

/**
 * Execute RPC call in parallel across all providers, return first successful result
 */
export async function raceRpcCall<T>(
  method: string,
  params: any[],
  timeoutMs: number = 5000
): Promise<{ result: T; source: string }> {
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    throw new Error('No RPC providers available');
  }

  const promises = providers.map(async ({ name, provider }) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout for ${name}`)), timeoutMs);
    });

    try {
      // Use type assertion to call method dynamically on provider
      const result = await Promise.race([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (provider as any)[method](...params),
        timeoutPromise
      ]);
      return { result, source: name, success: true };
    } catch (error: any) {
      const errorMsg = error?.shortMessage || error?.message || String(error);

      // Check for auth errors and mark provider as failed
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('403')) {
        if (!failedAuthProviders.has(name)) {
          failedAuthProviders.add(name);
          console.warn(`[API Router] Provider ${name} authentication failed - skipping for future requests`);
        }
      }

      // Check for rate limit errors
      if (isRateLimitError(error)) {
        markRateLimited(name);
      }

      return { error, source: name, success: false };
    }
  });

  // Wait for all promises and return first successful result
  const results = await Promise.all(promises);

  // Find first successful result
  for (const result of results) {
    if (result.success && result.result !== undefined) {
      return { result: result.result, source: result.source };
    }
  }

  // If all failed, throw the first error
  const firstError = results.find(r => r.error);
  if (firstError?.error) {
    throw firstError.error;
  }

  throw new Error('All RPC providers failed');
}

/**
 * Parallel transaction fetching from multiple sources
 */
export async function getTransactionParallel(txHash: string): Promise<any> {
  const providers = getAvailableProviders();

  const promises = providers.map(async ({ name, provider }) => {
    try {
      const tx = await Promise.race([
        provider.getTransaction(txHash),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      return { tx, source: name };
    } catch (error: any) {
      const errorMsg = error?.shortMessage || error?.message || String(error);

      // Track auth failures
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('403')) {
        if (!failedAuthProviders.has(name)) {
          failedAuthProviders.add(name);
        }
      }

      // Track rate limit errors
      if (isRateLimitError(error)) {
        markRateLimited(name);
      }

      return { error, source: name };
    }
  });

  const results = await Promise.allSettled(promises);

  // Return first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.tx) {
      return result.value.tx;
    }
  }

  throw new Error('All transaction fetches failed');
}

/**
 * Parallel transaction receipt fetching
 */
export async function getTransactionReceiptParallel(txHash: string): Promise<any> {
  const providers = getAvailableProviders();

  const promises = providers.map(async ({ name, provider }) => {
    try {
      const receipt = await Promise.race([
        provider.getTransactionReceipt(txHash),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      return { receipt, source: name };
    } catch (error: any) {
      const errorMsg = error?.shortMessage || error?.message || String(error);

      // Track auth failures
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('403')) {
        if (!failedAuthProviders.has(name)) {
          failedAuthProviders.add(name);
        }
      }

      // Track rate limit errors
      if (isRateLimitError(error)) {
        markRateLimited(name);
      }

      return { error, source: name };
    }
  });

  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.receipt) {
      return result.value.receipt;
    }
  }

  throw new Error('All receipt fetches failed');
}

/**
 * Parallel block fetching
 */
export async function getBlockParallel(blockNumber: number): Promise<{ result: ethers.Block; source: string }> {
  try {
    return await raceRpcCall<ethers.Block>('getBlock', [blockNumber]);
  } catch (error: any) {
    // If all providers fail, log and rethrow
    console.error(`[API Router] Failed to get block ${blockNumber} from all providers:`, error?.message || error);
    throw error;
  }
}

/**
 * Parallel block number fetching
 */
export async function getBlockNumberParallel(): Promise<number> {
  try {
    const { result } = await raceRpcCall<number>('getBlockNumber', []);
    return result;
  } catch (error: any) {
    console.error('[API Router] Failed to get block number from all providers:', error?.message || error);
    throw error;
  }
}

/**
 * Check which APIs are available
 */
export function getAvailableApis() {
  return {
    alchemy: !!ALCHEMY_API_KEY,
    infura: !!INFURA_API_KEY,
    zerox: !!ZEROX_API_KEY,
    moralis: !!MORALIS_API_KEY,
    zerion: !!ZERION_API_KEY
  };
}

