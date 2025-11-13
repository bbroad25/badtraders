import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * GET /api/votes/list
 *
 * Get current active voting period and options
 */
export async function GET(request: NextRequest) {
  try {
    // Get active voting period
    const periodResult = await query(
      `SELECT * FROM voting_periods
       WHERE status = 'active'
       ORDER BY start_date DESC
       LIMIT 1`
    );

    if (periodResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        hasActiveVoting: false,
        message: 'No active voting period'
      });
    }

    const period = periodResult.rows[0];

    // Get voting options for this period
    const optionsResult = await query(
      `SELECT
        id,
        token_address,
        token_symbol,
        token_name,
        description,
        vote_count
      FROM voting_options
      WHERE voting_period_id = $1
      ORDER BY vote_count DESC, token_symbol ASC`,
      [period.id]
    );

    const options = optionsResult.rows.map(row => ({
      id: row.id,
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol,
      tokenName: row.token_name,
      description: row.description,
      voteCount: parseInt(row.vote_count, 10)
    }));

    return NextResponse.json({
      success: true,
      hasActiveVoting: true,
      votingPeriod: {
        id: period.id,
        startDate: period.start_date,
        endDate: period.end_date,
        status: period.status
      },
      options,
      totalVotes: options.reduce((sum, opt) => sum + opt.voteCount, 0)
    });

  } catch (error: any) {
    console.error('Error fetching voting options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voting options', message: error.message },
      { status: 500 }
    );
  }
}

