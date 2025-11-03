import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/services/userService';
import { getBadTradersBalance } from '@/lib/services/tokenService';

const ELIGIBILITY_THRESHOLD = 1_000_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, walletAddress } = body;

    if (!fid || !walletAddress) {
      return NextResponse.json(
        { error: 'FID and wallet address are required' },
        { status: 400 }
      );
    }

    // Validate eligibility by checking token balance directly via Alchemy
    // Skip Neynar - we know BadTraders token isn't in Neynar response
    let balance = 0;
    try {
      balance = await getBadTradersBalance(walletAddress);
    } catch (error) {
      console.error('Error checking token balance:', error);
      // Still allow registration, but mark as ineligible
      balance = 0;
    }

    const isEligible = balance >= ELIGIBILITY_THRESHOLD;

    if (!isEligible) {
      return NextResponse.json(
        {
          error: 'Not eligible. You must hold at least 1,000,000 $BADTRADERS tokens to register.',
          balance,
          threshold: ELIGIBILITY_THRESHOLD
        },
        { status: 403 }
      );
    }

    // Username should come from the client via Farcaster SDK context
    // Client should pass it in the request body if available
    const username: string | null = body.username || null;

    // Register the user
    const user = await registerUser(
      parseInt(fid, 10),
      walletAddress,
      username,
      isEligible
    );

    return NextResponse.json({
      success: true,
      user: {
        fid: user.fid,
        username: user.username,
        walletAddress: user.wallet_address,
        isEligible: user.eligibility_status,
        isRegistered: user.opt_in_status,
        registeredAt: user.registered_at
      }
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Failed to register user', message: error?.message },
      { status: 500 }
    );
  }
}

