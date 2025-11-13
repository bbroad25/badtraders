import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * GET /api/contests/leaderboard?contestId=123
 *
 * Get leaderboard for a specific contest
 * Returns users sorted by PnL (worst first - most negative)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contestId = searchParams.get('contestId');

    if (!contestId) {
      return NextResponse.json(
        { error: 'contestId is required' },
        { status: 400 }
      );
    }

    // Get contest details
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

    // Get all registrations with PnL, sorted worst first
    const leaderboardResult = await query(
      `SELECT
        cr.id,
        cr.wallet_address,
        cr.fid,
        cr.current_pnl,
        cr.indexed_at,
        cr.pnl_calculated_at,
        u.username
      FROM contest_registrations cr
      LEFT JOIN users u ON cr.fid = u.fid
      WHERE cr.contest_id = $1
        AND cr.current_pnl IS NOT NULL
      ORDER BY cr.current_pnl ASC
      LIMIT 100`,
      [contestId]
    );

    const leaderboard = leaderboardResult.rows.map((row, index) => ({
      rank: index + 1,
      walletAddress: row.wallet_address,
      fid: row.fid,
      username: row.username,
      pnl: parseFloat(row.current_pnl || 0),
      indexedAt: row.indexed_at
    }));

    return NextResponse.json({
      success: true,
      contest: {
        id: contest.id,
        tokenAddress: contest.token_address,
        tokenSymbol: contest.token_symbol,
        startDate: contest.start_date,
        endDate: contest.end_date,
        status: contest.status
      },
      leaderboard,
      totalParticipants: leaderboard.length
    });

  } catch (error: any) {
    console.error('Error fetching contest leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard', message: error.message },
      { status: 500 }
    );
  }
}

