import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * GET /api/contests/my-position?contestId=1&walletAddress=0x...
 *
 * Get user's position in a contest
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contestId = searchParams.get('contestId');
    const walletAddress = searchParams.get('walletAddress');

    if (!contestId || !walletAddress) {
      return NextResponse.json(
        { error: 'contestId and walletAddress are required' },
        { status: 400 }
      );
    }

    // Get registration
    const regResult = await query(
      `SELECT
        cr.id,
        cr.contest_id,
        cr.wallet_address,
        cr.current_pnl,
        cr.indexed_at,
        COUNT(*) OVER() as total_participants
      FROM contest_registrations cr
      WHERE cr.contest_id = $1 AND cr.wallet_address = $2`,
      [contestId, walletAddress.toLowerCase()]
    );

    if (regResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not registered for this contest' },
        { status: 404 }
      );
    }

    const registration = regResult.rows[0];
    const isIndexed = registration.indexed_at !== null;

    // Get rank (how many participants have worse PnL) - only count indexed participants
    const rankResult = await query(
      `SELECT COUNT(*) as rank
       FROM contest_registrations
       WHERE contest_id = $1
         AND indexed_at IS NOT NULL
         AND current_pnl < $2`,
      [contestId, registration.current_pnl || 0]
    );

    const rank = parseInt(rankResult.rows[0].rank, 10) + 1; // +1 because rank is 1-indexed

    // Get total indexed participants
    const totalIndexedResult = await query(
      `SELECT COUNT(*) as total
       FROM contest_registrations
       WHERE contest_id = $1 AND indexed_at IS NOT NULL`,
      [contestId]
    );

    const totalParticipants = parseInt(totalIndexedResult.rows[0].total, 10);

    return NextResponse.json({
      success: true,
      position: {
        rank: isIndexed ? rank : null, // Only show rank if indexed
        totalParticipants,
        pnl: parseFloat(registration.current_pnl || 0),
        status: isIndexed ? 'indexed' : 'indexing',
      }
    });

  } catch (error: any) {
    console.error('Error fetching contest position:', error);
    return NextResponse.json(
      { error: 'Failed to fetch position', message: error.message },
      { status: 500 }
    );
  }
}
