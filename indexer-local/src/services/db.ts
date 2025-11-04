/**
 * Database connection for local indexer
 * Connects to the same Supabase Postgres as production website
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

let pgPool: Pool | null = null;

/**
 * Get database connection pool
 */
export function getPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Handle SSL for Supabase
    // Remove sslmode from connection string to avoid conflicts
    let cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&$]*/, '');
    cleanConnectionString = cleanConnectionString.replace(/[?&]+$/, '');

    const isLocalhost = cleanConnectionString.includes('localhost') || cleanConnectionString.includes('127.0.0.1');
    const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

    pgPool = new Pool({
      connectionString: cleanConnectionString,
      max: 5, // Local indexer can use more connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, // Increased timeout for local connections
      ssl: sslConfig
    });

    pgPool.on('error', (err: Error) => {
      // Ignore connection termination errors from pooler - these are normal
      const errorMessage = err.message || String(err);
      if (!errorMessage.includes('shutdown') && !errorMessage.includes('db_termination')) {
        console.error('Unexpected database error:', err);
      }
      // Reset pool on error to force reconnection
      pgPool = null;
    });
  }

  return pgPool;
}

/**
 * Execute a query
 */
export async function query(text: string, params?: any[]) {
  let pool = getPool();
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error: any) {
    // If connection was terminated, reset pool and retry once
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('shutdown') || errorMessage.includes('db_termination') || errorMessage.includes('terminated')) {
      console.warn('Connection terminated, resetting pool and retrying...');
      pgPool = null;
      pool = getPool();
      try {
        const retryResult = await pool.query(text, params);
        return retryResult;
      } catch (retryError) {
        console.error('Database query error on retry:', retryError);
        throw retryError;
      }
    }
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Close database connections
 */
export async function closePool() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

