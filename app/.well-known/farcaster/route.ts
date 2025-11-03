import { NextResponse } from 'next/server';

export async function GET() {
  // Manifest with correct miniapp structure
  const manifest = {
    miniapp: {
      version: "1",
      name: "Bad Traders",
      iconUrl: "https://badtraders.xyz/icon.jpg",
      homeUrl: "https://badtraders.xyz",
      imageUrl: "https://badtraders.xyz/og-image.jpg",
      splashImageUrl: "https://badtraders.xyz/badtraders.png",
      splashBackgroundColor: "#8A63D2",
      tagline: "We trade bad but we fun good",
      description: "Track the biggest weekly losses. The BadTrader competition leaderboard.",
      primaryCategory: "social"
    },
    accountAssociation: {
      header: "eyJmaWQiOjQ3NDg2NywidHlwZSI6ImF1dGgiLCJrZXkiOiIweDhERkJkRUVDOGM1ZDQ5NzBCQjVGNDgxQzZlYzdmNzNmYTFDNjViZTUifQ",
      payload: "eyJkb21haW4iOiJiYWR0cmFkZXJzLnZlcmNlbC5hcHAifQ",
      signature: "q88WynF2zmG4EfZv2xYJJDYobMiWFmCu6E/HhR/1efMsI4YyoO0yY1Yy3/i8j7TjlavJKAUi0d2zKUMt/r/AmBw="
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}
