export interface LeaderboardEntry {
  rank: number;
  fid: number;
  username: string;
  display_name: string;
  pfpUrl: string;
  address: string; // Keep for reference but FID is primary
  loss: number;
}

export interface FarcasterProfile {
  fid: number;
  username: string;
  pfp_url: string;
  display_name: string;
}

export interface PnlData {
  fid?: number; // FID if available, otherwise use address
  address: string;
  netLoss: number;
}

