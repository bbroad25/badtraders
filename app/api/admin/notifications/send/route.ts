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
  console.log('📬 Admin notification send endpoint called');
  console.log('📬 Request URL:', request.url);
  console.log('📬 Request method:', request.method);
  console.log('📬 Request headers:', Object.fromEntries(request.headers.entries()));

  try {
    const body = await request.json();
    const { title, body: bodyText, targetFid, url } = body;

    console.log('📬 Admin notification request:', {
      hasTitle: !!title,
      hasBody: !!bodyText,
      targetFid,
      url
    });

    // Get FID from query param (passed from client)
    const fidParam = request.nextUrl.searchParams.get('fid');
    if (!fidParam) {
      console.error('❌ No FID in query params');
      return NextResponse.json(
        { error: 'FID is required. Pass ?fid=123 in the query string.' },
        { status: 400 }
      );
    }

    const fid = parseInt(fidParam, 10);
    if (isNaN(fid)) {
      console.error('❌ Invalid FID:', fidParam);
      return NextResponse.json(
        { error: 'Invalid FID' },
        { status: 400 }
      );
    }

    // Check admin access
    if (!ADMIN_FIDS.includes(fid)) {
      console.error('❌ Admin access denied for FID:', fid);
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!title || !bodyText) {
      console.error('❌ Missing required fields:', { hasTitle: !!title, hasBody: !!bodyText });
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      );
    }

    // Check if Neynar API key is configured
    if (!process.env.NEYNAR_API_KEY) {
      console.error('❌ NEYNAR_API_KEY environment variable is missing');
      return NextResponse.json(
        { error: 'NEYNAR_API_KEY not configured. Please set it in Vercel environment variables.' },
        { status: 500 }
      );
    }

    // Determine target FIDs
    const targetFids = targetFid ? [targetFid] : [];

    // Determine target URL
    const targetUrl = url || process.env.NEXT_PUBLIC_APP_URL || 'https://badtraders.xyz';

    console.log('🚀 Sending notification via Neynar:', {
      targetFids: targetFids.length === 0 ? 'ALL_USERS' : targetFids,
      title,
      body: bodyText.substring(0, 50) + '...',
      targetUrl
    });

    // Send notification using Neynar API
    try {
      await sendNotification(targetFids, title, bodyText, targetUrl);
      console.log('✅ Notification sent successfully');
    } catch (notificationError: any) {
      // Extract detailed error information
      const errorDetails = notificationError?.message || 'Unknown error';
      console.error('❌ Notification sending error:', {
        message: notificationError?.message,
        stack: notificationError?.stack,
        response: notificationError?.response?.data,
        status: notificationError?.response?.status
      });

      return NextResponse.json(
        {
          error: 'Failed to send notifications',
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
    console.error('❌ Admin notification API error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      {
        error: error.message || 'Failed to send notification',
        details: error.stack || 'No additional details available'
      },
      { status: 500 }
    );
  }
}

