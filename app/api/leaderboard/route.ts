// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateLeaderboard } from '@/lib/services/leaderboardService';

// Simple in-memory cache (in production, use Redis or similar)
interface Cache {
  leaderboard: any[];
  timestamp: number;
}
let cache: Cache | null = null;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function GET(req: NextRequest) {
  const now = Date.now();

  // Check if we have a valid cache
  if (cache && now - cache.timestamp < CACHE_TTL) {
    console.log("Serving leaderboard from cache.");
    return NextResponse.json(cache.leaderboard);
  }

  try {
    console.log("Generating new leaderboard. This may take a moment...");
    const leaderboardData = await generateLeaderboard();

    // Update the cache
    cache = {
      leaderboard: leaderboardData,
      timestamp: now,
    };
    console.log("Leaderboard generated and cached successfully.");
    return NextResponse.json(leaderboardData);
  } catch (error) {
    console.error("Error generating leaderboard:", error);
    // Return empty array instead of error so UI still works
    const emptyData: any[] = [];
    cache = {
      leaderboard: emptyData,
      timestamp: now,
    };
    return NextResponse.json(emptyData);
  }
}

