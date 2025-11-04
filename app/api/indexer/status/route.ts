import { NextResponse } from 'next/server';
import { getIndexerStatus } from '@/lib/services/indexerMetrics';

/**
 * Get real-time indexer status
 * This endpoint returns the current state of the indexer including:
 * - Worker pool status
 * - Progress metrics
 * - Rate limit information
 * - Estimated time remaining
 */
export async function GET() {
  try {
    const status = getIndexerStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Error getting indexer status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get indexer status',
        message: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

