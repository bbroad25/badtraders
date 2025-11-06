// lib/services/swapProcessor.ts
// Process swaps using Bitquery as the PRIMARY source (most reliable)

import { query } from '@/lib/db/connection';
import { logError, logInfo, logSuccess, logWarn } from './indexerLogger';
import { incrementTradesFound, updateWorkerStatusWithTiming } from './indexerMetrics';
import { getTokenSwaps } from './bitqueryService';
import { processBuy, processSell, getPosition } from './fifoAccounting';

/**
 * Get token decimals from database
 */
async function getTokenDecimals(tokenAddress: string): Promise<number> {
  const result = await query(
    'SELECT decimals FROM tracked_tokens WHERE token_address = $1',
    [tokenAddress.toLowerCase()]
  );
  if (result.rows.length > 0) {
    return result.rows[0].decimals;
  }
  return 18; // Default
}

/**
 * Get block timestamp from database or estimate
 */
async function getBlockTimestamp(blockNumber: number): Promise<Date> {
  // Try to get from a transaction in that block
  const result = await query(
    `SELECT timestamp FROM trades WHERE block_number = $1 LIMIT 1`,
    [blockNumber]
  );

  if (result.rows.length > 0) {
    return new Date(result.rows[0].timestamp);
  }

  // Estimate: Base has ~2s block time, genesis around 2023-08-09
  const genesisTimestamp = new Date('2023-08-09T00:00:00Z').getTime();
  const estimatedTimestamp = genesisTimestamp + (blockNumber * 2000);
  return new Date(estimatedTimestamp);
}

/**
 * Process swaps from Bitquery - ONLY METHOD
 * Bitquery is the primary and only source for swaps
 */
export async function processSwapsFromBitquery(
  tokenAddress?: string,
  onProgress?: (page: number, swapsFound: number) => void,
  onSwapProcessed?: (processed: number, total: number) => void
): Promise<{
  swapsProcessed: number;
  walletsFound: Set<string>;
}> {
  const walletsFound = new Set<string>();
  let swapsProcessed = 0;

  try {
    // Get tracked tokens
    const trackedTokensResult = await query('SELECT token_address FROM tracked_tokens');
    const trackedTokenAddresses = trackedTokensResult.rows.map(r => r.token_address.toLowerCase());

    if (trackedTokenAddresses.length === 0) {
      logWarn('No tracked tokens found');
      return { swapsProcessed: 0, walletsFound };
    }

    const tokensToProcess = tokenAddress
      ? [tokenAddress.toLowerCase()]
      : trackedTokenAddresses;

    logInfo(`Processing swaps from Bitquery for ${tokensToProcess.length} token(s)...`);

    // Process each tracked token - query ALL historical swaps
    for (let i = 0; i < tokensToProcess.length; i++) {
      const tokenAddr = tokensToProcess[i];

      logInfo(`Querying Bitquery for ALL swaps for token ${tokenAddr}...`);

      try {
        // Fetch ALL swaps from Bitquery (no date/block limits)
        const swaps = await getTokenSwaps(tokenAddr, null, null, onProgress);
        logInfo(`[Bitquery] Found ${swaps.length} swaps for token ${tokenAddr}`);

        // Update progress: Bitquery fetching complete, now processing swaps
        if (onSwapProcessed) {
          onSwapProcessed(0, swaps.length);
        }

        // Process each swap
        for (let swapIdx = 0; swapIdx < swaps.length; swapIdx++) {
          const swap = swaps[swapIdx];
          try {
            // Log progress every 10 swaps (to catch slow operations)
            if (swapIdx > 0 && swapIdx % 10 === 0) {
              logInfo(`[Swap Progress] Processing swap ${swapIdx + 1} / ${swaps.length} (${Math.round((swapIdx / swaps.length) * 100)}%)...`);
            }
            // Use Bitquery's calculated price and USD values
            let priceUsd = 0;
            let usdValue = 0;

            if (swap.priceUsd && swap.priceUsd > 0) {
              priceUsd = Number(swap.priceUsd);
            }

            // USD value calculation (CRITICAL for volume stats):
            // BUY volume = what was paid = baseTokenUsdValue (Sell.AmountInUSD)
            // SELL volume = what was received = baseTokenUsdValue (Buy.AmountInUSD)
            // This matches Bitquery's pattern: Trade_Buy_AmountInUSD for buys, Trade_Sell_AmountInUSD for sells
            if (swap.baseTokenUsdValue && swap.baseTokenUsdValue > 0) {
              // For both BUY and SELL, use baseTokenUsdValue
              // BUY: baseTokenUsdValue = Sell.AmountInUSD (what was paid)
              // SELL: baseTokenUsdValue = Buy.AmountInUSD (what was received)
              usdValue = Number(swap.baseTokenUsdValue);
            } else if (swap.trackedTokenUsdValue && swap.trackedTokenUsdValue > 0) {
              // Fallback: use tracked token USD value (less accurate for volume)
              usdValue = Number(swap.trackedTokenUsdValue);
            }

            // Fallback: calculate if Bitquery values not available
            if (!priceUsd || !usdValue) {
              const tokenAmountDecimal = Number(swap.amountOut) / (10 ** swap.tokenOutDecimals);
              const baseTokenAmountDecimal = Number(swap.amountIn) / (10 ** swap.tokenInDecimals);

              if (tokenAmountDecimal > 0) {
                if (!priceUsd) {
                  priceUsd = baseTokenAmountDecimal / tokenAmountDecimal;
                }
                if (!usdValue) {
                  // For BUY: usdValue = baseTokenAmount (what was paid)
                  // For SELL: usdValue = baseTokenAmount (what was received)
                  // Use baseTokenAmountDecimal as fallback USD value
                  usdValue = baseTokenAmountDecimal;
                }
              }
            }

            // Log USD value calculation for first few SELLs to debug
            if (swap.side === 'SELL' && swapsProcessed <= 5) {
              logInfo(`[USD Value Debug] SELL ${swap.txHash.substring(0, 10)}... | baseTokenUsdValue=${swap.baseTokenUsdValue} | trackedTokenUsdValue=${swap.trackedTokenUsdValue} | calculated usdValue=${usdValue}`);
            }

            // Ensure usdValue is always a number
            usdValue = Number(usdValue) || 0;
            priceUsd = Number(priceUsd) || 0;

            if (swapsProcessed <= 10) {
              logInfo(`[Swap ${swapsProcessed}] ${swap.side}: ${swap.txHash.substring(0, 10)}... | price=$${priceUsd.toFixed(8)} | usdValue=$${usdValue.toFixed(2)} | tokenAmount=${Number(swap.amountOut) / (10 ** swap.tokenOutDecimals)}`);
            } else if (swapsProcessed % 100 === 0) {
              logInfo(`[Swap ${swapsProcessed}/${swaps.length}] Processing...`);
            }

            await insertTrade(
              swap.walletAddress,
              tokenAddr,
              swap.txHash,
              swap.blockNumber,
              swap.timestamp,
              swap.side,
              swap.amountOut, // tokenAmount (tracked token)
              priceUsd,
              usdValue,
              swap.amountIn, // baseTokenAmount
              swap.baseTokenAddress
            );

            // Calculate FIFO positions after inserting trade
            // Note: FIFO only tracks tokens bought via DEX swaps, not tokens received via transfers/airdrops
            // If a SELL happens before any BUY, skip FIFO accounting (wallet likely received tokens via transfer)
            try {
              if (swap.side === 'BUY') {
                // BUY: Add to position with cost basis
                const costBasis = usdValue; // Cost basis is the USD value paid
                await processBuy(
                  swap.walletAddress,
                  tokenAddr,
                  swap.amountOut, // token amount received
                  priceUsd,
                  costBasis
                );
              } else {
                // SELL: Remove from position FIFO, calculate realized PnL
                // Check if position exists first - if not, wallet likely received tokens via transfer/airdrop
                const position = await getPosition(swap.walletAddress, tokenAddr);
                if (position && BigInt(position.remaining_amount) > 0) {
                  // Pass position to avoid redundant DB query
                  await processSell(
                    swap.walletAddress,
                    tokenAddr,
                    swap.amountOut, // token amount sold
                    priceUsd,
                    swap.tokenOutDecimals,
                    position // Pass position to avoid redundant getPosition call
                  );
                } else {
                  // No position exists - wallet likely received tokens via transfer/airdrop before this SELL
                  // Skip FIFO accounting (no cost basis to track)
                  if (swapsProcessed <= 5) {
                    logInfo(`[FIFO] Skipping SELL ${swap.txHash.substring(0, 10)}... - no position (wallet likely received tokens via transfer)`);
                  }
                }
              }
            } catch (fifoError: any) {
              const fifoErrorMsg = fifoError?.message || fifoError?.toString() || JSON.stringify(fifoError);
              logWarn(`[FIFO] Failed to process ${swap.side} for ${swap.txHash}: ${fifoErrorMsg}`);
              // Continue processing other swaps even if FIFO fails
            }

            walletsFound.add(swap.walletAddress.toLowerCase());
            swapsProcessed++;
            incrementTradesFound(1);

            // Update progress every swap (for real-time progress bar)
            if (onSwapProcessed) {
              onSwapProcessed(swapsProcessed, swaps.length);
            }

            if (swapsProcessed <= 5) {
              logInfo(`[Swap ${swapsProcessed}] Inserted: ${swap.txHash} ${swap.side} ${swap.amountOut} ${tokenAddr} at $${priceUsd.toFixed(6)}`);
            }
          } catch (insertError: any) {
            const errorMsg = insertError?.message || insertError?.toString() || JSON.stringify(insertError);
            logError(`[Swap ${swapIdx + 1}/${swaps.length}] Failed to insert trade ${swap.txHash}: ${errorMsg}`);

            // If it's a constraint violation (like missing 'bitquery' in parsed_source), fail fast
            if (errorMsg.includes('trades_parsed_source_check') || errorMsg.includes('constraint')) {
              throw new Error(`Database constraint violation: ${errorMsg}. Please run migration 011_add_bitquery_support.sql`);
            }
            // Continue processing other swaps for non-critical errors
          }
        }

        logInfo(`[Swap Processing] Completed processing ${swapsProcessed} swaps out of ${swaps.length} total`);
      } catch (bitqueryError: any) {
        const errorMsg = bitqueryError?.message || bitqueryError?.toString() || JSON.stringify(bitqueryError);
        logError(`[Bitquery] Error fetching swaps for token ${tokenAddr}: ${errorMsg}`);
        if (bitqueryError?.stack) {
          logError(`[Bitquery] Stack: ${bitqueryError.stack.substring(0, 500)}`);
        }
        // THROW error - don't silently fail
        throw new Error(`Bitquery processing failed for token ${tokenAddr}: ${errorMsg}`);
      }
    }

    logSuccess(`Processed ${swapsProcessed} swaps from Bitquery, found ${walletsFound.size} wallets`);
    return { swapsProcessed, walletsFound };
  } catch (error: any) {
    logError(`Error processing swaps from Bitquery: ${error.message}`);
    throw error;
  }
}

/**
 * Process swaps from transfers - BITQUERY ONLY (no fallback)
 * This function name is kept for backward compatibility but ONLY uses Bitquery
 */
export async function processSwapsFromTransfers(tokenAddress?: string, minBlock?: number, maxBlock?: number): Promise<{
  swapsProcessed: number;
  walletsFound: Set<string>;
}> {
  // Bitquery is the ONLY source - throw if it fails
  logInfo('Processing swaps from Bitquery (ONLY source)...');
  return await processSwapsFromBitquery(tokenAddress);
}

/**
 * Insert trade into database
 */
async function insertTrade(
  walletAddress: string,
  tokenAddress: string,
  txHash: string,
  blockNumber: number,
  timestamp: Date,
  side: 'BUY' | 'SELL',
  tokenAmount: bigint,
  priceUsd: number,
  usdValue: number,
  baseTokenAmount: bigint,
  baseTokenAddress: string
): Promise<void> {
  const tokenAmountStr = tokenAmount.toString();
  const baseTokenAmountStr = baseTokenAmount.toString();

  // Clamp values to prevent DECIMAL overflow
  const MAX_DECIMAL_VALUE = 999999999999999999.99999999;
  const clampedPriceUsd = Math.min(Math.max(priceUsd, -MAX_DECIMAL_VALUE), MAX_DECIMAL_VALUE);
  const clampedUsdValue = Math.min(Math.max(usdValue, -MAX_DECIMAL_VALUE), MAX_DECIMAL_VALUE);

  // Determine token_in and token_out from side
  const tokenIn = side === 'BUY' ? baseTokenAddress.toLowerCase() : tokenAddress.toLowerCase();
  const tokenOut = side === 'BUY' ? tokenAddress.toLowerCase() : baseTokenAddress.toLowerCase();
  const amountIn = side === 'BUY' ? baseTokenAmountStr : tokenAmountStr;
  const amountOut = side === 'BUY' ? tokenAmountStr : baseTokenAmountStr;

  await query(
    `INSERT INTO trades (
      wallet_address, token_address, tx_hash, block_number, timestamp,
      side, token_amount, price_usd, usd_value, parsed_source,
      token_in, token_out, amount_in, amount_out, base_token,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
    ON CONFLICT (wallet_address, tx_hash, token_address, side) DO NOTHING`,
    [
      walletAddress.toLowerCase(),
      tokenAddress.toLowerCase(),
      txHash,
      blockNumber,
      timestamp,
      side,
      tokenAmountStr,
      clampedPriceUsd.toFixed(8),
      clampedUsdValue.toFixed(8),
      'bitquery', // Always bitquery since we're using it as primary
      tokenIn || null,
      tokenOut || null,
      amountIn || null,
      amountOut || null,
      baseTokenAddress?.toLowerCase() || null,
    ]
  );
}
