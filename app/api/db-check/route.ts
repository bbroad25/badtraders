import { NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * Database verification endpoint
 * GET /api/db-check
 *
 * Checks:
 * - Database connection
 * - All required tables exist
 * - Can query from tables
 */
export async function GET() {
  const results: {
    connection: { status: string; message?: string };
    tables: { name: string; exists: boolean; rowCount?: number }[];
    errors: string[];
  } = {
    connection: { status: 'unknown' },
    tables: [],
    errors: [],
  };

  // Check 1: Database Connection
  try {
    await query('SELECT 1');
    results.connection = { status: 'ok', message: 'Database connection successful' };
  } catch (error: any) {
    results.connection = {
      status: 'error',
      message: error?.message || 'Connection failed',
    };
    results.errors.push(`Connection error: ${error?.message}`);
    return NextResponse.json(results, { status: 500 });
  }

  // Check 2: Verify tables exist and are queryable
  const requiredTables = ['users', 'daily_payouts', 'trading_metrics', 'leaderboard_cache'];

  for (const tableName of requiredTables) {
    try {
      // Try to query the table
      const result = await query(`SELECT COUNT(*) FROM ${tableName}`);
      const rowCount = parseInt(result.rows[0].count);

      results.tables.push({
        name: tableName,
        exists: true,
        rowCount,
      });
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      const exists = !errorMsg.includes('does not exist') && !errorMsg.includes('relation');

      results.tables.push({
        name: tableName,
        exists,
        rowCount: undefined,
      });

      if (!exists) {
        results.errors.push(`Table '${tableName}' does not exist. Run migration from DATABASE_MIGRATION_SETUP.md`);
      } else {
        results.errors.push(`Table '${tableName}' query error: ${errorMsg}`);
      }
    }
  }

  // Determine overall status
  const allTablesExist = results.tables.every((t) => t.exists);
  const hasErrors = results.errors.length > 0;

  const status = results.connection.status === 'ok' && allTablesExist && !hasErrors ? 200 : 500;

  return NextResponse.json(
    {
      status: status === 200 ? 'ok' : 'error',
      ...results,
      summary: {
        connection: results.connection.status === 'ok' ? '✅ Connected' : '❌ Failed',
        tablesCreated: results.tables.filter((t) => t.exists).length,
        tablesRequired: requiredTables.length,
        ready: status === 200,
      },
    },
    { status }
  );
}

