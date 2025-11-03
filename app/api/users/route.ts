import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const result = await query(
      'SELECT id, fid, username, wallet_address, eligibility_status, opt_in_status, registered_at, last_active_at, created_at FROM users ORDER BY registered_at DESC'
    );

    return NextResponse.json({
      success: true,
      users: result.rows,
      count: result.rows.length
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', message: error?.message },
      { status: 500 }
    );
  }
}

