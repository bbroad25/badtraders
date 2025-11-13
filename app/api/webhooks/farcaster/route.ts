import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

/**
 * POST /api/webhooks/farcaster
 *
 * Webhook endpoint to handle Farcaster notification events
 * According to Farcaster docs: https://miniapps.farcaster.xyz/docs/guides/notifications
 *
 * Event formats:
 * - miniapp_added: { event: "miniapp_added", notificationDetails: { token, url } }
 * - notifications_enabled: { event: "notifications_enabled", notificationDetails: { token, url } }
 * - notifications_disabled: { event: "notifications_disabled" }
 * - miniapp_removed: { event: "miniapp_removed" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, notificationDetails } = body;

    console.log('📬 Farcaster notification webhook:', {
      event,
      hasNotificationDetails: !!notificationDetails
    });

    if (!event) {
      return NextResponse.json(
        { error: 'event is required' },
        { status: 400 }
      );
    }

    // Extract FID from the signed event (would need verification in production)
    // For now, we'll need to get it from the body or verify the signature
    // The actual webhook format includes signed data - we'd need to verify it
    // But for now, let's handle the basic structure

    if (event === 'miniapp_added' || event === 'notifications_enabled') {
      if (!notificationDetails || !notificationDetails.token || !notificationDetails.url) {
        return NextResponse.json(
          { error: 'notificationDetails with token and url are required' },
          { status: 400 }
        );
      }

      // TODO: Extract FID from signed event data and verify signature
      // For now, we'll need to get FID from the verified event
      // This requires using @farcaster/miniapp-node to verify the webhook

      console.log(`✅ Notifications enabled - token received`);
      // Store token when we have verified FID
      // await query(
      //   `INSERT INTO notification_tokens (fid, token, url, created_at, updated_at)
      //    VALUES ($1, $2, $3, NOW(), NOW())
      //    ON CONFLICT (fid, token) DO UPDATE SET url = $3, updated_at = NOW()`,
      //   [fid, notificationDetails.token, notificationDetails.url]
      // );

      return NextResponse.json({
        success: true,
        message: 'Notification token received'
      });
    } else if (event === 'notifications_disabled' || event === 'miniapp_removed') {
      // TODO: Remove tokens for this user when we have verified FID
      console.log(`❌ Notifications disabled or miniapp removed`);

      return NextResponse.json({
        success: true,
        message: 'Notification disabled'
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

