import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

// Hardcoded admin FIDs (matches other admin routes)
const ADMIN_FIDS = [474867, 7212];

/**
 * GET /api/admin/contests/status?fid=...
 *
 * Get status of contest registrations and PnL calculations
 * Admin only - used for investigation
 */
export async function GET(request: NextRequest) {
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

    // Get overall statistics
    const statsResult = await query(`
      SELECT
        COUNT(*) as total_registrations,
        COUNT(indexed_at) as indexed_count,
        COUNT(pnl_calculated_at) as pnl_calculated_count,
        COUNT(CASE WHEN indexed_at IS NULL THEN 1 END) as pending_indexing,
        COUNT(CASE WHEN indexed_at IS NOT NULL AND pnl_calculated_at IS NULL THEN 1 END) as indexed_but_no_pnl,
        COUNT(CASE WHEN current_pnl IS NOT NULL THEN 1 END) as has_pnl_value
      FROM contest_registrations
    `);

    // Get contest breakdown
    const contestBreakdownResult = await query(`
      SELECT
        wc.id as contest_id,
        wc.token_address,
        wc.token_symbol,
        wc.status as contest_status,
        COUNT(cr.id) as total_registrations,
        COUNT(cr.indexed_at) as indexed,
        COUNT(cr.pnl_calculated_at) as pnl_calculated,
        COUNT(CASE WHEN cr.indexed_at IS NULL THEN 1 END) as pending,
        AVG(CAST(cr.current_pnl AS FLOAT)) as avg_pnl
      FROM weekly_contests wc
      LEFT JOIN contest_registrations cr ON wc.id = cr.contest_id
      GROUP BY wc.id, wc.token_address, wc.token_symbol, wc.status
      ORDER BY wc.created_at DESC
    `);

    // Get stuck registrations (created more than 10 minutes ago but not indexed)
    const stuckResult = await query(`
      SELECT
        cr.id,
        cr.contest_id,
        cr.wallet_address,
        cr.created_at,
        cr.indexed_at,
        cr.pnl_calculated_at,
        cr.current_pnl,
        wc.token_address,
        wc.token_symbol
      FROM contest_registrations cr
      JOIN weekly_contests wc ON cr.contest_id = wc.id
      WHERE cr.indexed_at IS NULL
        AND cr.created_at < NOW() - INTERVAL '10 minutes'
      ORDER BY cr.created_at ASC
      LIMIT 20
    `);

    // Get registrations with trades but no PnL
    const tradesNoPnLResult = await query(`
      SELECT DISTINCT
        cr.id as registration_id,
        cr.contest_id,
        cr.wallet_address,
        cr.indexed_at,
        cr.pnl_calculated_at,
        COUNT(ut.id) as trade_count,
        wc.token_address,
        wc.token_symbol
      FROM contest_registrations cr
      JOIN weekly_contests wc ON cr.contest_id = wc.id
      JOIN user_trades ut ON cr.id = ut.registration_id
      WHERE cr.pnl_calculated_at IS NULL
        OR cr.current_pnl IS NULL
      GROUP BY cr.id, cr.contest_id, cr.wallet_address, cr.indexed_at, cr.pnl_calculated_at, wc.token_address, wc.token_symbol
      ORDER BY trade_count DESC
      LIMIT 20
    `);

    const stats = statsResult.rows[0];
    const contestBreakdown = contestBreakdownResult.rows;
    const stuck = stuckResult.rows;
    const tradesNoPnL = tradesNoPnLResult.rows;

    return NextResponse.json({
      success: true,
      statistics: {
        totalRegistrations: parseInt(stats.total_registrations, 10),
        indexedCount: parseInt(stats.indexed_count, 10),
        pnlCalculatedCount: parseInt(stats.pnl_calculated_count, 10),
        pendingIndexing: parseInt(stats.pending_indexing, 10),
        indexedButNoPnL: parseInt(stats.indexed_but_no_pnl, 10),
        hasPnLValue: parseInt(stats.has_pnl_value, 10)
      },
      contestBreakdown: contestBreakdown.map(row => ({
        contestId: row.contest_id,
        tokenAddress: row.token_address,
        tokenSymbol: row.token_symbol,
        contestStatus: row.contest_status,
        totalRegistrations: parseInt(row.total_registrations, 10),
        indexed: parseInt(row.indexed, 10),
        pnlCalculated: parseInt(row.pnl_calculated, 10),
        pending: parseInt(row.pending, 10),
        avgPnL: row.avg_pnl ? parseFloat(row.avg_pnl) : null
      })),
      stuckRegistrations: stuck.map(row => ({
        id: row.id,
        contestId: row.contest_id,
        walletAddress: row.wallet_address,
        createdAt: row.created_at,
        indexedAt: row.indexed_at,
        pnlCalculatedAt: row.pnl_calculated_at,
        currentPnL: row.current_pnl ? parseFloat(row.current_pnl) : null,
        tokenAddress: row.token_address,
        tokenSymbol: row.token_symbol
      })),
      tradesNoPnL: tradesNoPnL.map(row => ({
        registrationId: row.registration_id,
        contestId: row.contest_id,
        walletAddress: row.wallet_address,
        indexedAt: row.indexed_at,
        pnlCalculatedAt: row.pnl_calculated_at,
        tradeCount: parseInt(row.trade_count, 10),
        tokenAddress: row.token_address,
        tokenSymbol: row.token_symbol
      }))
    });

  } catch (error: any) {
    console.error('Error fetching contest status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contest status', message: error.message },
      { status: 500 }
    );
  }
}

