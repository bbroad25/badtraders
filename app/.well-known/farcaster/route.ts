import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;

  return NextResponse.json({
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
    }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

