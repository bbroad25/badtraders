// lib/db/connection.ts
import { Pool } from 'pg';
import Database from 'better-sqlite3';

let pgPool: Pool | null = null;
let sqliteDb: Database.Database | null = null;
let dbType: 'postgres' | 'sqlite' | null = null;

/**
 * Get or create a database connection
 * Automatically detects SQLite (file path) vs PostgreSQL (connection string)
 * - SQLite: Use for local dev (e.g., DATABASE_URL=./data/badtraders.db)
 * - PostgreSQL: Use for production (e.g., DATABASE_URL=postgresql://...)
 */
function getDbType(): 'postgres' | 'sqlite' {
  if (dbType) return dbType;

  const connectionString = process.env.DATABASE_URL || '';

  // If it's a file path (starts with ./ or / or just a filename), use SQLite
  if (connectionString.startsWith('./') ||
      connectionString.startsWith('/') ||
      (!connectionString.includes('://') && (connectionString.endsWith('.db') || connectionString.includes('.db')))) {
    dbType = 'sqlite';
  } else {
    dbType = 'postgres';
  }

  return dbType;
}

/**
 * Get PostgreSQL connection pool (for production/Vercel)
 */
function getPostgresPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
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

    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  return pgPool;
}

/**
 * Get SQLite database connection (for local development)
 */
function getSqliteDb(): Database.Database {
  if (!sqliteDb) {
    const dbPath = process.env.DATABASE_URL || './data/badtraders.db';
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL'); // Better performance
  }
  return sqliteDb;
}

/**
 * Execute a query (works with both PostgreSQL and SQLite)
 * Automatically handles parameter placeholders ($1 vs ?)
 */
export async function query(text: string, params?: any[]) {
  const dbType = getDbType();

  if (dbType === 'sqlite') {
    const db = getSqliteDb();
    try {
      // SQLite uses ? placeholders instead of $1, $2, etc.
      // Convert PostgreSQL-style params to SQLite
      let sql = text;
      if (params && params.length > 0) {
        // Simple conversion: replace $1, $2, etc. with ?
        sql = sql.replace(/\$(\d+)/g, '?');
      }
      const stmt = db.prepare(sql);
      const result = params ? stmt.all(...params) : stmt.all();
      return { rows: result as any[] };
    } catch (error) {
      console.error('SQLite query error:', error);
      throw error;
    }
  } else {
    // PostgreSQL
    const pool = getPostgresPool();
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
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
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  dbType = null;
}
