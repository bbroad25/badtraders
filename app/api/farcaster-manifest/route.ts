import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Get the host from the request - handles both www and non-www
  const host = req.headers.get('host') || 'badtraders.xyz';
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${protocol}://${host}`;

  // Normalize domain - remove www for canonicalDomain but keep it in URLs
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
      primaryCategory: "social"
    },
    accountAssociation: {
      header: "eyJmaWQiOjcyMTIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhBODU1ZmFFNEZmY0M1OUM3N0M3NkRjZmEzYUJmREY3NEEyMzQ0YTE4In0",
      payload: "eyJkb21haW4iOiJiYWR0cmFkZXJzLnh5eiJ9",
      signature: "UMNPzKG3f1sr1ZfgCKpuFhgFMhpodHLaIY+wrTTNXfQE8IbyzlXtDqKYSjTcLAMH9sYWOueC7UTvs2t2ViKJRRs="
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

