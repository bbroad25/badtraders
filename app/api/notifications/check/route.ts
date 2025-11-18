import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';

/**
 * GET /api/notifications/check?fid=123
 *
 * Check if a user has notifications enabled (has a token stored)
 * First checks Neynar's API (if using managed notifications), then falls back to local database
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'fid query parameter is required' },
        { status: 400 }
      );
    }

    const fidNumber = parseInt(fid, 10);
    if (isNaN(fidNumber)) {
      return NextResponse.json(
        { error: 'fid must be a valid number' },
        { status: 400 }
      );
    }

    let hasNotifications = false;
    let tokenCount = 0;
    let tokens: any[] = [];
    let source = 'database';
    let neynarTokensResponse: any = null; // Store for later sync

    // First, try to check Neynar's API (if using managed notifications)
    if (process.env.NEYNAR_API_KEY) {
      try {
        const neynarConfig = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });
        const neynarClient = new NeynarAPIClient(neynarConfig);

        // Try to fetch notification tokens from Neynar
        try {
          // Fetch notification tokens for this specific FID
          neynarTokensResponse = await neynarClient.fetchNotificationTokens({
            fids: [fidNumber]
          });

          // Check if response has notification_tokens array
          if (neynarTokensResponse && neynarTokensResponse.notification_tokens && Array.isArray(neynarTokensResponse.notification_tokens)) {
            tokenCount = neynarTokensResponse.notification_tokens.length;
            hasNotifications = tokenCount > 0;
            tokens = neynarTokensResponse.notification_tokens.map((tokenData: any) => ({
              fid: tokenData.fid || fidNumber,
              token: tokenData.token ? `${tokenData.token.substring(0, 10)}...` : null,
              url: tokenData.url || null,
              status: tokenData.status || null,
              source: 'neynar'
            }));
            source = 'neynar';
            console.log(`✅ Found ${tokenCount} notification token(s) in Neynar for FID ${fidNumber}`);
          } else if (neynarTokensResponse && neynarTokensResponse.notification_tokens && neynarTokensResponse.notification_tokens.length === 0) {
            // Explicitly no tokens
            hasNotifications = false;
            tokenCount = 0;
            tokens = [];
            source = 'neynar';
            console.log(`✅ No notification tokens found in Neynar for FID ${fidNumber}`);
          }
        } catch (neynarApiError: any) {
          // API method might not exist or have different signature
          // Log and fall back to database check
          console.log(`⚠️ Neynar API check failed, falling back to database: ${neynarApiError.message}`);
        }
      } catch (neynarError: any) {
        console.warn(`⚠️ Neynar client initialization failed, using database only: ${neynarError.message}`);
      }
    }

    // Sync database with Neynar's current state
    // If Neynar says user has notifications, store tokens in DB
    // If Neynar says user has NO notifications, remove tokens from DB
    try {
      const dbResult = await query(
        'SELECT fid, token, url, created_at, updated_at FROM notification_tokens WHERE fid = $1',
        [fidNumber]
      );

      const dbTokens = dbResult.rows;
      const hasDbTokens = dbTokens.length > 0;

      // If Neynar has tokens but DB doesn't, sync DB with Neynar
      if (hasNotifications && source === 'neynar' && neynarTokensResponse && neynarTokensResponse.notification_tokens) {
        console.log(`🔄 Syncing database with Neynar tokens for FID ${fidNumber}`);
        for (const neynarTokenData of neynarTokensResponse.notification_tokens) {
          if (neynarTokenData.token && neynarTokenData.url && (neynarTokenData.fid === fidNumber || !neynarTokenData.fid)) {
            await query(
              `INSERT INTO notification_tokens (fid, token, url, created_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())
               ON CONFLICT (fid, token) DO UPDATE SET url = $3, updated_at = NOW()`,
              [fidNumber, neynarTokenData.token, neynarTokenData.url]
            );
          }
        }
        console.log(`✅ Synced ${neynarTokensResponse.notification_tokens.length} token(s) to database for FID ${fidNumber}`);
      }

      // If Neynar has NO tokens but DB has tokens, remove stale tokens from DB
      if (!hasNotifications && source === 'neynar' && hasDbTokens) {
        console.log(`🗑️ Removing stale tokens from database for FID ${fidNumber} (no tokens in Neynar)`);
        await query(
          'DELETE FROM notification_tokens WHERE fid = $1',
          [fidNumber]
        );
        console.log(`✅ Removed ${dbTokens.length} stale token(s) from database for FID ${fidNumber}`);
        // Update our response to reflect cleaned state
        tokenCount = 0;
        tokens = [];
      }

      // If Neynar API failed, fall back to database
      if (source !== 'neynar' && hasDbTokens) {
        hasNotifications = true;
        tokenCount = dbTokens.length;
        tokens = dbTokens.map(row => ({
          fid: row.fid,
          token: row.token ? `${row.token.substring(0, 10)}...` : null,
          url: row.url,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          source: 'database'
        }));
        source = 'database';
        console.log(`✅ Found ${tokenCount} notification token(s) in database for FID ${fidNumber}`);
      }
    } catch (dbError: any) {
      console.error(`❌ Database sync failed: ${dbError.message}`);
      // Continue with whatever we have from Neynar (even if empty)
    }

    return NextResponse.json({
      success: true,
      fid: fidNumber,
      hasNotifications,
      tokenCount,
      tokens,
      source // Indicate where we got the data from
    });
  } catch (error: any) {
    console.error('❌ Error checking notifications:', error);
    return NextResponse.json(
      { error: 'Failed to check notifications', message: error.message },
      { status: 500 }
    );
  }
}

