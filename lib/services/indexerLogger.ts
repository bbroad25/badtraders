// lib/services/indexerLogger.ts
// In-memory logging system for indexer with real-time log access

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
}

const MAX_LOGS = 1000;
const logs: LogEntry[] = [];

/**
 * Add a log entry
 */
function addLog(level: LogLevel, message: string): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date()
  };

  logs.push(entry);

  // Keep only the most recent logs
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Also output to console
  switch (level) {
    case 'info':
      console.log(`[INDEXER] ${message}`);
      break;
    case 'warn':
      console.warn(`[INDEXER] ${message}`);
      break;
    case 'error':
      console.error(`[INDEXER] ${message}`);
      break;
    case 'success':
      console.log(`[INDEXER] ✓ ${message}`);
      break;
  }
}

/**
 * Log info message
 */
export function logInfo(message: string): void {
  addLog('info', message);
}

/**
 * Log warning message
 */
export function logWarn(message: string): void {
  addLog('warn', message);
}

/**
 * Log error message
 */
export function logError(message: string): void {
  addLog('error', message);
}

/**
 * Log success message
 */
export function logSuccess(message: string): void {
  addLog('success', message);
}

/**
 * Get all logs
 */
export function getLogs(limit?: number): LogEntry[] {
  if (limit) {
    return logs.slice(-limit);
  }
  return [...logs];
}

/**
 * Get logs since a specific timestamp
 */
export function getLogsSince(timestamp: Date): LogEntry[] {
  return logs.filter(log => log.timestamp >= timestamp);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logs.length = 0;
}

/**
 * Get log count
 */
export function getLogCount(): number {
  return logs.length;
}

