// lib/services/indexerLogger.ts
// Real-time log capture for indexer - like terminal output

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  metadata?: any;
}

// In-memory log buffer (stores last 1000 entries)
const logBuffer: LogEntry[] = [];
const MAX_LOG_ENTRIES = 1000;

/**
 * Add a log entry
 */
export function log(level: LogEntry['level'], message: string, metadata?: any): void {
  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    metadata,
  };

  logBuffer.push(entry);

  // Keep only last MAX_LOG_ENTRIES
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }

  // Also log to console for debugging
  const consoleMethod = level === 'error' ? console.error :
                        level === 'warn' ? console.warn :
                        console.log;
  consoleMethod(`[INDEXER ${level.toUpperCase()}] ${message}`, metadata || '');
}

/**
 * Convenience methods
 */
export function logInfo(message: string, metadata?: any): void {
  log('info', message, metadata);
}

export function logWarn(message: string, metadata?: any): void {
  log('warn', message, metadata);
}

export function logError(message: string, metadata?: any): void {
  log('error', message, metadata);
}

export function logSuccess(message: string, metadata?: any): void {
  log('success', message, metadata);
}

/**
 * Get recent log entries
 */
export function getLogs(limit: number = 500): LogEntry[] {
  return logBuffer.slice(-limit);
}

/**
 * Get logs since a specific timestamp
 */
export function getLogsSince(timestamp: Date): LogEntry[] {
  return logBuffer.filter(entry => entry.timestamp > timestamp);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logBuffer.length = 0;
}

/**
 * Get log count
 */
export function getLogCount(): number {
  return logBuffer.length;
}

