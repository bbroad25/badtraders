#!/usr/bin/env tsx
/**
 * Script to recalculate PnL for contest registrations locally
 * Useful for fixing calculation bugs or updating prices
 *
 * Usage:
 *   tsx scripts/recalculate-contest-pnl.ts [--contest-id=123] [--registration-id=456] [--all]
 *
 * Options:
 *   --contest-id: Recalculate all registrations for a specific contest
 *   --registration-id: Recalculate a specific registration
 *   --all: Recalculate all registrations (use with caution)
 */

import 'dotenv/config';
import { query } from '../lib/db/connection';
import { calculateUserPnL } from '../lib/services/userIndexerService';

interface RecalcOptions {
  contestId?: number;
  registrationId?: number;
  all?: boolean;
}

async function recalculatePnL(options: RecalcOptions) {
  console.log('🔄 Starting PnL recalculation...');
  console.log(`   Options:`, options);
  console.log('');

  let registrationsToProcess: any[] = [];

  if (options.registrationId) {
    // Recalculate specific registration
    console.log(`📋 Fetching registration ${options.registrationId}...`);
    const regResult = await query(
      `SELECT cr.*, wc.token_address
       FROM contest_registrations cr
       JOIN weekly_contests wc ON cr.contest_id = wc.id
       WHERE cr.id = $1`,
      [options.registrationId]
    );

    if (regResult.rows.length === 0) {
      console.error(`❌ Registration ${options.registrationId} not found`);
      process.exit(1);
    }

    registrationsToProcess = regResult.rows;
    console.log(`   Found 1 registration`);
  } else if (options.contestId) {
    // Recalculate all registrations for a contest
    console.log(`📋 Fetching registrations for contest ${options.contestId}...`);
    const regResult = await query(
      `SELECT cr.*, wc.token_address
       FROM contest_registrations cr
       JOIN weekly_contests wc ON cr.contest_id = wc.id
       WHERE cr.contest_id = $1`,
      [options.contestId]
    );

    registrationsToProcess = regResult.rows;
    console.log(`   Found ${registrationsToProcess.length} registration(s)`);
  } else if (options.all) {
    // Recalculate all registrations
    console.log(`📋 Fetching all registrations...`);
    const regResult = await query(
      `SELECT cr.*, wc.token_address
       FROM contest_registrations cr
       JOIN weekly_contests wc ON cr.contest_id = wc.id
       ORDER BY cr.id ASC`
    );

    registrationsToProcess = regResult.rows;
    console.log(`   Found ${registrationsToProcess.length} registration(s)`);
  } else {
    console.error('❌ Please provide --contest-id, --registration-id, or --all');
    process.exit(1);
  }

  if (registrationsToProcess.length === 0) {
    console.log('✅ No registrations to process');
    process.exit(0);
  }

  console.log('');
  console.log('🔄 Recalculating PnL...');
  console.log('');

  const results = {
    total: registrationsToProcess.length,
    successful: 0,
    failed: 0,
    updated: [] as any[],
    errors: [] as any[]
  };

  // Process each registration
  for (let i = 0; i < registrationsToProcess.length; i++) {
    const reg = registrationsToProcess[i];
    const progress = `[${i + 1}/${registrationsToProcess.length}]`;

    try {
      process.stdout.write(`${progress} Processing registration ${reg.id} (${reg.wallet_address.slice(0, 10)}...)... `);

      // Get token address
      const tokenAddress = reg.token_address;
      const previousPnL = reg.current_pnl ? parseFloat(reg.current_pnl.toString()) : null;

      // Recalculate PnL
      const newPnL = await calculateUserPnL(reg.id, tokenAddress);

      // Update registration
      await query(
        `UPDATE contest_registrations
         SET pnl_calculated_at = NOW(), current_pnl = $1, updated_at = NOW()
         WHERE id = $2`,
        [newPnL, reg.id]
      );

      results.successful++;
      results.updated.push({
        registrationId: reg.id,
        walletAddress: reg.wallet_address,
        previousPnL,
        newPnL
      });

      const pnlChange = previousPnL !== null ? (newPnL - previousPnL).toFixed(2) : 'N/A';
      console.log(`✅ PnL: $${newPnL.toFixed(2)} (change: ${pnlChange})`);
    } catch (error: any) {
      results.failed++;
      results.errors.push({
        registrationId: reg.id,
        walletAddress: reg.wallet_address,
        error: error.message
      });
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ Recalculation complete!');
  console.log('='.repeat(60));
  console.log('');
  console.log('📊 Summary:');
  console.log(`   Total: ${results.total}`);
  console.log(`   Successful: ${results.successful}`);
  console.log(`   Failed: ${results.failed}`);
  console.log('');

  if (results.errors.length > 0) {
    console.log('❌ Errors:');
    results.errors.slice(0, 10).forEach((err) => {
      console.log(`   Registration ${err.registrationId}: ${err.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`   ... and ${results.errors.length - 10} more`);
    }
    console.log('');
  }

  if (results.updated.length > 0 && results.updated.length <= 20) {
    console.log('📋 Updated Registrations:');
    results.updated.forEach((update) => {
      const change = update.previousPnL !== null
        ? ` (${update.newPnL >= update.previousPnL ? '+' : ''}${(update.newPnL - update.previousPnL).toFixed(2)})`
        : ' (new)';
      console.log(`   Registration ${update.registrationId}: $${update.previousPnL?.toFixed(2) || 'N/A'} → $${update.newPnL.toFixed(2)}${change}`);
    });
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

async function main() {
  console.log('🔧 Contest PnL Recalculation Script');
  console.log('');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: RecalcOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--contest-id=')) {
      options.contestId = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--registration-id=')) {
      options.registrationId = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--all') {
      options.all = true;
    }
  }

  // Validate database connection
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  try {
    await query('SELECT 1');
    console.log('✅ Database connection verified');
    console.log('');
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }

  // Confirm if recalculating all
  if (options.all) {
    console.log('⚠️  WARNING: You are about to recalculate PnL for ALL contest registrations.');
    console.log('   This may take a while and will update all records.');
    console.log('');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');
  }

  await recalculatePnL(options);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { recalculatePnL };

