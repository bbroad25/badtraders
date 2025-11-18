/**
 * Notification Service using Neynar's managed notification API
 *
 * Uses Neynar's publishFrameNotifications API - no database needed.
 * Neynar handles all token management, batching, and delivery.
 * According to Neynar docs: https://docs.neynar.com/docs/send-notifications-to-mini-app-users
 */

import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';

/**
 * Send notification using Neynar's managed notification API
 * Neynar handles all token management - no database needed
 *
 * @param targetFids Array of FIDs to notify (empty array = all users with notifications enabled)
 * @param title Notification title (max 32 chars)
 * @param body Notification body (max 128 chars)
 * @param targetUrl URL to open when clicked (must be same domain as miniapp)
 * @param notificationId Optional UUID for idempotency. If not provided, generates one.
 */
export async function sendNotification(
  targetFids: number[],
  title: string,
  body: string,
  targetUrl: string,
  notificationId?: string
): Promise<void> {
  try {
    if (!process.env.NEYNAR_API_KEY) {
      throw new Error('NEYNAR_API_KEY environment variable is required');
    }

    const neynarConfig = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });
    const neynarClient = new NeynarAPIClient(neynarConfig);

    const finalUuid = notificationId || `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    console.log(`🚀 Sending notifications via Neynar API:`, {
      targetFids: targetFids.length === 0 ? 'ALL_USERS' : targetFids,
      title,
      body,
      targetUrl,
      uuid: finalUuid
    });

    await neynarClient.publishFrameNotifications({
      targetFids: targetFids,
      notification: {
        title: title.substring(0, 32),
        body: body.substring(0, 128),
        target_url: targetUrl,
        uuid: finalUuid.substring(0, 128)
      }
    });

    console.log(`✅ Notification sent successfully via Neynar`);
  } catch (error: any) {
    console.error('❌ Failed to send notifications via Neynar:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers
    });
    throw error;
  }
}

/**
 * Broadcast notification to all users (empty targetFids)
 * Used for general announcements
 *
 * @param title Notification title (max 32 chars)
 * @param body Notification body (max 128 chars)
 * @param targetUrl URL to open when clicked (max 1024 chars, must be same domain)
 * @param notificationId Optional unique identifier for deduplication (max 128 chars)
 */
export async function broadcastNotification(
  title: string,
  body: string,
  targetUrl: string,
  notificationId?: string
): Promise<void> {
  await sendNotification([], title, body, targetUrl, notificationId);
}

