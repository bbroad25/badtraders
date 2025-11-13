#!/usr/bin/env tsx
/**
 * Script to run eligibility cleanup locally
 *
 * Usage:
 *   tsx scripts/run-cleanup.ts [--no-remove]
 *
 * Options:
 *   --no-remove: Only update eligibility_status, don't remove from indexing
 */

import 'dotenv/config';
import { cleanupIneligibleUsers } from '../lib/services/eligibilityCleanupService';

async function main() {
  // Check if --no-remove flag is set
  const removeFromIndexing = !process.argv.includes('--no-remove');

  console.log('🧹 Starting eligibility cleanup...');
  console.log(`   Remove from indexing: ${removeFromIndexing ? 'YES' : 'NO'}`);
  console.log('');

  try {
    const result = await cleanupIneligibleUsers(removeFromIndexing);

    console.log('');
    console.log('✅ Cleanup complete!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Total checked: ${result.totalChecked}`);
    console.log(`   Still eligible: ${result.stillEligible}`);
    console.log(`   No longer eligible: ${result.noLongerEligible}`);
    console.log(`   Removed from indexing: ${result.removedFromIndexing}`);
    console.log(`   Errors: ${result.errors}`);
    console.log('');

    if (result.details.length > 0) {
      console.log('📋 Details (first 20):');
      result.details.slice(0, 20).forEach((detail, index) => {
        const status = detail.action === 'kept' ? '✅' : detail.action === 'removed' ? '❌' : '⚠️';
        console.log(`   ${index + 1}. ${status} FID ${detail.fid} (${detail.username || 'no username'})`);
        console.log(`      Wallet: ${detail.walletAddress}`);
        console.log(`      Balance: ${detail.currentBalance.toLocaleString()}`);
        console.log(`      Threshold: ${detail.threshold.toLocaleString()}`);
        console.log(`      Action: ${detail.action}`);
        console.log('');
      });

      if (result.details.length > 20) {
        console.log(`   ... and ${result.details.length - 20} more`);
      }
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error running cleanup:', error);
    process.exit(1);
  }
}

main();

