import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const walletAddress = searchParams.get('wallet_address');
    const tokenAddress = searchParams.get('token_address');
    const side = searchParams.get('side'); // 'BUY' or 'SELL'
    const sortBy = searchParams.get('sort_by') || 'timestamp';
    const sortOrder = searchParams.get('sort_order') || 'DESC';

    // Validate sort fields
    const validSortFields = ['timestamp', 'usd_value', 'token_amount', 'price_usd'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let sql = `
      SELECT
        t.*,
        tt.symbol as token_symbol
      FROM trades t
      LEFT JOIN tracked_tokens tt ON t.token_address = tt.token_address
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Filter by registered wallets if requested
    if (searchParams.get('wallet_filter') === 'registered') {
      sql += ` AND t.wallet_address IN (
        SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true
      )`;
    }

    if (walletAddress) {
      paramCount++;
      sql += ` AND t.wallet_address = $${paramCount}`;
      params.push(walletAddress.toLowerCase());
    }

    if (tokenAddress) {
      paramCount++;
      sql += ` AND t.token_address = $${paramCount}`;
      params.push(tokenAddress.toLowerCase());
    }

    if (side && (side === 'BUY' || side === 'SELL')) {
      paramCount++;
      sql += ` AND t.side = $${paramCount}`;
      params.push(side);
    }

    sql += ` ORDER BY t.${sortField} ${sortDir}`;

    paramCount++;
    sql += ` LIMIT $${paramCount}`;
    params.push(limit);

    if (offset > 0) {
      paramCount++;
      sql += ` OFFSET $${paramCount}`;
      params.push(offset);
    }

    const result = await query(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as count FROM trades WHERE 1=1';
    const countParams: any[] = [];
    let countParamCount = 0;

    // Filter by registered wallets if requested
    if (searchParams.get('wallet_filter') === 'registered') {
      countSql += ` AND wallet_address IN (
        SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true
      )`;
    }

    if (walletAddress) {
      countParamCount++;
      countSql += ` AND wallet_address = $${countParamCount}`;
      countParams.push(walletAddress.toLowerCase());
    }

    if (tokenAddress) {
      countParamCount++;
      countSql += ` AND token_address = $${countParamCount}`;
      countParams.push(tokenAddress.toLowerCase());
    }

    if (side && (side === 'BUY' || side === 'SELL')) {
      countParamCount++;
      countSql += ` AND side = $${countParamCount}`;
      countParams.push(side);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count) || 0;

    return NextResponse.json({
      success: true,
      trades: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch trades',
        message: error?.message
      },
      { status: 500 }
    );
  }
}
