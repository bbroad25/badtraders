/**
 * Centralized eligibility threshold configuration
 * Single source of truth for all eligibility requirements
 */

// Competition eligibility thresholds
export const FARCASTER_ELIGIBILITY_THRESHOLD = 1_000_000; // 1M tokens for Farcaster miniapp users
export const WEBSITE_ELIGIBILITY_THRESHOLD = 2_000_000; // 2M tokens for website users

// NFT mint eligibility thresholds
export const FARCASTER_MINT_THRESHOLD = 10_000_000; // 10M tokens for Farcaster users (NFT mint)
export const WEBSITE_MINT_THRESHOLD = 10_000_000; // 10M tokens for website users (NFT mint)

// Contest eligibility thresholds
export const CONTEST_ELIGIBILITY_THRESHOLD = 5_000_000; // 5M tokens required for contests

/**
 * Get the appropriate eligibility threshold based on user type
 * @param hasFid - Whether the user has a Farcaster ID (FID)
 * @returns The eligibility threshold for the user type
 */
export function getEligibilityThreshold(hasFid: boolean): number {
  return hasFid ? FARCASTER_ELIGIBILITY_THRESHOLD : WEBSITE_ELIGIBILITY_THRESHOLD;
}

/**
 * Get the appropriate mint threshold based on user type
 * @param hasFid - Whether the user has a Farcaster ID (FID)
 * @returns The mint threshold for the user type
 */
export function getMintThreshold(hasFid: boolean): number {
  return hasFid ? FARCASTER_MINT_THRESHOLD : WEBSITE_MINT_THRESHOLD;
}
