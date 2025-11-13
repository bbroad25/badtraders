// lib/services/swapProcessor.ts
// Process swaps using Bitquery as the PRIMARY source (most reliable)

import { query } from '@/lib/db/connection';
import type { BitqueryDEXTrade, BitqueryTradeGroup } from './bitqueryService';
import { getTokenSwapGroups, isProtocolFeeTransfer, transformBitqueryTrade } from './bitqueryService';
import { getPosition, processBuy, processSell } from './fifoAccounting';
import { logError, logInfo, logSuccess, logWarn } from './indexerLogger';
import { incrementTradesFound } from './indexerMetrics';
import type { SwapDetails } from './swapTypes';

// Track skipped SELLs count for logging (module-level to persist across function calls)
let skippedSellCount = 0;

interface ProcessedLeg {
  trade: BitqueryDEXTrade;
  swapDetail: SwapDetails;
  wallet: string;
  legIndex: number;
  isProtocolFee: boolean;
}

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

function normalizeAddress(address?: string | null): string {
  return address ? address.toLowerCase() : '';
}

function addAmountToMap(map: Map<string, bigint>, token: string, amount: bigint): void {
  const key = token.toLowerCase();
  const current = map.get(key) ?? BigInt(0);
  map.set(key, current + amount);
}

/**
 * Known router/contract addresses to exclude when finding actual user wallets
 * These are DEX routers that initiate trades on behalf of users
 */
const KNOWN_ROUTER_CONTRACTS = new Set([
  '0x498581ff718922c3f8e6a244956af099b2652b2b', // Uniswap V4 Pool Manager
  '0x0faac7915f8cfd9fbde283c62c1fba018f7d69d2', // Another router
  '0x0000000000000000000000000000000000000000', // Zero address
].map(addr => addr.toLowerCase()));

/**
 * Find the actual user wallet address from Transfer events in the same transaction
 * This is more reliable than Buy.Buyer/Sell.Seller which are often null
 *
 * @param txHash - Transaction hash to search
 * @param trackedTokenAddress - The token we're tracking
 * @param isBuy - True if this is a BUY (token received), false if SELL (token sent)
 * @returns The wallet address that actually received (BUY) or sent (SELL) the token, or null if not found
 */
async function findWalletFromTransfers(
  txHash: string,
  trackedTokenAddress: string,
  isBuy: boolean
): Promise<string | null> {
  try {
    const txHashLower = txHash.toLowerCase();
    const tokenAddr = trackedTokenAddress.toLowerCase();
    const burnAddress = '0x0000000000000000000000000000000000000000';

    // For BUY: find who received the tracked token (to_address)
    // For SELL: find who sent the tracked token (from_address)
    // Use the same pattern as holderDiscoveryService - it works with the actual table structure
    const columnName = isBuy ? 'to_address' : 'from_address';

    const sqlQuery = `
      SELECT DISTINCT ${columnName}
      FROM token_transfers
      WHERE transaction_hash = $1
        AND token_address = $2
        AND ${columnName} != $3
      ORDER BY ${columnName}
      LIMIT 10
    `;

    const result = await query(sqlQuery, [txHashLower, tokenAddr, burnAddress]);

    if (result.rows.length === 0) {
      return null;
    }

    // Find the first address that's not a known router contract
    for (const row of result.rows) {
      // Handle both bytea (needs conversion) and text columns
      let address: string;
      const rawValue = row[columnName];

      if (Buffer.isBuffer(rawValue)) {
        // bytea column - convert to hex string
        address = '0x' + rawValue.toString('hex').toLowerCase();
      } else if (typeof rawValue === 'string') {
        // text column - use directly (normalize to lowercase)
        address = rawValue.toLowerCase();
        // Ensure it has 0x prefix
        if (!address.startsWith('0x')) {
          address = '0x' + address;
        }
      } else {
        continue; // Skip invalid values
      }

      if (!KNOWN_ROUTER_CONTRACTS.has(address)) {
        return address;
      }
    }

    // If all addresses are routers, return the first one (better than nothing)
    const firstRaw = result.rows[0][columnName];
    let firstAddress: string;
    if (Buffer.isBuffer(firstRaw)) {
      firstAddress = '0x' + firstRaw.toString('hex').toLowerCase();
    } else {
      firstAddress = String(firstRaw).toLowerCase();
      if (!firstAddress.startsWith('0x')) {
        firstAddress = '0x' + firstAddress;
      }
    }
    return firstAddress;
  } catch (error: any) {
    // If token_transfers table doesn't exist or query fails, return null (fallback to other methods)
    logWarn(`[FindWalletFromTransfers] Error querying transfers for tx ${txHash.substring(0, 10)}...: ${error.message}`);
    return null;
  }
}

interface AggregatedTransaction {
  txHash: string;
  blockNumber: number;
  blockTime: Date;
  walletInitiator: string | null;
  protocolNames: Set<string>;
  netTokenIn: Map<string, bigint>;
  netTokenOut: Map<string, bigint>;
  netUsdValue: number;
  legsCount: number;
  nonFeeLegs: number;
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
  bitqueryPages: number;
  bitqueryCalls: number;
  tokensProcessed: number;
}> {
  logInfo(`[SWAP PROCESSOR] processSwapsFromBitquery called with tokenAddress=${tokenAddress || 'ALL'}`);

  const walletsFound = new Set<string>();
  let swapsProcessed = 0;
  let totalBitqueryCalls = 0;
  let totalBitqueryPages = 0;
  skippedSellCount = 0; // Reset skipped SELL counter

  try {
    // Get tracked tokens
    logInfo(`[SWAP PROCESSOR] Fetching tracked tokens from database...`);
    const trackedTokensResult = await query('SELECT token_address FROM tracked_tokens');
    const trackedTokenAddresses = trackedTokensResult.rows.map(r => r.token_address.toLowerCase());
    logInfo(`[SWAP PROCESSOR] Found ${trackedTokenAddresses.length} tracked tokens: ${trackedTokenAddresses.slice(0, 3).join(', ')}...`);

    if (trackedTokenAddresses.length === 0) {
      logWarn('[SWAP PROCESSOR] No tracked tokens found - returning early');
      return { swapsProcessed: 0, walletsFound, bitqueryPages: 0, bitqueryCalls: 0, tokensProcessed: 0 };
    }

    const tokensToProcess = tokenAddress
      ? [tokenAddress.toLowerCase()]
      : trackedTokenAddresses;

    logInfo(`[SWAP PROCESSOR] Processing swaps from Bitquery for ${tokensToProcess.length} token(s): ${tokensToProcess.join(', ')}`);

    // Process each tracked token - query ALL historical swaps
    for (let i = 0; i < tokensToProcess.length; i++) {
      const tokenAddr = tokensToProcess[i];

      logInfo(`[SWAP PROCESSOR] Querying Bitquery for ALL swaps for token ${tokenAddr}...`);

      try {
        let tokenBitqueryCalls = 0;
        const progressWrapper = (page: number, swapsFound: number) => {
          tokenBitqueryCalls += 1;
          totalBitqueryCalls += 1;
          totalBitqueryPages += 1;
          logInfo(`[SWAP PROCESSOR] Progress callback: page=${page}, swapsFound=${swapsFound}`);
          if (onProgress) {
            onProgress(page, swapsFound);
          }
        };

        logInfo(`[SWAP PROCESSOR] About to call getTokenSwapGroups for token ${tokenAddr}...`);
        const { groups, trackedTokenAddresses } = await getTokenSwapGroups(tokenAddr, null, null, progressWrapper);
        logInfo(`[SWAP PROCESSOR] getTokenSwapGroups returned ${groups.length} groups for token ${tokenAddr}`);
        const totalLegs = groups.reduce((acc, group) => acc + group.trades.length, 0);
        logInfo(`[Bitquery] Found ${groups.length} transactions / ${totalLegs} legs for token ${tokenAddr} (pages=${tokenBitqueryCalls})`);

        if (onSwapProcessed) {
          onSwapProcessed(swapsProcessed, totalLegs);
        }

        // Process groups in batches to avoid freezing and show progress
        const BATCH_SIZE = 50;
        for (let i = 0; i < groups.length; i += BATCH_SIZE) {
          const batch = groups.slice(i, i + BATCH_SIZE);
          logInfo(`[SWAP PROCESSOR] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(groups.length / BATCH_SIZE)} (${batch.length} transactions)...`);

          for (const group of batch) {
            const processedLegs = await transformGroup(group, trackedTokenAddresses);
            if (processedLegs.length === 0) {
              continue;
            }

            const aggregated = aggregateTransaction(group, processedLegs);
            const transactionId = await upsertSwapTransactionRecord(aggregated);

            for (const leg of processedLegs) {
              await upsertTradeLegRecord(transactionId, leg);

              if (leg.isProtocolFee) {
                continue;
              }

              const { priceUsd, usdValue } = calculatePricing(leg.swapDetail);
              await insertTradeRecord(transactionId, leg.swapDetail, tokenAddr, priceUsd, usdValue);
              await handleFifoAccounting(leg.swapDetail, tokenAddr, priceUsd, usdValue, walletsFound);

              swapsProcessed++;
              incrementTradesFound(1);

              if (onSwapProcessed) {
                onSwapProcessed(swapsProcessed, totalLegs);
              }

              if (swapsProcessed <= 10) {
                logInfo(`[Swap ${swapsProcessed}] ${leg.swapDetail.side}: ${leg.swapDetail.txHash.substring(0, 10)}... | wallet=${leg.swapDetail.walletAddress.substring(0, 10)}... | price=$${priceUsd.toFixed(8)} | usdValue=$${usdValue.toFixed(2)}`);
              }
            }
          }

          // Log progress every batch
          if ((i + BATCH_SIZE) % (BATCH_SIZE * 5) === 0 || i + BATCH_SIZE >= groups.length) {
            logInfo(`[SWAP PROCESSOR] Progress: ${Math.min(i + BATCH_SIZE, groups.length)}/${groups.length} transactions processed, ${swapsProcessed} swaps so far`);
          }
        }

        logInfo(`[Swap Processing] Completed processing ${swapsProcessed} swaps across ${groups.length} transactions`);
      } catch (bitqueryError: any) {
        const errorMsg = bitqueryError?.message || bitqueryError?.toString() || JSON.stringify(bitqueryError);
        logError(`[SWAP PROCESSOR] [CRITICAL] Error fetching swaps for token ${tokenAddr}: ${errorMsg}`);
        if (bitqueryError?.stack) {
          logError(`[SWAP PROCESSOR] [CRITICAL] Stack: ${bitqueryError.stack.substring(0, 2000)}`);
        }
        throw new Error(`Bitquery processing failed for token ${tokenAddr}: ${errorMsg}`);
      }
    }

    logSuccess(`Processed ${swapsProcessed} swaps from Bitquery, found ${walletsFound.size} wallets (pages=${totalBitqueryPages}, calls=${totalBitqueryCalls})`);
    return {
      swapsProcessed,
      walletsFound,
      bitqueryPages: totalBitqueryPages,
      bitqueryCalls: totalBitqueryCalls,
      tokensProcessed: tokensToProcess.length
    };
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
  bitqueryPages: number;
  bitqueryCalls: number;
  tokensProcessed: number;
}> {
  // Bitquery is the ONLY source - throw if it fails
  logInfo('Processing swaps from Bitquery (ONLY source)...');
  return await processSwapsFromBitquery(tokenAddress);
}

// Helper functions for grouped Bitquery processing

async function transformGroup(
  group: BitqueryTradeGroup,
  trackedTokenAddresses: string[]
): Promise<ProcessedLeg[]> {
  const processed: ProcessedLeg[] = [];

  for (let legIndex = 0; legIndex < group.trades.length; legIndex++) {
    const trade = group.trades[legIndex];
    const buyToken = trade.Trade.Buy.Currency.SmartContract.toLowerCase();
    const sellToken = trade.Trade.Sell.Currency.SmartContract.toLowerCase();
    const isTrackedTokenBuy = trackedTokenAddresses.includes(buyToken);
    const isTrackedTokenSell = trackedTokenAddresses.includes(sellToken);

    // INTELLIGENT WALLET DISCOVERY:
    // 1. Try Transfer events (most reliable - finds actual user wallets, not routers)
    // 2. Fall back to Buy.Buyer/Sell.Seller if available
    // 3. Last resort: Transaction.From (often a router contract)
    let wallet = '';
    const trackedToken = isTrackedTokenBuy ? buyToken : (isTrackedTokenSell ? sellToken : null);

    if (trackedToken) {
      // Try to find wallet from Transfer events first (most reliable)
      const transferWallet = await findWalletFromTransfers(
        trade.Transaction.Hash,
        trackedToken,
        isTrackedTokenBuy
      );

      if (transferWallet) {
        wallet = transferWallet;
        if (legIndex < 3) { // Log first few for debugging
          logInfo(`[TransformGroup] Found wallet from transfers: ${wallet.substring(0, 10)}... for tx ${trade.Transaction.Hash.substring(0, 10)}... (${isTrackedTokenBuy ? 'BUY' : 'SELL'})`);
        }
      }
    }

    // Fallback to Bitquery fields if Transfer events didn't work
    if (!wallet) {
      if (isTrackedTokenBuy && trade.Trade.Buy.Buyer) {
        wallet = trade.Trade.Buy.Buyer.toLowerCase();
      } else if (isTrackedTokenSell && trade.Trade.Sell.Seller) {
        wallet = trade.Trade.Sell.Seller.toLowerCase();
      } else {
        wallet = trade.Transaction.From.toLowerCase();
        logWarn(`[TransformGroup] Fallback to transaction sender for tx ${trade.Transaction.Hash.substring(0, 10)}... (no Transfer events found)`);
      }
    }

    const isFee = isProtocolFeeTransfer(trade, wallet, trackedTokenAddresses);
    const swapDetail = await transformBitqueryTrade(trade, wallet, trackedTokenAddresses, legIndex, {
      protocolName: trade.Trade.Dex.ProtocolName,
      isProtocolFee: isFee
    });

    if (!swapDetail) {
      continue;
    }

    processed.push({
      trade,
      swapDetail,
      wallet,
      legIndex,
      isProtocolFee: isFee
    });
  }

  return processed;
}

function aggregateTransaction(
  group: BitqueryTradeGroup,
  legs: ProcessedLeg[]
): AggregatedTransaction {
  const aggregated: AggregatedTransaction = {
    txHash: group.txHash.toLowerCase(),
    blockNumber: typeof group.blockNumber === 'string' ? parseInt(group.blockNumber, 10) : group.blockNumber,
    blockTime: new Date(group.blockTime),
    walletInitiator: group.transactionFrom ? group.transactionFrom.toLowerCase() : null,
    protocolNames: new Set<string>(),
    netTokenIn: new Map<string, bigint>(),
    netTokenOut: new Map<string, bigint>(),
    netUsdValue: 0,
    legsCount: legs.length,
    nonFeeLegs: 0
  };

  for (const leg of legs) {
    if (leg.swapDetail.protocolName) {
      aggregated.protocolNames.add(leg.swapDetail.protocolName.toLowerCase());
    }

    if (leg.isProtocolFee) {
      continue;
    }

    aggregated.nonFeeLegs += 1;
    // Ensure baseTokenUsdValue is a valid number, not a string or malformed value
    let baseUsd: number;
    if (typeof leg.swapDetail.baseTokenUsdValue === 'number') {
      baseUsd = leg.swapDetail.baseTokenUsdValue;
    } else if (typeof leg.swapDetail.baseTokenUsdValue === 'string') {
      // Remove any non-numeric characters except decimal point and minus sign
      const cleaned = String(leg.swapDetail.baseTokenUsdValue).replace(/[^0-9.-]/g, '');
      // Check for multiple decimal points (malformed number)
      if ((cleaned.match(/\./g) || []).length > 1) {
        logWarn(`[Aggregate] Malformed baseUsd value (multiple decimals) for leg ${leg.legIndex}: ${leg.swapDetail.baseTokenUsdValue}, using 0`);
        baseUsd = 0;
      } else {
        baseUsd = parseFloat(cleaned) || 0;
      }
    } else {
      baseUsd = 0;
    }

    // Validate the number is finite and not NaN
    if (!Number.isFinite(baseUsd) || isNaN(baseUsd)) {
      logWarn(`[Aggregate] Invalid baseUsd value for leg ${leg.legIndex}: ${leg.swapDetail.baseTokenUsdValue} (parsed as ${baseUsd}), using 0`);
      baseUsd = 0;
    }

    aggregated.netUsdValue += baseUsd;
    addAmountToMap(aggregated.netTokenIn, leg.swapDetail.tokenIn, leg.swapDetail.amountIn);
    addAmountToMap(aggregated.netTokenOut, leg.swapDetail.tokenOut, leg.swapDetail.amountOut);
  }

  return aggregated;
}

function calculatePricing(swap: SwapDetails): { priceUsd: number; usdValue: number } {
  const MAX_DECIMAL_VALUE = 999999999999999999.99999999;
  let priceUsd = Number(swap.priceUsd ?? 0);
  let usdValue = Number(swap.baseTokenUsdValue ?? 0);

  if (!usdValue && swap.trackedTokenUsdValue) {
    usdValue = Number(swap.trackedTokenUsdValue);
  }

  if ((!priceUsd || !Number.isFinite(priceUsd)) || priceUsd === 0) {
    const trackedAmountDecimal = Number(swap.trackedTokenAmount) / (10 ** (swap.trackedTokenDecimals ?? 18));
    const baseAmountDecimal = Number(swap.baseTokenAmount) / (10 ** (swap.baseTokenDecimals ?? 18));
    if (trackedAmountDecimal > 0 && baseAmountDecimal > 0) {
      priceUsd = baseAmountDecimal / trackedAmountDecimal;
    }
  }

  if ((!usdValue || !Number.isFinite(usdValue)) || usdValue === 0) {
    const baseAmountDecimal = Number(swap.baseTokenAmount) / (10 ** (swap.baseTokenDecimals ?? 18));
    usdValue = baseAmountDecimal;
  }

  priceUsd = Math.min(Math.max(priceUsd, -MAX_DECIMAL_VALUE), MAX_DECIMAL_VALUE);
  usdValue = Math.min(Math.max(usdValue, -MAX_DECIMAL_VALUE), MAX_DECIMAL_VALUE);

  return { priceUsd, usdValue };
}

async function insertTradeRecord(
  transactionId: number,
  swap: SwapDetails,
  tokenAddress: string,
  priceUsd: number,
  usdValue: number
): Promise<void> {
  await query(
    `INSERT INTO trades (
      wallet_address, token_address, tx_hash, block_number, timestamp,
      side, token_amount, price_usd, usd_value, parsed_source,
      token_in, token_out, amount_in, amount_out, base_token,
      transaction_id, created_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, 'bitquery',
      $10, $11, $12, $13, $14,
      $15, NOW()
    )
    ON CONFLICT (transaction_id, wallet_address, token_address, side)
    DO UPDATE SET
      price_usd = EXCLUDED.price_usd,
      usd_value = EXCLUDED.usd_value,
      token_amount = EXCLUDED.token_amount,
      token_in = EXCLUDED.token_in,
      token_out = EXCLUDED.token_out,
      amount_in = EXCLUDED.amount_in,
      amount_out = EXCLUDED.amount_out,
      base_token = EXCLUDED.base_token`,
    [
      swap.walletAddress.toLowerCase(),
      (swap.trackedTokenAddress || tokenAddress).toLowerCase(),
      swap.txHash,
      swap.blockNumber,
      swap.timestamp,
      swap.side,
      swap.trackedTokenAmount.toString(),
      priceUsd.toFixed(8),
      usdValue.toFixed(8),
      swap.tokenIn?.toLowerCase() || null,
      swap.tokenOut?.toLowerCase() || null,
      swap.amountIn.toString(),
      swap.amountOut.toString(),
      swap.baseTokenAddress?.toLowerCase() || null,
      transactionId
    ]
  );
}

async function handleFifoAccounting(
  swap: SwapDetails,
  tokenAddress: string,
  priceUsd: number,
  usdValue: number,
  walletsFound: Set<string>
): Promise<void> {
  walletsFound.add(swap.walletAddress.toLowerCase());

  try {
    if (swap.side === 'BUY') {
      await processBuy(
        swap.walletAddress,
        tokenAddress,
        swap.trackedTokenAmount,
        priceUsd,
        usdValue
      );
    } else {
      const position = await getPosition(swap.walletAddress, tokenAddress);
      if (position && BigInt(position.remaining_amount) > 0) {
        await processSell(
          swap.walletAddress,
          tokenAddress,
          swap.trackedTokenAmount,
          priceUsd,
          swap.trackedTokenDecimals ?? 18,
          position
        );
      } else {
        skippedSellCount++;
        // Only log first few skipped SELLs to avoid spam, but log wallet address to debug
        if (skippedSellCount <= 20) {
          logInfo(`[FIFO] Skipping SELL ${swap.txHash.substring(0, 10)}... - wallet=${swap.walletAddress.substring(0, 10)}... has no position (skipped: ${skippedSellCount})`);
        }
      }
    }
  } catch (fifoError: any) {
    const fifoErrorMsg = fifoError?.message || fifoError?.toString() || JSON.stringify(fifoError);
    logWarn(`[FIFO] Failed to process ${swap.side} for ${swap.txHash}: ${fifoErrorMsg}`);
  }
}

async function upsertSwapTransactionRecord(
  aggregated: AggregatedTransaction
): Promise<number> {
  const netTokenInJson = JSON.stringify(Object.fromEntries(
    Array.from(aggregated.netTokenIn.entries()).map(([token, amount]) => [token, amount.toString()])
  ));
  const netTokenOutJson = JSON.stringify(Object.fromEntries(
    Array.from(aggregated.netTokenOut.entries()).map(([token, amount]) => [token, amount.toString()])
  ));
  const protocolName = aggregated.protocolNames.size > 0
    ? Array.from(aggregated.protocolNames.values()).join(',')
    : null;

  const result = await query(
    `INSERT INTO swap_transactions (
      tx_hash, block_number, block_time, source, protocol_name,
      wallet_initiator, net_token_in, net_token_out, net_usd_value, legs_count,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, 'bitquery', $4,
      $5, $6, $7, $8, $9,
      NOW(), NOW()
    )
    ON CONFLICT (tx_hash) DO UPDATE SET
      protocol_name = EXCLUDED.protocol_name,
      wallet_initiator = EXCLUDED.wallet_initiator,
      net_token_in = EXCLUDED.net_token_in,
      net_token_out = EXCLUDED.net_token_out,
      net_usd_value = EXCLUDED.net_usd_value,
      legs_count = EXCLUDED.legs_count,
      updated_at = NOW()
    RETURNING id`,
    [
      aggregated.txHash,
      aggregated.blockNumber,
      aggregated.blockTime,
      protocolName,
      aggregated.walletInitiator,
      netTokenInJson,
      netTokenOutJson,
      // Ensure netUsdValue is a valid number for database
      Number.isFinite(aggregated.netUsdValue) ? aggregated.netUsdValue : 0,
      aggregated.legsCount
    ]
  );

  return result.rows[0].id as number;
}

async function upsertTradeLegRecord(
  transactionId: number,
  leg: ProcessedLeg
): Promise<void> {
  const swap = leg.swapDetail;
  const protocolName = swap.protocolName || null;
  const routeHint = swap.route && swap.route.length > 0
    ? swap.route.map(step => `${step.tokenIn}->${step.tokenOut}`).join(' | ').slice(0, 255)
    : null;

  await query(
    `INSERT INTO trade_legs (
      transaction_id, leg_index, protocol_name, route_hint,
      side, wallet_address, token_in_address, token_out_address,
      amount_in, amount_out, token_in_decimals, token_out_decimals,
      usd_value, price_usd, is_protocol_fee, raw_payload, created_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16, NOW()
    )
    ON CONFLICT (transaction_id, leg_index) DO UPDATE SET
      protocol_name = EXCLUDED.protocol_name,
      route_hint = EXCLUDED.route_hint,
      wallet_address = EXCLUDED.wallet_address,
      token_in_address = EXCLUDED.token_in_address,
      token_out_address = EXCLUDED.token_out_address,
      amount_in = EXCLUDED.amount_in,
      amount_out = EXCLUDED.amount_out,
      token_in_decimals = EXCLUDED.token_in_decimals,
      token_out_decimals = EXCLUDED.token_out_decimals,
      usd_value = EXCLUDED.usd_value,
      price_usd = EXCLUDED.price_usd,
      is_protocol_fee = EXCLUDED.is_protocol_fee,
      raw_payload = EXCLUDED.raw_payload`,
    [
      transactionId,
      leg.legIndex,
      protocolName,
      routeHint,
      swap.side,
      swap.walletAddress.toLowerCase(),
      swap.tokenIn?.toLowerCase() || null,
      swap.tokenOut?.toLowerCase() || null,
      swap.amountIn.toString(),
      swap.amountOut.toString(),
      swap.tokenInDecimals ?? null,
      swap.tokenOutDecimals ?? null,
      swap.baseTokenUsdValue ?? null,
      swap.priceUsd ?? null,
      leg.isProtocolFee,
      JSON.stringify(leg.trade)
    ]
  );
}
