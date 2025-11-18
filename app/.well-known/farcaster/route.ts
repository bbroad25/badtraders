import { NextResponse } from 'next/server';

/**
 * Farcaster Mini App Manifest
 * Served at /.well-known/farcaster
 * Must match the structure in .well-known/farcaster.json
 */
export async function GET() {
  // Get the host from the request
  const host = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'badtraders.xyz';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://badtraders.xyz';
  const canonicalDomain = host.replace(/^www\./, '');

  const manifest = {
    miniapp: {
      version: "1",
      name: "Bad Traders",
      iconUrl: "https://badtraders.xyz/icon.jpg",
      homeUrl: "https://badtraders.xyz",
      canonicalDomain: canonicalDomain,
      splashImageUrl: "https://badtraders.xyz/badtraders.png",
      splashBackgroundColor: "#8A63D2",
      imageUrl: "https://badtraders.xyz/og-image.jpg",
      tagline: "We trade bad but we fun good",
      description: "Track the biggest weekly losses. The BadTrader competition leaderboard.",
      primaryCategory: "social",
      // Webhook URL must point to Neynar's webhook proxy for notifications
      webhookUrl: process.env.NEYNAR_CLIENT_ID
        ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
        : `${baseUrl}/api/webhooks/farcaster`, // Fallback if client ID not set
    },
    accountAssociation: {
      header: "eyJmaWQiOjcyMTIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhBODU1ZmFFNEZmY0M1OUM3N0M3NkRjZmEzYUJmREY3NEEyMzQ0YTE4In0",
      payload: "eyJkb21haW4iOiJ3d3cuYmFkdHJhZGVycy54eXoifQ",
      signature: "YDtfGSgFQEhKSRrTo6I+JoKS6KOSH8ijXgej/uNKsIwtnj8/gqHkMUySk9lk3CVIYBsl9VVhO433xHVHkNO6Fxs="
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

