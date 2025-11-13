/**
 * Notification Service using Neynar API
 *
 * Neynar manages notification tokens automatically via webhook.
 * We just call publishFrameNotifications to send to users.
 */

import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';

const neynarConfig = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY || '',
});
const client = new NeynarAPIClient(neynarConfig);

/**
 * Send a notification to users via Neynar
 * @param targetFids Array of FIDs to notify (empty array = all users with notifications enabled)
 * @param title Notification title (max 32 chars)
 * @param body Notification body (max 128 chars)
 * @param targetUrl URL to open when clicked
 */
export async function sendNotification(
  targetFids: number[],
  title: string,
  body: string,
  targetUrl: string
): Promise<void> {
  const notification = {
    title: title.substring(0, 32),
    body: body.substring(0, 128),
    target_url: targetUrl,
  };

  try {
    console.log('🚀 Sending notification via Neynar:', {
      targetFids: targetFids.length === 0 ? 'ALL_USERS' : targetFids,
      title,
      body,
      targetUrl
    });

    const response = await client.publishFrameNotifications({
      targetFids,
      notification
    });

    console.log('✅ Notification sent successfully:', response);
  } catch (error: any) {
    console.error('❌ Failed to send notification:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data
    });
    throw error;
  }
}

/**
 * Broadcast notification to all users (empty targetFids)
 * Used for general announcements
 */
export async function broadcastNotification(
  title: string,
  body: string,
  targetUrl: string
): Promise<void> {
  await sendNotification(
    [], // Empty array = all users with notifications enabled
    title,
    body,
    targetUrl
  );
}

