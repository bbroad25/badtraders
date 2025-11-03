import { NextResponse } from 'next/server';

/**
 * Farcaster Mini App Manifest
 * Served at /.well-known/farcaster
 * This needs to be signed via Base Build's Preview tool with the new domain
 */
export async function GET() {
  const manifest = {
  "accountAssociation": {
    "header": "eyJmaWQiOjcyMTIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhBODU1ZmFFNEZmY0M1OUM3N0M3NkRjZmEzYUJmREY3NEEyMzQ0YTE4In0",
    "payload": "eyJkb21haW4iOiJiYWR0cmFkZXJzLnh5eiJ9",
    "signature": "UMNPzKG3f1sr1ZfgCKpuFhgFMhpodHLaIY+wrTTNXfQE8IbyzlXtDqKYSjTcLAMH9sYWOueC7UTvs2t2ViKJRRs="
  },
  "frame": {
    "version": "1",
    "name": "$BADTRADERS",
    "iconUrl": "https://www.badtraders.xyz/icon.png",
    "homeUrl": "https://www.badtraders.xyz",
    "imageUrl": "https://www.badtraders.xyz/image.png",
    "buttonTitle": "Check this out",
    "splashImageUrl": "https://www.badtraders.xyz/splash.png",
    "splashBackgroundColor": "#eeccff",
    "webhookUrl": "https://www.badtraders.xyz/api/webhook"
  }
};

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

