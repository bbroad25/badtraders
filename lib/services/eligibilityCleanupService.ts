// lib/services/eligibilityCleanupService.ts
// Service to check and clean up users who no longer hold required tokens

import { query } from '@/lib/db/connection';
import { getBadTradersBalance } from './tokenService';
import { logInfo, logError } from './indexerLogger';

const FARCASTER_ELIGIBILITY_THRESHOLD = 1_000_000; // 1M tokens for Farcaster users
const WEBSITE_ELIGIBILITY_THRESHOLD = 2_000_000; // 2M tokens for website users

interface CleanupResult {
  totalChecked: number;
  stillEligible: number;
  noLongerEligible: number;
  removedFromIndexing: number;
  errors: number;
  details: {
    fid: number;
    walletAddress: string;
    username: string | null;
    previousBalance: number;
    currentBalance: number;
    threshold: number;
    action: 'kept' | 'removed' | 'error';
  }[];
}

/**
 * Clean up users who no longer hold required tokens
 * Checks all registered users (opt_in_status = true) and:
 * - Updates eligibility_status if balance is below threshold
 * - Optionally sets opt_in_status = false to remove from indexing
 *
 * @param removeFromIndexing - If true, sets opt_in_status = false for ineligible users
 * @returns CleanupResult with statistics
 */
export async function cleanupIneligibleUsers(
  removeFromIndexing: boolean = true
): Promise<CleanupResult> {
  logInfo('[EligibilityCleanup] Starting cleanup of ineligible users...');

  const result: CleanupResult = {
    totalChecked: 0,
    stillEligible: 0,
    noLongerEligible: 0,
    removedFromIndexing: 0,
    errors: 0,
    details: []
  };

  try {
    // Get all registered users
    const usersResult = await query(
      'SELECT id, fid, username, wallet_address, eligibility_status FROM users WHERE opt_in_status = true'
    );

    const users = usersResult.rows;
    result.totalChecked = users.length;

    logInfo(`[EligibilityCleanup] Checking ${users.length} registered users...`);

    // Check each user's balance
    for (const user of users) {
      try {
        const walletAddress = user.wallet_address;
        const fid = user.fid;
        const username = user.username;
        const previousEligible = user.eligibility_status;

        // Determine threshold based on whether user has FID (Farcaster user)
        // If fid exists, they're a Farcaster user (lower threshold)
        const threshold = fid ? FARCASTER_ELIGIBILITY_THRESHOLD : WEBSITE_ELIGIBILITY_THRESHOLD;

        // Get current balance
        const currentBalance = await getBadTradersBalance(walletAddress);
        const isEligible = currentBalance >= threshold;

        // Update eligibility status if it changed
        if (previousEligible !== isEligible) {
          await query(
            'UPDATE users SET eligibility_status = $1, updated_at = NOW() WHERE fid = $2',
            [isEligible, fid]
          );
          logInfo(`[EligibilityCleanup] Updated eligibility for FID ${fid}: ${previousEligible} -> ${isEligible}`);
        }

        if (isEligible) {
          result.stillEligible++;
          result.details.push({
            fid,
            walletAddress,
            username,
            previousBalance: currentBalance, // We don't track previous, so use current
            currentBalance,
            threshold,
            action: 'kept'
          });
        } else {
          result.noLongerEligible++;

          // Remove from indexing if requested
          if (removeFromIndexing) {
            await query(
              'UPDATE users SET opt_in_status = false, updated_at = NOW() WHERE fid = $1',
              [fid]
            );
            result.removedFromIndexing++;
            logInfo(`[EligibilityCleanup] Removed FID ${fid} (${username || 'no username'}) from indexing - balance: ${currentBalance.toLocaleString()}, threshold: ${threshold.toLocaleString()}`);
          }

          result.details.push({
            fid,
            walletAddress,
            username,
            previousBalance: currentBalance,
            currentBalance,
            threshold,
            action: removeFromIndexing ? 'removed' : 'kept'
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        result.errors++;
        logError(`[EligibilityCleanup] Error checking user ${user.fid}: ${error.message}`);
        result.details.push({
          fid: user.fid,
          walletAddress: user.wallet_address,
          username: user.username,
          previousBalance: 0,
          currentBalance: 0,
          threshold: 0,
          action: 'error'
        });
      }
    }

    logInfo(`[EligibilityCleanup] Cleanup complete: ${result.stillEligible} eligible, ${result.noLongerEligible} ineligible, ${result.removedFromIndexing} removed from indexing, ${result.errors} errors`);

  } catch (error: any) {
    logError(`[EligibilityCleanup] Fatal error during cleanup: ${error.message}`);
    throw error;
  }

  return result;
}

