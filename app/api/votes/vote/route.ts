import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * POST /api/votes/vote
 *
 * Submit a vote for a token option
 * Requires: walletAddress, optionId, fid (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, optionId, fid } = body;

    if (!walletAddress || !optionId) {
      return NextResponse.json(
        { error: 'walletAddress and optionId are required' },
        { status: 400 }
      );
    }

    // Check if user is registered (opt_in_status = true)
    const userCheck = await query(
      'SELECT id, opt_in_status FROM users WHERE wallet_address = $1 OR fid = $2',
      [walletAddress.toLowerCase(), fid || null]
    );

    if (userCheck.rows.length === 0 || !userCheck.rows[0].opt_in_status) {
      return NextResponse.json(
        { error: 'You must be registered to vote. Please register first.' },
        { status: 403 }
      );
    }

    // Get voting option and verify it exists in active period
    const optionResult = await query(
      `SELECT vo.*, vp.status, vp.end_date
       FROM voting_options vo
       JOIN voting_periods vp ON vo.voting_period_id = vp.id
       WHERE vo.id = $1 AND vp.status = 'active'`,
      [optionId]
    );

    if (optionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Voting option not found or voting period is not active' },
        { status: 404 }
      );
    }

    const option = optionResult.rows[0];
    const periodId = option.voting_period_id;

    // Check if voting period has ended
    if (new Date(option.end_date) < new Date()) {
      return NextResponse.json(
        { error: 'Voting period has ended' },
        { status: 400 }
      );
    }

    // Check if user already voted in this period
    const existingVote = await query(
      'SELECT id, option_id FROM user_votes WHERE voting_period_id = $1 AND wallet_address = $2',
      [periodId, walletAddress.toLowerCase()]
    );

    if (existingVote.rows.length > 0) {
      const existingOptionId = existingVote.rows[0].option_id;

      // If voting for the same option, return success
      if (existingOptionId === optionId) {
        return NextResponse.json({
          success: true,
          message: 'You have already voted for this option',
          alreadyVoted: true
        });
      }

      // If voting for different option, update the vote
      // First, decrement old option vote count
      await query(
        'UPDATE voting_options SET vote_count = vote_count - 1 WHERE id = $1',
        [existingOptionId]
      );

      // Update the vote
      await query(
        'UPDATE user_votes SET option_id = $1, voted_at = NOW() WHERE voting_period_id = $2 AND wallet_address = $3',
        [optionId, periodId, walletAddress.toLowerCase()]
      );

      // Increment new option vote count
      await query(
        'UPDATE voting_options SET vote_count = vote_count + 1 WHERE id = $1',
        [optionId]
      );

      return NextResponse.json({
        success: true,
        message: 'Vote updated successfully',
        alreadyVoted: false,
        changed: true
      });
    }

    // New vote - insert and increment count
    await query(
      `INSERT INTO user_votes (voting_period_id, option_id, wallet_address, fid, voted_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [periodId, optionId, walletAddress.toLowerCase(), fid || null]
    );

    await query(
      'UPDATE voting_options SET vote_count = vote_count + 1 WHERE id = $1',
      [optionId]
    );

    return NextResponse.json({
      success: true,
      message: 'Vote submitted successfully',
      alreadyVoted: false
    });

  } catch (error: any) {
    console.error('Error submitting vote:', error);

    // Handle unique constraint violation (race condition)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You have already voted in this period' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit vote', message: error.message },
      { status: 500 }
    );
  }
}

