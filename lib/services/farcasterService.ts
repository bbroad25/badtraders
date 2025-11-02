// lib/services/farcasterService.ts
import { FarcasterProfile } from '@/types/leaderboard';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Only create client if API key exists
const neynarClient = NEYNAR_API_KEY ? new NeynarAPIClient(NEYNAR_API_KEY) : null;

/**
 * Fetches Farcaster profiles (FID and username) for a given list of Ethereum addresses.
 * Uses Neynar API to lookup FIDs by wallet addresses following Farcaster documentation.
 * @param {string[]} addresses - An array of wallet addresses.
 * @returns {Promise<Record<string, FarcasterProfile>>} A mapping from lowercase address to Farcaster profile (includes FID).
 */
export async function getFarcasterProfiles(addresses: string[]): Promise<Record<string, FarcasterProfile>> {
  if (addresses.length === 0 || !NEYNAR_API_KEY || !neynarClient) {
    console.warn("NEYNAR_API_KEY not set, returning empty profile map");
    return {};
  }

  try {
    // Use Neynar's API to fetch users by Ethereum addresses
    // This returns FID, username, and other profile data
    const { users } = await neynarClient.fetchBulkUsersByEthereumAddress(addresses);

    const profileMap: Record<string, FarcasterProfile> = {};

    for (const user of users) {
      // Extract FID - this is the primary identifier for Farcaster users
      const fid = user.fid;

      if (!fid) {
        console.warn(`User ${user.username} has no FID, skipping`);
        continue;
      }

      // A user can have multiple verified addresses, so we map all of them to the same profile
      const verifiedAddresses = user.verified_addresses?.eth_addresses || [];

      for (const address of verifiedAddresses) {
        if (address) {
          profileMap[address.toLowerCase()] = {
            fid: fid,
            username: user.username || '',
            pfp_url: user.pfp_url || '',
            display_name: user.display_name || user.username || '',
          };
        }
      }
    }

    console.log(`Fetched ${Object.keys(profileMap).length} Farcaster profiles with FIDs`);
    return profileMap;
  } catch (error) {
    console.error("Failed to fetch Farcaster profiles from Neynar:", error);
    // Return an empty object on failure so the app can continue without Farcaster data.
    return {};
  }
}

