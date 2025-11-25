import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

// Hardcoded admin FIDs (matches other admin routes)
const ADMIN_FIDS = [474867, 7212];

/**
 * POST /api/admin/contests/archive
 *
 * Archive a contest by updating its status to 'completed'
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
    const { contestId } = body;

    if (!contestId) {
      return NextResponse.json(
        { error: 'contestId is required' },
        { status: 400 }
      );
    }

    // Verify contest exists
    const contestResult = await query(
      'SELECT * FROM weekly_contests WHERE id = $1',
      [contestId]
    );

    if (contestResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Contest not found' },
        { status: 404 }
      );
    }

    const contest = contestResult.rows[0];

    // Update contest status to 'completed'
    await query(
      `UPDATE weekly_contests
       SET status = 'completed', updated_at = NOW()
       WHERE id = $1`,
      [contestId]
    );

    return NextResponse.json({
      success: true,
      message: 'Contest archived successfully',
      contest: {
        id: contest.id,
        tokenAddress: contest.token_address,
        tokenSymbol: contest.token_symbol,
        status: 'completed'
      }
    });

  } catch (error: any) {
    console.error('Error archiving contest:', error);
    return NextResponse.json(
      { error: 'Failed to archive contest', message: error.message },
      { status: 500 }
    );
  }
}

