/**
 * Notification Service using stored Farcaster notification tokens
 *
 * Uses tokens stored in database (synced from Neynar via webhook or check endpoint).
 * This allows sending notifications without relying on Neynar's API directly.
 * According to Farcaster spec: https://miniapps.farcaster.xyz/docs/guides/notifications
 */

import { query } from '@/lib/db/connection';

/**
 * Send notification using stored Farcaster notification tokens
 * Posts directly to Farcaster's notification API using stored tokens
 *
 * @param targetFids Array of FIDs to notify (empty array = all users with notifications enabled)
 * @param title Notification title (max 32 chars)
 * @param body Notification body (max 128 chars)
 * @param targetUrl URL to open when clicked (max 1024 chars, must be same domain)
 * @param notificationId Unique identifier for deduplication (max 128 chars). If not provided, generates one.
 */
export async function sendNotification(
  targetFids: number[],
  title: string,
  body: string,
  targetUrl: string,
  notificationId?: string
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
      throw new Error('No notification tokens found for target FIDs. Users may need to enable notifications first.');
    }

    // Generate notificationId if not provided (for deduplication)
    const finalNotificationId = notificationId || `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Group tokens by URL (same Farcaster client)
    // Tokens from the same client can be batched together
    const tokensByUrl = new Map<string, Array<{ fid: number; token: string }>>();

    for (const tokenRow of tokens) {
      const url = tokenRow.url;
      if (!tokensByUrl.has(url)) {
        tokensByUrl.set(url, []);
      }
      tokensByUrl.get(url)!.push({
        fid: tokenRow.fid,
        token: tokenRow.token
      });
    }

    console.log(`🚀 Sending notifications to ${tokens.length} users via Farcaster API:`, {
      targetFids: targetFids.length === 0 ? 'ALL_USERS' : targetFids,
      title,
      body,
      targetUrl,
      notificationId: finalNotificationId,
      batches: tokensByUrl.size
    });

    // Send batched requests (up to 100 tokens per request per Farcaster spec)
    const BATCH_SIZE = 100;
    const allInvalidTokens: string[] = [];
    const allRateLimitedTokens: string[] = [];
    let totalSuccessCount = 0;

    for (const [url, urlTokens] of tokensByUrl.entries()) {
      // Process tokens in batches of 100
      for (let i = 0; i < urlTokens.length; i += BATCH_SIZE) {
        const batch = urlTokens.slice(i, i + BATCH_SIZE);
        const tokenStrings = batch.map(t => t.token);

        try {
          // According to Farcaster spec, request body format:
          // {
          //   notificationId: string (max 128 chars),
          //   title: string (max 32 chars),
          //   body: string (max 128 chars),
          //   targetUrl: string (max 1024 chars, must be same domain),
          //   tokens: string[] (max 100 tokens)
          // }
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
              // NO Authorization header - tokens go in body
            },
            body: JSON.stringify({
              notificationId: finalNotificationId.substring(0, 128),
              title: title.substring(0, 32),
              body: body.substring(0, 128),
              targetUrl: targetUrl.substring(0, 1024),
              tokens: tokenStrings
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const responseData = await response.json();

          // Response format per Farcaster spec:
          // {
          //   successfulTokens: string[],
          //   invalidTokens: string[],
          //   rateLimitedTokens: string[]
          // }
          const { successfulTokens = [], invalidTokens = [], rateLimitedTokens = [] } = responseData;

          totalSuccessCount += successfulTokens.length;
          allInvalidTokens.push(...invalidTokens);
          allRateLimitedTokens.push(...rateLimitedTokens);

          console.log(`✅ Batch sent: ${successfulTokens.length} succeeded, ${invalidTokens.length} invalid, ${rateLimitedTokens.length} rate-limited`);

        } catch (error: any) {
          console.error(`❌ Failed to send notification batch to ${url}:`, error);
          // Mark all tokens in this batch as potentially failed
          // But don't delete them - might be a temporary error
        }
      }
    }

    // Remove invalid tokens from database (they should never be used again)
    if (allInvalidTokens.length > 0) {
      console.log(`🗑️ Removing ${allInvalidTokens.length} invalid tokens from database`);
      await query(
        'DELETE FROM notification_tokens WHERE token = ANY($1)',
        [allInvalidTokens]
      );
    }

    // Log rate-limited tokens (can retry later)
    if (allRateLimitedTokens.length > 0) {
      console.warn(`⚠️ ${allRateLimitedTokens.length} tokens were rate-limited. Can retry later.`);
    }

    console.log(`✅ Notification results: ${totalSuccessCount} succeeded, ${allInvalidTokens.length} invalid, ${allRateLimitedTokens.length} rate-limited`);

    // If all failed, throw an error
    if (totalSuccessCount === 0 && tokens.length > 0 && allRateLimitedTokens.length === 0) {
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

