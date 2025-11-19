import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

// Hardcoded admin FIDs (matches other admin routes)
const ADMIN_FIDS = [474867, 7212];

/**
 * POST /api/admin/contests/create
 *
 * Create a new weekly contest
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : null;

    if (!fid || !ADMIN_FIDS.includes(fid)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tokenAddress, tokenSymbol, startDate, endDate } = body;

    if (!tokenAddress || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'tokenAddress, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Create contest
    // Note: start_block and end_block columns don't exist in the table schema
    const result = await query(
      `INSERT INTO weekly_contests
       (token_address, token_symbol, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
       RETURNING id, token_address, token_symbol, start_date, end_date, status`,
      [
        tokenAddress,
        tokenSymbol || null,
        new Date(startDate),
        new Date(endDate)
      ]
    );

    const contest = result.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Contest created successfully',
      contest: {
        id: contest.id,
        tokenAddress: contest.token_address,
        tokenSymbol: contest.token_symbol,
        startDate: contest.start_date,
        endDate: contest.end_date,
        status: contest.status
      }
    });

  } catch (error: any) {
    console.error('Error creating contest:', error);
    return NextResponse.json(
      { error: 'Failed to create contest', message: error.message },
      { status: 500 }
    );
  }
}

