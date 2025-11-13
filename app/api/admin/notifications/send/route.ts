import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/app/services/notifications';

// Hardcoded admin FIDs
const ADMIN_FIDS = [474867, 7212];

/**
 * POST /api/admin/notifications/send
 *
 * Send a notification to users via Neynar API
 * Requires admin access (FID check)
 *
 * Request body:
 * {
 *   title: string,        // Notification title (max 32 chars)
 *   body: string,         // Notification body (max 128 chars)
 *   targetFid?: number,   // Optional: specific FID to notify. If omitted, broadcasts to all
 *   url?: string          // Optional: URL to open when clicked
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, body: bodyText, targetFid, url } = body;

    // Get FID from query param (passed from client)
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

    // Check admin access
    if (!ADMIN_FIDS.includes(fid)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!title || !bodyText) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      );
    }

    // Check if NEYNAR_API_KEY is set
    if (!process.env.NEYNAR_API_KEY) {
      console.error('❌ NEYNAR_API_KEY not configured');
      return NextResponse.json(
        { error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    // Determine target FIDs
    const targetFids = targetFid ? [targetFid] : [];

    // Determine target URL
    const targetUrl = url || process.env.NEXT_PUBLIC_APP_URL || 'https://badtraders.xyz';

    // Send notification via Neynar
    try {
      await sendNotification(targetFids, title, bodyText, targetUrl);
    } catch (notificationError: any) {
      // Extract detailed error information from Neynar API
      const errorDetails = notificationError?.response?.data || notificationError?.message || 'Unknown error';
      console.error('❌ Neynar API error details:', {
        message: notificationError?.message,
        status: notificationError?.response?.status,
        data: notificationError?.response?.data,
        stack: notificationError?.stack
      });

      return NextResponse.json(
        {
          error: 'Failed to send notification via Neynar',
          details: errorDetails,
          message: typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      method: 'Neynar API',
      targetFids: targetFids.length === 0 ? 'ALL_USERS' : targetFids
    });
  } catch (error: any) {
    console.error('❌ Admin notification API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to send notification',
        details: error.stack || 'No additional details available'
      },
      { status: 500 }
    );
  }
}

