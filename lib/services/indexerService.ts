// lib/services/indexerService.ts
import { ethers } from 'ethers';
import { query } from '@/lib/db/connection';
import { BADTRADER_TOKEN_ADDRESS } from '@/lib/utils/constants';
import { detectSwapTransaction, extractSwapDetails } from './swapDecoder';
import { processBuy, processSell } from './fifoAccounting';
import { getHistoricalPrice } from './priceService';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const BASE_CHAIN_ID = 8453;
const LOOKBACK_DAYS = 30;
const LOOKBACK_BLOCKS_ESTIMATE = LOOKBACK_DAYS * 24 * 60 * 4; // Approx 4 blocks/min on Base

const provider = ALCHEMY_API_KEY
  ? new ethers.AlchemyProvider(BASE_CHAIN_ID, ALCHEMY_API_KEY)
  : null;

/**
 * Get current block number
 */
async function getCurrentBlockNumber(): Promise<number> {
  if (!provider) {
    throw new Error('Alchemy provider not available');
  }
  return await provider.getBlockNumber();
}

/**
 * Get tracked tokens from database
 */
async function getTrackedTokens(): Promise<Array<{ token_address: string; symbol: string; decimals: number }>> {
  const result = await query('SELECT token_address, symbol, decimals FROM tracked_tokens');
  return result.rows;
}

/**
 * Get or create wallet sync record
 */
async function getOrCreateWallet(walletAddress: string, currentBlock: number): Promise<number> {
  const walletAddr = walletAddress.toLowerCase();

  // Check if wallet exists
  const existing = await query(
    'SELECT last_synced_block FROM wallets WHERE wallet_address = $1',
    [walletAddr]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].last_synced_block || currentBlock - LOOKBACK_BLOCKS_ESTIMATE;
  }

  // Create new wallet record with 30-day lookback
  const startBlock = currentBlock - LOOKBACK_BLOCKS_ESTIMATE;
  await query(
    'INSERT INTO wallets (wallet_address, last_synced_block, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
    [walletAddr, startBlock]
  );

  return startBlock;
}

/**
 * Update wallet's last synced block
 */
async function updateWalletSyncBlock(walletAddress: string, blockNumber: number): Promise<void> {
  const walletAddr = walletAddress.toLowerCase();
  await query(
    'UPDATE wallets SET last_synced_block = $1, updated_at = NOW() WHERE wallet_address = $2',
    [blockNumber, walletAddr]
  );
}

/**
 * Check if transaction already processed
 */
async function isTransactionProcessed(txHash: string, walletAddress: string, tokenAddress: string): Promise<boolean> {
  const result = await query(
    'SELECT COUNT(*) as count FROM trades WHERE tx_hash = $1 AND wallet_address = $2 AND token_address = $3',
    [txHash, walletAddress.toLowerCase(), tokenAddress.toLowerCase()]
  );
  return parseInt(result.rows[0].count) > 0;
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
  parsedSource: 'alchemy' | 'covalent'
): Promise<void> {
  const tokenDecimals = 18; // BadTraders token uses 18 decimals
  const tokenAmountStr = tokenAmount.toString();

  await query(
    `INSERT INTO trades (
      wallet_address, token_address, tx_hash, block_number, timestamp,
      side, token_amount, price_usd, usd_value, parsed_source, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (wallet_address, tx_hash, token_address, side) DO NOTHING`,
    [
      walletAddress.toLowerCase(),
      tokenAddress.toLowerCase(),
      txHash,
      blockNumber,
      timestamp,
      side,
      tokenAmountStr,
      priceUsd.toFixed(8),
      usdValue.toFixed(8),
      parsedSource
    ]
  );
}

/**
 * Process a swap transaction
 */
async function processSwapTransaction(
  txHash: string,
  walletAddress: string,
  blockNumber: number,
  timestamp: Date
): Promise<boolean> {
  try {
    // Check if this is a swap
    const isSwap = await detectSwapTransaction(txHash);
    if (!isSwap) {
      return false;
    }

    // Extract swap details
    const swapDetails = await extractSwapDetails(txHash, walletAddress);
    if (!swapDetails) {
      return false;
    }

    // Get tracked tokens
    const trackedTokens = await getTrackedTokens();
    const trackedTokenAddresses = trackedTokens.map(t => t.token_address.toLowerCase());

    // Determine which token is the tracked token
    const tokenAddress = swapDetails.side === 'BUY'
      ? swapDetails.tokenOut.toLowerCase()
      : swapDetails.tokenIn.toLowerCase();

    // Check if this swap involves a tracked token
    if (!trackedTokenAddresses.includes(tokenAddress)) {
      return false;
    }

    // Check if already processed
    const alreadyProcessed = await isTransactionProcessed(txHash, walletAddress, tokenAddress);
    if (alreadyProcessed) {
      return false;
    }

    // Get historical price
    const priceUsd = await getHistoricalPrice(tokenAddress, Math.floor(timestamp.getTime() / 1000));
    if (!priceUsd || priceUsd <= 0) {
      console.warn(`Could not get price for ${tokenAddress} at timestamp ${timestamp}`);
      return false;
    }

    // Calculate USD value
    const tokenDecimals = 18; // Assuming 18 decimals
    const tokenAmount = swapDetails.side === 'BUY' ? swapDetails.amountOut : swapDetails.amountIn;
    const tokenAmountFloat = Number(ethers.formatUnits(tokenAmount, tokenDecimals));
    const usdValue = tokenAmountFloat * priceUsd;

    // Parsed source is always Alchemy (no external decode service needed)
    const parsedSource: 'alchemy' | 'covalent' = 'alchemy';

    // Insert trade
    await insertTrade(
      walletAddress,
      tokenAddress,
      txHash,
      blockNumber,
      timestamp,
      swapDetails.side,
      tokenAmount,
      priceUsd,
      usdValue,
      parsedSource
    );

    // Process FIFO accounting
    if (swapDetails.side === 'BUY') {
      const costBasis = usdValue;
      await processBuy(walletAddress, tokenAddress, tokenAmount, priceUsd, costBasis);
    } else {
      await processSell(walletAddress, tokenAddress, tokenAmount, priceUsd);
    }

    return true;
  } catch (error) {
    console.error(`Error processing swap transaction ${txHash}:`, error);
    return false;
  }
}

/**
 * Main sync function for a single wallet
 */
export async function syncWalletTransactions(walletAddress: string): Promise<void> {
  if (!provider) {
    throw new Error('Alchemy provider not available');
  }

  const walletAddr = walletAddress.toLowerCase();
  console.log(`Starting sync for wallet: ${walletAddr}`);

  // Get current block number
  const currentBlock = await getCurrentBlockNumber();

  // Get or create wallet record
  const lastSyncedBlock = await getOrCreateWallet(walletAddr, currentBlock);

  // Only sync if we're behind
  if (lastSyncedBlock >= currentBlock) {
    console.log(`Wallet ${walletAddr} already synced to latest block`);
    return;
  }

  console.log(`Fetching transactions from block ${lastSyncedBlock} to ${currentBlock}`);

  try {
    // Fetch transactions from Alchemy
    // Note: Alchemy's getAssetTransfers is better for this than getHistory
    const response = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: `0x${lastSyncedBlock.toString(16)}`,
          toBlock: 'latest',
          toAddress: walletAddr,
          excludeZeroValue: false,
          category: ['erc20']
        }]
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Alchemy API Error: ${data.error.message}`);
    }

    const transfers = data.result?.transfers || [];
    console.log(`Found ${transfers.length} transfers for wallet ${walletAddr}`);

    // Process each transfer to find swaps
    let processedCount = 0;
    let latestBlockSeen = lastSyncedBlock;

    for (const transfer of transfers) {
      const txHash = transfer.hash;
      const blockNumber = parseInt(transfer.blockNum, 16);
      const timestamp = new Date(transfer.metadata?.blockTimestamp);

      if (blockNumber > latestBlockSeen) {
        latestBlockSeen = blockNumber;
      }

      // Process the transaction (will check if it's a swap internally)
      const processed = await processSwapTransaction(txHash, walletAddr, blockNumber, timestamp);
      if (processed) {
        processedCount++;
      }
    }

    // Update last synced block
    await updateWalletSyncBlock(walletAddr, latestBlockSeen);

    console.log(`Sync complete for ${walletAddr}: ${processedCount} swaps processed, synced to block ${latestBlockSeen}`);
  } catch (error) {
    console.error(`Error syncing wallet ${walletAddr}:`, error);
    throw error;
  }
}

/**
 * Sync all registered wallets
 */
export async function syncAllWallets(): Promise<void> {
  try {
    // Get all registered wallets from users table
    const result = await query(
      'SELECT DISTINCT wallet_address FROM users WHERE opt_in_status = true'
    );

    const wallets = result.rows.map((row: any) => row.wallet_address);
    console.log(`Syncing ${wallets.length} registered wallets`);

    for (const wallet of wallets) {
      try {
        await syncWalletTransactions(wallet);
      } catch (error) {
        console.error(`Error syncing wallet ${wallet}:`, error);
        // Continue with next wallet
      }
    }

    console.log('Sync complete for all wallets');
  } catch (error) {
    console.error('Error syncing all wallets:', error);
    throw error;
  }
}

