// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { LeaderboardEntry } from '@/types/leaderboard';

const DEFAULT_PFP = 'https://i.imgur.com/sB02Hbz.png'; // Default PFP for users without one

export async function GET(req: NextRequest) {
  try {
    // Since automated PnL isn't working yet, return manual loserboard entries
    console.log("Fetching manual loserboard entries...");

    const result = await query(
      `SELECT
        id,
        fid,
        username,
        display_name,
        address,
        pfp_url,
        added_at,
        added_by_fid
       FROM manual_loserboard_entries
       ORDER BY added_at DESC`,
      []
    );

    // Format entries to match LeaderboardEntry interface
    const leaderboard: LeaderboardEntry[] = result.rows.map((row, index) => ({
      rank: index + 1,
      fid: row.fid || 0,
      username: row.username || '',
      display_name: row.display_name || row.username || '',
      pfpUrl: row.pfp_url || DEFAULT_PFP,
      address: row.address || '',
      loss: 0 // Manual entries don't have loss amounts tracked
    }));

    console.log(`Returning ${leaderboard.length} manual loserboard entries.`);
    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    // Return empty array instead of error so UI still works
    return NextResponse.json([]);
  }
}

