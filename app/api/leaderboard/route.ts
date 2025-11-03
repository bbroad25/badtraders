// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateLeaderboard } from '@/lib/services/leaderboardService';
import { query } from '@/lib/db/connection';

const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const CACHE_KEY = 'default';

export async function GET(req: NextRequest) {
  try {
    // Check for cached leaderboard in database
    const cacheResult = await query(
      'SELECT leaderboard_data, updated_at FROM leaderboard_cache WHERE cache_key = $1',
      [CACHE_KEY]
    );

    if (cacheResult.rows.length > 0) {
      const cached = cacheResult.rows[0];
      const updatedAt = new Date(cached.updated_at).getTime();
      const cacheAge = Date.now() - updatedAt;

      if (cacheAge < CACHE_TTL) {
        console.log("Serving leaderboard from database cache.");
        // PostgreSQL JSONB returns as object, no need to parse
        const leaderboardData = cached.leaderboard_data;
        return NextResponse.json(leaderboardData);
      }
    }

    // Cache expired or doesn't exist - generate new leaderboard
    console.log("Generating new leaderboard. This may take a moment...");
    const leaderboardData = await generateLeaderboard();

    // Store in database (PostgreSQL - same in dev and production)
    const leaderboardJson = JSON.stringify(leaderboardData);
    await query(
      `INSERT INTO leaderboard_cache (cache_key, leaderboard_data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT(cache_key) DO UPDATE SET
         leaderboard_data = $2::jsonb,
         updated_at = NOW()`,
      [CACHE_KEY, leaderboardJson]
    );

    console.log("Leaderboard generated and cached in database successfully.");
    return NextResponse.json(leaderboardData);
  } catch (error) {
    console.error("Error generating leaderboard:", error);
    // Return empty array instead of error so UI still works
    return NextResponse.json([]);
  }
}

