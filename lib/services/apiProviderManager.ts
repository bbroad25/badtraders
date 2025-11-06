// lib/services/apiProviderManager.ts
// Multi-provider API manager with intelligent routing and load balancing

import { ethers } from 'ethers';

const BASE_CHAIN_ID = 8453;

interface ProviderConfig {
  name: string;
  provider: ethers.Provider | null;
  apiKey: string | null;
  rateLimit: number; // requests per minute
  currentUsage: number;
  isHealthy: boolean;
  lastError: Date | null;
  priority: number; // Lower = higher priority
}

class ApiProviderManager {
  private providers: ProviderConfig[] = [];
  private currentIndex: number = 0;
  private usageResetInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeProviders();
    this.startUsageReset();
  }

  /**
   * Initialize all available providers
   */
  private initializeProviders(): void {
    // Alchemy - Best for general RPC calls
    if (process.env.ALCHEMY_API_KEY) {
      this.providers.push({
        name: 'alchemy',
        provider: new ethers.AlchemyProvider(BASE_CHAIN_ID, process.env.ALCHEMY_API_KEY),
        apiKey: process.env.ALCHEMY_API_KEY,
        rateLimit: 330, // Free tier: 330 req/sec
        currentUsage: 0,
        isHealthy: true,
        lastError: null,
        priority: 1
      });
    }

    // Infura - DISABLED: Using Bitquery instead
    // if (process.env.INFURA_API_KEY) {
    //   this.providers.push({
    //     name: 'infura',
    //     provider: new ethers.InfuraProvider(BASE_CHAIN_ID, process.env.INFURA_API_KEY),
    //     apiKey: process.env.INFURA_API_KEY,
    //     rateLimit: 100, // Free tier: 100 req/sec
    //     currentUsage: 0,
    //     isHealthy: true,
    //     lastError: null,
    //     priority: 2
    //   });
    // }

    // Moralis - Good for transaction decoding
    if (process.env.MORALIS_API_KEY) {
      // Note: Moralis doesn't provide standard ethers.Provider, but we can use their API for specific calls
      // For now, we'll use HTTP provider
      try {
        this.providers.push({
          name: 'moralis',
          provider: new ethers.JsonRpcProvider(`https://base-mainnet.g.moralis.io/v2/${process.env.MORALIS_API_KEY}`),
          apiKey: process.env.MORALIS_API_KEY,
          rateLimit: 200, // Free tier limits
          currentUsage: 0,
          isHealthy: true,
          lastError: null,
          priority: 3
        });
      } catch (error) {
        console.warn('Failed to initialize Moralis provider:', error);
      }
    }

    // Sort by priority
    this.providers.sort((a, b) => a.priority - b.priority);

    if (this.providers.length === 0) {
      console.warn('No API providers available! Using public RPC as fallback.');
      // Fallback to public RPC
      this.providers.push({
        name: 'public',
        provider: new ethers.JsonRpcProvider('https://mainnet.base.org'),
        apiKey: null,
        rateLimit: 10, // Very limited
        currentUsage: 0,
        isHealthy: true,
        lastError: null,
        priority: 999
      });
    }
  }

  /**
   * Reset usage counters every minute
   */
  private startUsageReset(): void {
    if (this.usageResetInterval) {
      clearInterval(this.usageResetInterval);
    }

    this.usageResetInterval = setInterval(() => {
      this.providers.forEach(p => {
        p.currentUsage = Math.max(0, p.currentUsage - p.rateLimit);
      });
    }, 60000); // Reset every minute
  }

  /**
   * Get a healthy provider with available capacity
   */
  async getProvider(): Promise<ethers.Provider> {
    // Try providers in priority order
    for (let attempt = 0; attempt < this.providers.length * 2; attempt++) {
      const provider = this.providers[this.currentIndex % this.providers.length];
      this.currentIndex++;

      // Check if provider is healthy and has capacity
      if (
        provider.isHealthy &&
        provider.provider &&
        provider.currentUsage < provider.rateLimit * 0.8 // Use 80% of rate limit
      ) {
        provider.currentUsage++;
        return provider.provider;
      }
    }

    // Fallback: return first available provider even if at capacity
    for (const provider of this.providers) {
      if (provider.isHealthy && provider.provider) {
        provider.currentUsage++;
        return provider.provider;
      }
    }

    throw new Error('No healthy providers available');
  }

  /**
   * Mark provider as unhealthy
   */
  markProviderUnhealthy(name: string): void {
    const provider = this.providers.find(p => p.name === name);
    if (provider) {
      provider.isHealthy = false;
      provider.lastError = new Date();
    }
  }

  /**
   * Mark provider as healthy
   */
  markProviderHealthy(name: string): void {
    const provider = this.providers.find(p => p.name === name);
    if (provider) {
      provider.isHealthy = true;
      provider.lastError = null;
    }
  }

  /**
   * Get provider health status
   */
  getProviderStatus(): Array<{ name: string; healthy: boolean; usage: number; rateLimit: number }> {
    return this.providers.map(p => ({
      name: p.name,
      healthy: p.isHealthy,
      usage: p.currentUsage,
      rateLimit: p.rateLimit
    }));
  }

  /**
   * Get best provider for a specific operation type
   */
  async getProviderForOperation(operation: 'getTransaction' | 'getReceipt' | 'getBlock' | 'getBalance'): Promise<ethers.Provider> {
    // For now, use round-robin with health checks
    // In the future, we could route specific operations to preferred providers
    // e.g., Moralis for getReceipt (better decoding), Alchemy for getBlock (faster)
    return this.getProvider();
  }

  /**
   * Get a specific provider by name (for parallel processing)
   */
  async getProviderByName(name: string): Promise<ethers.Provider | null> {
    const provider = this.providers.find(p => p.name === name && p.isHealthy && p.provider);
    if (provider) {
      provider.currentUsage++;
      return provider.provider;
    }
    return null;
  }

  /**
   * Get multiple providers for parallel tasks
   */
  async getProvidersForParallelTasks(count: number): Promise<ethers.Provider[]> {
    const providers: ethers.Provider[] = [];
    const healthyProviders = this.providers.filter(p => p.isHealthy && p.provider);

    for (let i = 0; i < count && i < healthyProviders.length; i++) {
      const provider = healthyProviders[i % healthyProviders.length];
      provider.currentUsage++;
      providers.push(provider.provider!);
    }

    // If we need more providers than available, reuse them
    while (providers.length < count) {
      const provider = healthyProviders[providers.length % healthyProviders.length];
      provider.currentUsage++;
      providers.push(provider.provider!);
    }

    return providers;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.usageResetInterval) {
      clearInterval(this.usageResetInterval);
      this.usageResetInterval = null;
    }
  }
}

// Singleton instance
let managerInstance: ApiProviderManager | null = null;

export function getApiProviderManager(): ApiProviderManager {
  if (!managerInstance) {
    managerInstance = new ApiProviderManager();
  }
  return managerInstance;
}

// Export convenience methods
export async function getProvider(): Promise<ethers.Provider> {
  return getApiProviderManager().getProvider();
}

export async function getProviderForOperation(operation: 'getTransaction' | 'getReceipt' | 'getBlock' | 'getBalance'): Promise<ethers.Provider> {
  return getApiProviderManager().getProviderForOperation(operation);
}

