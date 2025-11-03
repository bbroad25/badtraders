// Quick test script to check wallets and trigger sync
import { query } from '../lib/db/connection';
import { syncWalletTransactions, syncAllWallets } from '../lib/services/indexerService';

async function main() {
  console.log('=== Indexer Test Script ===\n');

  // Check registered users
  console.log('1. Checking registered users...');
  const usersResult = await query(
    'SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true'
  );
  const wallets = usersResult.rows.map((row: any) => row.wallet_address);
  console.log(`   Found ${wallets.length} registered wallets`);

  if (wallets.length === 0) {
    console.log('\n   ❌ No registered wallets found!');
    console.log('   Users need to register first via /api/register');
    process.exit(0);
  }

  // Check wallets table
  console.log('\n2. Checking wallets table...');
  const walletsResult = await query('SELECT wallet_address, last_synced_block FROM wallets');
  console.log(`   Found ${walletsResult.rows.length} wallets in sync table`);

  // Check tracked tokens
  console.log('\n3. Checking tracked tokens...');
  const tokensResult = await query('SELECT * FROM tracked_tokens');
  console.log(`   Found ${tokensResult.rows.length} tracked tokens`);
  tokensResult.rows.forEach((row: any) => {
    console.log(`   - ${row.symbol}: ${row.token_address}`);
  });

  // Run sync
  console.log('\n4. Running sync for all wallets...');
  try {
    await syncAllWallets();
    console.log('   ✅ Sync completed!');
  } catch (error: any) {
    console.error('   ❌ Sync failed:', error.message);
    throw error;
  }

  // Check results
  console.log('\n5. Checking results...');
  const tradesResult = await query('SELECT COUNT(*) as count FROM trades');
  const positionsResult = await query('SELECT COUNT(*) as count FROM positions');
  console.log(`   Trades found: ${tradesResult.rows[0].count}`);
  console.log(`   Positions found: ${positionsResult.rows[0].count}`);

  console.log('\n=== Done ===');
  process.exit(0);
}

main().catch(console.error);


