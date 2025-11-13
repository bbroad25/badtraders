import { NextRequest, NextResponse } from 'next/server';
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';
import { query } from '@/lib/db/connection';

// Hardcoded admin FIDs
const ADMIN_FIDS = [474867, 7212];

/**
 * POST /api/admin/loserboard/add
 *
 * Add a user to the manual loserboard
 * Requires admin access (FID check)
 *
 * Request body:
 * {
 *   usernameOrFid: string,      // Username or FID to add
 *   sendNotification: boolean,   // Whether to send notification
 *   composeCast: boolean        // Whether to compose and publish a cast
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usernameOrFid, sendNotification, composeCast } = body;

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
    if (!usernameOrFid || typeof usernameOrFid !== 'string') {
      return NextResponse.json(
        { error: 'usernameOrFid is required and must be a string' },
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

    // Initialize Neynar client
    const neynarConfig = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });
    const neynarClient = new NeynarAPIClient(neynarConfig);

    // Look up user via Neynar API
    let userData: any = null;
    const isNumeric = /^\d+$/.test(usernameOrFid.trim());

    try {
      if (isNumeric) {
        // Treat as FID
        const fidToLookup = parseInt(usernameOrFid.trim(), 10);
        const response = await neynarClient.lookupUserByFid({ fid: fidToLookup });
        userData = response.result?.user || response;
      } else {
        // Treat as username
        const username = usernameOrFid.trim().replace('@', '');
        const response = await neynarClient.lookupUserByUsername({ username });
        userData = response.result?.user || response;
      }
    } catch (neynarError: any) {
      console.error('❌ Error looking up user via Neynar:', neynarError);
      return NextResponse.json(
        { error: `Failed to find user: ${neynarError.message || 'User not found'}` },
        { status: 404 }
      );
    }

    if (!userData || !userData.fid) {
      return NextResponse.json(
        { error: 'User not found or invalid user data' },
        { status: 404 }
      );
    }

    // Extract user information
    const userFid = userData.fid;
    const username = userData.username || '';
    const displayName = userData.display_name || userData.username || '';
    const pfpUrl = userData.pfp_url || '';
    const addresses = userData.verified_addresses?.eth_addresses || [];
    const address = addresses.length > 0 ? addresses[0] : null;

    // Check if user already exists in loserboard
    const existingCheck = await query(
      'SELECT id FROM manual_loserboard_entries WHERE fid = $1',
      [userFid]
    );

    if (existingCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'User is already in the loserboard' },
        { status: 400 }
      );
    }

    // Insert into database
    const insertResult = await query(
      `INSERT INTO manual_loserboard_entries
       (fid, username, display_name, address, pfp_url, added_by_fid)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, added_at`,
      [userFid, username, displayName, address, pfpUrl, fid]
    );

    const entry = insertResult.rows[0];

    console.log('✅ Added user to loserboard:', {
      fid: userFid,
      username,
      addedBy: fid
    });

    // Send notification if requested
    let notificationResult = null;
    if (sendNotification) {
      try {
        const notificationResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/notifications/send?fid=${fid}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: '🏆 New Loser Added!',
              body: `@${username} has been added to the loserboard!`,
              targetFid: userFid,
              url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://badtraders.xyz'}/leaderboard`
            })
          }
        );

        if (notificationResponse.ok) {
          notificationResult = { success: true };
        } else {
          const errorData = await notificationResponse.json();
          notificationResult = { success: false, error: errorData.error };
        }
      } catch (notifError: any) {
        console.error('❌ Error sending notification:', notifError);
        notificationResult = { success: false, error: notifError.message };
      }
    }

    // Note: Cast composition is handled client-side via Farcaster SDK composeCast
    // The composeCast flag is passed back to the client to handle
    let castResult = null;
    if (composeCast) {
      // Cast will be composed client-side after this response
      castResult = { success: true, pending: true, message: 'Cast will be composed client-side' };
    }

    return NextResponse.json({
      success: true,
      message: 'User added to loserboard successfully',
      entry: {
        id: entry.id,
        fid: userFid,
        username,
        displayName,
        address,
        pfpUrl,
        addedAt: entry.added_at,
        addedBy: fid
      },
      notification: notificationResult,
      cast: castResult
    });
  } catch (error: any) {
    console.error('❌ Add loserboard entry API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add user to loserboard' },
      { status: 500 }
    );
  }
}

