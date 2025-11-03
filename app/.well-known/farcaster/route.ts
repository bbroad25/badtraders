import { NextResponse } from 'next/server';

/**
 * Farcaster Mini App Manifest
 * Served at /.well-known/farcaster
 * This needs to be signed via Base Build's Preview tool with the new domain
 */
export async function GET() {
  const manifest = {
    accountAssociation: {
      // This will be populated when you sign it via Base Build
      // For now, returning the structure
      domain: "badtraders.xyz",
    },
    // Base Build specific configuration
    baseBuilder: {
      // Will be set when signed
    },
    // Frame fallback
    frame: {
      version: "vNext",
      imageUrl: "https://badtraders.xyz/og-image.jpg",
      button: {
        action: {
          type: "link",
          target: "https://badtraders.xyz/leaderboard",
        },
        title: "Open Leaderboard",
      },
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

