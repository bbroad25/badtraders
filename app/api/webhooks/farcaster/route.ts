import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { parseWebhookEvent, verifyAppKeyWithNeynar } from '@farcaster/miniapp-node';

/**
 * POST /api/webhooks/farcaster
 *
 * Webhook endpoint to handle Farcaster notification events
 * According to Farcaster docs: https://miniapps.farcaster.xyz/docs/guides/notifications
 *
 * Events are signed JSON Farcaster Signatures with format:
 * {
 *   header: string (base64url encoded),
 *   payload: string (base64url encoded),
 *   signature: string (base64url encoded)
 * }
 *
 * Event types:
 * - miniapp_added: { event: "miniapp_added", notificationDetails: { token, url } }
 * - notifications_enabled: { event: "notifications_enabled", notificationDetails: { token, url } }
 * - notifications_disabled: { event: "notifications_disabled" }
 * - miniapp_removed: { event: "miniapp_removed" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📬 Farcaster notification webhook received:', {
      hasHeader: !!body.header,
      hasPayload: !!body.payload,
      hasSignature: !!body.signature,
      hasEvent: !!body.event,
      hasFid: !!body.fid,
      bodyKeys: Object.keys(body),
      bodySample: JSON.stringify(body).substring(0, 500) // Log first 500 chars for debugging
    });

    let verifiedEvent: any;

    // Check if this is Neynar's forwarded format (already parsed) or Farcaster's signature format
    if (body.header && body.payload && body.signature) {
      // Farcaster signature format - needs parsing
      console.log('📝 Detected Farcaster signature format, parsing...');
      try {
        verifiedEvent = await parseWebhookEvent(body, verifyAppKeyWithNeynar);
        console.log('✅ Webhook signature verified:', {
          fid: verifiedEvent.fid,
          event: verifiedEvent.event
        });
      } catch (verifyError: any) {
        console.error('❌ Webhook signature verification failed:', verifyError);

        // Handle specific error types per Farcaster docs
        if (verifyError.name === 'VerifyJsonFarcasterSignature.InvalidDataError' ||
            verifyError.name === 'VerifyJsonFarcasterSignature.InvalidEventDataError') {
          return NextResponse.json(
            { error: 'Invalid webhook data', details: verifyError.message },
            { status: 400 }
          );
        } else if (verifyError.name === 'VerifyJsonFarcasterSignature.InvalidAppKeyError') {
          return NextResponse.json(
            { error: 'Invalid app key', details: verifyError.message },
            { status: 401 }
          );
        } else if (verifyError.name === 'VerifyJsonFarcasterSignature.VerifyAppKeyError') {
          return NextResponse.json(
            { error: 'Verification service error', details: verifyError.message },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: 'Invalid webhook signature', details: verifyError.message },
          { status: 401 }
        );
      }
    } else if (body.event && body.fid !== undefined) {
      // Neynar forwarded format - already parsed, just use it directly
      console.log('📝 Detected Neynar forwarded format, using directly');
      verifiedEvent = {
        event: body.event,
        fid: body.fid,
        notificationDetails: body.notificationDetails
      };
      console.log('✅ Using Neynar forwarded event:', {
        fid: verifiedEvent.fid,
        event: verifiedEvent.event
      });
    } else {
      // Unknown format
      console.error('❌ Unknown webhook format:', body);
      return NextResponse.json(
        { error: 'Unknown webhook format. Expected Farcaster signature or Neynar forwarded format.' },
        { status: 400 }
      );
    }

    const { event, notificationDetails } = verifiedEvent;
    const fid = verifiedEvent.fid;

    if (!event) {
      return NextResponse.json(
        { error: 'event is required in verified payload' },
        { status: 400 }
      );
    }

    if (event === 'miniapp_added' || event === 'notifications_enabled') {
      if (!notificationDetails || !notificationDetails.token || !notificationDetails.url) {
        return NextResponse.json(
          { error: 'notificationDetails with token and url are required' },
          { status: 400 }
        );
      }

      console.log(`✅ Notifications enabled for FID ${fid} - storing token`);

      // Store the notification token
      await query(
        `INSERT INTO notification_tokens (fid, token, url, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (fid, token) DO UPDATE SET url = $3, updated_at = NOW()`,
        [fid, notificationDetails.token, notificationDetails.url]
      );

      console.log(`✅ Notification token stored for FID ${fid}`);

      return NextResponse.json({
        success: true,
        message: 'Notification token received and stored'
      });
    } else if (event === 'notifications_disabled' || event === 'miniapp_removed') {
      console.log(`❌ Notifications disabled or miniapp removed for FID ${fid}`);

      // Remove all tokens for this FID
      await query(
        `DELETE FROM notification_tokens WHERE fid = $1`,
        [fid]
      );

      console.log(`✅ Notification tokens removed for FID ${fid}`);

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

