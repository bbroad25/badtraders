// lib/services/indexerMetrics.ts
// Real-time status tracking for indexer sync operations

export interface WorkerStatus {
  walletAddress: string;
  progress: number; // 0-100
  currentTask: string; // e.g., "Fetching transactions", "Processing swaps", "Syncing blocks 1000-2000"
  blocksProcessed?: number;
  blocksTotal?: number;
  blocksStart?: number; // Starting block number
  blocksEnd?: number; // Ending block number
  transfersFound?: number;
  transactionsProcessed?: number; // Transactions processed so far
  transactionsTotal?: number; // Total transactions to process
  swapsProcessed?: number;
  startTime: Date;
  lastUpdate: Date;
  elapsedSeconds?: number; // Time elapsed in seconds
  estimatedRemainingSeconds?: number; // Estimated time remaining in seconds
}

export interface IndexerStatus {
  isRunning: boolean;
  progress: number; // 0-100 - UNIFIED overall progress that never resets
  currentWallet: string | null;
  activeWorkers: string[]; // Array of wallet addresses being processed in parallel
  workerDetails: Map<string, WorkerStatus>; // Detailed status for each worker
  walletsTotal: number;
  walletsProcessed: number;
  tokensTotal: number; // Total tokens being synced
  tokensProcessed: number; // Tokens that have been synced
  tradesFound: number;
  errors: string[];
  startTime: Date | null;
  endTime: Date | null;
  lastUpdate: Date | null;
  elapsedSeconds?: number; // Overall elapsed time in seconds
  estimatedRemainingSeconds?: number; // Overall estimated time remaining in seconds
  currentTask?: string; // Overall current task description
}

let status: IndexerStatus = {
  isRunning: false,
  progress: 0,
  currentWallet: null,
  activeWorkers: [],
  workerDetails: new Map(),
  walletsTotal: 0,
  walletsProcessed: 0,
  tokensTotal: 0,
  tokensProcessed: 0,
  tradesFound: 0,
  errors: [],
  startTime: null,
  endTime: null,
  lastUpdate: null,
  currentTask: null
};

/**
 * Get current status (convert Map to array for JSON serialization)
 */
export function getStatus(): IndexerStatus {
  return {
    ...status,
    workerDetails: status.workerDetails // Map will be serialized properly
  };
}

/**
 * Update status
 */
export function updateStatus(updates: Partial<IndexerStatus>): void {
  status = {
    ...status,
    ...updates,
    lastUpdate: new Date()
  };
}

/**
 * Reset status (call at start of sync)
 */
export function resetStatus(): void {
  status = {
    isRunning: true,
    progress: 0,
    currentWallet: null,
    activeWorkers: [],
    workerDetails: new Map(),
    walletsTotal: 0,
    walletsProcessed: 0,
    tokensTotal: 0,
    tokensProcessed: 0,
    tradesFound: 0,
    errors: [],
    startTime: new Date(),
    endTime: null,
    lastUpdate: new Date()
  };
}

/**
 * Update token sync progress
 */
export function updateTokenProgress(tokensProcessed: number, tokensTotal: number): void {
  status.tokensProcessed = tokensProcessed;
  status.tokensTotal = tokensTotal;
  status.lastUpdate = new Date();
}

/**
 * Update worker status (what a specific worker is doing)
 */
export function updateWorkerStatus(
  walletAddress: string,
  updates: Partial<WorkerStatus>
): void {
  const wallet = walletAddress.toLowerCase();
  const existing = status.workerDetails.get(wallet) || {
    walletAddress: wallet,
    progress: 0,
    currentTask: 'Initializing...',
    startTime: new Date(),
    lastUpdate: new Date()
  };

  status.workerDetails.set(wallet, {
    ...existing,
    ...updates,
    lastUpdate: new Date()
  });

  status.lastUpdate = new Date();
}

/**
 * Remove worker status
 */
export function removeWorkerStatus(walletAddress: string): void {
  status.workerDetails.delete(walletAddress.toLowerCase());
  status.lastUpdate = new Date();
}

/**
 * Mark sync as complete
 */
export function markComplete(): void {
  status = {
    ...status,
    isRunning: false,
    progress: 100,
    endTime: new Date(),
    lastUpdate: new Date()
  };
}

/**
 * Mark sync as failed (preserves progress and error details)
 */
export function markFailed(errorMessage?: string): void {
  status = {
    ...status,
    isRunning: false,
    endTime: new Date(),
    lastUpdate: new Date()
  };

  if (errorMessage) {
    addError(errorMessage);
  }
}

/**
 * Add an error
 */
export function addError(error: string): void {
  status.errors.push(error);
  status.lastUpdate = new Date();

  // Keep only last 100 errors
  if (status.errors.length > 100) {
    status.errors.shift();
  }
}

/**
 * Update progress
 */
export function updateProgress(walletsProcessed: number, walletsTotal: number): void {
  status.walletsProcessed = walletsProcessed;
  status.walletsTotal = walletsTotal;
  status.progress = walletsTotal > 0 ? Math.round((walletsProcessed / walletsTotal) * 100) : 0;
  status.lastUpdate = new Date();
}

/**
 * Set current wallet being processed
 */
export function setCurrentWallet(walletAddress: string | null): void {
  status.currentWallet = walletAddress;
  status.lastUpdate = new Date();
}

/**
 * Add wallet to active workers
 */
export function addActiveWorker(walletAddress: string): void {
  if (!status.activeWorkers.includes(walletAddress)) {
    status.activeWorkers.push(walletAddress);
    status.lastUpdate = new Date();
  }
}

/**
 * Remove wallet from active workers
 */
export function removeActiveWorker(walletAddress: string): void {
  const wallet = walletAddress.toLowerCase();
  status.activeWorkers = status.activeWorkers.filter(w => w.toLowerCase() !== wallet);
  status.workerDetails.delete(wallet);
  status.lastUpdate = new Date();
}

/**
 * Set active workers (for batch processing)
 */
export function setActiveWorkers(walletAddresses: string[]): void {
  status.activeWorkers = walletAddresses;

  // Initialize worker status for new workers
  walletAddresses.forEach(wallet => {
    const walletLower = wallet.toLowerCase();
    if (!status.workerDetails.has(walletLower)) {
      status.workerDetails.set(walletLower, {
        walletAddress: walletLower,
        progress: 0,
        currentTask: 'Starting...',
        startTime: new Date(),
        lastUpdate: new Date()
      });
    }
  });

  // Remove workers that are no longer active
  const activeSet = new Set(walletAddresses.map(w => w.toLowerCase()));
  for (const [wallet] of status.workerDetails) {
    if (!activeSet.has(wallet)) {
      status.workerDetails.delete(wallet);
    }
  }

  status.lastUpdate = new Date();
}

/**
 * Increment trades found counter
 */
export function incrementTradesFound(count: number = 1): void {
  status.tradesFound += count;
  status.lastUpdate = new Date();
}

/**
 * Generate progress bar string
 * @param progress - Progress percentage (0-100)
 * @param width - Width of progress bar (default 30)
 * @returns Progress bar string like "[=====>    ] 45%"
 */
export function generateProgressBar(progress: number, width: number = 30): string {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  const bar = '='.repeat(filled) + '>'.repeat(filled > 0 ? 1 : 0) + ' '.repeat(empty);
  return `[${bar}] ${Math.round(progress)}%`;
}

/**
 * Format time duration
 * @param seconds - Duration in seconds
 * @returns Formatted string like "2m 14s" or "1h 23m"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Get detailed progress string for a worker
 * Format: Wallet: 0x1234...5678 | Blocks: 37581961 → 37754761 (45% | 78,000 / 173,000) | Txs: 234 | Swaps: 18 | Time: 2m 14s | ETA: 2m 56s
 */
export function getDetailedProgressString(worker: WorkerStatus): string {
  const parts: string[] = [];

  // Wallet address (shortened)
  const walletShort = worker.walletAddress.length > 10
    ? `${worker.walletAddress.slice(0, 6)}...${worker.walletAddress.slice(-4)}`
    : worker.walletAddress;
  parts.push(`Wallet: ${walletShort}`);

  // Block progress
  if (worker.blocksStart !== undefined && worker.blocksEnd !== undefined) {
    const currentBlock = worker.blocksProcessed !== undefined && worker.blocksTotal !== undefined
      ? worker.blocksStart + worker.blocksProcessed
      : worker.blocksStart;
    parts.push(`Blocks: ${worker.blocksStart.toLocaleString()} → ${worker.blocksEnd.toLocaleString()}`);
    if (worker.blocksProcessed !== undefined && worker.blocksTotal !== undefined) {
      const blockProgress = (worker.blocksProcessed / worker.blocksTotal) * 100;
      parts.push(`(${blockProgress.toFixed(1)}% | ${worker.blocksProcessed.toLocaleString()} / ${worker.blocksTotal.toLocaleString()})`);
    }
  } else if (worker.blocksProcessed !== undefined && worker.blocksTotal !== undefined) {
    parts.push(`Blocks: ${worker.blocksProcessed.toLocaleString()} / ${worker.blocksTotal.toLocaleString()}`);
  }

  // Transactions
  if (worker.transactionsProcessed !== undefined) {
    if (worker.transactionsTotal !== undefined) {
      parts.push(`Txs: ${worker.transactionsProcessed.toLocaleString()} / ${worker.transactionsTotal.toLocaleString()}`);
    } else {
      parts.push(`Txs: ${worker.transactionsProcessed.toLocaleString()}`);
    }
  }

  // Swaps
  if (worker.swapsProcessed !== undefined) {
    parts.push(`Swaps: ${worker.swapsProcessed.toLocaleString()}`);
  }

  // Time elapsed and ETA
  if (worker.elapsedSeconds !== undefined) {
    parts.push(`Time: ${formatDuration(worker.elapsedSeconds)}`);
  }
  if (worker.estimatedRemainingSeconds !== undefined) {
    parts.push(`ETA: ${formatDuration(worker.estimatedRemainingSeconds)}`);
  }

  return parts.join(' | ');
}

/**
 * Update worker status with calculated elapsed time and ETA
 */
export function updateWorkerStatusWithTiming(
  walletAddress: string,
  updates: Partial<WorkerStatus>
): void {
  const wallet = walletAddress.toLowerCase();
  const existing = status.workerDetails.get(wallet) || {
    walletAddress: wallet,
    progress: 0,
    currentTask: 'Initializing...',
    startTime: new Date(),
    lastUpdate: new Date()
  };

  // Calculate elapsed time
  const now = new Date();
  const elapsedMs = now.getTime() - existing.startTime.getTime();
  const elapsedSeconds = elapsedMs / 1000;

  // Calculate per-worker ETA if we have progress
  let estimatedRemainingSeconds: number | undefined;
  if (updates.progress !== undefined && updates.progress > 0 && updates.progress < 100) {
    const progressRate = updates.progress / elapsedSeconds; // progress per second
    if (progressRate > 0) {
      const remainingProgress = 100 - updates.progress;
      estimatedRemainingSeconds = remainingProgress / progressRate;
    }
  } else if (existing.progress > 0 && existing.progress < 100) {
    const progressRate = existing.progress / elapsedSeconds;
    if (progressRate > 0) {
      const remainingProgress = 100 - (updates.progress !== undefined ? updates.progress : existing.progress);
      estimatedRemainingSeconds = remainingProgress / progressRate;
    }
  }

  // Store both per-worker ETA and overall will have its own
  status.workerDetails.set(wallet, {
    ...existing,
    ...updates,
    elapsedSeconds,
    estimatedRemainingSeconds,
    lastUpdate: new Date()
  });

  status.lastUpdate = new Date();

  // Don't recalculate overall progress - it's managed by updateOverallProgress()
  // Only calculate ETA if we have overall progress
  if (status.startTime && status.progress > 0) {
    const now = new Date();
    const elapsedMs = now.getTime() - status.startTime.getTime();
    const elapsedSeconds = elapsedMs / 1000;
    status.elapsedSeconds = elapsedSeconds;

    if (status.progress > 1 && status.progress < 100 && elapsedSeconds > 0) {
      const progressRate = status.progress / elapsedSeconds;
      if (progressRate > 0) {
        const remainingProgress = 100 - status.progress;
        status.estimatedRemainingSeconds = remainingProgress / progressRate;
      }
    }
  }
}

/**
 * Update unified overall progress (0-100% across entire sync, never resets)
 * This is called directly from sync route to track sequential progress
 */
export function updateOverallProgress(progress: number, currentTask?: string): void {
  status.progress = Math.min(Math.max(progress, 0), 100); // Clamp between 0-100

  if (currentTask !== undefined) {
    status.currentTask = currentTask;
  }

  status.lastUpdate = new Date();

  // Calculate overall ETA based on overall progress
  if (status.startTime) {
    const now = new Date();
    const elapsedMs = now.getTime() - status.startTime.getTime();
    const elapsedSeconds = elapsedMs / 1000;
    status.elapsedSeconds = elapsedSeconds;

    // Only calculate ETA if we have meaningful progress (> 1%)
    if (status.progress > 1 && status.progress < 100 && elapsedSeconds > 0) {
      const progressRate = status.progress / elapsedSeconds; // progress per second
      if (progressRate > 0) {
        const remainingProgress = 100 - status.progress;
        status.estimatedRemainingSeconds = remainingProgress / progressRate;
      }
    } else {
      status.estimatedRemainingSeconds = undefined;
    }
  }
}

/**
 * Calculate overall progress from worker statuses and overall ETA
 */
function calculateOverallProgress(): void {
  const workers = Array.from(status.workerDetails.values());
  if (workers.length === 0) return;

  // Weighted average: transfers are ~70% of work, swaps are ~30%
  let totalProgress = 0;
  let totalWeight = 0;

  const transferWorker = workers.find(w => w.walletAddress === 'transfer-indexer');
  if (transferWorker) {
    totalProgress += transferWorker.progress * 0.7;
    totalWeight += 0.7;
  }

  const swapWorker = workers.find(w => w.walletAddress === 'swap-processor');
  if (swapWorker) {
    totalProgress += swapWorker.progress * 0.3;
    totalWeight += 0.3;
  }

  if (totalWeight > 0) {
    status.progress = Math.round(totalProgress / totalWeight);
  }

  // Calculate overall ETA based on overall progress and elapsed time
  if (status.startTime) {
    const now = new Date();
    const elapsedMs = now.getTime() - status.startTime.getTime();
    const elapsedSeconds = elapsedMs / 1000;
    status.elapsedSeconds = elapsedSeconds;

    // Only calculate ETA if we have meaningful progress (> 1%)
    if (status.progress > 1 && status.progress < 100 && elapsedSeconds > 0) {
      const progressRate = status.progress / elapsedSeconds; // progress per second
      if (progressRate > 0) {
        const remainingProgress = 100 - status.progress;
        status.estimatedRemainingSeconds = remainingProgress / progressRate;
      }
    } else {
      status.estimatedRemainingSeconds = undefined;
    }
  }

  status.lastUpdate = new Date();
}
