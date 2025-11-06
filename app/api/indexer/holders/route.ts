import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenAddress = searchParams.get('token_address');
    const walletFilter = searchParams.get('wallet_filter'); // 'registered' or null
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'token_address is required' },
        { status: 400 }
      );
    }

    // Get total supply for percentage calculation (optional - column may not exist)
    let totalSupply = '0';
    try {
      // Try to get total supply if column exists
      const tokenInfoQuery = await query(
        `SELECT total_supply FROM tracked_tokens WHERE token_address = $1`,
        [tokenAddress.toLowerCase()]
      );
      totalSupply = tokenInfoQuery.rows[0]?.total_supply || '0';
    } catch (err: any) {
      // Column doesn't exist or other error - use default
      // Percentage will be 0 for all holders
      console.warn('Could not fetch total_supply (column may not exist):', err.message);
      totalSupply = '0';
    }

    let sql = `
      SELECT
        p.wallet_address,
        p.remaining_amount,
        p.cost_basis_usd,
        p.realized_pnl_usd,
        COUNT(DISTINCT t.id) as txn_count
      FROM positions p
      LEFT JOIN trades t ON p.wallet_address = t.wallet_address AND p.token_address = t.token_address
      WHERE p.token_address = $1 AND p.remaining_amount > 0
    `;

    const params: any[] = [tokenAddress.toLowerCase()];
    let paramCount = 1;

    // Filter by registered wallets if requested
    if (walletFilter === 'registered') {
      sql += ` AND p.wallet_address IN (
        SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true
      )`;
    }

    sql += ` GROUP BY p.wallet_address, p.remaining_amount, p.cost_basis_usd, p.realized_pnl_usd`;
    sql += ` ORDER BY p.remaining_amount DESC`;

    // Get total count
    let countSql = `
      SELECT COUNT(DISTINCT wallet_address) as count
      FROM positions
      WHERE token_address = $1 AND remaining_amount > 0
    `;
    const countParams: any[] = [tokenAddress.toLowerCase()];

    if (walletFilter === 'registered') {
      countSql += ` AND wallet_address IN (
        SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true
      )`;
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

    const totalSupplyBigInt = BigInt(totalSupply);
    const holders = result.rows.map((row, index) => {
      const rank = offset + index + 1;
      const remainingAmount = BigInt(row.remaining_amount || '0');
      const percentage = totalSupplyBigInt > 0
        ? (Number(remainingAmount) / Number(totalSupplyBigInt)) * 100
        : 0;

      // Estimate USD value (approximate - would need current price)
      const costBasis = parseFloat(row.cost_basis_usd || '0');
      const amount = parseFloat(row.remaining_amount || '0');
      const estimatedUsdValue = amount > 0 && costBasis > 0
        ? (costBasis / amount) * amount
        : 0;

      return {
        rank,
        wallet_address: row.wallet_address,
        amount: row.remaining_amount,
        percentage: percentage,
        value_usd: estimatedUsdValue,
        txn_count: parseInt(row.txn_count) || 0,
        cost_basis_usd: costBasis,
      };
    });

    return NextResponse.json({
      success: true,
      holders,
      total_supply: totalSupply,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error('Error fetching holders:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch holders',
        message: error?.message
      },
      { status: 500 }
    );
  }
}

