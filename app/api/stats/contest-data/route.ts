import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * GET /api/stats/contest-data
 *
 * Fetch all contest registration data including trades and PnL calculations
 * Used for debugging PnL calculations
 */
export async function GET(request: NextRequest) {
  try {
    // Get all contest registrations with contest details
    const registrationsResult = await query(
      `SELECT
        cr.id,
        cr.contest_id,
        cr.wallet_address,
        cr.fid,
        cr.indexed_at,
        cr.pnl_calculated_at,
        cr.current_pnl,
        cr.created_at,
        wc.token_address,
        wc.token_symbol,
        wc.start_date,
        wc.end_date,
        wc.status as contest_status
      FROM contest_registrations cr
      JOIN weekly_contests wc ON cr.contest_id = wc.id
      ORDER BY cr.created_at DESC`
    );

    const registrations = registrationsResult.rows;

    // For each registration, get all trades
    const registrationsWithTrades = await Promise.all(
      registrations.map(async (reg: any) => {
        // Get all trades for this registration
        const tradesResult = await query(
          `SELECT
            id,
            tx_hash,
            block_number,
            timestamp,
            trade_type,
            amount_in,
            amount_out,
            token_in_address,
            token_out_address,
            price_usd
          FROM user_trades
          WHERE registration_id = $1
          ORDER BY timestamp ASC, block_number ASC`,
          [reg.id]
        );

        const trades = tradesResult.rows;

        // Calculate PnL manually to show the calculation
        let position = 0; // Net position in tokens (raw amount)
        let costBasis = 0; // Total cost basis in USD
        let realizedPnL = 0;
        const tradeCalculations: any[] = [];

        for (const trade of trades) {
          const amountIn = parseFloat(trade.amount_in || '0');
          const amountOut = parseFloat(trade.amount_out || '0');
          const priceUSD = parseFloat(trade.price_usd || '0');

          if (trade.trade_type === 'buy') {
            // Buy: tokens come in, cost basis increases
            position += amountIn;
            const cost = amountIn * priceUSD;
            costBasis += cost;

            tradeCalculations.push({
              ...trade,
              calculation: {
                beforePosition: position - amountIn,
                beforeCostBasis: costBasis - cost,
                tradeAmount: amountIn,
                tradeCost: cost,
                afterPosition: position,
                afterCostBasis: costBasis,
                avgCostPerToken: costBasis / position,
                realizedPnL: 0,
                note: 'BUY: Added to position'
              }
            });
          } else if (trade.trade_type === 'sell') {
            // Sell: tokens go out, realize PnL
            const avgCost = costBasis / Math.max(position, 1);
            const sellAmount = amountOut;
            const sellValue = sellAmount * priceUSD;
            const costOfSold = sellAmount * avgCost;
            const tradePnL = sellValue - costOfSold;

            realizedPnL += tradePnL;
            position -= sellAmount;
            costBasis -= costOfSold;

            tradeCalculations.push({
              ...trade,
              calculation: {
                beforePosition: position + sellAmount,
                beforeCostBasis: costBasis + costOfSold,
                tradeAmount: sellAmount,
                tradeValue: sellValue,
                costOfSold: costOfSold,
                tradePnL: tradePnL,
                afterPosition: position,
                afterCostBasis: costBasis,
                avgCostPerToken: avgCost,
                realizedPnL: realizedPnL,
                note: 'SELL: Realized PnL'
              }
            });
          }
        }

        return {
          ...reg,
          trades: trades,
          tradeCalculations: tradeCalculations,
          calculatedPnL: {
            position: position,
            costBasis: costBasis,
            avgCostPerToken: costBasis / Math.max(position, 1),
            realizedPnL: realizedPnL,
            // Note: unrealized PnL would require current price
            totalPnL: realizedPnL // For now, just realized
          },
          tradeCount: trades.length
        };
      })
    );

    return NextResponse.json({
      success: true,
      registrations: registrationsWithTrades,
      total: registrationsWithTrades.length,
      indexed: registrationsWithTrades.filter((r: any) => r.indexed_at).length,
      pending: registrationsWithTrades.filter((r: any) => !r.indexed_at).length
    });

  } catch (error: any) {
    console.error('Error fetching contest data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contest data', message: error.message },
      { status: 500 }
    );
  }
}

