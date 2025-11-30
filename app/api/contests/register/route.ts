import { CONTEST_ELIGIBILITY_THRESHOLD } from '@/lib/config/eligibility';
import { query } from '@/lib/db/connection';
import { getBadTradersBalance } from '@/lib/services/tokenService';
import { indexUserWalletForToken } from '@/lib/services/userIndexerService';
import { ethers } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/contests/register
 *
 * Register a user for a weekly contest by signing a message
 * This triggers on-demand indexing of their wallet for the contest token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contestId, walletAddress, signedMessage, message, fid } = body;

    if (!contestId || !walletAddress || !signedMessage || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: contestId, walletAddress, signedMessage, message' },
        { status: 400 }
      );
    }

    // Verify the signed message
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signedMessage);
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Invalid signature', details: error.message },
        { status: 400 }
      );
    }

    // Check that recovered address matches provided wallet
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Signature does not match wallet address' },
        { status: 400 }
      );
    }

    // Verify message format (should contain contest info)
    if (!message.includes(contestId.toString()) || !message.includes(walletAddress.toLowerCase())) {
      return NextResponse.json(
        { error: 'Message does not match expected format' },
        { status: 400 }
      );
    }

    // Get contest details
    const contestResult = await query(
      'SELECT * FROM weekly_contests WHERE id = $1 AND status = $2',
      [contestId, 'active']
    );

    if (contestResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Contest not found or not active' },
        { status: 404 }
      );
    }

    const contest = contestResult.rows[0];

    // Check token balance eligibility (5M tokens required)
    const balance = await getBadTradersBalance(walletAddress);
    if (balance < CONTEST_ELIGIBILITY_THRESHOLD) {
      return NextResponse.json(
        {
          error: `Insufficient token balance. You need at least ${CONTEST_ELIGIBILITY_THRESHOLD.toLocaleString()} BadTraders tokens to enter contests.`,
          balance,
          required: CONTEST_ELIGIBILITY_THRESHOLD
        },
        { status: 403 }
      );
    }

    // Check if user is already registered
    const existingReg = await query(
      'SELECT * FROM contest_registrations WHERE contest_id = $1 AND wallet_address = $2',
      [contestId, walletAddress.toLowerCase()]
    );

    if (existingReg.rows.length > 0) {
      const registration = existingReg.rows[0];

      // If already indexed, return existing registration
      if (registration.indexed_at) {
        return NextResponse.json({
          success: true,
          message: 'Already registered and indexed',
          registration: {
            id: registration.id,
            contestId: registration.contest_id,
            walletAddress: registration.wallet_address,
            currentPnL: registration.current_pnl,
            indexedAt: registration.indexed_at
          }
        });
      }

      // If registered but not indexed yet, return pending status
      return NextResponse.json({
        success: true,
        message: 'Registration pending indexing',
        registration: {
          id: registration.id,
          contestId: registration.contest_id,
          walletAddress: registration.wallet_address,
          status: 'indexing'
        }
      });
    }

    // Create registration
    const messageHash = ethers.id(message);
    const insertResult = await query(
      `INSERT INTO contest_registrations
       (contest_id, wallet_address, fid, signed_message, message_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [contestId, walletAddress.toLowerCase(), fid || null, signedMessage, messageHash]
    );

    const registrationId = insertResult.rows[0].id;

    // Start indexing in background (don't wait for it)
    indexUserWalletForToken(
      walletAddress,
      contest.token_address,
      contestId,
      registrationId
    ).catch((error) => {
      console.error(`[Contest Register] Error indexing wallet ${walletAddress}:`, error);
      // Update registration with error status (could add error field to table)
    });

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Indexing started.',
      registration: {
        id: registrationId,
        contestId,
        walletAddress,
        status: 'indexing'
      }
    });

  } catch (error: any) {
    console.error('Error in contest registration:', error);
    return NextResponse.json(
      { error: 'Failed to register for contest', message: error.message },
      { status: 500 }
    );
  }
}

