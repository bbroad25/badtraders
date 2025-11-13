import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletFilter = searchParams.get('wallet_filter'); // 'registered' or null
    const holderFilter = searchParams.get('holder_filter'); // 'current' to show only wallets with positions

    let sql = `
      SELECT DISTINCT w.id, w.wallet_address, w.last_synced_block, w.created_at, w.updated_at
      FROM wallets w
    `;
    const params: any[] = [];
    let paramCount = 0;
    const conditions: string[] = [];

    // Filter by registered wallets if requested
    if (walletFilter === 'registered') {
      conditions.push(`w.wallet_address IN (
        SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true
      )`);
    }

    // Filter to only current holders (wallets with non-zero positions)
    if (holderFilter === 'current') {
      sql += `
        INNER JOIN positions p ON w.wallet_address = p.wallet_address
        WHERE p.remaining_amount > 0
      `;
    } else {
      sql += ' WHERE 1=1';
    }

    if (conditions.length > 0) {
      sql += (holderFilter === 'current' ? ' AND ' : ' AND ') + conditions.join(' AND ');
    }

    sql += ' ORDER BY w.updated_at DESC';

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      wallets: result.rows
    });
  } catch (error: any) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch wallets',
        message: error?.message
      },
      { status: 500 }
    );
  }
}

