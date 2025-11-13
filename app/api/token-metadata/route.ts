import { NextRequest, NextResponse } from 'next/server';
import { getTokenMetadata } from '@/lib/services/tokenMetadataService';

/**
 * GET /api/token-metadata?address=0x...
 *
 * Get token metadata (name, symbol, decimals, logo) from the chain
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'address parameter is required' },
        { status: 400 }
      );
    }

    const metadata = await getTokenMetadata(address);

    return NextResponse.json({
      success: true,
      metadata,
    });

  } catch (error: any) {
    console.error('Error fetching token metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token metadata', message: error.message },
      { status: 500 }
    );
  }
}

