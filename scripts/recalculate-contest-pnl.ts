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
import { query, closePool } from '../lib/db/connection';
import { getCurrentPrice } from '../lib/services/priceService';

/**
 * Calculate user PnL - script-specific version that uses the standard connection
 * This is a copy of calculateUserPnL from userIndexerService but uses our query function
 */
async function calculateUserPnL(
  registrationId: number,
  tokenAddress: string
): Promise<number> {
  // Get all trades for this registration
  const tradesResult = await query(
    `SELECT * FROM user_trades
     WHERE registration_id = $1 AND token_address = $2
     ORDER BY timestamp ASC, block_number ASC`,
    [registrationId, tokenAddress.toLowerCase()]
  );

  const trades = tradesResult.rows;

  if (trades.length === 0) {
    return 0;
  }

  // FIFO PnL calculation
  let position = 0; // Net position in tokens
  let costBasis = 0; // Total cost basis in USD
  let realizedPnL = 0;

  for (const trade of trades) {
    // Parse NUMERIC fields (they may be strings from database)
    const amountIn = typeof trade.amount_in === 'string' ? parseFloat(trade.amount_in) : Number(trade.amount_in || 0);
    const amountOut = typeof trade.amount_out === 'string' ? parseFloat(trade.amount_out) : Number(trade.amount_out || 0);
    const priceUsd = typeof trade.price_usd === 'string' ? parseFloat(trade.price_usd) : Number(trade.price_usd || 0);

    if (trade.trade_type === 'buy') {
      // Buy: amount_out is tokens received, amount_in is payment
      const tokensReceived = amountOut;

      // Calculate cost basis
      let costBasisForBuy = 0;
      if (priceUsd > 0) {
        // If price_usd is per token
        costBasisForBuy = tokensReceived * priceUsd;
      } else {
        // Fallback: assume price_usd represents total value
        costBasisForBuy = amountIn > 0 ? amountIn : 0;
      }

      position += tokensReceived;
      costBasis += costBasisForBuy;
    } else if (trade.trade_type === 'sell') {
      // Sell: amount_in is tokens sold, amount_out is payment received
      const tokensSold = amountIn;

      if (position <= 0 || tokensSold <= 0) {
        continue; // Skip invalid sells
      }

      const avgCostPerToken = costBasis / position;
      const costOfSold = tokensSold * avgCostPerToken;

      // Calculate sell value
      let sellValue = 0;
      if (priceUsd > 0) {
        sellValue = tokensSold * priceUsd;
      } else {
        sellValue = amountOut; // Fallback to amount_out
      }

      const tradePnL = sellValue - costOfSold;
      realizedPnL += tradePnL;
      position -= tokensSold;
      costBasis -= costOfSold;

      if (costBasis < 0) {
        costBasis = 0; // Reset if negative
      }
    }
  }

  // Get current price for unrealized PnL
  let unrealizedPnL = 0;
  if (position > 0) {
    try {
      const currentPrice = await getCurrentPrice(tokenAddress);
      if (currentPrice && currentPrice > 0) {
        const avgCostPerToken = costBasis / position;
        unrealizedPnL = position * (currentPrice - avgCostPerToken);
      }
    } catch (error: any) {
      // Continue without unrealized PnL if price fetch fails
    }
  }

  const totalPnL = realizedPnL + unrealizedPnL;
  return totalPnL;
}

async function closeConnection() {
  await closePool();
  console.log('✅ Database connection closed');
}

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

  // Close database connection
  await closeConnection();

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
    // Test connection with retry logic built into query function
    const testResult = await query('SELECT 1 as test');
    if (testResult.rows && testResult.rows[0]?.test === 1) {
      console.log('✅ Database connection verified');
      console.log('');
    } else {
      throw new Error('Connection test query returned unexpected result');
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // If it's a connection termination error, the retry should have handled it
    if (errorMessage.includes('shutdown') ||
        errorMessage.includes('db_termination') ||
        errorMessage.includes('DbHandler exited')) {
      console.error('❌ Database connection unstable - pooler is terminating connections');
      console.error('   Error:', errorMessage);
    } else {
      console.error('❌ Database connection failed:', errorMessage);
    }
    console.error('');
    console.error('💡 Tip: Make sure your DATABASE_URL is set correctly in .env');
    await closeConnection();
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

  try {
    await recalculatePnL(options);
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    await closeConnection();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { recalculatePnL };

