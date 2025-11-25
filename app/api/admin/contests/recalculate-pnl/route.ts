import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { calculateUserPnL } from '@/lib/services/userIndexerService';

// Hardcoded admin FIDs (matches other admin routes)
const ADMIN_FIDS = [474867, 7212];

/**
 * POST /api/admin/contests/recalculate-pnl
 *
 * Manually recalculate PnL for contest registrations
 * Can recalculate all registrations for a contest, or a specific registration
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
    const { contestId, registrationId } = body;

    if (!contestId && !registrationId) {
      return NextResponse.json(
        { error: 'Either contestId or registrationId is required' },
        { status: 400 }
      );
    }

    let registrationsToProcess: any[] = [];

    if (registrationId) {
      // Recalculate specific registration
      const regResult = await query(
        `SELECT cr.*, wc.token_address
         FROM contest_registrations cr
         JOIN weekly_contests wc ON cr.contest_id = wc.id
         WHERE cr.id = $1`,
        [registrationId]
      );

      if (regResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Registration not found' },
          { status: 404 }
        );
      }

      registrationsToProcess = regResult.rows;
    } else {
      // Recalculate all registrations for a contest
      const regResult = await query(
        `SELECT cr.*, wc.token_address
         FROM contest_registrations cr
         JOIN weekly_contests wc ON cr.contest_id = wc.id
         WHERE cr.contest_id = $1`,
        [contestId]
      );

      registrationsToProcess = regResult.rows;
    }

    const results = {
      total: registrationsToProcess.length,
      successful: 0,
      failed: 0,
      updated: [] as any[],
      errors: [] as any[]
    };

    // Recalculate PnL for each registration
    for (const reg of registrationsToProcess) {
      try {
        // Get token address from registration
        const tokenAddress = reg.token_address;

        // Recalculate PnL
        const pnl = await calculateUserPnL(reg.id, tokenAddress);

        // Update registration with new PnL
        await query(
          `UPDATE contest_registrations
           SET pnl_calculated_at = NOW(), current_pnl = $1, updated_at = NOW()
           WHERE id = $2`,
          [pnl, reg.id]
        );

        results.successful++;
        results.updated.push({
          registrationId: reg.id,
          walletAddress: reg.wallet_address,
          previousPnL: reg.current_pnl ? parseFloat(reg.current_pnl.toString()) : null,
          newPnL: pnl
        });
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          registrationId: reg.id,
          walletAddress: reg.wallet_address,
          error: error.message
        });
        console.error(`Error recalculating PnL for registration ${reg.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated PnL for ${results.successful} registration(s)`,
      results
    });

  } catch (error: any) {
    console.error('Error recalculating PnL:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate PnL', message: error.message },
      { status: 500 }
    );
  }
}

