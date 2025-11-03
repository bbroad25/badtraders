// lib/db/connection.ts
import { Pool } from 'pg';

let pgPool: Pool | null = null;

/**
 * Get PostgreSQL connection pool
 * Works the same way in dev and production - just uses DATABASE_URL
 */
function getPostgresPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set. Use PostgreSQL connection string (e.g., postgresql://user:pass@host/db)');
    }

    pgPool = new Pool({
      connectionString,
      max: 1, // Serverless-friendly: limit connections per function
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: connectionString.includes('localhost') ? false : {
        rejectUnauthorized: false
      }
    });

    pgPool.on('error', (err: Error) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  return pgPool;
}

/**
 * Execute a query (PostgreSQL only - same in dev and production)
 */
export async function query(text: string, params?: any[]) {
  const pool = getPostgresPool();
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('PostgreSQL query error:', error);
    throw error;
  }
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
