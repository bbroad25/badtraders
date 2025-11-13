// lib/db/connection.ts
import { Pool } from 'pg';

let pgPool: Pool | null = null;

/**
 * Get Supabase connection pool
 * Works the same way in dev and production - just uses DATABASE_URL
 * Supabase uses standard PostgreSQL connection strings
 */
function getSupabasePool(): Pool {
  if (!pgPool) {
    let connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set. Use Supabase PostgreSQL connection string (e.g., postgresql://user:pass@host/db)');
    }

    // Log connection info (without password) for debugging
    const connectionInfo = connectionString.replace(/:[^:@]+@/, ':****@');
    console.log('[DB Connection] Original connection string:', connectionInfo);

    // Determine SSL config - Supabase requires SSL but uses certificates that may not be in Node's trust store
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    // Check if using pooler - if port is 5432 and it's a pooler URL, switch to transaction pooler port 6543
    // Transaction pooler (6543) is better for serverless/edge functions and handles timeouts better
    if (connectionString.includes('pooler.supabase.com') && connectionString.includes(':5432')) {
      connectionString = connectionString.replace(':5432', ':6543');
      console.log('[DB Connection] Switched to transaction pooler port 6543');
    }

    // Remove sslmode from connection string to avoid conflicts, we'll handle SSL via Pool config
    // This prevents the connection string's sslmode=require from conflicting with our SSL config
    connectionString = connectionString.replace(/[?&]sslmode=[^&$]*/, '');
    // Clean up any trailing ? or & after removal
    connectionString = connectionString.replace(/[?&]+$/, '');

    // For Supabase, always use SSL but don't reject unauthorized certificates
    // This is safe because we're using Supabase's pooler which is trusted
    const sslConfig = isLocalhost ? false : {
      rejectUnauthorized: false // Allow Supabase's self-signed/intermediate certificates
    };

    console.log('[DB Connection] Final connection string:', connectionString.replace(/:[^:@]+@/, ':****@'));
    console.log('[DB Connection] SSL config:', sslConfig);

    pgPool = new Pool({
      connectionString,
      max: 1, // Reduce to 1 connection - pooler handles concurrency
      idleTimeoutMillis: 10000, // 10 seconds
      connectionTimeoutMillis: 5000, // 5 seconds - fail fast
      ssl: sslConfig
    });

    console.log('[DB Connection] Pool created');

    pgPool.on('error', (err: Error) => {
      // Ignore connection termination errors from pooler - these are normal
      const errorMessage = err.message || String(err);
      if (!errorMessage.includes('shutdown') && !errorMessage.includes('db_termination')) {
        console.error('Unexpected error on idle database client', err);
      }
      // Reset pool on error to force reconnection
      pgPool = null;
    });
  }

  return pgPool;
}

/**
 * Execute a query (Supabase PostgreSQL - same in dev and production)
 */
export async function query(text: string, params?: any[]) {
  let pool = getSupabasePool();
  try {
    const result = await pool.query(text, params);
    return result;
    } catch (error: any) {
    const errorMessage = error?.message || String(error);

    // Log detailed error info
    console.error('[DB Query] Error:', {
      message: errorMessage,
      code: error?.code,
      query: text.substring(0, 100) + '...'
    });

    // If connection was terminated or timed out, reset pool and retry once
    if (errorMessage.includes('shutdown') ||
        errorMessage.includes('db_termination') ||
        errorMessage.includes('terminated') ||
        errorMessage.includes('Connection terminated') ||
        errorMessage.includes('timeout exceeded')) {
      console.warn('[DB Query] Connection issue detected, resetting pool and retrying...', errorMessage);
      pgPool = null;
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
      pool = getSupabasePool();
      try {
        console.log('[DB Query] Retrying query...');
        const retryResult = await pool.query(text, params);
        console.log('[DB Query] Retry succeeded');
        return retryResult;
      } catch (retryError: any) {
        console.error('[DB Query] Retry failed:', retryError?.message);
        throw retryError;
      }
    }

    // For other errors, just throw
    console.error('[DB Query] Query failed:', error);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to call client.release() when done!
 */
export async function getClient() {
  const pool = getSupabasePool();
  return await pool.connect();
}

/**
 * Close database connections (for cleanup in tests)
 */
export async function closePool() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}
