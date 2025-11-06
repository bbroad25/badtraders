// lib/services/holderDiscoveryService.ts
// Multi-API parallel holder discovery service

import { logError, logInfo, logSuccess, logWarn } from './indexerLogger';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ZERION_API_KEY = process.env.ZERION_API_KEY;
const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY;

// Debug logging for API key detection
if (process.env.NODE_ENV !== 'production') {
  console.log('[Holder Discovery] API Key Check:', {
    ZERION_API_KEY: ZERION_API_KEY ? `${ZERION_API_KEY.substring(0, 10)}...` : 'NOT SET',
    ZAPPER_API_KEY: ZAPPER_API_KEY ? `${ZAPPER_API_KEY.substring(0, 10)}...` : 'NOT SET',
    ZERION_exists: !!ZERION_API_KEY,
    ZAPPER_exists: !!ZAPPER_API_KEY,
  });
}

interface HolderResult {
  address: string;
  balance: bigint;
  source: 'alchemy' | 'zerion' | 'zapper' | 'transfers';
}

/**
 * Result of parallel holder discovery with separate sets for comparison
 */
export interface HolderDiscoveryResult {
  transferBasedHolders: Set<string>;  // From token_transfers table
  apiBasedHolders: Set<string>;       // From external APIs (Zerion/Zapper)
  allHolders: Set<string>;             // Combined set
  sourceBreakdown: Map<string, number>; // Count by source
}

/**
 * Discover token holders using multiple APIs in parallel
 * Returns separate sets for transfer-based and API-based holders for comparison
 */
export async function discoverHoldersParallel(
  tokenAddress: string,
  minBalance: bigint = BigInt(0)
): Promise<HolderDiscoveryResult> {
  const tokenAddr = tokenAddress.toLowerCase();

  logInfo(`Starting parallel holder discovery for ${tokenAddr}...`);

  // PRIMARY METHOD: Use Transfer events (most reliable, no API needed)
  const transferHolders = await discoverHoldersFromTransfers(tokenAddr);
  logInfo(`[Holder Discovery] Transfer events: Found ${transferHolders.size} holders`);

  // SECONDARY: Try external APIs if configured (optional)
  const configuredApis: string[] = [];

  // Check if keys exist (handle both undefined and empty string cases)
  const hasZerion = ZERION_API_KEY && ZERION_API_KEY.trim().length > 0;
  const hasZapper = ZAPPER_API_KEY && ZAPPER_API_KEY.trim().length > 0;

  if (hasZerion) configuredApis.push('Zerion');
  if (hasZapper) configuredApis.push('Zapper');

  logInfo(`Configured APIs: ${configuredApis.length > 0 ? configuredApis.join(', ') : 'NONE'}`);
  if (configuredApis.length === 0) {
    logWarn(`No holder discovery APIs configured. Checked: ZERION_API_KEY=${hasZerion ? 'SET' : 'NOT SET'}, ZAPPER_API_KEY=${hasZapper ? 'SET' : 'NOT SET'}`);
  }

  const apiBasedHolders = new Set<string>();
  const sourceBreakdown = new Map<string, number>();
  sourceBreakdown.set('transfers', transferHolders.size);

  if (configuredApis.length > 0) {
    // Run all API discovery methods in parallel
    const discoveryPromises: Promise<HolderResult[]>[] = [];

    // Zerion API (if available)
    if (hasZerion) {
      logInfo(`[Holder Discovery] Zerion: Attempting API call...`);
      discoveryPromises.push(
        discoverHoldersZerion(tokenAddr).catch(err => {
          logWarn(`[Holder Discovery] Zerion: FAILED - ${err.message}`);
          return [];
        })
      );
    }

    // Zapper API (if available)
    if (hasZapper) {
      logInfo(`[Holder Discovery] Zapper: Attempting API call...`);
      discoveryPromises.push(
        discoverHoldersZapper(tokenAddr).catch(err => {
          logWarn(`[Holder Discovery] Zapper: FAILED - ${err.message}`);
          return [];
        })
      );
    }

    logInfo(`[Holder Discovery] Starting ${discoveryPromises.length} API call(s)...`);

    // Wait for all to complete (some may fail, that's OK)
    const results = await Promise.allSettled(discoveryPromises);

    // Aggregate results from all API sources
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const holder of result.value) {
          apiBasedHolders.add(holder.address.toLowerCase());
          sourceBreakdown.set(holder.source, (sourceBreakdown.get(holder.source) || 0) + 1);
        }
      } else {
        logWarn(`[Holder Discovery] One API call failed: ${result.reason?.message || 'Unknown error'}`);
      }
    }
  }

  // Log results by source
  if (sourceBreakdown.size > 0) {
    const sourceDetails = Array.from(sourceBreakdown.entries())
      .map(([source, count]) => `${source}: ${count}`)
      .join(', ');
    logInfo(`[Holder Discovery] Results by source: ${sourceDetails}`);
  }

  // Combine all holders
  const allHolders = new Set<string>();
  transferHolders.forEach(h => allHolders.add(h));
  apiBasedHolders.forEach(h => allHolders.add(h));

  // Log comparison stats
  const onlyInTransfers = new Set([...transferHolders].filter(h => !apiBasedHolders.has(h)));
  const onlyInAPIs = new Set([...apiBasedHolders].filter(h => !transferHolders.has(h)));
  const inBoth = new Set([...transferHolders].filter(h => apiBasedHolders.has(h)));

  logInfo(`[Holder Discovery] Comparison: ${inBoth.size} in both, ${onlyInTransfers.size} only in transfers, ${onlyInAPIs.size} only in APIs`);
  logSuccess(`Discovered ${allHolders.size} total holders (${transferHolders.size} from transfers, ${apiBasedHolders.size} from APIs)`);

  return {
    transferBasedHolders: transferHolders,
    apiBasedHolders: apiBasedHolders,
    allHolders: allHolders,
    sourceBreakdown: sourceBreakdown
  };
}

/**
 * Discover holders using Alchemy Token Holders API
 */
async function discoverHoldersAlchemy(tokenAddress: string): Promise<HolderResult[]> {
  if (!ALCHEMY_API_KEY) {
    return [];
  }

  const holders: HolderResult[] = [];
  let pageKey: string | undefined = undefined;
  let page = 1;

  try {
    do {
      const response: Response = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getTokenHolders',
          params: [
            {
              contractAddress: tokenAddress,
              pageSize: 1000,
              ...(pageKey && { pageKey })
            }
          ]
        })
      });

      const data: any = await response.json();

      if (data.error) {
        throw new Error(`Alchemy API Error: ${data.error.message}`);
      }

      const result: any = data.result;
      if (result?.holders) {
        for (const holder of result.holders) {
          holders.push({
            address: holder.address.toLowerCase(),
            balance: BigInt(holder.balance || '0'),
            source: 'alchemy'
          });
        }
      }

      pageKey = result?.pageKey;
      page++;

      logInfo(`Alchemy: Fetched page ${page - 1}, total holders so far: ${holders.length}`);

      // Rate limiting
      if (pageKey) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } while (pageKey && page < 100); // Limit to 100 pages max (100k holders)

    logInfo(`Alchemy: Found ${holders.length} holders`);
    return holders;
  } catch (error: any) {
    logError(`Alchemy holder discovery error: ${error.message}`);
    throw error;
  }
}

/**
 * Discover holders using Zerion API
 * Zerion provides portfolio/asset APIs that can list token holders
 */
async function discoverHoldersZerion(tokenAddress: string): Promise<HolderResult[]> {
  const hasZerion = ZERION_API_KEY && ZERION_API_KEY.trim().length > 0;
  if (!hasZerion) {
    return [];
  }

  const holders: HolderResult[] = [];
  const apiUrl = `https://api.zerion.io/v1/wallets/token-balances/?chain_id=base&token_address=${tokenAddress}`;

  try {
    logInfo(`[Holder Discovery] Zerion: Calling ${apiUrl}`);
    const startTime = Date.now();

    const response: Response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${ZERION_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;
    logInfo(`[Holder Discovery] Zerion: Response ${response.status} ${response.statusText} (${duration}ms)`);

    if (!response.ok) {
      const responseText = await response.text().catch(() => 'Unable to read response');
      logWarn(`[Holder Discovery] Zerion: API Error ${response.status} - ${responseText.substring(0, 200)}`);

      // Zerion might not support this endpoint - that's OK
      if (response.status === 404 || response.status === 403) {
        logInfo('[Holder Discovery] Zerion: Endpoint not available (404/403)');
        return [];
      }
      throw new Error(`Zerion API Error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    logInfo(`[Holder Discovery] Zerion: Response data keys: ${Object.keys(data).join(', ')}`);

    // Parse Zerion response (structure may vary)
    if (data.data) {
      for (const item of data.data) {
        if (item.attributes?.address) {
          holders.push({
            address: item.attributes.address.toLowerCase(),
            balance: BigInt(item.attributes.balance || '0'),
            source: 'zerion'
          });
        }
      }
    }

    logInfo(`[Holder Discovery] Zerion: Parsed ${holders.length} holders from response`);
    return holders;
  } catch (error: any) {
    logError(`[Holder Discovery] Zerion: Exception - ${error.message}`);
    logError(`[Holder Discovery] Zerion: Stack: ${error.stack?.substring(0, 200)}`);
    // Zerion might not support this - that's OK, we have other sources
    return [];
  }
}

/**
 * Discover holders using Zapper API
 * Zapper provides DeFi portfolio data including token holders
 */
async function discoverHoldersZapper(tokenAddress: string): Promise<HolderResult[]> {
  const hasZapper = ZAPPER_API_KEY && ZAPPER_API_KEY.trim().length > 0;
  if (!hasZapper) {
    return [];
  }

  const holders: HolderResult[] = [];
  const apiUrl = `https://api.zapper.fi/v2/tokens/${tokenAddress}/holders?network=base`;

  try {
    logInfo(`[Holder Discovery] Zapper: Calling ${apiUrl}`);
    const startTime = Date.now();

    const response: Response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${ZAPPER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;
    logInfo(`[Holder Discovery] Zapper: Response ${response.status} ${response.statusText} (${duration}ms)`);

    if (!response.ok) {
      const responseText = await response.text().catch(() => 'Unable to read response');
      logWarn(`[Holder Discovery] Zapper: API Error ${response.status} - ${responseText.substring(0, 200)}`);

      // Zapper might not support this endpoint - that's OK
      if (response.status === 404 || response.status === 403) {
        logInfo('[Holder Discovery] Zapper: Endpoint not available (404/403)');
        return [];
      }
      throw new Error(`Zapper API Error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    logInfo(`[Holder Discovery] Zapper: Response type: ${Array.isArray(data) ? 'Array' : 'Object'}, keys: ${Array.isArray(data) ? `Array[${data.length}]` : Object.keys(data).join(', ')}`);

    // Parse Zapper response (structure may vary)
    if (Array.isArray(data)) {
      for (const holder of data) {
        if (holder.address) {
          holders.push({
            address: holder.address.toLowerCase(),
            balance: BigInt(holder.balance || holder.balanceRaw || '0'),
            source: 'zapper'
          });
        }
      }
    } else if (data.data) {
      for (const holder of data.data) {
        if (holder.address) {
          holders.push({
            address: holder.address.toLowerCase(),
            balance: BigInt(holder.balance || holder.balanceRaw || '0'),
            source: 'zapper'
          });
        }
      }
    }

    logInfo(`[Holder Discovery] Zapper: Parsed ${holders.length} holders from response`);
    return holders;
  } catch (error: any) {
    logError(`[Holder Discovery] Zapper: Exception - ${error.message}`);
    logError(`[Holder Discovery] Zapper: Stack: ${error.stack?.substring(0, 200)}`);
    // Zapper might not support this - that's OK, we have other sources
    return [];
  }
}

/**
 * Discover holders by scanning Transfer events from token_transfers table
 * This is the most reliable method - we already have all the data!
 */
export async function discoverHoldersFromTransfers(tokenAddress: string): Promise<Set<string>> {
  const holders = new Set<string>();

  try {
    const { query } = await import('@/lib/db/connection');

    // Find all unique addresses that received this token
    const result = await query(
      `SELECT DISTINCT to_address
       FROM token_transfers
       WHERE token_address = $1
       AND to_address != $2  -- Exclude burn address
       ORDER BY to_address`,
      [tokenAddress.toLowerCase(), '0x0000000000000000000000000000000000000000']
    );

    for (const row of result.rows) {
      holders.add(row.to_address.toLowerCase());
    }

    logInfo(`[Holder Discovery] Found ${holders.size} holders from Transfer events for ${tokenAddress}`);
    return holders;
  } catch (error: any) {
    logError(`[Holder Discovery] Error discovering holders from transfers: ${error.message}`);
    return new Set();
  }
}
