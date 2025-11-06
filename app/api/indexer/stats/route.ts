import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    // Get all stats in parallel
    const [
      walletsResult,
      tradesResult,
      positionsResult,
      volumeResult,
      pnlResult,
      recentTradesResult
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM wallets'),
      query('SELECT COUNT(*) as count FROM trades'),
      query('SELECT COUNT(*) as count FROM positions WHERE remaining_amount > 0'),
      query(`
        SELECT
          COALESCE(SUM(usd_value), 0) as total_volume,
          COALESCE(SUM(CASE WHEN side = 'BUY' THEN usd_value ELSE 0 END), 0) as buy_volume,
          COALESCE(SUM(CASE WHEN side = 'SELL' THEN usd_value ELSE 0 END), 0) as sell_volume,
          COUNT(DISTINCT wallet_address) as unique_traders,
          COUNT(DISTINCT token_address) as tokens_traded
        FROM trades
      `),
      query(`
        SELECT
          COALESCE(SUM(realized_pnl_usd), 0) as total_realized_pnl,
          COUNT(*) as positions_with_pnl
        FROM positions
        WHERE realized_pnl_usd != 0
      `),
      query(`
        SELECT
          COUNT(*) as trades_last_24h
        FROM trades
        WHERE timestamp > NOW() - INTERVAL '24 hours'
      `)
    ]);

    const stats = {
      wallets: parseInt(walletsResult.rows[0].count) || 0,
      trades: parseInt(tradesResult.rows[0].count) || 0,
      positions: parseInt(positionsResult.rows[0].count) || 0, // Active positions (remaining_amount > 0)
      volume: {
        total: parseFloat(volumeResult.rows[0].total_volume) || 0,
        buy: parseFloat(volumeResult.rows[0].buy_volume) || 0,
        sell: parseFloat(volumeResult.rows[0].sell_volume) || 0,
      },
      traders: parseInt(volumeResult.rows[0].unique_traders) || 0, // Unique wallets that have trades
      tokens: parseInt(volumeResult.rows[0].tokens_traded) || 0,
      pnl: {
        realized: parseFloat(pnlResult.rows[0].total_realized_pnl) || 0,
        positions: parseInt(pnlResult.rows[0].positions_with_pnl) || 0,
      },
      recent: {
        trades_24h: parseInt(recentTradesResult.rows[0].trades_last_24h) || 0,
      }
    };

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error fetching indexer stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch stats',
        message: error?.message
      },
      { status: 500 }
    );
  }
}


