import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * GET /api/votes/my-vote?walletAddress=0x...&fid=123
 *
 * Get user's current vote in the active voting period
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('walletAddress');
    const fid = searchParams.get('fid');

    if (!walletAddress && !fid) {
      return NextResponse.json(
        { error: 'walletAddress or fid is required' },
        { status: 400 }
      );
    }

    // Get active voting period
    const periodResult = await query(
      `SELECT id FROM voting_periods
       WHERE status = 'active'
       ORDER BY start_date DESC
       LIMIT 1`
    );

    if (periodResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        hasVote: false,
        message: 'No active voting period'
      });
    }

    const periodId = periodResult.rows[0].id;

    // Get user's vote
    const voteResult = await query(
      `SELECT uv.*, vo.token_address, vo.token_symbol, vo.token_name
       FROM user_votes uv
       JOIN voting_options vo ON uv.option_id = vo.id
       WHERE uv.voting_period_id = $1
         AND (uv.wallet_address = $2 OR ($3 IS NOT NULL AND uv.fid = $3))`,
      [periodId, walletAddress?.toLowerCase() || null, fid ? parseInt(fid, 10) : null]
    );

    if (voteResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        hasVote: false
      });
    }

    const vote = voteResult.rows[0];

    return NextResponse.json({
      success: true,
      hasVote: true,
      vote: {
        optionId: vote.option_id,
        tokenAddress: vote.token_address,
        tokenSymbol: vote.token_symbol,
        tokenName: vote.token_name,
        votedAt: vote.voted_at
      }
    });

  } catch (error: any) {
    console.error('Error fetching user vote:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vote', message: error.message },
      { status: 500 }
    );
  }
}

