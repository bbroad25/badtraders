// lib/services/userService.ts
import { query } from '@/lib/db/connection';

export interface User {
  id: number;
  fid: number;
  username: string | null;
  wallet_address: string;
  eligibility_status: boolean;
  opt_in_status: boolean;
  registered_at: Date | null;
  last_active_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get user by FID
 */
export async function getUserByFid(fid: number): Promise<User | null> {
  try {
    const result = await query(
      'SELECT * FROM users WHERE fid = $1',
      [fid]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as User;
  } catch (error) {
    console.error('Error getting user by FID:', error);
    throw error;
  }
}

/**
 * Register wallet for indexing (add to wallets table)
 */
async function registerWalletForIndexing(walletAddress: string): Promise<void> {
  try {
    const walletAddr = walletAddress.toLowerCase();

    // Check if wallet already exists
    const existing = await query(
      'SELECT id FROM wallets WHERE wallet_address = $1',
      [walletAddr]
    );

    if (existing.rows.length === 0) {
      // Get current block number for 30-day lookback
      // We'll set last_synced_block later when we have the provider available
      // For now, set to 0 to indicate it needs initial sync
      await query(
        'INSERT INTO wallets (wallet_address, last_synced_block, created_at, updated_at) VALUES ($1, 0, NOW(), NOW()) ON CONFLICT (wallet_address) DO NOTHING',
        [walletAddr]
      );
    }
  } catch (error) {
    console.error('Error registering wallet for indexing:', error);
    // Don't throw - indexing registration failure shouldn't block user registration
  }
}

/**
 * Register a user (opt-in to competition)
 */
export async function registerUser(
  fid: number,
  walletAddress: string,
  username: string | null = null,
  eligibilityStatus: boolean = true
): Promise<User> {
  try {
    // Check if user already exists
    const existingUser = await getUserByFid(fid);

    if (existingUser) {
      // Update existing user (Supabase)
      const result = await query(
        `UPDATE users
         SET wallet_address = $1,
             username = COALESCE($2, username),
             eligibility_status = $3,
             opt_in_status = true,
             last_active_at = NOW(),
             updated_at = NOW()
         WHERE fid = $4
         RETURNING *`,
        [walletAddress, username, eligibilityStatus, fid]
      );

      // Register wallet for indexing
      await registerWalletForIndexing(walletAddress);

      return result.rows[0] as User;
    } else {
      // Create new user (Supabase)
      const result = await query(
        `INSERT INTO users (fid, username, wallet_address, eligibility_status, opt_in_status, registered_at, last_active_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW(), NOW())
         RETURNING *`,
        [fid, username, walletAddress, eligibilityStatus]
      );

      // Register wallet for indexing
      await registerWalletForIndexing(walletAddress);

      return result.rows[0] as User;
    }
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
}

/**
 * Get all registered users (for leaderboard filtering)
 */
export async function getRegisteredUsers(): Promise<User[]> {
  try {
    const result = await query(
      'SELECT * FROM users WHERE opt_in_status = true ORDER BY registered_at DESC'
    );

    return result.rows as User[];
  } catch (error) {
    console.error('Error getting registered users:', error);
    throw error;
  }
}

/**
 * Update user's eligibility status
 */
export async function updateEligibilityStatus(fid: number, isEligible: boolean): Promise<void> {
  try {
    await query(
      'UPDATE users SET eligibility_status = $1, updated_at = NOW() WHERE fid = $2',
      [isEligible, fid]
    );
  } catch (error) {
    console.error('Error updating eligibility status:', error);
    throw error;
  }
}

