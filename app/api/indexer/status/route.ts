// app/api/indexer/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStatus } from '@/lib/services/indexerMetrics';
import { getBlockNumberParallel } from '@/lib/services/apiRouter';
import { query } from '@/lib/db/connection';

// Suppress Next.js logging for this polling endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Check if admin mode is enabled
    if (process.env.ENABLE_ADMIN_MODE !== 'true') {
      return NextResponse.json(
        { error: 'Admin mode is not enabled' },
        { status: 403 }
      );
    }

    const status = getStatus();

    // Convert Map to object for JSON serialization
    const workerDetailsObj: Record<string, any> = {};
    status.workerDetails.forEach((value, key) => {
      workerDetailsObj[key] = {
        ...value,
        startTime: value.startTime.toISOString(),
        lastUpdate: value.lastUpdate.toISOString()
      };
    });

    // Get current blockchain block number
    let currentBlock: number | null = null;
    try {
      currentBlock = await getBlockNumberParallel();
    } catch (error) {
      console.error('Error fetching current block:', error);
    }

    // Get last synced block (max block number from trades or token_transfers)
    let lastSyncedBlock: number | null = null;
    try {
      const result = await query(`
        SELECT GREATEST(
          COALESCE((SELECT MAX(block_number) FROM trades), 0),
          COALESCE((SELECT MAX(block_number) FROM token_transfers), 0)
        ) as max_block
      `);
      lastSyncedBlock = parseInt(result.rows[0]?.max_block || '0') || null;
    } catch (error) {
      console.error('Error fetching last synced block:', error);
    }

    // Calculate blocks behind
    let blocksBehind: number | null = null;
    if (currentBlock !== null && lastSyncedBlock !== null) {
      blocksBehind = Math.max(0, currentBlock - lastSyncedBlock);
    }

    return NextResponse.json({
      success: true,
      status: {
        ...status,
        workerDetails: workerDetailsObj,
        currentBlock,
        lastSyncedBlock,
        blocksBehind
      }
    });
  } catch (error: any) {
    console.error('Error fetching indexer status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch status',
        message: error?.message
      },
      { status: 500 }
    );
  }
}

