import { NextRequest, NextResponse } from 'next/server';
import { getUserByFid } from '@/lib/services/userService';
import { sdk } from '@farcaster/miniapp-sdk';

export async function GET(request: NextRequest) {
  try {
    // Get FID from Farcaster context (this would need to be passed from client)
    // For server-side, we'll need the FID from query params or headers
    const fidParam = request.nextUrl.searchParams.get('fid');

    if (!fidParam) {
      return NextResponse.json(
        { error: 'FID is required. Pass ?fid=123 in the query string.' },
        { status: 400 }
      );
    }

    const fid = parseInt(fidParam, 10);

    if (isNaN(fid)) {
      return NextResponse.json(
        { error: 'Invalid FID' },
        { status: 400 }
      );
    }

    const user = await getUserByFid(fid);

    if (!user) {
      return NextResponse.json({
        fid,
        isRegistered: false,
        isEligible: false,
        walletAddress: null,
        username: null
      });
    }

    return NextResponse.json({
      fid: user.fid,
      isRegistered: user.opt_in_status,
      isEligible: user.eligibility_status,
      walletAddress: user.wallet_address,
      username: user.username,
      registeredAt: user.registered_at
    });
  } catch (error: any) {
    console.error('Error getting current user:', error);
    return NextResponse.json(
      { error: 'Failed to get user', message: error?.message },
      { status: 500 }
    );
  }
}

