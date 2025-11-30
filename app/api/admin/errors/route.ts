import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/errors
 *
 * Fetch recent errors from the system (if stored in database)
 * For now, this is a placeholder - errors are tracked client-side
 */
export async function GET(request: NextRequest) {
  try {
    // Check if admin mode is enabled
    if (process.env.ENABLE_ADMIN_MODE !== 'true') {
      return NextResponse.json(
        { error: 'Admin mode is not enabled' },
        { status: 403 }
      );
    }

    // For now, return empty array - errors are tracked client-side
    // In the future, we could store errors in a database table
    return NextResponse.json({
      success: true,
      errors: []
    });
  } catch (error: any) {
    console.error('Error fetching errors:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch errors',
        message: error?.message
      },
      { status: 500 }
    );
  }
}
