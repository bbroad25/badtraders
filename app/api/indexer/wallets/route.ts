import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const result = await query(
      'SELECT id, wallet_address, last_synced_block, created_at, updated_at FROM wallets ORDER BY updated_at DESC'
    );

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

