import { getEligibilityThreshold } from '@/lib/config/eligibility';
import { getBadTradersBalance } from '@/lib/services/tokenService';
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';
import { NextRequest, NextResponse } from 'next/server';

const BADTRADERS_TOKEN_ADDRESS = '0x0774409Cda69A47f272907fd5D0d80173167BB07';

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

            // Try multiple methods to get wallet addresses for better auto-detection
            try {
              // Method 1: fetchUserBalance (primary method)
              const response = await neynarClient.fetchUserBalance({
                fid: fid,
                networks: ['base'],
              });

              // Handle response structure - could be BalanceResponse or BalanceResponseUserBalance
              const userBalance = (response as any)?.user_balance || response;
              const addressBalances = (userBalance as any)?.address_balances;
              if (Array.isArray(addressBalances)) {
                const addresses = addressBalances
                  .map((ab: any) => ab?.verified_address?.address)
                  .filter((addr: string | undefined): addr is string => !!addr && /^0x[a-fA-F0-9]{40}$/i.test(addr));
                walletAddresses.push(...addresses);
              }
            } catch (balanceError) {
              console.warn('fetchUserBalance failed, trying REST API fallback:', balanceError);

              // Method 2: Use Neynar REST API directly as fallback
              try {
                const userResponse = await fetch(
                  `https://api.neynar.com/v2/farcaster/user?fid=${fid}`,
                  {
                    headers: {
                      'x-api-key': neynarApiKey
                    }
                  }
                );

                if (userResponse.ok) {
                  const userData = await userResponse.json();
                  const user = userData?.result?.user;
                  if (user) {
                    // Extract verified addresses
                    if (user.verified_addresses?.eth_addresses) {
                      const verifiedAddrs = user.verified_addresses.eth_addresses
                        .filter((addr: string | undefined): addr is string => !!addr && /^0x[a-fA-F0-9]{40}$/i.test(addr));
                      walletAddresses.push(...verifiedAddrs);
                    }
                    // Also check custody address
                    if (user.custody_address && /^0x[a-fA-F0-9]{40}$/i.test(user.custody_address)) {
                      walletAddresses.push(user.custody_address);
                    }
                  }
                }
              } catch (lookupError) {
                console.warn('REST API fallback also failed:', lookupError);
              }
            }
          } catch (error) {
            console.warn('Error fetching wallet addresses from Neynar (continuing with address param):', error);
          }
        }

        // Check each wallet address directly via Alchemy for BadTraders token
        let balance = 0;
        let walletAddress: string | null = null;

        // Add addressParam to the list if provided (prioritize it)
        if (addressParam && /^0x[a-fA-F0-9]{40}$/i.test(addressParam)) {
          // Put addressParam first in the list to check it first
          walletAddresses.unshift(addressParam);
        }

        // Remove duplicates while preserving order
        walletAddresses = Array.from(new Set(walletAddresses));

        // Check all wallet addresses via Alchemy - check ALL addresses, not just first with balance > 0
        // This ensures we find the wallet with the highest balance
        for (const addr of walletAddresses) {
          try {
            const walletBalance = await getBadTradersBalance(addr);
            // Use the wallet with the highest balance
            if (walletBalance > balance) {
              balance = walletBalance;
              walletAddress = addr;
            }
          } catch (error) {
            console.warn(`Error checking balance for ${addr}:`, error);
          }
        }

        // If no addresses found and no addressParam, return zero balance
        // FID present = Farcaster user = 1M threshold
        const threshold = getEligibilityThreshold(true); // Has FID = Farcaster user
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
      const threshold = getEligibilityThreshold(false); // No FID = website user
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

