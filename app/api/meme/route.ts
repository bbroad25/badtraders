// app/api/meme/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateLoserMeme } from '@/lib/services/geminiService';
import { LeaderboardEntry } from '@/types/leaderboard';

export async function POST(req: NextRequest) {
  try {
    const winner: LeaderboardEntry = await req.json();

    if (!winner || (!winner.username && !winner.display_name) || !winner.loss) {
      return NextResponse.json(
        { message: "Invalid loser data - missing username or loss amount" },
        { status: 400 }
      );
    }

    const imageUrl = await generateLoserMeme(winner);
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Error minting loss NFT:", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "An unknown error occurred while minting your loss NFT."
      },
      { status: 500 }
    );
  }
}

