import { NextRequest, NextResponse } from 'next/server';
import { getBadTradersBalance, checkEligibility } from '@/lib/services/tokenService';
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';

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
        // No Neynar API key - gracefully return zero balance instead of error
        console.warn('NEYNAR_API_KEY not configured, returning zero balance for FID:', fid);
        return NextResponse.json({
          fid,
          address: null,
          balance: 0,
          isEligible: false,
          threshold: ELIGIBILITY_THRESHOLD,
        });
      } else {
        try {
          // Use Neynar SDK with Configuration (same pattern as pumpkin project)
          const neynarConfig = new Configuration({ apiKey: neynarApiKey });
          const neynarClient = new NeynarAPIClient(neynarConfig);

          // Use SDK method to fetch user balances by FID
          const response = await neynarClient.fetchUserBalance({
            fid: fid,
            networks: ['base'], // Base mainnet
          });

          console.log('Neynar API response:', JSON.stringify(response, null, 2));

          // Parse Neynar response to find BadTraders token balance
          // Response structure: { user_balance: { address_balances: [...] } }
          let balance = 0;
          let walletAddress: string | null = null;

          const userBalance = response?.user_balance || response;

          // First, try to find BadTraders token in Neynar response
          if (userBalance?.address_balances) {
            for (const addressBalance of userBalance.address_balances) {
              if (addressBalance.token_balances) {
                for (const tokenBalance of addressBalance.token_balances) {
                  const tokenAddress = tokenBalance.token?.address?.toLowerCase();

                  // Check if this is the BadTraders token
                  if (tokenAddress === BADTRADERS_TOKEN_ADDRESS.toLowerCase()) {
                    // Parse balance - in_token is already a number
                    balance = typeof tokenBalance.balance?.in_token === 'number'
                      ? tokenBalance.balance.in_token
                      : parseFloat(tokenBalance.balance?.in_token || tokenBalance.balance || '0');
                    walletAddress = addressBalance.verified_address?.address || null;
                    console.log(`Found BadTraders token in Neynar response! Balance: ${balance}, Address: ${walletAddress}`);
                    break;
                  }
                }
                if (balance > 0) break;
              }
            }
          }

          // If not found in Neynar response, check wallet addresses directly using Alchemy
          // Neynar might not return all ERC-20 tokens, so we'll check each wallet address
          if (balance === 0 && userBalance?.address_balances) {
            console.log('BadTraders token not in Neynar response, checking wallets directly via Alchemy...');

            // Get all wallet addresses from the response
            const walletAddresses = userBalance.address_balances
              .map(ab => ab.verified_address?.address)
              .filter((addr): addr is string => !!addr && /^0x[a-fA-F0-9]{40}$/i.test(addr));

            // Check each wallet for BadTraders token balance using Alchemy
            for (const addr of walletAddresses) {
              try {
                const walletBalance = await getBadTradersBalance(addr);
                if (walletBalance > 0) {
                  balance = walletBalance;
                  walletAddress = addr;
                  console.log(`Found BadTraders token via Alchemy! Balance: ${balance}, Address: ${walletAddress}`);
                  break;
                }
              } catch (error) {
                console.warn(`Error checking balance for ${addr}:`, error);
              }
            }
          }

          // Note: Eligibility can be calculated client-side (balance >= threshold)
          // We still return it for convenience, but client should calculate it too
          const isEligible = balance >= ELIGIBILITY_THRESHOLD;

          return NextResponse.json({
            fid,
            address: walletAddress,
            balance,
            isEligible, // Optional - client can calculate this from balance
            threshold: ELIGIBILITY_THRESHOLD,
          });
        } catch (error: any) {
          console.error('Error fetching balance from Neynar:', error);

          // Handle SDK errors - check if it's an API error response
          if (NeynarAPIClient.isApiErrorResponse && NeynarAPIClient.isApiErrorResponse(error)) {
            const status = error.response?.status;
            const errorData = error.response?.data;

            // Handle 401 (unauthorized) gracefully
            if (status === 401) {
              console.warn('NEYNAR_API_KEY is invalid or expired, returning zero balance for FID:', fid);
              return NextResponse.json({
                fid,
                address: null,
                balance: 0,
                isEligible: false,
                threshold: ELIGIBILITY_THRESHOLD,
              });
            }

            console.error('Neynar API error:', status, errorData);
          } else {
            console.error('Error details:', {
              message: error?.message,
              stack: error?.stack,
              fid
            });
          }

          // Fallback to address-based lookup if Neynar fails
          if (addressParam) {
            // Continue to address-based logic below
            console.warn('Neynar API failed, falling back to address-based lookup');
          } else {
            // No address for fallback - gracefully return zero balance instead of error
            console.warn('Neynar API failed and no address provided, returning zero balance for FID:', fid);
            return NextResponse.json({
              fid,
              address: null,
              balance: 0,
              isEligible: false,
              threshold: ELIGIBILITY_THRESHOLD,
            });
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
      // Note: Eligibility can be calculated client-side (balance >= threshold)
      // We still return it for convenience, but client should calculate it too
      const isEligible = balance >= ELIGIBILITY_THRESHOLD;

      return NextResponse.json({
        address: addressParam,
        balance,
        isEligible, // Optional - client can calculate this from balance
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

