// lib/services/userIndexerService.ts
// User-generated indexing service using Alchemy instead of BitQuery
// Indexes individual wallets on-demand when users register for contests

import { ethers } from 'ethers';
import { query } from '@/lib/db/connection';
import { getPrimaryProvider } from './providers';
import { SwapDetails } from './swapTypes';
import { getCurrentPrice } from './priceService';
import { logInfo, logError } from './indexerLogger';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const BASE_CHAIN_ID = 8453;

// Uniswap V3 Pool Swap event signature
const SWAP_EVENT_SIGNATURE = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
// Transfer event signature (ERC20)
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

interface IndexResult {
  tradesFound: number;
  pnl: number;
  indexedAt: Date;
}

/**
 * Index a user's wallet for a specific token in a contest
 * Fetches all swap transactions involving the user's wallet and the token
 */
export async function indexUserWalletForToken(
  walletAddress: string,
  tokenAddress: string,
  contestId: number,
  registrationId: number
): Promise<IndexResult> {
  logInfo(`[UserIndexer] Indexing wallet ${walletAddress} for token ${tokenAddress} in contest ${contestId}`);

  if (!ALCHEMY_API_KEY) {
    throw new Error('ALCHEMY_API_KEY not configured');
  }

  const provider = getPrimaryProvider();
  if (!provider) {
    throw new Error('No provider available');
  }

  // Get contest dates to determine block range
  const contestResult = await query(
    'SELECT start_date, end_date FROM weekly_contests WHERE id = $1',
    [contestId]
  );

  if (contestResult.rows.length === 0) {
    throw new Error(`Contest ${contestId} not found`);
  }

  const contest = contestResult.rows[0];
  const startDate = new Date(contest.start_date);
  const endDate = new Date(contest.end_date);

  // Get block numbers for date range
  const currentBlock = await provider.getBlockNumber();
  const startBlock = await getBlockNumberForDate(provider, startDate);
  const endBlock = await getBlockNumberForDate(provider, endDate);

  logInfo(`[UserIndexer] Block range: ${startBlock} to ${endBlock} (current: ${currentBlock})`);

  // Fetch all swap events involving this wallet and token
  const trades = await fetchUserSwapEvents(
    provider,
    walletAddress,
    tokenAddress,
    startBlock,
    endBlock
  );

  logInfo(`[UserIndexer] Found ${trades.length} swap transactions`);

  // Store trades in database
  let tradesStored = 0;
  for (const trade of trades) {
    try {
      await storeUserTrade(registrationId, walletAddress, tokenAddress, trade);
      tradesStored++;
    } catch (error: any) {
      // Skip duplicates
      if (error.message?.includes('duplicate') || error.code === '23505') {
        continue;
      }
      logError(`[UserIndexer] Error storing trade ${trade.txHash}: ${error.message}`);
    }
  }

  // Calculate PnL
  const pnl = await calculateUserPnL(registrationId, tokenAddress);

  // Update registration with PnL
  await query(
    `UPDATE contest_registrations
     SET indexed_at = NOW(), pnl_calculated_at = NOW(), current_pnl = $1
     WHERE id = $2`,
    [pnl, registrationId]
  );

  logInfo(`[UserIndexer] Completed: ${tradesStored} trades stored, PnL: $${pnl.toFixed(2)}`);

  return {
    tradesFound: trades.length,
    pnl,
    indexedAt: new Date()
  };
}

/**
 * Fetch swap events for a user's wallet involving a specific token
 * Uses eth_getLogs to query Uniswap V3 Pool Swap events
 */
async function fetchUserSwapEvents(
  provider: ethers.Provider,
  walletAddress: string,
  tokenAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<SwapDetails[]> {
  const walletAddressLower = walletAddress.toLowerCase();
  const tokenAddressLower = tokenAddress.toLowerCase();

  // Get all Uniswap V3 pools that involve this token
  // We'll need to find pools by querying Transfer events or using known pool addresses
  // For now, we'll query all Swap events and filter by token involvement

  const swaps: SwapDetails[] = [];

  try {
    // Query Swap events from Uniswap V3 pools
    // Note: This is a simplified approach. In production, you'd want to:
    // 1. Maintain a list of known Uniswap V3 pools for each token
    // 2. Query each pool individually for better performance
    // 3. Use Alchemy's getAssetTransfers API for better coverage

    // For now, we'll use a broader approach: query Transfer events for the token
    // and then fetch the transaction to see if it's a swap

    const transferFilter = {
      address: tokenAddressLower,
      topics: [
        TRANSFER_EVENT_SIGNATURE,
        null, // from (any)
        ethers.zeroPadValue(walletAddressLower, 32), // to (user's wallet)
      ],
      fromBlock,
      toBlock
    };

    logInfo(`[UserIndexer] Querying Transfer events for token ${tokenAddressLower}...`);

    // Query transfers TO the user's wallet (buys)
    const transfersTo = await provider.getLogs({
      ...transferFilter,
      topics: [
        TRANSFER_EVENT_SIGNATURE,
        null,
        ethers.zeroPadValue(walletAddressLower, 32)
      ]
    });

    // Query transfers FROM the user's wallet (sells)
    const transfersFrom = await provider.getLogs({
      address: tokenAddressLower,
      topics: [
        TRANSFER_EVENT_SIGNATURE,
        ethers.zeroPadValue(walletAddressLower, 32), // from (user's wallet)
        null // to (any)
      ],
      fromBlock,
      toBlock
    });

    logInfo(`[UserIndexer] Found ${transfersTo.length} transfers to wallet, ${transfersFrom.length} transfers from wallet`);

    // Process transfers and identify swaps
    const allTransfers = [...transfersTo, ...transfersFrom];
    const processedTxs = new Set<string>();

    for (const transfer of allTransfers) {
      const txHash = transfer.transactionHash;

      // Skip if we've already processed this transaction
      if (processedTxs.has(txHash)) {
        continue;
      }

      try {
        // Fetch transaction receipt to get full details
        const receipt = await provider.getTransactionReceipt(txHash);

        // Check if this is a swap transaction
        // Look for Swap events in the receipt
        const swapEvent = receipt.logs.find(log =>
          log.topics[0] === SWAP_EVENT_SIGNATURE
        );

        if (swapEvent) {
          // Parse the swap
          const swapDetails = await parseSwapTransaction(
            provider,
            txHash,
            walletAddressLower,
            tokenAddressLower
          );

          if (swapDetails) {
            swaps.push(swapDetails);
            processedTxs.add(txHash);
          }
        }
      } catch (error: any) {
        logError(`[UserIndexer] Error processing transaction ${txHash}: ${error.message}`);
        continue;
      }
    }

    logInfo(`[UserIndexer] Identified ${swaps.length} swap transactions`);

  } catch (error: any) {
    logError(`[UserIndexer] Error fetching swap events: ${error.message}`);
    throw error;
  }

  return swaps;
}

/**
 * Parse a swap transaction to extract swap details
 */
async function parseSwapTransaction(
  provider: ethers.Provider,
  txHash: string,
  walletAddress: string,
  tokenAddress: string
): Promise<SwapDetails | null> {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    const tx = await provider.getTransaction(txHash);
    const block = await provider.getBlock(receipt.blockNumber);

    // Determine if this is a buy or sell
    // Buy: token transferred TO wallet
    // Sell: token transferred FROM wallet

    const tokenTransfer = receipt.logs.find(log =>
      log.address.toLowerCase() === tokenAddress &&
      log.topics[0] === TRANSFER_EVENT_SIGNATURE
    );

    if (!tokenTransfer) {
      return null;
    }

    // Parse transfer event
    const transferInterface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ]);
    const transferEvent = transferInterface.parseLog({
      topics: tokenTransfer.topics,
      data: tokenTransfer.data
    });

    if (!transferEvent) {
      return null;
    }

    const from = transferEvent.args.from.toLowerCase();
    const to = transferEvent.args.to.toLowerCase();
    const amount = BigInt(transferEvent.args.value.toString());

    const isBuy = to === walletAddress;
    const isSell = from === walletAddress;

    if (!isBuy && !isSell) {
      return null; // Not a trade for this wallet
    }

    // Get the other token in the swap (WETH or USDC typically)
    // This requires parsing the swap event or transaction data
    // For now, we'll use a simplified approach

    // Try to get price from receipt logs or transaction data
    let amountIn = amount;
    let amountOut = 0n;
    let tokenIn = tokenAddress;
    let tokenOut = '';

    // If it's a buy, token is the output, we need to find the input
    // If it's a sell, token is the input, we need to find the output

    // Simplified: We'll calculate this from the transaction value or other logs
    // In production, you'd parse the Swap event properly

    // Get current price for USD value calculation
    const price = await getCurrentPrice(tokenAddress);

    const swapDetails: SwapDetails = {
      txHash,
      blockNumber: receipt.blockNumber,
      timestamp: new Date(block.timestamp * 1000),
      walletAddress,
      tokenAddress,
      tradeType: isBuy ? 'buy' : 'sell',
      amountIn: Number(amountIn) / 1e18, // Assuming 18 decimals
      amountOut: Number(amountOut) / 1e18,
      tokenInAddress: isBuy ? '' : tokenAddress, // Will be filled properly in production
      tokenOutAddress: isBuy ? tokenAddress : '',
      priceUSD: price * (Number(amountIn) / 1e18),
      protocol: 'uniswap-v3'
    };

    return swapDetails;

  } catch (error: any) {
    logError(`[UserIndexer] Error parsing transaction ${txHash}: ${error.message}`);
    return null;
  }
}

/**
 * Store a user trade in the database
 */
async function storeUserTrade(
  registrationId: number,
  walletAddress: string,
  tokenAddress: string,
  trade: SwapDetails
): Promise<void> {
  await query(
    `INSERT INTO user_trades
     (registration_id, wallet_address, token_address, tx_hash, block_number, timestamp,
      trade_type, amount_in, amount_out, token_in_address, token_out_address, price_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (tx_hash, wallet_address, token_address) DO NOTHING`,
    [
      registrationId,
      walletAddress.toLowerCase(),
      tokenAddress.toLowerCase(),
      trade.txHash,
      trade.blockNumber,
      trade.timestamp,
      trade.tradeType,
      trade.amountIn,
      trade.amountOut,
      trade.tokenInAddress || null,
      trade.tokenOutAddress || null,
      trade.priceUSD || null
    ]
  );
}

/**
 * Calculate PnL for a user's contest registration
 * Uses FIFO accounting similar to the existing system
 */
async function calculateUserPnL(
  registrationId: number,
  tokenAddress: string
): Promise<number> {
  // Get all trades for this registration
  const tradesResult = await query(
    `SELECT * FROM user_trades
     WHERE registration_id = $1 AND token_address = $2
     ORDER BY timestamp ASC, block_number ASC`,
    [registrationId, tokenAddress.toLowerCase()]
  );

  const trades = tradesResult.rows;

  if (trades.length === 0) {
    return 0;
  }

  // Simple FIFO PnL calculation
  // This is a simplified version - you'd want to use the existing fifoAccounting service
  let position = 0; // Net position in tokens
  let costBasis = 0; // Total cost basis
  let realizedPnL = 0;

  for (const trade of trades) {
    if (trade.trade_type === 'buy') {
      position += parseFloat(trade.amount_in);
      costBasis += (parseFloat(trade.amount_in) * (trade.price_usd || 0));
    } else if (trade.trade_type === 'sell') {
      const sellAmount = parseFloat(trade.amount_out);
      const sellValue = sellAmount * (trade.price_usd || 0);

      // Calculate cost basis for sold tokens (FIFO)
      const avgCost = costBasis / Math.max(position, 1);
      const costOfSold = sellAmount * avgCost;

      realizedPnL += (sellValue - costOfSold);
      position -= sellAmount;
      costBasis -= costOfSold;
    }
  }

  // Get current price for unrealized PnL
  const currentPrice = await getCurrentPrice(tokenAddress);
  const unrealizedPnL = position * (currentPrice - (costBasis / Math.max(position, 1)));

  const totalPnL = realizedPnL + unrealizedPnL;

  return totalPnL;
}

/**
 * Get block number for a specific date
 */
async function getBlockNumberForDate(
  provider: ethers.Provider,
  date: Date
): Promise<number> {
  const currentBlock = await provider.getBlockNumber();
  const currentTime = Date.now();
  const targetTime = date.getTime();
  const blockTime = 2; // Base block time is ~2 seconds

  // Estimate block number based on time difference
  const timeDiff = targetTime - currentTime;
  const blocksDiff = Math.floor(timeDiff / (blockTime * 1000));
  const estimatedBlock = currentBlock + blocksDiff;

  // Clamp to reasonable values
  return Math.max(0, Math.min(estimatedBlock, currentBlock));
}

