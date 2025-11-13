import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { getCurrentPrice } from '@/lib/services/priceService';
import { calculateUnrealizedPnL } from '@/lib/services/fifoAccounting';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('wallet_address');
    const tokenAddress = searchParams.get('token_address');
    const includeUnrealized = searchParams.get('include_unrealized') === 'true';

    let sql = `
      SELECT
        p.*,
        tt.symbol as token_symbol
      FROM positions p
      LEFT JOIN tracked_tokens tt ON p.token_address = tt.token_address
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (walletAddress) {
      paramCount++;
      sql += ` AND p.wallet_address = $${paramCount}`;
      params.push(walletAddress.toLowerCase());
    }

    if (tokenAddress) {
      paramCount++;
      sql += ` AND p.token_address = $${paramCount}`;
      params.push(tokenAddress.toLowerCase());
    }

    // Only show positions with remaining balance
    sql += ` AND p.remaining_amount > 0`;

    sql += ` ORDER BY p.updated_at DESC`;

    const result = await query(sql, params);

    // Enhance positions with unrealized PnL if requested
    let positions = result.rows;
    if (includeUnrealized) {
      positions = await Promise.all(
        result.rows.map(async (position: any) => {
          try {
            const currentPrice = await getCurrentPrice(position.token_address);
            if (currentPrice && currentPrice > 0) {
              const unrealizedPnL = await calculateUnrealizedPnL(
                position.wallet_address,
                position.token_address,
                currentPrice
              );
              return {
                ...position,
                unrealized_pnl_usd: unrealizedPnL.toFixed(8),
                current_price_usd: currentPrice.toFixed(8),
                total_pnl_usd: (
                  parseFloat(position.realized_pnl_usd) + unrealizedPnL
                ).toFixed(8)
              };
            }
            return {
              ...position,
              unrealized_pnl_usd: '0',
              current_price_usd: '0',
              total_pnl_usd: position.realized_pnl_usd
            };
          } catch (error) {
            console.error(`Error calculating unrealized PnL for position:`, error);
            return {
              ...position,
              unrealized_pnl_usd: '0',
              current_price_usd: '0',
              total_pnl_usd: position.realized_pnl_usd
            };
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      positions,
      count: positions.length
    });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch positions',
        message: error?.message
      },
      { status: 500 }
    );
  }
}
