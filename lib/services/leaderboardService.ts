// lib/services/leaderboardService.ts
import { getEligibleWallets, getNetLossForWallets } from './blockchainService';
import { getFarcasterProfiles } from './farcasterService';
import { LeaderboardEntry, PnlData, FarcasterProfile } from '@/types/leaderboard';

const DEFAULT_PFP = 'https://i.imgur.com/sB02Hbz.png'; // Default PFP for users without one

/**
 * Orchestrates the entire process of generating the leaderboard.
 * 1. Fetches eligible wallets from the blockchain.
 * 2. Fetches Farcaster profiles for those wallets.
 * 3. Calculates the net loss for each wallet from their trades.
 * 4. Merges all data and formats it into the final leaderboard.
 * @returns {Promise<LeaderboardEntry[]>} The sorted leaderboard data.
 */
export async function generateLeaderboard(): Promise<LeaderboardEntry[]> {
  console.log("Step 1: Finding eligible wallets...");
  const eligibleWallets = await getEligibleWallets();
  if (eligibleWallets.length === 0) {
    console.log("No eligible wallets found.");
    return [];
  }
  console.log(`Found ${eligibleWallets.length} eligible wallets.`);

  console.log("Step 2: Fetching Farcaster profiles...");
  const farcasterProfiles = await getFarcasterProfiles(eligibleWallets);
  console.log(`Found ${Object.keys(farcasterProfiles).length} Farcaster profiles.`);

  console.log("Step 3: Calculating P&L for wallets...");
  const pnlData = await getNetLossForWallets(eligibleWallets);
  console.log(`Calculated P&L for ${pnlData.length} wallets.`);

  // Filter for traders who actually have a loss
  const losers = pnlData.filter(p => p.netLoss > 0);

  // Sort by the highest loss
  losers.sort((a, b) => b.netLoss - a.netLoss);

  console.log("Step 4: Assembling the final leaderboard (by FID and username)...");

  // Group PnL data by FID if available, otherwise by address
  const pnlByFid = new Map<number, { address: string; netLoss: number }>();
  const pnlByAddress = new Map<string, { address: string; netLoss: number }>();

  for (const trader of losers) {
    const address = trader.address.toLowerCase();
    const profile = farcasterProfiles[address];

    if (profile?.fid) {
      // Use FID as primary identifier
      const existing = pnlByFid.get(profile.fid);
      if (existing) {
        // If multiple wallets for same FID, combine losses
        existing.netLoss += trader.netLoss;
      } else {
        pnlByFid.set(profile.fid, { address: trader.address, netLoss: trader.netLoss });
      }
    } else {
      // No FID found, use address
      pnlByAddress.set(address, { address: trader.address, netLoss: trader.netLoss });
    }
  }

  // Build leaderboard entries with FID and username
  const leaderboard: LeaderboardEntry[] = [];

  // Add entries with FIDs (these are primary)
  for (const [fid, pnlData] of pnlByFid) {
    const address = pnlData.address.toLowerCase();
    const profile = farcasterProfiles[address];

    leaderboard.push({
      rank: 0, // Will be set after sorting
      fid: fid,
      username: profile?.username || '',
      display_name: profile?.display_name || profile?.username || '',
      address: pnlData.address,
      pfpUrl: profile?.pfp_url || DEFAULT_PFP,
      loss: Math.round(pnlData.netLoss),
    });
  }

  // Add entries without FIDs (secondary, by address)
  for (const [address, pnlData] of pnlByAddress) {
    leaderboard.push({
      rank: 0, // Will be set after sorting
      fid: 0, // No FID available
      username: `${pnlData.address.slice(0, 6)}...${pnlData.address.slice(-4)}`,
      display_name: `${pnlData.address.slice(0, 6)}...${pnlData.address.slice(-4)}`,
      address: pnlData.address,
      pfpUrl: DEFAULT_PFP,
      loss: Math.round(pnlData.netLoss),
    });
  }

  // Sort by loss (descending) and assign ranks
  leaderboard.sort((a, b) => b.loss - a.loss);
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return leaderboard;
}

