import { NextRequest, NextResponse } from 'next/server';

// Hardcoded admin FIDs
const ADMIN_FIDS = [474867, 7212];

/**
 * GET /api/admin/check
 *
 * Checks if the provided FID is an admin
 * Query param: ?fid=123
 */
export async function GET(request: NextRequest) {
  try {
    const fidParam = request.nextUrl.searchParams.get('fid');

    if (!fidParam) {
      return NextResponse.json(
        { error: 'FID is required. Pass ?fid=123 in the query string.' },
        { status: 400 }
      );
    }

    const fid = parseInt(fidParam, 10);

    if (isNaN(fid)) {
      return NextResponse.json(
        { error: 'Invalid FID' },
        { status: 400 }
      );
    }

    const isAdmin = ADMIN_FIDS.includes(fid);

    return NextResponse.json({
      isAdmin,
      fid,
      adminFids: ADMIN_FIDS
    });
  } catch (error: any) {
    console.error('[Admin Check] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status', message: error?.message },
      { status: 500 }
    );
  }
}

