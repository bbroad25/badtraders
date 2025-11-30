import { getEligibilityThreshold } from '@/lib/config/eligibility';
import { getBadTradersBalance } from '@/lib/services/tokenService';
import { registerUser } from '@/lib/services/userService';
import { NextRequest, NextResponse } from 'next/server';

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

    // FID present = Farcaster user = 1M threshold, otherwise 2M for website
    const threshold = getEligibilityThreshold(!!fid);
    const isEligible = balance >= threshold;

    if (!isEligible) {
      return NextResponse.json(
        {
          error: `Not eligible. You must hold at least ${threshold.toLocaleString()} $BADTRADERS tokens to register.${!fid ? ' Join Farcaster to lower the requirement to 1,000,000 tokens!' : ''}`,
          balance,
          threshold
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

