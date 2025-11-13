import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * GET /api/notifications/check?fid=123
 *
 * Check if a user has notifications enabled (has a token stored)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'fid query parameter is required' },
        { status: 400 }
      );
    }

    const fidNumber = parseInt(fid, 10);
    if (isNaN(fidNumber)) {
      return NextResponse.json(
        { error: 'fid must be a valid number' },
        { status: 400 }
      );
    }

    // Check if user has notification tokens
    const result = await query(
      'SELECT fid, token, url, created_at, updated_at FROM notification_tokens WHERE fid = $1',
      [fidNumber]
    );

    const hasNotifications = result.rows.length > 0;
    const tokens = result.rows.map(row => ({
      fid: row.fid,
      token: row.token ? `${row.token.substring(0, 10)}...` : null, // Only show first 10 chars for security
      url: row.url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      fid: fidNumber,
      hasNotifications,
      tokenCount: result.rows.length,
      tokens
    });
  } catch (error: any) {
    console.error('Error checking notifications:', error);
    return NextResponse.json(
      { error: 'Failed to check notifications', message: error.message },
      { status: 500 }
    );
  }
}

