import { NextRequest, NextResponse } from 'next/server';
import { syncAllWallets, syncWalletTransactions } from '@/lib/services/indexerService';

/**
 * Manual sync endpoint for indexer
 *
 * This endpoint runs the indexer sync without requiring a cron secret.
 * It's designed for local use and manual triggers.
 *
 * Supports different sync modes:
 * - full: Sync all wallets from launch block
 * - incremental: Sync only new blocks (default)
 * - single: Sync a specific wallet address
 *
 * Note: On Vercel, this will still have time limits (10s Hobby, 60s Pro).
 * For production, use the standalone script (scripts/indexer.ts) on a separate service.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const syncMode = body.mode || 'full';
    const walletAddress = body.walletAddress;

    console.log(`Starting manual indexer sync (mode: ${syncMode})...`);
    const startTime = Date.now();

    // Run sync based on mode
    if (syncMode === 'single' && walletAddress) {
      // Sync single wallet
      if (!walletAddress || !walletAddress.startsWith('0x')) {
        return NextResponse.json(
          { success: false, error: 'Invalid wallet address' },
          { status: 400 }
        );
      }
      await syncWalletTransactions(walletAddress);
    } else if (syncMode === 'incremental') {
      // Incremental sync - only sync wallets that haven't been synced to latest
      // This is the same as full for now, but could be optimized later
      await syncAllWallets();
    } else {
      // Full sync - all wallets
      await syncAllWallets();
    }

    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log(`Indexer sync completed in ${minutes}m ${seconds}s`);

    return NextResponse.json({
      success: true,
      message: 'Indexer sync completed',
      duration: `${minutes}m ${seconds}s`,
      durationMs: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in manual indexer sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Indexer sync failed',
        message: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also allow GET for convenience
export async function GET(request: NextRequest) {
  return POST(request);
}

