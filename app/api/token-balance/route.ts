import { NextRequest, NextResponse } from 'next/server';
import { getBadTradersBalance, checkEligibility } from '@/lib/services/tokenService';

const BADTRADERS_TOKEN_ADDRESS = '0x0774409Cda69A47f272907fd5D0d80173167BB07';
const ELIGIBILITY_THRESHOLD = 1_000_000;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fidParam = searchParams.get('fid');
    const addressParam = searchParams.get('address');

    // Prefer FID-based lookup via Neynar API
    if (fidParam) {
      const fid = parseInt(fidParam, 10);
      if (isNaN(fid) || fid < 1) {
        return NextResponse.json(
          { error: 'Invalid FID parameter' },
          { status: 400 }
        );
      }

      const neynarApiKey = process.env.NEYNAR_API_KEY;
      if (!neynarApiKey) {
        // Fallback to address if no Neynar API key
        if (!addressParam) {
          return NextResponse.json(
            { error: 'NEYNAR_API_KEY not configured and no address provided' },
            { status: 500 }
          );
        }
      } else {
        try {
          // Call Neynar API to get token balances by FID
          const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/balance/?fid=${fid}&networks=ethereum`,
            {
              headers: {
                'Authorization': `Bearer ${neynarApiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Neynar API error: ${response.status}`);
          }

          const data = await response.json();

          // Parse Neynar response to find BadTraders token balance
          let balance = 0;
          let walletAddress: string | null = null;

          if (data?.user_balance?.address_balances) {
            for (const addressBalance of data.user_balance.address_balances) {
              if (addressBalance.token_balances) {
                for (const tokenBalance of addressBalance.token_balances) {
                  if (tokenBalance.token?.address?.toLowerCase() === BADTRADERS_TOKEN_ADDRESS.toLowerCase()) {
                    // Parse balance string (e.g., "1234.56")
                    balance = parseFloat(tokenBalance.balance?.in_token || '0');
                    walletAddress = addressBalance.verified_address?.address || null;
                    break;
                  }
                }
                if (balance > 0) break;
              }
            }
          }

          const isEligible = balance >= ELIGIBILITY_THRESHOLD;

          return NextResponse.json({
            fid,
            address: walletAddress,
            balance,
            isEligible,
            threshold: ELIGIBILITY_THRESHOLD,
          });
        } catch (error) {
          console.error('Error fetching balance from Neynar:', error);
          // Fallback to address-based lookup if Neynar fails
          if (addressParam) {
            // Continue to address-based logic below
          } else {
            return NextResponse.json(
              { error: 'Failed to fetch token balance from Neynar' },
              { status: 500 }
            );
          }
        }
      }
    }

    // Fallback: Address-based lookup (for non-Farcaster environments or when FID not provided)
    if (addressParam) {
      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(addressParam)) {
        return NextResponse.json(
          { error: 'Invalid Ethereum address format' },
          { status: 400 }
        );
      }

      const balance = await getBadTradersBalance(addressParam);
      const isEligible = await checkEligibility(addressParam, ELIGIBILITY_THRESHOLD);

      return NextResponse.json({
        address: addressParam,
        balance,
        isEligible,
        threshold: ELIGIBILITY_THRESHOLD,
      });
    }

    return NextResponse.json(
      { error: 'Either fid or address parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token balance' },
      { status: 500 }
    );
  }
}

