import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { calculateUnrealizedPnL } from '@/lib/services/fifoAccounting';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenAddress = searchParams.get('token_address');
    const walletFilter = searchParams.get('wallet_filter'); // 'registered' or null
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let sql = `
      SELECT
        t.wallet_address,
        COUNT(DISTINCT CASE WHEN t.side = 'BUY' THEN t.id END) as buy_txns,
        COUNT(DISTINCT CASE WHEN t.side = 'SELL' THEN t.id END) as sell_txns,
        COUNT(DISTINCT t.id) as total_txns,
        COALESCE(SUM(CASE WHEN t.side = 'BUY' THEN t.usd_value ELSE 0 END), 0) as bought_usd,
        COALESCE(SUM(CASE WHEN t.side = 'SELL' THEN t.usd_value ELSE 0 END), 0) as sold_usd,
        COALESCE(SUM(CASE WHEN t.side = 'BUY' THEN t.token_amount ELSE 0 END), 0) as bought_amount,
        COALESCE(SUM(CASE WHEN t.side = 'SELL' THEN t.token_amount ELSE 0 END), 0) as sold_amount
      FROM trades t
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    // Filter by registered wallets if requested
    if (walletFilter === 'registered') {
      sql += ` AND t.wallet_address IN (
        SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true
      )`;
    }

    if (tokenAddress) {
      paramCount++;
      sql += ` AND t.token_address = $${paramCount}`;
      params.push(tokenAddress.toLowerCase());
    }

    sql += ` GROUP BY t.wallet_address`;

    // Calculate PNL for each wallet - order by realized PNL (sold - bought)
    // Use HAVING to ensure we have valid aggregates
    sql += ` HAVING COUNT(DISTINCT t.id) > 0`;
    sql += ` ORDER BY (COALESCE(SUM(CASE WHEN t.side = 'SELL' THEN t.usd_value ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN t.side = 'BUY' THEN t.usd_value ELSE 0 END), 0)) DESC`;

    // Get total count first
    let countSql = `
      SELECT COUNT(DISTINCT wallet_address) as count
      FROM trades t
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamCount = 0;

    if (walletFilter === 'registered') {
      countSql += ` AND t.wallet_address IN (
        SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true
      )`;
    }

    if (tokenAddress) {
      countParamCount++;
      countSql += ` AND t.token_address = $${countParamCount}`;
      countParams.push(tokenAddress.toLowerCase());
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count) || 0;

    // Apply limit and offset
    paramCount++;
    sql += ` LIMIT $${paramCount}`;
    params.push(limit);

    if (offset > 0) {
      paramCount++;
      sql += ` OFFSET $${paramCount}`;
      params.push(offset);
    }

    const result = await query(sql, params);

    // Enhance with positions and unrealized PnL
    const traders = await Promise.all(
      result.rows.map(async (row, index) => {
        const walletAddress = row.wallet_address;
        const rank = offset + index + 1;

        // Get current position
        let positionSql = `
          SELECT remaining_amount, cost_basis_usd, realized_pnl_usd, token_address
          FROM positions
          WHERE wallet_address = $1 AND remaining_amount > 0
        `;
        const positionParams = [walletAddress.toLowerCase()];

        if (tokenAddress) {
          positionSql += ` AND token_address = $2`;
          positionParams.push(tokenAddress.toLowerCase());
        }

        const positionResult = await query(positionSql, positionParams);

        let balance = '0';
        let balanceUsd = 0;
        let unrealizedPnL = 0;

        if (positionResult.rows.length > 0) {
          const position = positionResult.rows[0];
          balance = position.remaining_amount;

          // Calculate unrealized PnL
          try {
            unrealizedPnL = await calculateUnrealizedPnL(
              walletAddress,
              position.token_address,
              0
            );
          } catch (error) {
            console.error(`Error calculating unrealized PnL for ${walletAddress}:`, error);
          }

          // Estimate balance USD (this is approximate - would need current price)
          const costBasis = parseFloat(position.cost_basis_usd || '0');
          const remainingAmount = parseFloat(balance);
          if (remainingAmount > 0 && costBasis > 0) {
            // Rough estimate: assume average cost basis per token
            balanceUsd = (costBasis / remainingAmount) * remainingAmount;
          }
        }

        const boughtUsd = parseFloat(row.bought_usd || '0');
        const soldUsd = parseFloat(row.sold_usd || '0');
        const realizedPnL = soldUsd - boughtUsd;

        return {
          rank,
          wallet_address: walletAddress,
          bought_usd: boughtUsd,
          sold_usd: soldUsd,
          bought_amount: row.bought_amount,
          sold_amount: row.sold_amount,
          buy_txns: parseInt(row.buy_txns) || 0,
          sell_txns: parseInt(row.sell_txns) || 0,
          total_txns: parseInt(row.total_txns) || 0,
          realized_pnl: realizedPnL,
          unrealized_pnl: unrealizedPnL,
          balance: balance,
          balance_usd: balanceUsd,
        };
      })
    );

    return NextResponse.json({
      success: true,
      traders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error('Error fetching top traders:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch top traders',
        message: error?.message
      },
      { status: 500 }
    );
  }
}

