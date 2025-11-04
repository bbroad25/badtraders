import { NextRequest, NextResponse } from 'next/server';
import { getLogs, getLogsSince } from '@/lib/services/indexerLogger';

/**
 * Get indexer logs (like terminal output)
 *
 * Query params:
 * - limit: Number of recent logs to return (default: 500)
 * - since: ISO timestamp to get logs since (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '500');
    const since = searchParams.get('since');

    let logs;
    if (since) {
      const sinceDate = new Date(since);
      logs = getLogsSince(sinceDate);
    } else {
      logs = getLogs(limit);
    }

    return NextResponse.json({
      logs,
      count: logs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error getting indexer logs:', error);
    return NextResponse.json(
      {
        error: 'Failed to get logs',
        message: error?.message || 'Unknown error',
        logs: []
      },
      { status: 500 }
    );
  }
}

