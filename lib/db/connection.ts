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

    // Determine SSL config - Supabase requires SSL but uses certificates that may not be in Node's trust store
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

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

    pgPool = new Pool({
      connectionString,
      max: 2, // Allow 2 connections to handle concurrent requests during sync
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 60000, // 60 seconds - wait longer for pooler
      ssl: sslConfig
    });

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
    // If connection was terminated, reset pool and retry once
    // Don't reset on timeout - that just means pooler is busy, connection is still valid
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('shutdown') ||
        errorMessage.includes('db_termination') ||
        errorMessage.includes('terminated') ||
        errorMessage.includes('Connection terminated')) {
      console.warn('Connection terminated, resetting pool and retrying...', errorMessage);
      pgPool = null;
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      pool = getSupabasePool();
      try {
        const retryResult = await pool.query(text, params);
        return retryResult;
      } catch (retryError) {
        console.error('Supabase query error on retry:', retryError);
        throw retryError;
      }
    }
    // For timeout errors, just throw - don't reset pool (pooler is just busy)
    console.error('Supabase query error:', error);
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
