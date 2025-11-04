import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const walletAddress = searchParams.get('wallet_address');

    let sql = 'SELECT * FROM trades';
    const params: any[] = [];

    if (walletAddress) {
      sql += ' WHERE wallet_address = $1';
      params.push(walletAddress.toLowerCase());
    }

    sql += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      trades: result.rows,
      count: result.rows.length
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

