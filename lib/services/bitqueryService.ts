// lib/services/bitqueryService.ts
// Bitquery GraphQL API V2 client for Base chain DEX trades
//
// V2 API Features:
// - Endpoint: https://streaming.bitquery.io/graphql
// - Real-time data access and WebSocket subscriptions
// - OAuth tokens or API keys (as Bearer token) for authentication
// - Improved performance and reliability
//
// Documentation: https://docs.bitquery.io/docs/blockchain/Base/

import { query } from '@/lib/db/connection';
import { USDC_ADDRESS, WETH_ADDRESS } from '@/lib/utils/constants';
import { logInfo, logWarn } from './indexerLogger';
import { SwapDetails } from './swapTypes';

const BITQUERY_API_KEY = process.env.BITQUERY_API_KEY;

/**
 * Check if an address is a known protocol contract (fee lockers, LP lockers, etc.)
 * These should be filtered out as they're internal protocol mechanics, not user swaps
 */
function isProtocolContract(address: string, protocolName?: string): boolean {
  const addr = address.toLowerCase();

  // Filter out known protocol contract patterns
  // Clanker protocol contracts (fee lockers, LP lockers)
  // These addresses are typically contracts that handle protocol fees
  // We'll identify them by checking:
  // 1. If they're in a known list (add addresses as discovered)
  // 2. If the protocol is Clanker and the address appears to be a fee mechanism

  // For now, we'll filter based on transaction patterns:
  // If the swap amount is very small ($0.17 matches the user's example) and
  // the protocol is Clanker, it's likely a fee transfer
  // But we need the actual contract addresses to filter properly

  // TODO: Add known Clanker protocol contract addresses here as discovered
  // Example: KNOWN_PROTOCOL_CONTRACTS.add('0x...')

  return false; // Placeholder - will be implemented based on discovered addresses
}

/**
 * Check if a swap appears to be a protocol fee transfer rather than a user swap
 * This filters out internal protocol mechanics like fee lockers
 */
function isProtocolFeeTransfer(
  trade: BitqueryDEXTrade,
  swapWallet: string,
  trackedTokenAddresses: string[]
): boolean {
  const protocolName = trade.Trade.Dex.ProtocolName?.toLowerCase() || '';
  const swapWalletLower = swapWallet.toLowerCase();
  const buyer = trade.Trade.Buy.Buyer?.toLowerCase() || '';
  const seller = trade.Trade.Sell.Seller?.toLowerCase() || '';

  // Get USD values to check if this is a suspiciously small fee transfer
  const buyUsdValue = trade.Trade.Buy.AmountInUSD || 0;
  const sellUsdValue = trade.Trade.Sell.AmountInUSD || 0;
  const minUsdValue = Math.min(buyUsdValue, sellUsdValue);

  // Check if the swap wallet matches known protocol patterns
  if (isProtocolContract(swapWalletLower, protocolName)) {
    return true;
  }

  // Heuristic: Filter out protocol fee transfers in Clanker swaps
  // Protocol fee transfers typically:
  // 1. Have very small USD values (< $0.50)
  // 2. Involve protocol contracts (fee lockers, LP lockers)
  // 3. Are part of larger transactions (we'll catch these by checking tx hash duplicates later)

  // For now, be conservative: only filter very suspicious cases
  // TODO: Implement transaction hash grouping to identify fee transfers more accurately
  if (protocolName.includes('clanker') && minUsdValue > 0 && minUsdValue < 0.5) {
    // Check if this looks like a protocol-to-protocol transfer
    // If the swap wallet matches Buyer or Seller, and the other party might be a protocol contract
    if (swapWalletLower === buyer || swapWalletLower === seller) {
      // Very small amounts (< $0.30) in Clanker are likely protocol fees
      if (minUsdValue < 0.3) {
        return true; // Likely a protocol fee transfer
      }
    }
  }

  return false;
}
// V2 API endpoint - supports real-time data and WebSocket subscriptions
const BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';

// Base tokens used for BUY/SELL classification (in order of preference)
const BASE_TOKENS = [
  WETH_ADDRESS.toLowerCase(),
  USDC_ADDRESS.toLowerCase(),
  '0x0000000000000000000000000000000000000000', // Native ETH
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', // USDbC
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI
].map(addr => addr.toLowerCase());

interface BitqueryDEXTrade {
  Block: {
    Time: string;
    Number: number;
  };
  Transaction: {
    Hash: string;
    From: string;
  };
  Trade: {
    Dex: {
      ProtocolName: string;
    };
    Buy: {
      Amount: string; // Actual token amount (in wei/smallest unit)
      AmountInUSD: number;
      Buyer: string; // Wallet that bought
      Currency: {
        Symbol: string;
        SmartContract: string;
      };
    };
    Sell: {
      Amount: string; // Actual token amount (in wei/smallest unit)
      AmountInUSD: number;
      Seller: string; // Wallet that sold
      Currency: {
        Symbol: string;
        SmartContract: string;
      };
    };
  };
}

interface BitqueryResponse {
  data: {
    EVM: {
      DEXTrades: BitqueryDEXTrade[];
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Get tracked tokens from database
 */
async function getTrackedTokens(): Promise<Array<{ token_address: string; symbol: string; decimals: number }>> {
  const result = await query('SELECT token_address, symbol, decimals FROM tracked_tokens');
  return result.rows;
}

/**
 * Get token decimals (with caching)
 */
const decimalsCache = new Map<string, number>();

async function getTokenDecimals(tokenAddress: string): Promise<number> {
  const tokenAddr = tokenAddress.toLowerCase();

  if (decimalsCache.has(tokenAddr)) {
    return decimalsCache.get(tokenAddr)!;
  }

  // Check database first
  try {
    const result = await query(
      'SELECT decimals FROM tracked_tokens WHERE token_address = $1',
      [tokenAddr]
    );
    if (result.rows.length > 0) {
      const decimals = result.rows[0].decimals;
      decimalsCache.set(tokenAddr, decimals);
      return decimals;
    }
  } catch (e) {
    // Continue to contract call
  }

  // Default to 18 for unknown tokens
  decimalsCache.set(tokenAddr, 18);
  return 18;
}

/**
 * Execute GraphQL query to Bitquery API V2
 * V2 API uses OAuth tokens or API keys depending on plan
 * For API key authentication, use Authorization header with Bearer token
 */
async function executeBitqueryQuery(queryString: string, variables?: Record<string, any>): Promise<any> {
  if (!BITQUERY_API_KEY) {
    throw new Error('BITQUERY_API_KEY not configured');
  }

  const authHeader = BITQUERY_API_KEY.startsWith('Bearer ')
    ? BITQUERY_API_KEY
    : `Bearer ${BITQUERY_API_KEY}`;

  const response = await fetch(BITQUERY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify({
      query: queryString,
      variables: variables || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bitquery API error: ${response.status} ${errorText}`);
  }

  const jsonData = await response.json();

  // Check for GraphQL errors first
  if (jsonData.errors && jsonData.errors.length > 0) {
    const errorMessages = jsonData.errors.map((e: any) => e.message).join(', ');
    throw new Error(`Bitquery GraphQL errors: ${errorMessages}`);
  }

  // Return data directly (not data.data)
  return jsonData.data || jsonData;
}

/**
 * Transform Bitquery trade to SwapDetails format
 */
async function transformBitqueryTrade(
  trade: BitqueryDEXTrade,
  walletAddress: string,
  trackedTokenAddresses: string[]
): Promise<SwapDetails | null> {
  const buyToken = trade.Trade.Buy.Currency.SmartContract.toLowerCase();
  const sellToken = trade.Trade.Sell.Currency.SmartContract.toLowerCase();
  const txHash = trade.Transaction.Hash.toLowerCase();
  const blockNumber = trade.Block.Number;
  const timestamp = new Date(trade.Block.Time);

  // Determine which token is the tracked token
  let trackedToken: string | null = null;
  let isTrackedTokenBuy = false;

  if (trackedTokenAddresses.includes(buyToken)) {
    trackedToken = buyToken;
    isTrackedTokenBuy = true;
  } else if (trackedTokenAddresses.includes(sellToken)) {
    trackedToken = sellToken;
    isTrackedTokenBuy = false;
  } else {
    // Neither token is tracked, skip
    return null;
  }

  // Determine base token (the other token in the swap)
  const baseToken = isTrackedTokenBuy ? sellToken : buyToken;

  // Check if base token is a recognized base token - allow any token as base
  // (Don't filter out swaps just because base token isn't WETH/USDC)
  // const isBaseTokenValid = BASE_TOKENS.includes(baseToken);
  // if (!isBaseTokenValid && !BASE_TOKENS.includes(buyToken) && !BASE_TOKENS.includes(sellToken)) {
  //   return null;
  // }

  // Determine swap direction from the wallet's perspective
  // CRITICAL: The wallet passed to this function should match the side
  // If tracked token is in Buy.Currency:
  //   - Buy.Buyer receives tracked token → this is a BUY for Buy.Buyer
  //   - Sell.Seller sends base token (other side) → this would be something else for Sell.Seller
  // If tracked token is in Sell.Currency:
  //   - Sell.Seller sends tracked token → this is a SELL for Sell.Seller
  //   - Buy.Buyer receives base token (other side) → this would be something else for Buy.Buyer
  //
  // So: if tracked token in Buy → side = BUY, wallet should be Buy.Buyer
  //     if tracked token in Sell → side = SELL, wallet should be Sell.Seller
  const side: 'BUY' | 'SELL' = isTrackedTokenBuy ? 'BUY' : 'SELL';

  // Verify wallet matches expected side for debugging
  const expectedBuyer = trade.Trade.Buy.Buyer?.toLowerCase();
  const expectedSeller = trade.Trade.Sell.Seller?.toLowerCase();
  const walletMatchesExpected = isTrackedTokenBuy
    ? (walletAddress.toLowerCase() === expectedBuyer)
    : (walletAddress.toLowerCase() === expectedSeller);

  // Note: Debug logging removed here - wallet verification happens in calling function

  // Parse amounts from Bitquery (Amount is decimal string, convert to BigInt in smallest unit)
  function parseAmount(amountStr: string | undefined, decimals: number): bigint {
    if (!amountStr) return BigInt(0);

    // Handle if already an integer string
    if (!amountStr.includes('.')) {
      return BigInt(amountStr);
    }

    // Parse decimal string and convert to smallest unit (wei)
    const [integerPart, decimalPart = ''] = amountStr.split('.');
    const fullDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals); // Pad/truncate to decimals
    return BigInt(integerPart + fullDecimal);
  }

  // Buy.Amount is the amount of the token being bought (in its decimals)
  // Sell.Amount is the amount of the token being sold (in its decimals)
  const buyTokenDecimals = await getTokenDecimals(buyToken);
  const sellTokenDecimals = await getTokenDecimals(sellToken);

  const buyAmount = parseAmount(trade.Trade.Buy.Amount, buyTokenDecimals);
  const sellAmount = parseAmount(trade.Trade.Sell.Amount, sellTokenDecimals);

  // Determine token amounts based on swap direction
  const tokenAmount = side === 'BUY' ? buyAmount : sellAmount;
  const baseTokenAmount = side === 'BUY' ? sellAmount : buyAmount;

  // Determine token in/out based on side
  const tokenIn = side === 'BUY' ? baseToken : trackedToken;
  const tokenOut = side === 'BUY' ? trackedToken : baseToken;
  const amountIn = side === 'BUY' ? baseTokenAmount : tokenAmount;
  const amountOut = side === 'BUY' ? tokenAmount : baseTokenAmount;

  // Get decimals for return values
  const trackedTokenDecimals = await getTokenDecimals(trackedToken);
  const baseTokenDecimals = await getTokenDecimals(baseToken);

  // Calculate USD values from Bitquery's AmountInUSD
  // For BUY: tracked token USD = Buy.AmountInUSD (what was received), base token USD = Sell.AmountInUSD (what was paid)
  // For SELL: tracked token USD = Sell.AmountInUSD (what was sold), base token USD = Buy.AmountInUSD (what was received)
  // IMPORTANT: For volume tracking, we want:
  //   - BUY volume = baseTokenUsdValue (what was paid)
  //   - SELL volume = baseTokenUsdValue (what was received)
  const trackedTokenUsdValue = side === 'BUY'
    ? (trade.Trade.Buy.AmountInUSD || 0)
    : (trade.Trade.Sell.AmountInUSD || 0);
  const baseTokenUsdValue = side === 'BUY'
    ? (trade.Trade.Sell.AmountInUSD || 0) // What was paid for BUY
    : (trade.Trade.Buy.AmountInUSD || 0); // What was received for SELL

  // Calculate price per token: Price = baseTokenUSD / trackedTokenAmount
  // For BUY: amountOut = tracked token, so price = baseTokenUSD / amountOut
  // For SELL: amountIn = tracked token sold, so price = baseTokenUSD / amountIn
  const trackedTokenAmountDecimal = side === 'BUY'
    ? Number(amountOut) / (10 ** trackedTokenDecimals)
    : Number(amountIn) / (10 ** trackedTokenDecimals);

  let priceUsd = 0;

  if (trackedTokenAmountDecimal > 0) {
    // Use USD value if available (more accurate)
    if (baseTokenUsdValue > 0) {
      priceUsd = baseTokenUsdValue / trackedTokenAmountDecimal;
    } else {
      // Fallback: calculate from token amounts
      const baseTokenAmountDecimal = side === 'BUY'
        ? Number(amountIn) / (10 ** baseTokenDecimals)
        : Number(amountOut) / (10 ** baseTokenDecimals);
      if (baseTokenAmountDecimal > 0) {
        priceUsd = baseTokenAmountDecimal / trackedTokenAmountDecimal;
      }
    }
  }

  // If still 0, use trackedTokenUsdValue to calculate price
  if (priceUsd === 0 && trackedTokenUsdValue > 0 && trackedTokenAmountDecimal > 0) {
    priceUsd = trackedTokenUsdValue / trackedTokenAmountDecimal;
  }

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    side,
    walletAddress: walletAddress.toLowerCase(),
    source: 'bitquery' as const,
    confidence: 'high' as const,
    baseTokenAddress: baseToken,
    baseTokenAmount,
    tokenInDecimals: side === 'BUY' ? baseTokenDecimals : trackedTokenDecimals,
    tokenOutDecimals: side === 'BUY' ? trackedTokenDecimals : baseTokenDecimals,
    route: [], // Route info not currently needed for FIFO accounting
    txHash,
    blockNumber,
    timestamp,
    // Add USD values for price calculation (using type assertion to bypass TS cache issue)
    trackedTokenUsdValue,
    baseTokenUsdValue,
    priceUsd,
  } as SwapDetails & { trackedTokenUsdValue: number; baseTokenUsdValue: number; priceUsd: number };
}

/**
 * Get wallet swaps from Bitquery
 */
export async function getWalletSwaps(
  walletAddress: string,
  fromDate: Date,
  toDate: Date
): Promise<SwapDetails[]> {
  if (!BITQUERY_API_KEY) {
    throw new Error('BITQUERY_API_KEY not configured');
  }

  const walletAddr = walletAddress.toLowerCase();
  const trackedTokens = await getTrackedTokens();
  const trackedTokenAddresses = trackedTokens.map(t => t.token_address.toLowerCase());

  if (trackedTokenAddresses.length === 0) {
    return [];
  }

  // Format dates for Bitquery (ISO 8601)
  const fromDateStr = fromDate.toISOString();
  const toDateStr = toDate.toISOString();

  // Build token addresses filter string for GraphQL
  const tokenAddressesList = trackedTokenAddresses.map(addr => `"${addr}"`).join(', ');

  const queryString = `
    query WalletSwaps($fromDate: DateTime!, $toDate: DateTime!, $wallet: String!) {
      EVM(network: base) {
        DEXTrades(
          where: {
            any: [
              {Trade: {Buy: {Buyer: {is: $wallet}, Currency: {SmartContract: {in: [${tokenAddressesList}]}}}}},
              {Trade: {Sell: {Seller: {is: $wallet}, Currency: {SmartContract: {in: [${tokenAddressesList}]}}}}}
            ]
            Block: {
              Time: {
                since: $fromDate
                till: $toDate
              }
            }
          }
          limit: { count: 10000 }
          orderBy: { ascending: Block_Number }
        ) {
          Block {
            Time
            Number
          }
          Transaction {
            Hash
            From
          }
          Trade {
            Dex {
              ProtocolName
            }
            Buy {
              Amount
              AmountInUSD
              Buyer
              Currency {
                Symbol
                SmartContract
              }
            }
            Sell {
              Amount
              AmountInUSD
              Seller
              Currency {
                Symbol
                SmartContract
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    fromDate: fromDateStr,
    toDate: toDateStr,
    wallet: walletAddr,
  };

  try {
    const data = await executeBitqueryQuery(queryString, variables);
    const trades: BitqueryDEXTrade[] = data.EVM?.DEXTrades || [];

    // Transform trades to SwapDetails
    const swapDetails: SwapDetails[] = [];
    for (const trade of trades) {
      // Determine which wallet is involved (Buyer or Seller)
      const buyToken = trade.Trade.Buy.Currency.SmartContract.toLowerCase();
      const sellToken = trade.Trade.Sell.Currency.SmartContract.toLowerCase();
      const isTrackedTokenBuy = trackedTokenAddresses.includes(buyToken);
      const isTrackedTokenSell = trackedTokenAddresses.includes(sellToken);

      let tradeWallet: string;
      if (isTrackedTokenBuy && trade.Trade.Buy.Buyer) {
        tradeWallet = trade.Trade.Buy.Buyer.toLowerCase();
      } else if (isTrackedTokenSell && trade.Trade.Sell.Seller) {
        tradeWallet = trade.Trade.Sell.Seller.toLowerCase();
      } else {
        // Fallback to transaction sender
        tradeWallet = trade.Transaction.From.toLowerCase();
      }

      const swapDetail = await transformBitqueryTrade(trade, tradeWallet, trackedTokenAddresses);
      if (swapDetail) {
        swapDetails.push(swapDetail);
      }
    }

    return swapDetails;
  } catch (error: any) {
    console.error(`Error fetching wallet swaps from Bitquery: ${error.message}`);
    throw error;
  }
}

/**
 * Execute Bitquery query with retry logic for transient errors
 */
async function executeBitqueryQueryWithRetry(
  queryString: string,
  variables?: Record<string, any>,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executeBitqueryQuery(queryString, variables);
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || error?.toString() || '';

      // Retry on transient errors (network, rate limiting, server errors)
      const isRetryable =
        errorMsg.includes('timeout') ||
        errorMsg.includes('429') ||
        errorMsg.includes('500') ||
        errorMsg.includes('502') ||
        errorMsg.includes('503') ||
        errorMsg.includes('network');

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      logWarn(`[Bitquery] Retry ${attempt}/${maxRetries} after ${delayMs}ms: ${errorMsg}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error('Unknown error during retry');
}

/**
 * Get token's first transaction block and timestamp (inception)
 * Queries Bitquery for the earliest transaction involving this token
 * Returns both block number and timestamp
 */
async function getTokenInception(tokenAddress: string): Promise<{ block: number; timestamp: Date } | null> {
  if (!BITQUERY_API_KEY) {
    return null;
  }

  const tokenAddr = tokenAddress.toLowerCase();

  try {
    // Query for the earliest DEX trade involving this token
    const queryString = `
      query TokenInception($token: String!) {
        EVM(network: base) {
          DEXTrades(
            where: {
              any: [
                {Trade: {Buy: {Currency: {SmartContract: {is: $token}}}}},
                {Trade: {Sell: {Currency: {SmartContract: {is: $token}}}}}
              ]
            }
            limit: { count: 1 }
            orderBy: { ascending: Block_Number }
          ) {
            Block {
              Number
              Time
            }
          }
        }
      }
    `;

    const data = await executeBitqueryQueryWithRetry(queryString, { token: tokenAddr });
    const trades = data.EVM?.DEXTrades || [];

    if (trades.length > 0 && trades[0].Block?.Number && trades[0].Block?.Time) {
      const inceptionBlock = trades[0].Block.Number;
      const inceptionTimestamp = new Date(trades[0].Block.Time);
      logInfo(`[Bitquery] Found inception block ${inceptionBlock} at ${inceptionTimestamp.toISOString()} for token ${tokenAddr}`);
      return { block: inceptionBlock, timestamp: inceptionTimestamp };
    }

    // Fallback: try to get first transfer event
    const transferQuery = `
      query TokenFirstTransfer($token: String!) {
        EVM(network: base) {
          Transfers(
            where: {
              any: [
                {Currency: {SmartContract: {is: $token}}}
              ]
            }
            limit: { count: 1 }
            orderBy: { ascending: Block_Number }
          ) {
            Block {
              Number
              Time
            }
          }
        }
      }
    `;

    const transferData = await executeBitqueryQueryWithRetry(transferQuery, { token: tokenAddr });
    const transfers = transferData.EVM?.Transfers || [];

    if (transfers.length > 0 && transfers[0].Block?.Number && transfers[0].Block?.Time) {
      const inceptionBlock = transfers[0].Block.Number;
      const inceptionTimestamp = new Date(transfers[0].Block.Time);
      logInfo(`[Bitquery] Found inception block ${inceptionBlock} at ${inceptionTimestamp.toISOString()} for token ${tokenAddr} (from transfers)`);
      return { block: inceptionBlock, timestamp: inceptionTimestamp };
    }

    logWarn(`[Bitquery] Could not find inception block for token ${tokenAddr}, querying from genesis`);
    return null;
  } catch (error: any) {
    logWarn(`[Bitquery] Error finding inception block for ${tokenAddr}: ${error.message}`);
    return null;
  }
}

/**
 * Get token swaps from Bitquery (all swaps for a specific token)
 * Query ALL historical swaps by default (no date/block limits unless specified)
 * Uses Bitquery v2 schema with `any` operator and Buyer/Seller fields
 * Supports pagination (Bitquery has 10k limit per query)
 * Uses block numbers ONLY for pagination (no date-based pagination)
 */
export async function getTokenSwaps(
  tokenAddress: string,
  fromDate?: Date | null,
  toDate?: Date | null,
  onProgress?: (page: number, swapsFound: number) => void
): Promise<SwapDetails[]> {
  if (!BITQUERY_API_KEY) {
    throw new Error('BITQUERY_API_KEY not configured');
  }

  const tokenAddr = tokenAddress.toLowerCase();

  // Start from block 0 (Base genesis) unless fromBlock is provided
  // Note: fromDate/toDate parameters are kept for API compatibility but not used for pagination
  let minBlock = 0; // Start from Base genesis block

  logInfo(`[Bitquery] Querying ALL swaps for token ${tokenAddr} starting from block ${minBlock}`);

  // Get tracked tokens to filter
  const trackedTokens = await getTrackedTokens();
  const trackedTokenAddresses = trackedTokens.map(t => t.token_address.toLowerCase());

  // Log the token we're querying for debugging
  logInfo(`[Bitquery] Querying swaps for token: ${tokenAddr} (in tracked tokens: ${trackedTokenAddresses.includes(tokenAddr)})`);

  if (trackedTokenAddresses.length === 0) {
    logWarn('[Bitquery] No tracked tokens found');
    return [];
  }

  const allTradesMap = new Map<string, BitqueryDEXTrade>();
  let page = 1;
  let consecutiveEmptyPages = 0; // Track consecutive empty pages to detect end

  while (true) {
    // Build where clause using `any` operator for OR condition
    // Structure matches Bitquery v2 docs exactly
    const whereConditions: string[] = [];

    // Use ONLY block number for pagination (EVM uses 'ge' not 'gte')
    whereConditions.push(`Block: { Number: { ge: $minBlock } }`);

    // Use `any` operator to match token in either Buy OR Sell side (as per Bitquery v2 docs)
    whereConditions.push(`any: [
      {Trade: {Buy: {Currency: {SmartContract: {is: $token}}}}},
      {Trade: {Sell: {Currency: {SmartContract: {is: $token}}}}}
    ]`);

    // Build variable declarations - only need token and minBlock (String for EVM)
    const variableDeclarations: string[] = ['$token: String!', '$minBlock: String!'];

    const queryString = `
      query TokenSwaps(${variableDeclarations.join(', ')}) {
        EVM(network: base, dataset: combined) {
          DEXTrades(
            where: {
              ${whereConditions.join(',\n              ')}
            }
            limit: { count: 10000 }
            orderBy: { ascending: Block_Number }
          ) {
            Block {
              Time
              Number
            }
            Transaction {
              Hash
              From
            }
            Trade {
              Dex {
                ProtocolName
              }
              Buy {
                Amount
                AmountInUSD
                Buyer
                Currency {
                  Symbol
                  SmartContract
                }
              }
              Sell {
                Amount
                AmountInUSD
                Seller
                Currency {
                  Symbol
                  SmartContract
                }
              }
            }
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      token: tokenAddr,
      minBlock: String(minBlock) // Convert to string for EVM GraphQL API
    };

    logInfo(`[Bitquery] Page ${page}: Querying from block ${minBlock} (total unique so far: ${allTradesMap.size})`);

    const data = await executeBitqueryQueryWithRetry(queryString, variables);
    const trades: BitqueryDEXTrade[] = data.EVM?.DEXTrades || [];

    logInfo(`[Bitquery] Page ${page}: Found ${trades.length} trades (total unique so far: ${allTradesMap.size})`);

    if (trades.length === 0) {
      consecutiveEmptyPages++;
      if (consecutiveEmptyPages >= 2) {
        logInfo(`[Bitquery] Received 2 consecutive empty pages, pagination complete`);
        break;
      }
      // Continue to next page in case of temporary empty result
      // Increment block number and try again
      // CRITICAL: Ensure minBlock stays as a number
      minBlock = Number(minBlock) + 1;
      page++;
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }

    consecutiveEmptyPages = 0; // Reset counter when we get results

    // Track highest block number seen in this page for next page cursor
    let maxBlockInPage = 0;
    for (const trade of trades) {
      allTradesMap.set(trade.Transaction.Hash.toLowerCase(), trade);

      // Track highest block number in this page
      // Ensure Block.Number is treated as a number, not string
      const blockNum = typeof trade.Block.Number === 'string' ? parseInt(trade.Block.Number, 10) : trade.Block.Number;
      if (blockNum > maxBlockInPage) {
        maxBlockInPage = blockNum;
      }
    }

    logInfo(`[Bitquery] Page ${page}: Processed ${trades.length} trades, max block in page: ${maxBlockInPage}, total unique: ${allTradesMap.size}`);

    if (onProgress) {
      onProgress(page, allTradesMap.size);
    }

    // For next page, start from block after the highest block we saw
    // This ensures we don't miss trades and don't get duplicates
    // CRITICAL: Ensure minBlock stays as a number, only convert to string when passing to GraphQL
    minBlock = Number(maxBlockInPage) + 1;
    page++;

    // Small delay between pages to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const allTrades = Array.from(allTradesMap.values());

  // Sort by block number (ascending) and timestamp to ensure chronological order for FIFO
  allTrades.sort((a, b) => {
    if (a.Block.Number !== b.Block.Number) {
      return a.Block.Number - b.Block.Number;
    }
    // If same block, sort by timestamp
    return new Date(a.Block.Time).getTime() - new Date(b.Block.Time).getTime();
  });

  logInfo(`[Bitquery] Found ${allTrades.length} total unique swaps for token ${tokenAddr}`);

  if (allTrades.length === 0) {
    logWarn(`[Bitquery] No swaps found for token ${tokenAddr}`);
    return [];
  }

  // Transform trades to SwapDetails
  const swapDetails: SwapDetails[] = [];
  let buyCount = 0;
  let sellCount = 0;

  for (const trade of allTrades) {
    // Determine which side the tracked token is on
    const buyToken = trade.Trade.Buy.Currency.SmartContract.toLowerCase();
    const sellToken = trade.Trade.Sell.Currency.SmartContract.toLowerCase();
    const isTrackedTokenBuy = trackedTokenAddresses.includes(buyToken);
    const isTrackedTokenSell = trackedTokenAddresses.includes(sellToken);

    // Debug: log token detection for first 50 swaps to see what we're getting
    if (swapDetails.length < 50) {
      logInfo(`[Transform Debug] Tx ${trade.Transaction.Hash.substring(0, 10)}... | buyToken=${buyToken.substring(0, 10)} | sellToken=${sellToken.substring(0, 10)} | isBuy=${isTrackedTokenBuy} | isSell=${isTrackedTokenSell} | trackedToken=${tokenAddr.substring(0, 10)}`);
    }

    // Determine wallet address based on tracked token side
    // CRITICAL: Match wallet to the side where tracked token appears
    // If tracked token is in Buy.Currency → Buyer wallet is buying it → use Buyer
    // If tracked token is in Sell.Currency → Seller wallet is selling it → use Seller
    let swapWallet: string;
    if (isTrackedTokenBuy && trade.Trade.Buy.Buyer) {
      // Tracked token is in Buy side → Buyer wallet receives it → this is a BUY for Buyer
      swapWallet = trade.Trade.Buy.Buyer.toLowerCase();
    } else if (isTrackedTokenSell && trade.Trade.Sell.Seller) {
      // Tracked token is in Sell side → Seller wallet sends it → this is a SELL for Seller
      swapWallet = trade.Trade.Sell.Seller.toLowerCase();
    } else {
      // Fallback to transaction sender (shouldn't happen if data is correct)
      swapWallet = trade.Transaction.From.toLowerCase();
      if (swapDetails.length < 10) {
        logWarn(`[Warning] Using Transaction.From as wallet fallback: ${swapWallet.substring(0, 10)}...`);
      }
    }

    // FILTER OUT PROTOCOL FEE TRANSFERS
    // Check if this swap is a protocol fee transfer (like Clanker locker fees)
    // These are internal protocol mechanics, not actual user swaps
    if (isProtocolFeeTransfer(trade, swapWallet, trackedTokenAddresses)) {
      if (swapDetails.length < 10) {
        logInfo(`[Filter] Skipping protocol fee transfer: ${trade.Transaction.Hash.substring(0, 10)}... | wallet=${swapWallet.substring(0, 10)}... | protocol=${trade.Trade.Dex.ProtocolName}`);
      }
      continue; // Skip this trade
    }

    const swapDetail = await transformBitqueryTrade(trade, swapWallet, trackedTokenAddresses);
    if (swapDetail) {
      swapDetails.push(swapDetail);
      if (swapDetail.side === 'BUY') buyCount++;
      else sellCount++;

      // Debug: log first 50 swaps to verify BUY/SELL detection
      if (swapDetails.length <= 50) {
        logInfo(`[Bitquery Transform] ${swapDetail.side} swap: ${swapDetail.txHash.substring(0, 10)}..., wallet=${swapWallet.substring(0, 10)}..., trackedToken=${tokenAddr.substring(0, 10)}..., side=${swapDetail.side}`);
      }
    } else {
      // Log why swaps are being filtered out
      if (swapDetails.length < 20) {
        logWarn(`[Transform] Filtered out swap ${trade.Transaction.Hash.substring(0, 10)}... | buyToken=${buyToken.substring(0, 10)}... | sellToken=${sellToken.substring(0, 10)}... | trackedToken=${tokenAddr.substring(0, 10)}...`);
      }
    }
  }

  logInfo(`[Bitquery] Transformed ${swapDetails.length} swaps: ${buyCount} BUY, ${sellCount} SELL`);
  return swapDetails;
}

/**
 * Test Bitquery connection
 */
export async function testBitqueryConnection(): Promise<boolean> {
  if (!BITQUERY_API_KEY) {
    return false;
  }

  try {
    const queryString = `
      query TestConnection {
        EVM(network: base) {
          DEXTrades(limit: { count: 1 }) {
            Transaction {
              Hash
            }
          }
        }
      }
    `;

    await executeBitqueryQuery(queryString);
    return true;
  } catch (error) {
    console.error('Bitquery connection test failed:', error);
    return false;
  }
}

