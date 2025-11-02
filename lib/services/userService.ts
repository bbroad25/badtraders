// lib/services/userService.ts
import { query } from '@/lib/db/connection';

// Helper to detect database type
function isSqlite(): boolean {
  const connectionString = process.env.DATABASE_URL || '';
  return connectionString.startsWith('./') ||
    connectionString.startsWith('/') ||
    (!connectionString.includes('://') && (connectionString.endsWith('.db') || connectionString.includes('.db')));
}

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
      // Update existing user
      // Use database-appropriate timestamp handling
      const useSqlite = isSqlite();
      let sql: string;
      let params: any[];

      if (useSqlite) {
        // SQLite: use Unix timestamp integers and 0/1 for booleans, use ? placeholders
        const timestamp = Math.floor(Date.now() / 1000);
        sql = `UPDATE users
               SET wallet_address = ?,
                   username = COALESCE(?, username),
                   eligibility_status = ?,
                   opt_in_status = 1,
                   last_active_at = ?,
                   updated_at = ?
               WHERE fid = ?
               RETURNING *`;
        params = [walletAddress, username, eligibilityStatus ? 1 : 0, timestamp, timestamp, fid];
    } else {
      // PostgreSQL: use NOW() function and boolean true
        sql = `UPDATE users
               SET wallet_address = $1,
                   username = COALESCE($2, username),
                   eligibility_status = $3,
                   opt_in_status = true,
                   last_active_at = NOW(),
                   updated_at = NOW()
               WHERE fid = $4
               RETURNING *`;
        params = [walletAddress, username, eligibilityStatus, fid];
      }

      const result = await query(sql, params);

      return result.rows[0] as User;
    } else {
      // Create new user
      // Use database-appropriate timestamp handling
      const useSqlite = isSqlite();
      let sql: string;
      let params: any[];

      if (useSqlite) {
        // SQLite: use Unix timestamp integers and 0/1 for booleans, use ? placeholders
        const timestamp = Math.floor(Date.now() / 1000);
        sql = `INSERT INTO users (fid, username, wallet_address, eligibility_status, opt_in_status, registered_at, last_active_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
               RETURNING *`;
        params = [fid, username, walletAddress, eligibilityStatus ? 1 : 0, timestamp, timestamp, timestamp, timestamp];
    } else {
      // PostgreSQL: use NOW() function and boolean true
        sql = `INSERT INTO users (fid, username, wallet_address, eligibility_status, opt_in_status, registered_at, last_active_at, created_at, updated_at)
               VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW(), NOW())
               RETURNING *`;
        params = [fid, username, walletAddress, eligibilityStatus];
      }

      const result = await query(sql, params);

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
    const useSqlite = isSqlite();
    if (useSqlite) {
      // SQLite: use Unix timestamp integers and 0/1 for booleans, use ? placeholders
      const timestamp = Math.floor(Date.now() / 1000);
      await query(
        'UPDATE users SET eligibility_status = ?, updated_at = ? WHERE fid = ?',
        [isEligible ? 1 : 0, timestamp, fid]
      );
    } else {
      // PostgreSQL: use NOW() function and boolean
      await query(
        'UPDATE users SET eligibility_status = $1, updated_at = NOW() WHERE fid = $2',
        [isEligible, fid]
      );
    }
  } catch (error) {
    console.error('Error updating eligibility status:', error);
    throw error;
  }
}

