import { NextResponse } from "next/server"

export async function GET() {
  const manifest = {
    miniapp: {
      version: "1",
      name: "$BADTRADERS",
      homeUrl: "https://badtraders.vercel.app",
      iconUrl: "https://badtraders.vercel.app/icon.jpg",
      splashImageUrl: "https://badtraders.vercel.app/icon.jpg",
      splashBackgroundColor: "#000000",
      description: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
      tagline: "For Traders Who Can't Trade",
      ogTitle: $BADTRADERS - For Traders Who Can't Trade",
      ogDescription: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
      ogImageUrl: "https://badtraders.vercel.app/og-image.jpg",
    },
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
