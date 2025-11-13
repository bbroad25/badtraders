import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    // Get filter parameter - default to showing only active registered users
    const searchParams = request.nextUrl.searchParams;
    const showAll = searchParams.get('showAll') === 'true';

    const queryText = showAll
      ? 'SELECT id, fid, username, wallet_address, eligibility_status, opt_in_status, registered_at, last_active_at, created_at FROM users ORDER BY registered_at DESC'
      : 'SELECT id, fid, username, wallet_address, eligibility_status, opt_in_status, registered_at, last_active_at, created_at FROM users WHERE opt_in_status = true ORDER BY registered_at DESC';

    const result = await query(queryText);

    return NextResponse.json({
      success: true,
      users: result.rows,
      count: result.rows.length,
      filtered: !showAll // Indicate if results are filtered
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);

    // Check if it's a database connection or table missing error
    const errorMessage = error?.message || 'Unknown error';
    const isTableMissing = errorMessage.includes('does not exist') || errorMessage.includes('relation');
    const isConnectionError = errorMessage.includes('DATABASE_URL') || errorMessage.includes('connect');

    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: errorMessage,
        hint: isTableMissing
          ? 'Database tables not created. Run migration: migrations/001_create_tables.sql in Supabase SQL Editor'
          : isConnectionError
          ? 'Database connection failed. Check DATABASE_URL environment variable.'
          : undefined
      },
      { status: 500 }
    );
  }
}

