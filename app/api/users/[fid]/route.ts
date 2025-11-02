import { NextRequest, NextResponse } from 'next/server';
import { getUserByFid } from '@/lib/services/userService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid: fidParam } = await params;
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
    console.error('Error getting user:', error);
    return NextResponse.json(
      { error: 'Failed to get user', message: error?.message },
      { status: 500 }
    );
  }
}
