import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * GET /api/contests/list
 *
 * Get list of active contests
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'active';

    const result = await query(
      `SELECT
        id,
        token_address,
        token_symbol,
        start_date,
        end_date,
        status,
        created_at
      FROM weekly_contests
      WHERE status = $1
      ORDER BY start_date DESC
      LIMIT 10`,
      [status]
    );

    const contests = result.rows.map(row => ({
      id: row.id,
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol || null,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      createdAt: row.created_at
    }));

    return NextResponse.json({
      success: true,
      contests
    });

  } catch (error: any) {
    console.error('Error fetching contests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contests', message: error.message },
      { status: 500 }
    );
  }
}

