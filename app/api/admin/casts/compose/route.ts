import { NextRequest, NextResponse } from 'next/server';
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';

// Hardcoded admin FIDs
const ADMIN_FIDS = [474867, 7212];

/**
 * POST /api/admin/casts/compose
 *
 * Compose and publish a cast via Neynar API
 * Requires admin access (FID check) and NEYNAR_SIGNER_UUID
 *
 * Request body:
 * {
 *   text: string,           // Cast text content
 *   embeds?: string[],      // Optional: URLs to embed
 *   mentions?: number[]     // Optional: FIDs to mention
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, embeds, mentions } = body;

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
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'text is required and must be a string' },
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

    // Check if NEYNAR_SIGNER_UUID is set (required for publishing casts via Neynar API)
    // Note: Notifications don't need this, only cast publishing does
    if (!process.env.NEYNAR_SIGNER_UUID) {
      console.error('❌ NEYNAR_SIGNER_UUID not configured');
      return NextResponse.json(
        {
          error: 'Neynar signer UUID not configured. Cast publishing requires a signer UUID. Get one from Neynar dashboard.',
          hint: 'Notifications work without a signer UUID, but automated cast publishing requires NEYNAR_SIGNER_UUID to be set.'
        },
        { status: 500 }
      );
    }

    // Initialize Neynar client
    const neynarConfig = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });
    const neynarClient = new NeynarAPIClient(neynarConfig);

    // Prepare cast data
    const castData: any = {
      signerUuid: process.env.NEYNAR_SIGNER_UUID,
      text: text,
    };

    // Add embeds if provided
    if (embeds && Array.isArray(embeds) && embeds.length > 0) {
      castData.embeds = embeds;
    }

    // Add mentions if provided (convert FIDs to mentions format)
    if (mentions && Array.isArray(mentions) && mentions.length > 0) {
      // Neynar API expects mentions as FIDs in the text with @mentions or as a mentions array
      // For simplicity, we'll add them to the text if not already present
      castData.mentions = mentions;
    }

    console.log('🚀 Publishing cast via Neynar:', {
      textLength: text.length,
      hasEmbeds: !!(embeds && embeds.length > 0),
      hasMentions: !!(mentions && mentions.length > 0)
    });

    // Publish cast
    const response = await neynarClient.publishCast(castData);

    console.log('✅ Cast published successfully:', response);

    return NextResponse.json({
      success: true,
      message: 'Cast published successfully',
      cast: {
        hash: response.hash,
        author: response.author,
        text: response.text
      }
    });
  } catch (error: any) {
    console.error('❌ Cast composition API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to publish cast',
        details: error?.response?.data || error?.stack
      },
      { status: 500 }
    );
  }
}

