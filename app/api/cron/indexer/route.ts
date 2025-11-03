import { NextRequest, NextResponse } from 'next/server';
import { syncAllWallets } from '@/lib/services/indexerService';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Vercel Cron endpoint for indexer sync
 * Runs every 12 hours to sync all registered wallets
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret from Authorization header
    const authHeader = request.headers.get('authorization');

    if (!CRON_SECRET) {
      console.error('CRON_SECRET not set in environment variables');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    // Vercel Cron sends secret in Authorization header: "Bearer <secret>"
    const expectedAuth = `Bearer ${CRON_SECRET}`;
    if (authHeader !== expectedAuth) {
      console.warn('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting indexer sync (cron)...');
    const startTime = Date.now();

    // Run sync for all wallets
    await syncAllWallets();

    const duration = Date.now() - startTime;
    console.log(`Indexer sync completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Indexer sync completed',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in indexer cron:', error);
    return NextResponse.json(
      {
        error: 'Indexer sync failed',
        message: error?.message
      },
      { status: 500 }
    );
  }
}

// Also allow POST for manual triggers (optional)
export async function POST(request: NextRequest) {
  return GET(request);
}

