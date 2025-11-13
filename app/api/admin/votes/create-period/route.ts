import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

// Hardcoded admin FIDs (matches other admin routes)
const ADMIN_FIDS = [474867, 7212];

/**
 * POST /api/admin/votes/create-period
 *
 * Create a new voting period with options
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
    const { endDate, options } = body;

    if (!endDate || !options || !Array.isArray(options) || options.length === 0) {
      return NextResponse.json(
        { error: 'endDate and options array are required' },
        { status: 400 }
      );
    }

    // Close any existing active voting periods
    await query(
      `UPDATE voting_periods
       SET status = 'completed', updated_at = NOW()
       WHERE status = 'active'`
    );

    // Create new voting period
    const periodResult = await query(
      `INSERT INTO voting_periods (end_date, status, created_at, updated_at)
       VALUES ($1, 'active', NOW(), NOW())
       RETURNING id`,
      [new Date(endDate)]
    );

    const periodId = periodResult.rows[0].id;

    // Insert voting options
    const insertedOptions = [];
    for (const option of options) {
      const optionResult = await query(
        `INSERT INTO voting_options
         (voting_period_id, token_address, token_symbol, token_name, description, vote_count)
         VALUES ($1, $2, $3, $4, $5, 0)
         RETURNING id, token_address, token_symbol, token_name`,
        [
          periodId,
          option.tokenAddress,
          option.tokenSymbol || null,
          option.tokenName || null,
          option.description || null
        ]
      );
      insertedOptions.push(optionResult.rows[0]);
    }

    return NextResponse.json({
      success: true,
      message: 'Voting period created successfully',
      votingPeriod: {
        id: periodId,
        endDate,
        status: 'active'
      },
      options: insertedOptions.map(opt => ({
        id: opt.id,
        tokenAddress: opt.token_address,
        tokenSymbol: opt.token_symbol,
        tokenName: opt.token_name
      }))
    });

  } catch (error: any) {
    console.error('Error creating voting period:', error);
    return NextResponse.json(
      { error: 'Failed to create voting period', message: error.message },
      { status: 500 }
    );
  }
}

