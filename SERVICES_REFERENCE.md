# Active Services Reference

## Core Indexer Services (ACTIVE)

### `bitqueryService.ts` ✅
- **Purpose**: Fetches swap data from Bitquery API
- **Used by**: `swapProcessor.ts`
- **Status**: ACTIVE - Primary data source for swaps

### `swapProcessor.ts` ✅
- **Purpose**: Processes swaps from Bitquery and inserts into database
- **Used by**: `app/api/indexer/sync/route.ts`
- **Status**: ACTIVE - Core swap processing logic

### `fifoAccounting.ts` ✅
- **Purpose**: FIFO accounting logic for positions and PnL
- **Used by**: `swapProcessor.ts`, `app/api/indexer/positions/route.ts`
- **Status**: ACTIVE - Core accounting logic

### `holderDiscoveryService.ts` ✅
- **Purpose**: Discovers token holders using token_transfers table and external APIs
- **Used by**: `app/api/indexer/sync/route.ts`
- **Status**: ACTIVE - Holder discovery

### `indexerMetrics.ts` ✅
- **Purpose**: Tracks sync status and progress
- **Used by**: `app/api/indexer/sync/route.ts`, `app/api/indexer/status/route.ts`
- **Status**: ACTIVE - Status tracking

### `indexerLogger.ts` ✅
- **Purpose**: Centralized logging
- **Used by**: All indexer services
- **Status**: ACTIVE - Logging utility

### `swapTypes.ts` ✅
- **Purpose**: TypeScript type definitions for swaps
- **Used by**: `bitqueryService.ts`, `swapProcessor.ts`
- **Status**: ACTIVE - Type definitions

## RPC Provider Services (ACTIVE)

### `apiRouter.ts` ✅
- **Purpose**: Parallel RPC calls with failover
- **Used by**: `app/api/indexer/status/route.ts` (for getBlockNumberParallel)
- **Status**: ACTIVE - RPC provider routing

### `apiProviderManager.ts` ✅
- **Purpose**: Manages RPC provider instances
- **Used by**: `apiRouter.ts`, `app/api/indexer/tokens/route.ts`
- **Status**: ACTIVE - Provider management

### `providers.ts` ✅
- **Purpose**: Base provider configuration
- **Used by**: `apiProviderManager.ts`
- **Status**: ACTIVE - Provider setup

## Removed Services (DELETED)

### `indexerService.ts` ❌ DELETED
- **Reason**: Replaced by Bitquery-based sync flow
- **Was used by**: `app/api/cron/indexer/route.ts` (updated to use sync endpoint)

### `walletIndexer.ts` ❌ DELETED
- **Reason**: Only used by legacy indexerService
- **Was used by**: `indexerService.ts`

### `transferIndexer.ts` ❌ DELETED
- **Reason**: Not used - holderDiscoveryService uses token_transfers table directly
- **Was used by**: Nothing

### `swapEventParser.ts` ❌ DELETED
- **Reason**: Not used - replaced by Bitquery
- **Was used by**: Nothing

### `traceParser.ts` ❌ DELETED
- **Reason**: Not used - replaced by Bitquery
- **Was used by**: Nothing

## Other Services (Non-Indexer)

### `blockchainService.ts`, `chainlinkOracle.ts`, `farcasterService.ts`, `geminiService.ts`, `leaderboardService.ts`, `priceCalculator.ts`, `priceService.ts`, `tokenService.ts`, `userService.ts`
- **Status**: Not part of indexer cleanup - belong to other parts of the app

