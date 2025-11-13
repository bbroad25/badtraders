// app/api/test-swaps/route.ts
// Quick test endpoint to verify Bitquery swap processing works BEFORE running full sync

import { NextRequest, NextResponse } from 'next/server';
import { processSwapsFromBitquery } from '@/lib/services/swapProcessor';
import { query } from '@/lib/db/connection';
import { logInfo } from '@/lib/services/indexerLogger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenAddress = searchParams.get('token');
    const testBlock = searchParams.get('block');

    // Get tracked tokens
    const trackedTokens = await query('SELECT token_address, symbol FROM tracked_tokens');

    if (trackedTokens.rows.length === 0) {
      return NextResponse.json({
        error: 'No tracked tokens found. Add a token first.',
      }, { status: 400 });
    }

    const testToken = tokenAddress
      ? tokenAddress.toLowerCase()
      : trackedTokens.rows[0].token_address.toLowerCase();

    logInfo(`Testing Bitquery swap processing for token: ${testToken}`);

    // Test with a small block range (last 1000 blocks if no block specified)
    let minBlock: number | undefined;
    let maxBlock: number | undefined;

    if (testBlock) {
      const blockNum = parseInt(testBlock);
      minBlock = blockNum - 100;
      maxBlock = blockNum + 100;
    } else {
      // Get current block
      const { getProvider } = await import('@/lib/services/apiProviderManager');
      const provider = await getProvider();
      const currentBlock = await provider.getBlockNumber();
      maxBlock = currentBlock;
      minBlock = currentBlock - 1000; // Last 1000 blocks
    }

    logInfo(`Testing blocks ${minBlock} to ${maxBlock}`);

    const startTime = Date.now();
    const result = await processSwapsFromBitquery(testToken);
    const duration = Date.now() - startTime;

    // Get trades that were inserted
    const insertedTrades = await query(
      `SELECT COUNT(*) as count FROM trades
       WHERE token_address = $1
       AND block_number >= $2
       AND block_number <= $3
       AND parsed_source = 'bitquery'`,
      [testToken, minBlock, maxBlock]
    );

    return NextResponse.json({
      success: true,
      test: {
        token: testToken,
        tokenSymbol: trackedTokens.rows.find(t => t.token_address.toLowerCase() === testToken)?.symbol || 'unknown',
        blockRange: { min: minBlock, max: maxBlock },
        durationMs: duration,
      },
      results: {
        swapsProcessed: result.swapsProcessed,
        walletsFound: result.walletsFound.size,
        wallets: Array.from(result.walletsFound).slice(0, 10), // First 10 wallets
        bitqueryPages: result.bitqueryPages,
        bitqueryCalls: result.bitqueryCalls,
        tradesInDB: parseInt(insertedTrades.rows[0].count),
      },
      message: result.swapsProcessed > 0
        ? `SUCCESS: Processed ${result.swapsProcessed} swaps in ${duration}ms`
        : `WARNING: No swaps processed. Check Bitquery API key and token address.`,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

