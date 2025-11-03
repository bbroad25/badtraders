import { NextRequest, NextResponse } from 'next/server';
import { getBadTradersBalance, checkEligibility } from '@/lib/services/tokenService';
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';

const BADTRADERS_TOKEN_ADDRESS = '0x0774409Cda69A47f272907fd5D0d80173167BB07';
const FARCASTER_ELIGIBILITY_THRESHOLD = 1_000_000; // 1M for Farcaster miniapp users
const WEBSITE_ELIGIBILITY_THRESHOLD = 2_000_000; // 2M for website users

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fidParam = searchParams.get('fid');
    const addressParam = searchParams.get('address');

      // FID-based lookup - use Neynar ONLY to get wallet addresses, then check Alchemy directly
      // Skip Neynar token balance since we know BadTraders isn't there
      if (fidParam) {
        const fid = parseInt(fidParam, 10);
        if (isNaN(fid) || fid < 1) {
          return NextResponse.json(
            { error: 'Invalid FID parameter' },
            { status: 400 }
          );
        }

        const neynarApiKey = process.env.NEYNAR_API_KEY;
        let walletAddresses: string[] = [];

        // Get wallet addresses from Neynar (if available) - but skip token balance lookup
        if (neynarApiKey) {
          try {
            const neynarConfig = new Configuration({ apiKey: neynarApiKey });
            const neynarClient = new NeynarAPIClient(neynarConfig);

            // Only fetch user data to get wallet addresses, NOT token balances
            const response = await neynarClient.fetchUserBalance({
              fid: fid,
              networks: ['base'],
            });

            // Handle response structure - could be BalanceResponse or BalanceResponseUserBalance
            const userBalance = (response as any)?.user_balance || response;
            const addressBalances = (userBalance as any)?.address_balances;
            if (Array.isArray(addressBalances)) {
              walletAddresses = addressBalances
                .map((ab: any) => ab?.verified_address?.address)
                .filter((addr: string | undefined): addr is string => !!addr && /^0x[a-fA-F0-9]{40}$/i.test(addr));
            }
          } catch (error) {
            console.warn('Error fetching wallet addresses from Neynar (continuing with address param):', error);
          }
        }

        // Check each wallet address directly via Alchemy for BadTraders token
        let balance = 0;
        let walletAddress: string | null = null;

        // Add addressParam to the list if provided
        if (addressParam && /^0x[a-fA-F0-9]{40}$/i.test(addressParam)) {
          walletAddresses.push(addressParam);
        }

        // Check all wallet addresses via Alchemy
        for (const addr of walletAddresses) {
          try {
            const walletBalance = await getBadTradersBalance(addr);
            if (walletBalance > 0) {
              balance = walletBalance;
              walletAddress = addr;
              break;
            }
          } catch (error) {
            console.warn(`Error checking balance for ${addr}:`, error);
          }
        }

        // If no addresses found and no addressParam, return zero balance
        // FID present = Farcaster user = 1M threshold
        const threshold = FARCASTER_ELIGIBILITY_THRESHOLD;
        if (walletAddresses.length === 0 && !addressParam) {
          return NextResponse.json({
            fid,
            address: null,
            balance: 0,
            isEligible: false,
            threshold,
          });
        }

        const isEligible = balance >= threshold;

        return NextResponse.json({
          fid,
          address: walletAddress,
          balance,
          isEligible,
          threshold,
        });
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
      // No FID = website user = 2M threshold
      const threshold = WEBSITE_ELIGIBILITY_THRESHOLD;
      // Note: Eligibility can be calculated client-side (balance >= threshold)
      // We still return it for convenience, but client should calculate it too
      const isEligible = balance >= threshold;

      return NextResponse.json({
        address: addressParam,
        balance,
        isEligible, // Optional - client can calculate this from balance
        threshold,
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

