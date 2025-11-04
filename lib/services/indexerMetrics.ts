// lib/services/indexerMetrics.ts
// Real-time metrics and status tracking for the indexer

export interface WorkerStatus {
  active: number
  total: number
  completed: number
  failed: number
  currentBatch: number
  totalBatches: number
}

export interface IndexerStatus {
  isRunning: boolean
  startTime: Date | null
  currentWallet: string | null
  walletsProcessed: number
  walletsTotal: number
  transactionsProcessed: number
  transactionsTotal: number
  swapsProcessed: number
  swapsSkipped: number
  errors: number
  workerPool: WorkerStatus | null
  rateLimitHits: number
  lastRateLimitAt: Date | null
  estimatedTimeRemaining: number | null // seconds
}

// Global status object (in-memory, resets on server restart)
let indexerStatus: IndexerStatus = {
  isRunning: false,
  startTime: null,
  currentWallet: null,
  walletsProcessed: 0,
  walletsTotal: 0,
  transactionsProcessed: 0,
  transactionsTotal: 0,
  swapsProcessed: 0,
  swapsSkipped: 0,
  errors: 0,
  workerPool: null,
  rateLimitHits: 0,
  lastRateLimitAt: null,
  estimatedTimeRemaining: null,
};

/**
 * Get current indexer status
 */
export function getIndexerStatus(): IndexerStatus {
  return { ...indexerStatus };
}

/**
 * Reset indexer status (call when starting a new sync)
 */
export function resetIndexerStatus(totalWallets: number): void {
  indexerStatus = {
    isRunning: true,
    startTime: new Date(),
    currentWallet: null,
    walletsProcessed: 0,
    walletsTotal: totalWallets,
    transactionsProcessed: 0,
    transactionsTotal: 0,
    swapsProcessed: 0,
    swapsSkipped: 0,
    errors: 0,
    workerPool: null,
    rateLimitHits: 0,
    lastRateLimitAt: null,
    estimatedTimeRemaining: null,
  };
}

/**
 * Update current wallet being processed
 */
export function setCurrentWallet(walletAddress: string | null): void {
  indexerStatus.currentWallet = walletAddress;
}

/**
 * Update wallet progress
 */
export function updateWalletProgress(processed: number, total?: number): void {
  indexerStatus.walletsProcessed = processed;
  if (total !== undefined) {
    indexerStatus.walletsTotal = total;
  }
  updateEstimatedTimeRemaining();
}

/**
 * Update transaction progress
 */
export function updateTransactionProgress(processed: number, total: number): void {
  indexerStatus.transactionsProcessed = processed;
  indexerStatus.transactionsTotal = total;
  updateEstimatedTimeRemaining();
}

/**
 * Update swap counts
 */
export function updateSwapCounts(processed: number, skipped: number): void {
  indexerStatus.swapsProcessed = processed;
  indexerStatus.swapsSkipped = skipped;
}

/**
 * Increment error count
 */
export function incrementErrors(): void {
  indexerStatus.errors++;
}

/**
 * Update worker pool status
 */
export function updateWorkerPool(status: WorkerStatus): void {
  indexerStatus.workerPool = status;
}

/**
 * Record rate limit hit
 */
export function recordRateLimit(): void {
  indexerStatus.rateLimitHits++;
  indexerStatus.lastRateLimitAt = new Date();
}

/**
 * Mark indexer as stopped
 */
export function stopIndexer(): void {
  indexerStatus.isRunning = false;
  indexerStatus.currentWallet = null;
  indexerStatus.workerPool = null;
}

/**
 * Calculate estimated time remaining
 */
function updateEstimatedTimeRemaining(): void {
  if (!indexerStatus.startTime || indexerStatus.walletsTotal === 0) {
    indexerStatus.estimatedTimeRemaining = null;
    return;
  }

  const elapsed = (Date.now() - indexerStatus.startTime.getTime()) / 1000; // seconds
  const walletsPerSecond = indexerStatus.walletsProcessed / elapsed;

  if (walletsPerSecond > 0) {
    const remaining = indexerStatus.walletsTotal - indexerStatus.walletsProcessed;
    indexerStatus.estimatedTimeRemaining = Math.ceil(remaining / walletsPerSecond);
  } else {
    indexerStatus.estimatedTimeRemaining = null;
  }
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(seconds: number | null): string {
  if (seconds === null) return 'Calculating...';

  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

