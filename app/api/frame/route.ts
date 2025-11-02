import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;

  return NextResponse.json({
    name: "BadTraders Leaderboard",
    version: "1.0.0",
    imageUrl: `${baseUrl}/og-image.jpg`,
    button: {
      action: {
        type: "link",
        target: `${baseUrl}/leaderboard`
      },
      text: "View Leaderboard"
    },
    postUrl: `${baseUrl}/api/frame`,
    homeUrl: baseUrl,
  }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const baseUrl = req.nextUrl.origin;

    // Handle Farcaster Frame/Mini App interactions
    // This can handle button clicks, form submissions, etc.

    return NextResponse.json({
      type: "redirect",
      url: `${baseUrl}/leaderboard`
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

