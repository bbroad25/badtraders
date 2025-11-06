// app/api/test-bitquery/route.ts
// Test endpoint to verify Bitquery v2 implementation

import { NextRequest, NextResponse } from 'next/server';
import { getTokenSwaps, getWalletSwaps, testBitqueryConnection } from '@/lib/services/bitqueryService';
import { query } from '@/lib/db/connection';

export const dynamic = 'force-dynamic';

const MAIN_TOKEN_ADDRESS = '0x0774409cda69a47f272907fd5d0d80173167bb07';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testType = searchParams.get('test') || 'full'; // 'connection', 'token', 'wallet', 'full'
    const tokenAddress = searchParams.get('token') || MAIN_TOKEN_ADDRESS;
    const walletAddress = searchParams.get('wallet');

    // Test connection first
    if (testType === 'connection') {
      const isConnected = await testBitqueryConnection();
      return NextResponse.json({
        success: isConnected,
        message: isConnected
          ? 'Bitquery connection successful'
          : 'Bitquery connection failed - check BITQUERY_API_KEY',
      });
    }

    // Test token swaps (main function used in sync)
    if (testType === 'token' || testType === 'full') {
      console.log(`[Test Bitquery] Testing getTokenSwaps for token ${tokenAddress}`);
      const tokenStartTime = Date.now();
      let tokenSwaps: any[] = [];
      let tokenError: string | null = null;
      let progressPages: number[] = [];
      let progressCounts: number[] = [];

      try {
        tokenSwaps = await getTokenSwaps(
          tokenAddress,
          null, // No date range - get all historical
          null,
          (page, swapsFound) => {
            progressPages.push(page);
            progressCounts.push(swapsFound);
            console.log(`[Test Bitquery] Token swaps progress: Page ${page}, ${swapsFound} swaps found`);
          }
        );
        console.log(`[Test Bitquery] Found ${tokenSwaps.length} total swaps for token`);
      } catch (error: any) {
        tokenError = error.message;
        console.error(`[Test Bitquery] Token swaps error:`, error);
      }

      const tokenDuration = Date.now() - tokenStartTime;

      // Get unique wallets from swaps
      const walletsFromSwaps = new Set(tokenSwaps.map(s => s.walletAddress.toLowerCase()));

      // Test connection
      const connectionTest = await testBitqueryConnection();

      if (testType === 'token') {
        return NextResponse.json({
          success: !tokenError,
          error: tokenError,
          connectionTest,
          token: tokenAddress,
          swapsFound: tokenSwaps.length,
          uniqueWallets: walletsFromSwaps.size,
          durationMs: tokenDuration,
          progressPages,
          progressCounts,
          sampleSwaps: tokenSwaps.slice(0, 5).map(s => ({
            txHash: s.txHash,
            blockNumber: s.blockNumber,
            timestamp: s.timestamp.toISOString(),
            side: s.side,
            walletAddress: s.walletAddress,
            tokenIn: s.tokenIn,
            tokenOut: s.tokenOut,
            amountIn: s.amountIn.toString(),
            amountOut: s.amountOut.toString(),
          })),
          wallets: Array.from(walletsFromSwaps).slice(0, 10),
        });
      }
    }

    // Test wallet swaps (if wallet provided)
    if (testType === 'wallet' || (testType === 'full' && walletAddress)) {
      if (!walletAddress) {
        return NextResponse.json({
          error: 'wallet parameter is required for wallet test',
          example: '/api/test-bitquery?test=wallet&wallet=0x...',
        }, { status: 400 });
      }

      const testWallet = walletAddress.toLowerCase();

      // Verify wallet exists in database (optional)
      const walletCheck = await query(
        'SELECT wallet_address FROM users WHERE wallet_address = $1 LIMIT 1',
        [testWallet]
      );

      const walletExists = walletCheck.rows.length > 0;

      // Set date range (last 30 days)
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);

      // Test Bitquery wallet swaps
      console.log(`[Test Bitquery] Fetching wallet swaps for ${testWallet} from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
      const bitqueryStartTime = Date.now();
      let bitquerySwaps: any[] = [];
      let bitqueryError: string | null = null;

      try {
        bitquerySwaps = await getWalletSwaps(testWallet, fromDate, toDate);
        console.log(`[Test Bitquery] Found ${bitquerySwaps.length} wallet swaps`);
      } catch (error: any) {
        bitqueryError = error.message;
        console.error(`[Test Bitquery] Error:`, error);
      }

      const bitqueryDuration = Date.now() - bitqueryStartTime;

      // Get summary statistics
      const bitqueryBuyCount = bitquerySwaps.filter(s => s.side === 'BUY').length;
      const bitquerySellCount = bitquerySwaps.filter(s => s.side === 'SELL').length;

      if (testType === 'wallet') {
        return NextResponse.json({
          success: !bitqueryError,
          error: bitqueryError,
          wallet: testWallet,
          walletExists,
          dateRange: {
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            days: 30,
          },
          swapsFound: bitquerySwaps.length,
          durationMs: bitqueryDuration,
          buyCount: bitqueryBuyCount,
          sellCount: bitquerySellCount,
          swaps: bitquerySwaps.map(s => ({
            txHash: s.txHash,
            blockNumber: s.blockNumber,
            timestamp: s.timestamp.toISOString(),
            side: s.side,
            tokenIn: s.tokenIn,
            tokenOut: s.tokenOut,
            amountIn: s.amountIn.toString(),
            amountOut: s.amountOut.toString(),
            source: s.source,
          })),
        });
      }
    }

    // Full test: token + wallet (if provided)
    if (testType === 'full') {
      // Token test already done above, now compile results
      const tokenStartTime = Date.now();
      let tokenSwaps: any[] = [];
      let tokenError: string | null = null;
      let progressPages: number[] = [];
      let progressCounts: number[] = [];

      try {
        tokenSwaps = await getTokenSwaps(
          tokenAddress,
          null,
          null,
          (page, swapsFound) => {
            progressPages.push(page);
            progressCounts.push(swapsFound);
          }
        );
      } catch (error: any) {
        tokenError = error.message;
      }

      const tokenDuration = Date.now() - tokenStartTime;
      const walletsFromSwaps = new Set(tokenSwaps.map(s => s.walletAddress.toLowerCase()));
      const connectionTest = await testBitqueryConnection();

      return NextResponse.json({
        success: !tokenError,
        error: tokenError,
        connectionTest,
        token: {
          address: tokenAddress,
          swapsFound: tokenSwaps.length,
          uniqueWallets: walletsFromSwaps.size,
          durationMs: tokenDuration,
          progressPages,
          progressCounts,
          sampleSwaps: tokenSwaps.slice(0, 5).map(s => ({
            txHash: s.txHash,
            blockNumber: s.blockNumber,
            timestamp: s.timestamp.toISOString(),
            side: s.side,
            walletAddress: s.walletAddress,
          })),
        },
        summary: {
          totalSwaps: tokenSwaps.length,
          uniqueWallets: walletsFromSwaps.size,
          buyCount: tokenSwaps.filter(s => s.side === 'BUY').length,
          sellCount: tokenSwaps.filter(s => s.side === 'SELL').length,
        },
      });
    }

    return NextResponse.json({
      error: 'Invalid test type',
      validTypes: ['connection', 'token', 'wallet', 'full'],
      examples: [
        '/api/test-bitquery?test=connection',
        '/api/test-bitquery?test=token',
        '/api/test-bitquery?test=wallet&wallet=0x...',
        '/api/test-bitquery?test=full',
      ],
    }, { status: 400 });
  } catch (error: any) {
    console.error('[Test Bitquery] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

