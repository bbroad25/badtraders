import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  const webhookUrl = process.env.FARCASTER_WEBHOOK_URL;

  const manifest: any = {
    // Updated accountAssociation from your new manifest
    accountAssociation: {
      header: "eyJmaWQiOjcyMTIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhBODU1ZmFFNEZmY0M1OUM3N0M3NkRjZmEzYUJmREY3NEEyMzQ0YTE4In0",
      payload: "eyJkb21haW4iOiJiYWR0cmFkZXJzLnh5eiJ9",
      signature: "UMNPzKG3f1sr1ZfgCKpuFhgFMhpodHLaIY+wrTTNXfQE8IbyzlXtDqKYSjTcLAMH9sYWOueC7UTvs2t2ViKJRRs=",
    },

    // Keep baseBuilder as-is
    baseBuilder: {
      version: "1",
      title: "$BADTRADERS Leaderboard",
      description: "Track the biggest weekly losses. The $BadTrader competition leaderboard.",
      imageUrl: `${baseUrl}/og-image.jpg`,
      button: {
        title: "Open Leaderboard",
        action: {
          type: "launch"
        }
      },
      homeUrl: baseUrl,
      postUrl: `${baseUrl}/api/frame`
    },

    // Updated frame from your new manifest
    frame: {
      version: "1",
      name: "$BADTRADERS",
      iconUrl: "https://www.badtraders.xyz/icon.png",
      homeUrl: "https://www.badtraders.xyz",
      imageUrl: "https://www.badtraders.xyz/image.png",
      buttonTitle: "Check this out",
      splashImageUrl: "https://www.badtraders.xyz/splash.png",
      splashBackgroundColor: "#eeccff",
      webhookUrl: webhookUrl || "https://badtraders.xyz/api/webhook"
    },

    // Keep miniapp as-is, optionally update URLs if needed
    miniapp: {
      version: "1",
      name: "$BADTRADERS",
      subtitle: "Bad Traders",
      homeUrl: baseUrl,
      iconUrl: `${baseUrl}/icon.jpg`,
      imageUrl: `${baseUrl}/og-image.jpg`,
      splashImageUrl: `${baseUrl}/badtraders.png`,
      splashBackgroundColor: "#000000",
      description: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
      tagline: "For Traders Who Can't Trade",
      primaryCategory: "social",
      ogTitle: "$BADTRADERS - For Traders Who Can't Trade",
      ogDescription: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
      ogImageUrl: `${baseUrl}/og-image.jpg`,
    },
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
