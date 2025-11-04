#!/usr/bin/env node
/**
 * Standalone Indexer Script
 *
 * This script can run independently of the Next.js app, either:
 * - Locally: npm run indexer
 * - On a separate service (Railway, Render, Fly.io, etc.)
 * - As a long-running process without time limits
 *
 * Usage:
 *   npm run indexer              # Run once and exit
 *   npm run indexer:watch       # Run continuously with intervals
 */

import { syncAllWallets } from '../lib/services/indexerService';
import { query } from '../lib/db/connection';

// Configuration
const SYNC_INTERVAL_MS = process.env.INDEXER_SYNC_INTERVAL
  ? parseInt(process.env.INDEXER_SYNC_INTERVAL)
  : 12 * 60 * 60 * 1000; // Default: 12 hours

const RUN_CONTINUOUSLY = process.env.INDEXER_CONTINUOUS === 'true';

/**
 * Run a single sync cycle
 */
async function runSync(): Promise<void> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Starting indexer sync at ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Check database connection
    await query('SELECT 1');
    console.log('✅ Database connection verified\n');

    // Check tracked tokens
    const tokensResult = await query('SELECT * FROM tracked_tokens');
    console.log(`📊 Tracking ${tokensResult.rows.length} token(s)`);
    tokensResult.rows.forEach((row: any) => {
      console.log(`   - ${row.symbol}: ${row.token_address}`);
    });
    console.log('');

    // Run sync
    await syncAllWallets();

    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Sync completed successfully in ${minutes}m ${seconds}s`);
    console.log(`${'='.repeat(60)}\n`);

    // Show summary stats
    const [tradesResult, positionsResult, walletsResult] = await Promise.all([
      query('SELECT COUNT(*) as count FROM trades'),
      query('SELECT COUNT(*) as count FROM positions'),
      query('SELECT COUNT(*) as count FROM wallets')
    ]);

    console.log('📈 Summary:');
    console.log(`   Trades: ${tradesResult.rows[0].count}`);
    console.log(`   Positions: ${positionsResult.rows[0].count}`);
    console.log(`   Wallets tracked: ${walletsResult.rows[0].count}`);
    console.log('');

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Sync failed after ${Math.floor(duration / 1000)}s`);
    console.error('Error:', error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('🔍 Indexer Service Starting...');
  console.log(`   Mode: ${RUN_CONTINUOUSLY ? 'Continuous (watch mode)' : 'Single run'}`);
  console.log(`   Sync interval: ${SYNC_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`   Database: ${process.env.DATABASE_URL ? '✅ Configured' : '❌ Missing DATABASE_URL'}`);
  console.log(`   Alchemy: ${process.env.ALCHEMY_API_KEY ? '✅ Configured' : '❌ Missing ALCHEMY_API_KEY'}`);

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!process.env.ALCHEMY_API_KEY) {
    console.error('\n❌ ALCHEMY_API_KEY environment variable is required');
    process.exit(1);
  }

  if (RUN_CONTINUOUSLY) {
    console.log('\n🔄 Running in continuous mode...\n');

    // Run immediately
    await runSync();

    // Then run on interval
    setInterval(async () => {
      try {
        await runSync();
      } catch (error) {
        console.error('Sync failed, will retry on next interval:', error);
        // Don't exit - continue running
      }
    }, SYNC_INTERVAL_MS);

    // Keep process alive
    console.log(`⏰ Next sync scheduled in ${SYNC_INTERVAL_MS / 1000 / 60} minutes\n`);
    console.log('Press Ctrl+C to stop\n');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      process.exit(0);
    });

  } else {
    // Single run
    console.log('\n▶️  Running single sync...\n');
    try {
      await runSync();
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Sync failed');
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runSync, main };

