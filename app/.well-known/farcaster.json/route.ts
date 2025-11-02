import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  const webhookUrl = process.env.FARCASTER_WEBHOOK_URL;

  const manifest: any = {
    accountAssociation: {
      type: "account_uri",
      account: "eip155:1:0x0774409Cda69A47f272907fd5D0d80173167BB07"
    },
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
    frame: {
      version: "vNext",
      imageUrl: `${baseUrl}/og-image.jpg`,
      button: {
        title: "Open Leaderboard",
        action: {
          type: "link",
          target: `${baseUrl}/leaderboard`
        }
      },
      homeUrl: baseUrl,
      postUrl: `${baseUrl}/api/frame`
    },
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
      ...(webhookUrl && { webhookUrl }),
    },
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
