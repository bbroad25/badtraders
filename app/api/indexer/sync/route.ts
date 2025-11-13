// app/api/indexer/sync/route.ts
// Unified sync flow using Bitquery as the ONLY source for swaps
import { query } from '@/lib/db/connection';
import { discoverHoldersParallel } from '@/lib/services/holderDiscoveryService';
import { logError, logInfo, logSuccess, logWarn } from '@/lib/services/indexerLogger';
import { addError, getStatus, markComplete, markFailed, resetStatus, setActiveWorkers, updateOverallProgress, updateWorkerStatusWithTiming } from '@/lib/services/indexerMetrics';
import { processSwapsFromBitquery } from '@/lib/services/swapProcessor';
import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
const SYNC_PASSWORD = process.env.SYNC_PASSWORD || '';

export async function POST(request: NextRequest) {
  try {
    // Check if admin mode is enabled
    if (process.env.ENABLE_ADMIN_MODE !== 'true') {
      return NextResponse.json(
        { error: 'Admin mode is not enabled' },
        { status: 403 }
      );
    }

    // Check for sync password (if set)
    const body = await request.json().catch(() => ({}));
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '') || body.secret;
    const providedPassword = body.password;

    // If CRON_SECRET is provided, verify it matches (for cron jobs)
    if (providedSecret && CRON_SECRET && providedSecret !== CRON_SECRET) {
      logError('Invalid CRON_SECRET provided');
      return NextResponse.json(
        { error: 'Invalid secret' },
        { status: 401 }
      );
    }

    // If SYNC_PASSWORD is set, require it for manual syncs (unless CRON_SECRET is provided)
    if (!providedSecret && SYNC_PASSWORD && providedPassword !== SYNC_PASSWORD) {
      logError('Invalid sync password provided');
      return NextResponse.json(
        { error: 'Invalid password', requiresPassword: true },
        { status: 401 }
      );
    }

    const enableBitquerySync = (process.env.ENABLE_BITQUERY_SYNC || '').toLowerCase() === 'true';
    if (!enableBitquerySync) {
      logWarn('Bitquery sync attempted while ENABLE_BITQUERY_SYNC is disabled');
      return NextResponse.json(
        { error: 'Bitquery sync disabled', flag: 'ENABLE_BITQUERY_SYNC' },
        { status: 403 }
      );
    }

    // syncType: 'incremental' (update existing) or 'full' (clear all first)
    // tokenAddress: optional - if provided, sync only wallets that traded this token
    const syncType = body.syncType || 'incremental';
    const tokenAddress = body.tokenAddress;

    if (tokenAddress) {
      logInfo(`Starting per-token sync for ${tokenAddress} - Sync Type: ${syncType}...`);
    } else {
      logInfo(`Starting sync - Sync Type: ${syncType}...`);
    }
    resetStatus();

    let indexerRunId: number | null = null;

    // Full sync: Clear all indexer data
    if (syncType === 'full') {
      logInfo('Full sync: Clearing all existing indexer data...');
      try {
        await query('TRUNCATE TABLE trades CASCADE');
        await query('TRUNCATE TABLE positions CASCADE');
        await query('TRUNCATE TABLE wallets CASCADE');
        logSuccess('All indexer data cleared. Starting fresh sync...');
      } catch (error: any) {
        logError(`Error clearing data: ${error.message}`);
        addError(`Failed to clear data: ${error.message}`);
        throw error;
      }
    }

    const startTime = Date.now();

    try {
      const trackedTokensResult = await query('SELECT token_address FROM tracked_tokens');
      const trackedTokenAddresses = trackedTokensResult.rows.map((r: any) => r.token_address.toLowerCase());

      const tokensToIndex = tokenAddress
        ? [tokenAddress.toLowerCase()]
        : trackedTokenAddresses;

      if (tokensToIndex.length === 0) {
        throw new Error('No tracked tokens found. Please add a token first.');
      }

      try {
        const initiator = providedSecret ? 'cron' : 'manual';
        const runInsert = await query(
          `INSERT INTO indexer_runs (
            initiator, sync_type, tokens_scanned, status, started_at
          ) VALUES ($1, $2, $3, 'running', NOW())
          RETURNING id`,
          [initiator, syncType, tokensToIndex.length]
        );
        indexerRunId = runInsert.rows[0].id as number;
        logInfo(`[IndexerRun] Started run ${indexerRunId} (initiator=${initiator}, tokens=${tokensToIndex.length})`);
      } catch (runError: any) {
        logWarn(`[IndexerRun] Failed to record run start: ${runError?.message || runError}`);
      }

      // Initialize workers
      setActiveWorkers(['swap-processor']);

      let totalSwapsProcessed = 0;
      const walletsFound = new Set<string>();

      // Work breakdown: Swaps = 80%, Holder Discovery = 20%
      const SWAP_WEIGHT = 0.80;
      const HOLDER_DISCOVERY_WEIGHT = 0.20;

      // Initialize unified overall progress (starts at 0, never resets)
      updateOverallProgress(0, 'Starting sync...');

      // 1. PROCESS SWAPS FROM BITQUERY (0-80% of overall progress)
      updateWorkerStatusWithTiming('swap-processor', {
        walletAddress: 'swap-processor',
        progress: 0,
        currentTask: 'Querying Bitquery for ALL swaps...',
        swapsProcessed: 0
      });

      logInfo('Processing swaps from Bitquery (ONLY source)...');
      logInfo(`[SYNC ROUTE] About to call processSwapsFromBitquery with tokenAddress=${tokenAddress || 'ALL'}`);

      type SwapProcessResult = Awaited<ReturnType<typeof processSwapsFromBitquery>>;
      let swapResult: SwapProcessResult | null = null;

      try {
        logInfo(`[SYNC ROUTE] Entering try block for processSwapsFromBitquery...`);
        // Track total swaps fetched for progress calculation
        let totalSwapsFetched = 0;

        // Process swaps for each token - query ALL historical swaps
        swapResult = await processSwapsFromBitquery(
          tokenAddress,
          (page, swapsFound) => {
            // Update progress as Bitquery paginates (0-40% of overall progress)
            totalSwapsFetched = swapsFound;
            const fetchProgress = Math.min(40, (swapsFound / 10000) * 40); // 0-40% for fetching
            updateWorkerStatusWithTiming('swap-processor', {
              walletAddress: 'swap-processor',
              progress: fetchProgress,
              currentTask: `Querying Bitquery: Page ${page} | ${swapsFound.toLocaleString()} swaps found`,
              swapsProcessed: swapsFound
            });
            updateOverallProgress(fetchProgress, `Querying Bitquery: ${swapsFound.toLocaleString()} swaps found...`);
          },
          (processed, total) => {
            // Update progress as swaps are inserted (40-80% of overall progress)
            if (total > 0) {
              const insertProgress = 40 + ((processed / total) * 40); // 40-80% for inserting
              const percentage = Math.round((processed / total) * 100);
              updateWorkerStatusWithTiming('swap-processor', {
                walletAddress: 'swap-processor',
                progress: insertProgress,
                currentTask: `Processing swaps: ${processed.toLocaleString()} / ${total.toLocaleString()} (${percentage}%)`,
                swapsProcessed: processed
              });
              updateOverallProgress(insertProgress, `Processing swaps: ${processed.toLocaleString()} / ${total.toLocaleString()} (${percentage}%)`);
            }
          }
        );

        logInfo(`[SYNC ROUTE] processSwapsFromBitquery completed: swapsProcessed=${swapResult.swapsProcessed}, walletsFound=${swapResult.walletsFound.size}, pages=${swapResult.bitqueryPages}, calls=${swapResult.bitqueryCalls}`);

        totalSwapsProcessed = swapResult.swapsProcessed;
        swapResult.walletsFound.forEach(w => walletsFound.add(w));

        // Insert wallets found from swaps
        for (const walletAddr of swapResult.walletsFound) {
          try {
            await query(
              `INSERT INTO wallets (wallet_address, created_at, updated_at)
               VALUES ($1, NOW(), NOW())
               ON CONFLICT (wallet_address) DO UPDATE SET updated_at = NOW()`,
              [walletAddr]
            );
          } catch (error: any) {
            logWarn(`Failed to insert wallet ${walletAddr}: ${error.message}`);
          }
        }

        updateWorkerStatusWithTiming('swap-processor', {
          walletAddress: 'swap-processor',
          progress: 100,
          currentTask: `Complete: ${totalSwapsProcessed} swaps processed`,
          swapsProcessed: totalSwapsProcessed
        });

        logSuccess(`Processed ${totalSwapsProcessed} swaps from Bitquery, found ${swapResult.walletsFound.size} wallets`);
        updateOverallProgress(SWAP_WEIGHT * 100, `Swaps complete: ${totalSwapsProcessed} processed`);

        if (indexerRunId !== null) {
          try {
            await query(
              `UPDATE indexer_runs
               SET finished_at = NOW(),
                   status = 'succeeded',
                   tokens_scanned = $1,
                   bitquery_pages = $2,
                   bitquery_calls = $3
               WHERE id = $4`,
              [
                swapResult.tokensProcessed,
                swapResult.bitqueryPages,
                swapResult.bitqueryCalls,
                indexerRunId
              ]
            );
          } catch (runUpdateError: any) {
            logWarn(`[IndexerRun] Failed to update run ${indexerRunId}: ${runUpdateError?.message || runUpdateError}`);
          }
        }
      } catch (swapError: any) {
        const swapErrorMsg = swapError?.message || swapError?.toString() || JSON.stringify(swapError);
        logError(`[SYNC ROUTE] [CRITICAL] Swap processing failed: ${swapErrorMsg}`);
        if (swapError?.stack) {
          logError(`[SYNC ROUTE] [CRITICAL] Full Stack: ${swapError.stack}`);
        }
        updateWorkerStatusWithTiming('swap-processor', {
          walletAddress: 'swap-processor',
          progress: 0,
          currentTask: `FAILED: ${swapErrorMsg.substring(0, 50)}...`,
          swapsProcessed: 0
        });
        if (indexerRunId !== null) {
          try {
            await query(
              `UPDATE indexer_runs
               SET finished_at = NOW(),
                   status = 'failed',
                   error_message = $1
               WHERE id = $2`,
              [swapErrorMsg, indexerRunId]
            );
          } catch (runFailError: any) {
            logWarn(`[IndexerRun] Failed to mark run ${indexerRunId} as failed: ${runFailError?.message || runFailError}`);
          }
        }
        // THROW so sync fails visibly
        throw new Error(`Swap processing failed: ${swapErrorMsg}`);
      }

      // 2. HOLDER DISCOVERY (80-100% of overall progress) - Run AFTER swaps complete
      if (tokensToIndex.length > 0) {
        setActiveWorkers(['holder-discovery']);
        updateWorkerStatusWithTiming('holder-discovery', {
          walletAddress: 'holder-discovery',
          progress: 0,
          currentTask: `Discovering holders from ${tokensToIndex.length} token(s)...`
        });

        for (let i = 0; i < tokensToIndex.length; i++) {
          const tokenAddr = tokensToIndex[i];
          const tokenProgress = (i / tokensToIndex.length) * 100;

          updateWorkerStatusWithTiming('holder-discovery', {
            walletAddress: 'holder-discovery',
            progress: tokenProgress,
            currentTask: `Discovering holders for ${tokenAddr.substring(0, 10)}... (${i + 1}/${tokensToIndex.length})`
          });

          logInfo(`Starting holder discovery for token ${tokenAddr}...`);
          const discoveryResult = await discoverHoldersParallel(tokenAddr);

          // Insert discovered holders into wallets table
          for (const holderAddr of discoveryResult.allHolders) {
            try {
              await query(
                `INSERT INTO wallets (wallet_address, created_at, updated_at)
                 VALUES ($1, NOW(), NOW())
                 ON CONFLICT (wallet_address) DO UPDATE SET updated_at = NOW()`,
                [holderAddr]
              );
              walletsFound.add(holderAddr);
            } catch (error: any) {
              logWarn(`Failed to insert holder wallet ${holderAddr}: ${error.message}`);
            }
          }

          // Log comparison stats
          const onlyInTransfers = [...discoveryResult.transferBasedHolders].filter(h => !discoveryResult.apiBasedHolders.has(h));
          const onlyInAPIs = [...discoveryResult.apiBasedHolders].filter(h => !discoveryResult.transferBasedHolders.has(h));
          const inBoth = [...discoveryResult.transferBasedHolders].filter(h => discoveryResult.apiBasedHolders.has(h));

          logInfo(`[Holder Discovery] Token ${tokenAddr}: ${discoveryResult.transferBasedHolders.size} from transfers, ${discoveryResult.apiBasedHolders.size} from APIs`);
          logInfo(`[Holder Discovery] Comparison: ${inBoth.length} in both, ${onlyInTransfers.length} only in transfers, ${onlyInAPIs.length} only in APIs`);

          // Update progress
          const overallProgress = SWAP_WEIGHT * 100 + (HOLDER_DISCOVERY_WEIGHT * tokenProgress);
          updateOverallProgress(
            overallProgress,
            `Discovering holders: ${i + 1} / ${tokensToIndex.length} tokens (${discoveryResult.allHolders.size} total)`
          );
        }

        updateWorkerStatusWithTiming('holder-discovery', {
          walletAddress: 'holder-discovery',
          progress: 100,
          currentTask: `Complete: Discovered holders from ${tokensToIndex.length} token(s)`
        });

        logSuccess(`Holder discovery complete.`);
      }

      // Final overall progress: 100%
      updateOverallProgress(100, 'Sync complete!');

      markComplete();
      const duration = Date.now() - startTime;
      logSuccess(`Sync completed successfully in ${duration}ms`);

      return NextResponse.json({
        success: true,
        message: tokenAddress
          ? `${syncType} sync completed for token ${tokenAddress}`
          : `${syncType} sync completed (all tokens)`,
        syncType,
        tokenAddress,
        swapsProcessed: totalSwapsProcessed,
        walletsFound: walletsFound.size,
        bitqueryPages: swapResult.bitqueryPages,
        bitqueryCalls: swapResult.bitqueryCalls,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      // Capture full error details - database errors may not have .message
      const errorMessage = error?.message || error?.toString() || JSON.stringify(error) || 'Unknown error';
      const errorDetails = error?.code || error?.errno || error?.sqlState || '';
      const fullError = errorDetails ? `${errorMessage} (${errorDetails})` : errorMessage;

      markFailed(fullError);
      logError(`Sync failed: ${fullError}`);
      addError(fullError);

      if (indexerRunId !== null) {
        try {
          await query(
            `UPDATE indexer_runs
             SET finished_at = NOW(),
                 status = 'failed',
                 error_message = $1
             WHERE id = $2`,
            [fullError, indexerRunId]
          );
        } catch (runFailError: any) {
          logWarn(`[IndexerRun] Failed to mark run ${indexerRunId} as failed: ${runFailError?.message || runFailError}`);
        }
      }

      // Log stack trace if available
      if (error?.stack) {
        logError(`Stack trace: ${error.stack}`);
      }

      throw error;
    }
  } catch (error: any) {
    // Capture full error details for outer catch
    const errorMessage = error?.message || error?.toString() || JSON.stringify(error) || 'Unknown error';
    const errorDetails = error?.code || error?.errno || error?.sqlState || '';
    const fullError = errorDetails ? `${errorMessage} (${errorDetails})` : errorMessage;

    logError(`Sync route error: ${fullError}`);

    // Ensure sync is marked as failed if not already
    const currentStatus = getStatus();
    if (currentStatus.isRunning) {
      markFailed(fullError);
    }

    return NextResponse.json(
      { error: fullError || 'Sync failed' },
      { status: 500 }
    );
  }
}

