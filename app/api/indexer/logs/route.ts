// app/api/indexer/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getLogs, getLogsSince } from '@/lib/services/indexerLogger';

// Suppress Next.js logging for this polling endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const since = searchParams.get('since');

    let logs;
    if (since) {
      const sinceDate = new Date(since);
      logs = getLogsSince(sinceDate);
    } else if (limit) {
      logs = getLogs(parseInt(limit));
    } else {
      logs = getLogs();
    }

    return NextResponse.json({
      success: true,
      logs
    });
  } catch (error: any) {
    console.error('Error fetching indexer logs:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch logs',
        message: error?.message
      },
      { status: 500 }
    );
  }
}

