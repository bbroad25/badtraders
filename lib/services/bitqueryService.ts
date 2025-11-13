// lib/services/bitqueryService.ts
// Bitquery GraphQL API V2 client for Base chain DEX trades
//
// V2 API Features:
// - Endpoint: https://streaming.bitquery.io/graphql (for Base chain)
// - Historical data access with dataset: combined or dataset: archive
// - API keys via X-API-KEY header for authentication
// - Improved performance and reliability
// - Uppercase field names (Block, Transaction, Trade, etc.)
//
// Documentation: https://docs.bitquery.io/docs/blockchain/Base/
// Base Historical Queries: Use EVM(dataset: combined, network: base) with DEXTrades

import { query } from '@/lib/db/connection';
import { USDC_ADDRESS, WETH_ADDRESS } from '@/lib/utils/constants';
import { logInfo, logWarn } from './indexerLogger';
import { SwapDetails } from './swapTypes';

const BITQUERY_API_KEY = process.env.BITQUERY_API_KEY;
// Base chain requires streaming endpoint for V2 API
const DEFAULT_BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';
const STREAMING_BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';
let activeBitqueryEndpoint = (process.env.BITQUERY_ENDPOINT || DEFAULT_BITQUERY_ENDPOINT).trim();

const maskedApiKey = BITQUERY_API_KEY
  ? BITQUERY_API_KEY.trim().length <= 8
    ? `${BITQUERY_API_KEY.trim().slice(0, 2)}***`
    : `${BITQUERY_API_KEY.trim().slice(0, 4)}...${BITQUERY_API_KEY.trim().slice(-4)}`
  : 'MISSING';

logInfo(`[Bitquery] API key detected: ${BITQUERY_API_KEY ? 'present' : 'missing'} | mask=${maskedApiKey}`);

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
export function isProtocolFeeTransfer(
  trade: BitqueryDEXTrade,
  swapWallet: string,
  trackedTokenAddresses: string[]
): boolean {
  const protocolName = trade.Trade.Dex.ProtocolName?.toLowerCase() || '';
  const swapWalletLower = swapWallet.toLowerCase();
  // V2 API has separate Buyer and Seller fields
  const txFrom = trade.Transaction.From?.toLowerCase() || '';

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
// Default GraphQL endpoint for historical queries; override via env for streaming plans
const BITQUERY_ENDPOINT = activeBitqueryEndpoint;

// Base tokens used for BUY/SELL classification (in order of preference)
const BASE_TOKENS = [
  WETH_ADDRESS.toLowerCase(),
  USDC_ADDRESS.toLowerCase(),
  '0x0000000000000000000000000000000000000000', // Native ETH
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', // USDbC
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI
].map(addr => addr.toLowerCase());

// V2 API response structure (uppercase fields) - from Base Historical Queries docs
export interface BitqueryDEXTrade {
  Block: {
    Time: string;
    Number: number;
    Date?: string;
  };
  Transaction: {
    Hash: string;
    From: string;
    To?: string;
    Gas?: number;
  };
  Trade: {
    Buy: {
      Amount: string;
      AmountInUSD: number;
      PriceInUSD?: number;
      Currency: {
        Name?: string;
        Symbol: string;
        SmartContract: string;
        Decimals?: number;
      };
      Buyer: string;
    };
    Sell: {
      Amount: string;
      AmountInUSD: number;
      PriceInUSD?: number;
      Currency: {
        Name?: string;
        Symbol: string;
        SmartContract: string;
        Decimals?: number;
      };
      Seller: string;
    };
    Dex: {
      ProtocolName: string;
      ProtocolFamily?: string;
      SmartContract?: string;
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

export interface BitqueryTradeGroup {
  txHash: string;
  trades: BitqueryDEXTrade[];
  blockNumber: number;
  blockTime: string;
  transactionFrom: string;
}

interface TokenSwapFetchResult {
  groups: BitqueryTradeGroup[];
  trackedTokenAddresses: string[];
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

  const apiKeyRaw = BITQUERY_API_KEY.trim();
  if (apiKeyRaw.length === 0) {
    throw new Error('BITQUERY_API_KEY is empty after trimming');
  }

  const hasBearerPrefix = apiKeyRaw.toLowerCase().startsWith('bearer ');
  const tokenValue = hasBearerPrefix ? apiKeyRaw.slice(7).trim() : apiKeyRaw;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-KEY': tokenValue,
    'Authorization': hasBearerPrefix ? apiKeyRaw : `Bearer ${tokenValue}`,
  };

  const maskedKey = tokenValue.length <= 8
    ? `${tokenValue.slice(0, 2)}***`
    : `${tokenValue.slice(0, 4)}...${tokenValue.slice(-4)}`;

  const sendRequest = async (endpoint: string) =>
    fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: queryString,
        variables: variables || {},
      }),
    });

  let endpointUsed = activeBitqueryEndpoint;
  let response = await sendRequest(endpointUsed);

  if (response.status === 401) {
    logWarn(`[Bitquery] 401 Unauthorized | endpoint=${endpointUsed} | hasAuth=${headers['Authorization'] ? 'yes' : 'no'} | hasXApiKey=${headers['X-API-KEY'] ? 'yes' : 'no'} | keyMask=${maskedKey}`);

    const fallbackEndpoint = DEFAULT_BITQUERY_ENDPOINT;
    const canFallback = endpointUsed !== fallbackEndpoint;

    if (canFallback) {
      logWarn(`[Bitquery] Retrying with fallback endpoint ${fallbackEndpoint}`);
      endpointUsed = fallbackEndpoint;
      activeBitqueryEndpoint = fallbackEndpoint;
      response = await sendRequest(endpointUsed);

      if (response.status === 401) {
        logWarn(`[Bitquery] 401 Unauthorized on fallback endpoint as well | keyMask=${maskedKey}`);
      }
    }

    if (response.status === 401 && endpointUsed !== STREAMING_BITQUERY_ENDPOINT) {
      logWarn(`[Bitquery] Retrying with streaming endpoint ${STREAMING_BITQUERY_ENDPOINT}`);
      endpointUsed = STREAMING_BITQUERY_ENDPOINT;
      activeBitqueryEndpoint = STREAMING_BITQUERY_ENDPOINT;
      response = await sendRequest(endpointUsed);

      if (response.status === 401) {
        logWarn(`[Bitquery] 401 Unauthorized on streaming endpoint as well | keyMask=${maskedKey}`);
      }
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bitquery API error: ${response.status} ${errorText}`);
  }

  const jsonData = await response.json();

  if (jsonData.errors && jsonData.errors.length > 0) {
    const errorMessages = jsonData.errors.map((e: any) => e.message).join(', ');
    const fullErrors = jsonData.errors.map((e: any) => JSON.stringify(e)).join(', ');
    logWarn(`[Bitquery] GraphQL errors: ${errorMessages} | Full: ${fullErrors}`);
    throw new Error(`Bitquery GraphQL errors: ${errorMessages}`);
  }

  return jsonData.data || jsonData;
}

/**
 * Minimal test query to verify V2 API access and structure
 * Uses exact V2 syntax: EVM(dataset: archive, network: base) with where clause
 */
export async function testMinimalBitqueryQuery(tokenAddress: string): Promise<any> {
  if (!BITQUERY_API_KEY) {
    throw new Error('BITQUERY_API_KEY not configured');
  }

  const tokenAddr = tokenAddress.toLowerCase();

  // Use recent date for testing (combined dataset works better than archive)
  const startDate = "2024-01-01T00:00:00Z";

  // Use streaming endpoint for Base chain queries (V2 API)
  // Bitquery LLM confirmed: use https://streaming.bitquery.io/graphql for Base
  const originalEndpoint = activeBitqueryEndpoint;
  activeBitqueryEndpoint = STREAMING_BITQUERY_ENDPOINT;

  logInfo(`[Bitquery Test] Using streaming endpoint: ${activeBitqueryEndpoint}`);
  logInfo(`[Bitquery Test] API Key present: ${BITQUERY_API_KEY ? 'yes' : 'no'}`);

  // Use EXACT structure from Bitquery LLM response
  // Use dataset: combined (works better than archive for Base)
  const queryString = `
query TestMinimalQuery($tokenAddress: String!, $startDate: DateTime!) {
  EVM(dataset: combined, network: base) {
    DEXTrades(
      where: {
        any: [
          {Trade: {Buy: {Currency: {SmartContract: {is: $tokenAddress}}}}}
          {Trade: {Sell: {Currency: {SmartContract: {is: $tokenAddress}}}}}
        ]
        Block: {Time: {since: $startDate}}
      }
      orderBy: {ascending: Block_Time}
      limit: {count: 1}
    ) {
      Block {
        Time
        Number
      }
      Transaction {
        Hash
      }
      Trade {
        Buy {
          Currency {
            SmartContract
          }
        }
        Sell {
          Currency {
            SmartContract
          }
        }
      }
    }
  }
}
  `;

  const variables = {
    tokenAddress: tokenAddr,
    startDate: startDate
  };

  try {
    const result = await executeBitqueryQuery(queryString, variables);
    return result;
  } finally {
    // Restore original endpoint
    activeBitqueryEndpoint = originalEndpoint;
  }
}

/**
 * Test time-based filtering (Step 2)
 * Verifies that Block.Time filtering works correctly
 */
export async function testTimeFilteredQuery(
  tokenAddress: string,
  startDate: string,
  endDate: string
): Promise<any> {
  if (!BITQUERY_API_KEY) {
    throw new Error('BITQUERY_API_KEY not configured');
  }

  const tokenAddr = tokenAddress.toLowerCase();
  const originalEndpoint = activeBitqueryEndpoint;
  activeBitqueryEndpoint = STREAMING_BITQUERY_ENDPOINT;

  const queryString = `
query TestTimeFilter($tokenAddress: String!, $startDate: DateTime!, $endDate: DateTime!) {
  EVM(dataset: combined, network: base) {
    DEXTrades(
      where: {
        any: [
          {Trade: {Buy: {Currency: {SmartContract: {is: $tokenAddress}}}}}
          {Trade: {Sell: {Currency: {SmartContract: {is: $tokenAddress}}}}}
        ]
        Block: {
          Time: {
            since: $startDate
            till: $endDate
          }
        }
      }
      orderBy: {ascending: Block_Time}
      limit: {count: 10}
    ) {
      Block {
        Time
        Number
      }
      Transaction {
        Hash
      }
      Trade {
        Buy {
          Currency {
            SmartContract
          }
        }
        Sell {
          Currency {
            SmartContract
          }
        }
      }
    }
  }
}
  `;

  const variables = {
    tokenAddress: tokenAddr,
    startDate: startDate,
    endDate: endDate
  };

  try {
    return await executeBitqueryQuery(queryString, variables);
  } finally {
    activeBitqueryEndpoint = originalEndpoint;
  }
}

/**
 * Test complete field structure (Step 3)
 * Verifies all V2 fields from Base Historical Queries docs are present
 */
export async function testCompleteFieldsQuery(tokenAddress: string): Promise<any> {
  if (!BITQUERY_API_KEY) {
    throw new Error('BITQUERY_API_KEY not configured');
  }

  const tokenAddr = tokenAddress.toLowerCase();
  const startDate = "2024-01-01T00:00:00Z";
  const originalEndpoint = activeBitqueryEndpoint;
  activeBitqueryEndpoint = STREAMING_BITQUERY_ENDPOINT;

  // Use complete field structure from Base Historical Queries docs
  const queryString = `
query TestCompleteFields($tokenAddress: String!, $startDate: DateTime!) {
  EVM(dataset: combined, network: base) {
    DEXTrades(
      where: {
        any: [
          {Trade: {Buy: {Currency: {SmartContract: {is: $tokenAddress}}}}}
          {Trade: {Sell: {Currency: {SmartContract: {is: $tokenAddress}}}}}
        ]
        Block: {Time: {since: $startDate}}
      }
      orderBy: {ascending: Block_Time}
      limit: {count: 1}
    ) {
      Block {
        Time
        Number
        Date
      }
      Transaction {
        Hash
        From
        To
        Gas
      }
      Trade {
        Buy {
          Amount
          AmountInUSD
          PriceInUSD
          Currency {
            Name
            Symbol
            SmartContract
            Decimals
          }
          Buyer
        }
        Sell {
          Amount
          AmountInUSD
          PriceInUSD
          Currency {
            Name
            Symbol
            SmartContract
            Decimals
          }
          Seller
        }
        Dex {
          ProtocolName
          ProtocolFamily
          SmartContract
        }
      }
    }
  }
}
  `;

  const variables = {
    tokenAddress: tokenAddr,
    startDate: startDate
  };

  try {
    return await executeBitqueryQuery(queryString, variables);
  } finally {
    activeBitqueryEndpoint = originalEndpoint;
  }
}

/**
 * Transform Bitquery trade to SwapDetails format
 */
export async function transformBitqueryTrade(
  trade: BitqueryDEXTrade,
  walletAddress: string,
  trackedTokenAddresses: string[],
  legIndex?: number,
  options?: {
    protocolName?: string | null;
    isProtocolFee?: boolean;
  }
): Promise<SwapDetails | null> {
  const effectiveLegIndex = legIndex ?? 0;
  const buyToken = trade.Trade.Buy.Currency.SmartContract.toLowerCase();
  const sellToken = trade.Trade.Sell.Currency.SmartContract.toLowerCase();
  const txHash = trade.Transaction.Hash.toLowerCase();
  const blockNumber = typeof trade.Block.Number === 'string'
    ? parseInt(trade.Block.Number, 10)
    : trade.Block.Number;
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
  // V2 API uses Transaction.From for transaction sender
  const txFrom = trade.Transaction.From?.toLowerCase() || '';
  const walletMatchesExpected = walletAddress.toLowerCase() === txFrom;

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
  const buyTokenDecimals = trade.Trade.Buy.Currency.Decimals || await getTokenDecimals(buyToken);
  const sellTokenDecimals = trade.Trade.Sell.Currency.Decimals || await getTokenDecimals(sellToken);

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

  // Calculate USD values from Bitquery's USD amounts (V2 API)
  // For BUY: tracked token USD = Buy.AmountInUSD (what was received), base token USD = Sell.AmountInUSD (what was paid)
  // For SELL: tracked token USD = Sell.AmountInUSD (what was sold), base token USD = Buy.AmountInUSD (what was received)
  // IMPORTANT: For volume tracking, we want:
  //   - BUY volume = baseTokenUsdValue (what was paid)
  //   - SELL volume = baseTokenUsdValue (what was received)
  // Ensure AmountInUSD is converted to a number (it might come as string from API)
  const buyAmountUsd = typeof trade.Trade.Buy.AmountInUSD === 'number'
    ? trade.Trade.Buy.AmountInUSD
    : parseFloat(String(trade.Trade.Buy.AmountInUSD || 0)) || 0;
  const sellAmountUsd = typeof trade.Trade.Sell.AmountInUSD === 'number'
    ? trade.Trade.Sell.AmountInUSD
    : parseFloat(String(trade.Trade.Sell.AmountInUSD || 0)) || 0;

  const trackedTokenUsdValue = side === 'BUY' ? buyAmountUsd : sellAmountUsd;
  const baseTokenUsdValue = side === 'BUY' ? sellAmountUsd : buyAmountUsd; // What was paid for BUY / received for SELL

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
    legIndex: effectiveLegIndex,
    protocolName: options?.protocolName || trade.Trade.Dex.ProtocolName || undefined,
    buyerAddress: trade.Trade.Buy.Buyer?.toLowerCase(), // V2 has separate Buyer
    sellerAddress: trade.Trade.Sell.Seller?.toLowerCase(), // V2 has separate Seller
    trackedTokenAddress: trackedToken,
    trackedTokenAmount: tokenAmount,
    trackedTokenDecimals,
    baseTokenDecimals,
    buyAmountUsd: trade.Trade.Buy.AmountInUSD,
    sellAmountUsd: trade.Trade.Sell.AmountInUSD,
    isProtocolFee: options?.isProtocolFee ?? false,
  };
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
    let legIndex = 0;
    for (const trade of trades) {
      // Determine which wallet is involved (Buyer or Seller)
      const buyToken = trade.Trade.Buy.Currency.SmartContract.toLowerCase();
      const sellToken = trade.Trade.Sell.Currency.SmartContract.toLowerCase();
      const isTrackedTokenBuy = trackedTokenAddresses.includes(buyToken);
      const isTrackedTokenSell = trackedTokenAddresses.includes(sellToken);

      // V2 API: Use Buyer or Seller based on which side has the tracked token
      let tradeWallet: string = '';
      if (isTrackedTokenBuy) {
        tradeWallet = trade.Trade.Buy.Buyer?.toLowerCase() || trade.Transaction.From?.toLowerCase() || '';
      } else if (isTrackedTokenSell) {
        tradeWallet = trade.Trade.Sell.Seller?.toLowerCase() || trade.Transaction.From?.toLowerCase() || '';
      } else {
        tradeWallet = trade.Transaction.From?.toLowerCase() || '';
      }

      const swapDetail = await transformBitqueryTrade(trade, tradeWallet, trackedTokenAddresses, legIndex);
      legIndex++;

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

function buildTradeSignature(trade: BitqueryDEXTrade): string {
  const buy = trade.Trade.Buy;
  const sell = trade.Trade.Sell;
  return [
    trade.Transaction.Hash?.toLowerCase() || '',
    buy.Currency.SmartContract?.toLowerCase() || '',
    sell.Currency.SmartContract?.toLowerCase() || '',
    buy.Amount || '',
    sell.Amount || '',
    buy.Buyer?.toLowerCase() || '',
    sell.Seller?.toLowerCase() || ''
  ].join('|');
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
  const originalEndpoint = activeBitqueryEndpoint;
  activeBitqueryEndpoint = STREAMING_BITQUERY_ENDPOINT;

  try {
    // Query for the earliest DEX trade involving this token
    // Use combined dataset to find when token first traded
    const queryString = `
      query TokenInception($token: String!) {
        EVM(dataset: combined, network: base) {
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

    logWarn(`[Bitquery] Could not find inception block for token ${tokenAddr}`);
    return null;
  } catch (error: any) {
    logWarn(`[Bitquery] Error finding inception block for ${tokenAddr}: ${error.message}`);
    return null;
  } finally {
    activeBitqueryEndpoint = originalEndpoint;
  }
}

/**
 * Fetch grouped token swaps from Bitquery (all historical swaps for a token)
 * Returns grouped trades keyed by transaction hash along with tracked token list
 */
export async function getTokenSwapGroups(
  tokenAddress: string,
  fromDate?: Date | null,
  toDate?: Date | null,
  onProgress?: (page: number, swapsFound: number) => void
): Promise<TokenSwapFetchResult> {
  logInfo(`[Bitquery] getTokenSwapGroups called for token: ${tokenAddress}`);

  if (!BITQUERY_API_KEY) {
    logError('[Bitquery] BITQUERY_API_KEY not configured');
    throw new Error('BITQUERY_API_KEY not configured');
  }

  const tokenAddr = tokenAddress.toLowerCase();

  // Find when the token first started trading (inception date)
  // This is much better than guessing a date range
  logInfo(`[Bitquery] Finding token inception (first trade date)...`);
  const inception = await getTokenInception(tokenAddr);

  let currentStartDate: Date;
  if (fromDate) {
    currentStartDate = new Date(fromDate);
    logInfo(`[Bitquery] Using provided fromDate: ${currentStartDate.toISOString()}`);
  } else if (inception) {
    currentStartDate = inception.timestamp;
    logInfo(`[Bitquery] ✓ Found token inception: Block ${inception.block} at ${inception.timestamp.toISOString()}`);
  } else {
    // Fallback: use 30 days ago if we can't find inception
    currentStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    logWarn(`[Bitquery] ⚠ Could not find token inception, using fallback date: ${currentStartDate.toISOString()}`);
  }

  const endDateObj = toDate ? new Date(toDate) : new Date();

  logInfo(`[Bitquery] Date range: ${currentStartDate.toISOString()} to ${endDateObj.toISOString()} (${Math.round((endDateObj.getTime() - currentStartDate.getTime()) / (1000 * 60 * 60 * 24))} days)`);

  // Use streaming endpoint for Base chain (V2 API)
  const originalEndpoint = activeBitqueryEndpoint;
  activeBitqueryEndpoint = STREAMING_BITQUERY_ENDPOINT;

  logInfo(`[Bitquery] Querying ALL swap legs for token ${tokenAddr} from ${currentStartDate.toISOString()} to ${endDateObj.toISOString()}`);
  logInfo(`[Bitquery] Using endpoint: ${activeBitqueryEndpoint}`);
  logInfo(`[Bitquery] API Key present: ${BITQUERY_API_KEY ? 'yes' : 'no'}`);
  logInfo(`[Bitquery] Token address (lowercase): ${tokenAddr}`);

  // First, test if ANY trades exist for this token (no date filter)
  logInfo(`[Bitquery] Testing if token has ANY trades (no date filter)...`);
  try {
    const testQuery = `
query TestTokenExists($tokenAddress: String!) {
  EVM(dataset: combined, network: base) {
    DEXTrades(
      where: {
        any: [
          {Trade: {Buy: {Currency: {SmartContract: {is: $tokenAddress}}}}}
          {Trade: {Sell: {Currency: {SmartContract: {is: $tokenAddress}}}}}
        ]
      }
      limit: {count: 1}
      orderBy: {descending: Block_Time}
    ) {
      Block {
        Time
        Number
      }
      Transaction {
        Hash
      }
    }
  }
}
    `;
    const testData = await executeBitqueryQueryWithRetry(testQuery, { tokenAddress: tokenAddr });
    const testTrades = testData.EVM?.DEXTrades || [];
    if (testTrades.length > 0) {
      logInfo(`[Bitquery] ✓ Token HAS trades! Most recent: Block ${testTrades[0].Block.Number} at ${testTrades[0].Block.Time}`);
    } else {
      logWarn(`[Bitquery] ⚠ Token has NO trades in combined dataset. Response structure: ${JSON.stringify(Object.keys(testData))}`);
      if (testData.EVM) {
        logWarn(`[Bitquery] EVM keys: ${Object.keys(testData.EVM).join(', ')}`);
      }
    }
  } catch (testError: any) {
    logWarn(`[Bitquery] Test query failed: ${testError.message}`);
  }

  const trackedTokens = await getTrackedTokens();
  const trackedTokenAddresses = trackedTokens.map(t => t.token_address.toLowerCase());

  logInfo(`[Bitquery] Querying swaps for token: ${tokenAddr} (in tracked tokens: ${trackedTokenAddresses.includes(tokenAddr)})`);

  if (trackedTokenAddresses.length === 0) {
    logWarn('[Bitquery] No tracked tokens found');
    activeBitqueryEndpoint = originalEndpoint;
    return { groups: [], trackedTokenAddresses: [] };
  }

  interface GroupEntry {
    trades: BitqueryDEXTrade[];
    seen: Set<string>;
    blockNumber: number;
    blockTime: string;
    transactionFrom: string;
  }

  const groupMap = new Map<string, GroupEntry>();
  let page = 1;
  let consecutiveEmptyPages = 0;
  const pageSizeDays = 7; // Query 7 days at a time for pagination

  try {
    while (currentStartDate < endDateObj) {
      // Calculate end date for this page (7 days forward, or until endDate)
      const pageEndDate = new Date(currentStartDate);
      pageEndDate.setDate(pageEndDate.getDate() + pageSizeDays);
      const actualEndDate = pageEndDate > endDateObj ? endDateObj : pageEndDate;

      // Use working V2 structure from Base Historical Queries docs
      // Try dataset: combined first (works better with streaming endpoint)
      // If combined doesn't have enough history, we'll need to use classic endpoint with archive
      const queryString = `
query TokenSwaps($tokenAddress: String!, $startDate: DateTime!, $endDate: DateTime!) {
  EVM(dataset: combined, network: base) {
    DEXTrades(
      where: {
        any: [
          {Trade: {Buy: {Currency: {SmartContract: {is: $tokenAddress}}}}}
          {Trade: {Sell: {Currency: {SmartContract: {is: $tokenAddress}}}}}
        ]
        Block: {
          Time: {
            since: $startDate
            till: $endDate
          }
        }
      }
      orderBy: {ascending: Block_Time}
      limit: {count: 10000}
    ) {
      Block {
        Time
        Number
        Date
      }
      Transaction {
        Hash
        From
        To
        Gas
      }
      Trade {
        Buy {
          Amount
          AmountInUSD
          PriceInUSD
          Currency {
            Name
            Symbol
            SmartContract
            Decimals
          }
          Buyer
        }
        Sell {
          Amount
          AmountInUSD
          PriceInUSD
          Currency {
            Name
            Symbol
            SmartContract
            Decimals
          }
          Seller
        }
        Dex {
          ProtocolName
          ProtocolFamily
          SmartContract
        }
      }
    }
  }
}
      `;

      const variables: Record<string, any> = {
        tokenAddress: tokenAddr,
        startDate: currentStartDate.toISOString(),
        endDate: actualEndDate.toISOString()
      };

      logInfo(`[Bitquery] Page ${page}: Querying from ${currentStartDate.toISOString()} to ${actualEndDate.toISOString()} (transactions so far: ${groupMap.size})`);
      logInfo(`[Bitquery] Page ${page}: Query variables: tokenAddress=${tokenAddr.substring(0, 10)}..., startDate=${currentStartDate.toISOString()}, endDate=${actualEndDate.toISOString()}`);

      const data = await executeBitqueryQueryWithRetry(queryString, variables);
      logInfo(`[Bitquery] Page ${page}: Raw API response - EVM exists: ${!!data.EVM}, DEXTrades exists: ${!!data.EVM?.DEXTrades}, DEXTrades type: ${Array.isArray(data.EVM?.DEXTrades) ? 'array' : typeof data.EVM?.DEXTrades}, length: ${data.EVM?.DEXTrades?.length || 0}`);

      const trades: BitqueryDEXTrade[] = data.EVM?.DEXTrades || [];
      logInfo(`[Bitquery] Page ${page}: Found ${trades.length} trades (transactions so far: ${groupMap.size})`);

      if (trades.length > 0) {
        logInfo(`[Bitquery] Page ${page}: First trade example - Block: ${trades[0].Block.Number}, Time: ${trades[0].Block.Time}, TxHash: ${trades[0].Transaction.Hash.substring(0, 10)}...`);
      } else if (page === 1) {
        // Log full response structure for first page to debug
        logWarn(`[Bitquery] Page ${page}: No trades found. Full response keys: ${Object.keys(data).join(', ')}`);
        if (data.EVM) {
          logWarn(`[Bitquery] Page ${page}: EVM keys: ${Object.keys(data.EVM).join(', ')}`);
        }
      }

      if (trades.length === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) {
          logInfo('[Bitquery] Received 2 consecutive empty pages, pagination complete');
          break;
        }
        // Move to next time window
        currentStartDate = new Date(actualEndDate);
        page++;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      consecutiveEmptyPages = 0;

      let maxBlockInPage = 0;
      let lastTradeTime: Date | null = null;

      for (const trade of trades) {
        const txHashLower = trade.Transaction.Hash.toLowerCase();
        const signature = buildTradeSignature(trade);
        const blockNum = typeof trade.Block.Number === 'string'
          ? parseInt(trade.Block.Number, 10)
          : trade.Block.Number;
        const tradeTime = new Date(trade.Block.Time);

        let entry = groupMap.get(txHashLower);
        if (!entry) {
          entry = {
            trades: [],
            seen: new Set<string>(),
            blockNumber: blockNum,
            blockTime: trade.Block.Time,
            transactionFrom: trade.Transaction.From?.toLowerCase() || ''
          };
          groupMap.set(txHashLower, entry);
        }

        if (!entry.seen.has(signature)) {
          entry.trades.push(trade);
          entry.seen.add(signature);
        }

        if (blockNum > maxBlockInPage) {
          maxBlockInPage = blockNum;
        }
        if (tradeTime > (lastTradeTime || new Date(0))) {
          lastTradeTime = tradeTime;
        }

        if (blockNum > entry.blockNumber) {
          entry.blockNumber = blockNum;
          entry.blockTime = trade.Block.Time;
        }
        if (!entry.transactionFrom && trade.Transaction.From) {
          entry.transactionFrom = trade.Transaction.From.toLowerCase();
        }
      }

      logInfo(`[Bitquery] Page ${page}: Processed ${trades.length} trades, max block: ${maxBlockInPage}, total transactions: ${groupMap.size}`);

      if (onProgress) {
        onProgress(page, groupMap.size);
      }

      // Move to next time window (start from last trade time + 1 second to avoid duplicates)
      if (lastTradeTime) {
        currentStartDate = new Date(lastTradeTime.getTime() + 1000);
      } else {
        currentStartDate = new Date(actualEndDate);
      }

      page++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } finally {
    // Restore original endpoint
    activeBitqueryEndpoint = originalEndpoint;
  }

  const groups: BitqueryTradeGroup[] = Array.from(groupMap.entries()).map(([txHash, entry]) => ({
    txHash,
    trades: entry.trades,
    blockNumber: entry.blockNumber,
    blockTime: entry.blockTime,
    transactionFrom: entry.transactionFrom
  }));

  groups.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }
    return new Date(a.blockTime).getTime() - new Date(b.blockTime).getTime();
  });

  logInfo(`[Bitquery] Found ${groups.length} total transactions for token ${tokenAddr}`);

  return { groups, trackedTokenAddresses };
}

/**
 * Backwards-compatible helper: flatten grouped trades into SwapDetails array
 */
export async function getTokenSwaps(
  tokenAddress: string,
  fromDate?: Date | null,
  toDate?: Date | null,
  onProgress?: (page: number, swapsFound: number) => void
): Promise<SwapDetails[]> {
  const { groups, trackedTokenAddresses } = await getTokenSwapGroups(tokenAddress, fromDate, toDate, onProgress);

  if (groups.length === 0) {
    logWarn(`[Bitquery] No swaps found for token ${tokenAddress.toLowerCase()}`);
    return [];
  }

  const swapDetails: SwapDetails[] = [];
  let buyCount = 0;
  let sellCount = 0;

  for (const group of groups) {
    for (let legIndex = 0; legIndex < group.trades.length; legIndex++) {
      const trade = group.trades[legIndex];
      const buyToken = trade.Trade.Buy.Currency.SmartContract.toLowerCase();
      const sellToken = trade.Trade.Sell.Currency.SmartContract.toLowerCase();
      const isTrackedTokenBuy = trackedTokenAddresses.includes(buyToken);
      const isTrackedTokenSell = trackedTokenAddresses.includes(sellToken);

      if (swapDetails.length < 50) {
        logInfo(`[Transform Debug] Tx ${trade.Transaction.Hash.substring(0, 10)}... | leg=${legIndex} | buyToken=${buyToken.substring(0, 10)} | sellToken=${sellToken.substring(0, 10)} | isBuy=${isTrackedTokenBuy} | isSell=${isTrackedTokenSell} | trackedToken=${tokenAddress.toLowerCase().substring(0, 10)}`);
      }

      // V2 API: Use Buyer or Seller based on which side has the tracked token, fallback to Transaction.From
      let swapWallet: string = '';
      if (isTrackedTokenBuy) {
        swapWallet = trade.Trade.Buy.Buyer?.toLowerCase() || trade.Transaction.From?.toLowerCase() || '';
      } else if (isTrackedTokenSell) {
        swapWallet = trade.Trade.Sell.Seller?.toLowerCase() || trade.Transaction.From?.toLowerCase() || '';
      } else {
        swapWallet = trade.Transaction.From?.toLowerCase() || '';
      }

      if (!swapWallet && swapDetails.length < 10) {
        logWarn(`[Warning] No wallet address found for trade: ${trade.Transaction.Hash.substring(0, 10)}...`);
      }

      const isProtocolFee = isProtocolFeeTransfer(trade, swapWallet, trackedTokenAddresses);
      if (isProtocolFee) {
        if (swapDetails.length < 10) {
          logInfo(`[Filter] Skipping protocol fee transfer: ${trade.Transaction.Hash.substring(0, 10)}... | wallet=${swapWallet.substring(0, 10)}... | protocol=${trade.Trade.Dex.ProtocolName}`);
        }
        continue;
      }

      const swapDetail = await transformBitqueryTrade(
        trade,
        swapWallet,
        trackedTokenAddresses,
        legIndex,
        {
          protocolName: trade.Trade.Dex.ProtocolName,
          isProtocolFee
        }
      );

      if (swapDetail) {
        swapDetails.push(swapDetail);
        if (swapDetail.side === 'BUY') {
          buyCount++;
        } else {
          sellCount++;
        }

        if (swapDetails.length <= 50) {
          logInfo(`[Bitquery Transform] ${swapDetail.side} swap: ${swapDetail.txHash.substring(0, 10)}..., leg=${legIndex}, wallet=${swapWallet.substring(0, 10)}..., side=${swapDetail.side}`);
        }
      } else if (swapDetails.length < 20) {
        logWarn(`[Transform] Filtered out swap ${trade.Transaction.Hash.substring(0, 10)}... | buyToken=${buyToken.substring(0, 10)}... | sellToken=${sellToken.substring(0, 10)}... | trackedToken=${tokenAddress.toLowerCase().substring(0, 10)}...`);
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

