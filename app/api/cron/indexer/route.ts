import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Vercel Cron endpoint for indexer sync
 * Runs every 12 hours to sync all tokens
 * Calls the main sync endpoint instead of legacy indexerService
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

    // Call the main sync endpoint instead of legacy service
    // Sync uses incremental by default
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    try {
      const syncResponse = await fetch(`${baseUrl}/api/indexer/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CRON_SECRET}`
        },
        body: JSON.stringify({
          syncType: 'incremental',
          secret: CRON_SECRET
        })
      });

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Sync failed with status ${syncResponse.status}`);
      }

      const syncData = await syncResponse.json();
      const duration = Date.now() - startTime;

      console.log(`Indexer sync completed in ${duration}ms`);

      return NextResponse.json({
        success: true,
        message: 'Indexer sync completed',
        swapsProcessed: syncData.swapsProcessed || 0,
        walletsFound: syncData.walletsFound || 0,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      // Handle timeout or other errors
      const duration = Date.now() - startTime;
      console.error('Error in indexer sync:', error);

      // If timeout, return 200 so cron doesn't retry immediately
      if (error.message?.includes('timeout') || duration > 50000) {
        return NextResponse.json({
          success: false,
          message: 'Indexer sync timed out (partial sync may have completed)',
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        }, { status: 200 });
      }

      throw error;
    }
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

