/**
 * Notification Service using Farcaster's standard notification API
 *
 * We store notification tokens from webhook events and send notifications
 * directly to each user's notificationDetails.url using their stored token.
 */

import { query } from '@/lib/db/connection';

/**
 * Send notification using stored Farcaster notification tokens
 * Posts directly to Farcaster's notification API using stored tokens
 *
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
  try {
    // Get notification tokens from database
    let tokensQuery;
    if (targetFids.length === 0) {
      // Broadcast to all users
      tokensQuery = await query(
        'SELECT fid, token, url FROM notification_tokens WHERE token IS NOT NULL AND url IS NOT NULL'
      );
    } else {
      // Specific FIDs
      tokensQuery = await query(
        'SELECT fid, token, url FROM notification_tokens WHERE fid = ANY($1) AND token IS NOT NULL AND url IS NOT NULL',
        [targetFids]
      );
    }

    const tokens = tokensQuery.rows;

    if (tokens.length === 0) {
      console.warn('⚠️ No notification tokens found for target FIDs');
      return;
    }

    console.log(`🚀 Sending notifications to ${tokens.length} users via Farcaster API:`, {
      targetFids: targetFids.length === 0 ? 'ALL_USERS' : targetFids,
      title,
      body,
      targetUrl
    });

    // Send to each user's notification URL
    const results = await Promise.allSettled(
      tokens.map(async (tokenRow: any) => {
        try {
          const response = await fetch(tokenRow.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenRow.token}`
            },
            body: JSON.stringify({
              title: title.substring(0, 32),
              body: body.substring(0, 128),
              target_url: targetUrl
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const responseData = await response.json();
          return { fid: tokenRow.fid, status: 'success', data: responseData };
        } catch (error: any) {
          console.error(`❌ Failed to send notification to FID ${tokenRow.fid}:`, error);
          return { fid: tokenRow.fid, status: 'failed', error: error.message };
        }
      })
    );

    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.status === 'success'
    ).length;
    const failureCount = results.length - successCount;

    console.log(`✅ Notification results: ${successCount} succeeded, ${failureCount} failed`);

    if (failureCount > 0) {
      const failures = results
        .filter(r => r.status === 'fulfilled' && r.value.status === 'failed')
        .map(r => (r as PromiseFulfilledResult<any>).value);
      console.warn('⚠️ Failed notifications:', failures);
    }

    // If all failed, throw an error
    if (successCount === 0 && tokens.length > 0) {
      throw new Error(`All ${tokens.length} notification attempts failed`);
    }
  } catch (error: any) {
    console.error('❌ Failed to send notifications:', error);
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
  await sendNotification([], title, body, targetUrl);
}

