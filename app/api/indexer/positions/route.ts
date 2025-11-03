import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('wallet_address');

    let sql = 'SELECT * FROM positions';
    const params: any[] = [];

    if (walletAddress) {
      sql += ' WHERE wallet_address = $1';
      params.push(walletAddress.toLowerCase());
    }

    sql += ' ORDER BY updated_at DESC';

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      positions: result.rows,
      count: result.rows.length
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

