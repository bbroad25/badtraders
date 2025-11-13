import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/webhooks/farcaster
 *
 * Webhook endpoint to handle Farcaster notification enable/disable events
 * When users toggle notifications in the hamburger menu, Farcaster sends events here
 *
 * Webhook payload structure (from Farcaster SDK):
 * {
 *   event: 'notification.enabled' | 'notification.disabled' | 'miniapp_added',
 *   fid: number,
 *   token?: string,  // Notification token (provided when enabled)
 *   url?: string     // Notification URL (provided when enabled)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, fid, token, url } = body;

    console.log('📬 Farcaster notification webhook:', {
      event,
      fid,
      token: token ? '***' : undefined,
      url
    });

    if (!event || !fid) {
      return NextResponse.json(
        { error: 'event and fid are required' },
        { status: 400 }
      );
    }

    // Handle different event types
    if (event === 'notification.enabled') {
      if (!token || !url) {
        return NextResponse.json(
          { error: 'token and url are required for notification.enabled event' },
          { status: 400 }
        );
      }

      // For now, we just log it since Neynar manages tokens automatically
      // But we could store this in the database if needed for tracking
      console.log(`✅ Notifications enabled for FID ${fid}`);

      return NextResponse.json({
        success: true,
        message: 'Notification enabled',
        fid
      });
    } else if (event === 'notification.disabled') {
      // Mark notifications as disabled for this user
      console.log(`❌ Notifications disabled for FID ${fid}`);

      return NextResponse.json({
        success: true,
        message: 'Notification disabled',
        fid
      });
    } else if (event === 'miniapp_added') {
      // User added the miniapp
      console.log(`📱 Miniapp added for FID ${fid}`);

      return NextResponse.json({
        success: true,
        message: 'Miniapp added',
        fid
      });
    } else {
      console.warn(`⚠️ Unknown event type: ${event}`);
      return NextResponse.json(
        { error: `Unknown event type: ${event}` },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('❌ Farcaster notification webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

