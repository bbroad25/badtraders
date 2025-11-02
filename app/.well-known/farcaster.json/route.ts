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
      ogTitle: BADTRADERS - For Traders Who Can't Trade",
      ogDescription: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
      ogImageUrl: "https://badtraders.vercel.app/og-image.jpg",
    },
  }
{
  "accountAssociation": {
    "header": "eyJmaWQiOjcyMTIsInR5cGUiOiJhdXRoIiwia2V5IjoiMHg2QjVGNEViYzZDODUzMjA2RTJlNkMzMTliOWI3YzJGNUY2NGU2ODMxIn0",
    "payload": "eyJkb21haW4iOiJiYWR0cmFkZXJzLnZlcmNlbC5hcHAifQ",
    "signature": "scRafgqIzudsFQ6dpceLg4PY94tjZs6KPNfGjSvSK046iOLxDXF0ZC/FDIhAEGBbo1RvtazAsnzcq6/sjsOTmBs="
  }
}
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
