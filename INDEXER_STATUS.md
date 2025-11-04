# Indexer Implementation Status

**Branch:** `feature/indexer-implementation`
**Date:** Current session
**Status:** Implementation complete, needs testing and sync trigger

## ✅ Completed

### Database Schema
- Migration created: `migrations/003_create_indexer_tables.sql`
- Tables created in Supabase:
  - `wallets` - Track registered wallets and sync state
  - `tracked_tokens` - Configurable list of tokens to track (BadTraders seeded)
  - `trades` - Individual swap transactions
  - `positions` - FIFO cost basis tracking per wallet/token

### Core Services Implemented
1. **`lib/services/fifoAccounting.ts`** - FIFO cost basis tracking
   - `processBuy()` - Add to position
   - `processSell()` - Remove FIFO, calculate realized PnL
   - `calculateUnrealizedPnL()` - Current unrealized PnL

2. **`lib/services/swapDecoder.ts`** - Swap detection and decoding (Alchemy-only)
   - `detectSwapTransaction()` - Identify swap transactions
   - `decodeSwapFromAlchemy()` - Parse swap from transaction receipts
   - `extractSwapDetails()` - Main entry point

3. **`lib/services/priceService.ts`** - Price lookups with caching
   - Uses Dexscreener API
   - 5-minute cache TTL

4. **`lib/services/indexerService.ts`** - Main sync orchestration
   - `syncWalletTransactions()` - Sync single wallet
   - `syncAllWallets()` - Sync all registered wallets
   - Uses Alchemy `getAssetTransfers` API
   - 30-day lookback window

### Integration Updates
- **`lib/services/userService.ts`** - Auto-registers wallets for indexing on user registration
- **`lib/services/blockchainService.ts`** - Replaced placeholder `getNetLossForWallets()` with indexer-based calculation
  - Queries `positions` table for realized + unrealized PnL

### UI Components
- **`app/indexer/page.tsx`** - Indexer status page with:
  - Overview stats (wallets, trades, positions)
  - Tabs for Wallets, Trades, Positions
  - Manual sync button
  - Refresh functionality

- **`components/Navigation.tsx`** - Added "INDEXER" to hamburger menu

### API Routes
- **`app/api/cron/indexer/route.ts`** - Vercel cron endpoint (runs every 12 hours)
- **`app/api/indexer/wallets/route.ts`** - Get all wallets
- **`app/api/indexer/trades/route.ts`** - Get trades (with limit/filtering)
- **`app/api/indexer/positions/route.ts`** - Get positions

### Configuration
- **`vercel.json`** - Cron schedule configured (every 12 hours)
- Database connection error handling improved (handles pooler terminations)

## ⚠️ Current Status

### What's Working
- All code implemented and passing lint checks
- Database migration run successfully in Supabase
- Indexer page loads and displays stats
- API routes respond correctly (all returning 200)

### What Needs to Happen Next

1. **Trigger Initial Sync**
   - Currently showing 0 wallets, 0 trades, 0 positions
   - Need to run manual sync or wait for cron
   - Manual sync: Go to `/indexer` page, click "Manual Sync", enter `CRON_SECRET`

2. **Register Wallets** (if needed)
   - Indexer only syncs wallets from `users` table where `opt_in_status = true`
   - If wallets have traded but aren't registered, they won't be synced
   - Options:
     - Register those wallets via `/api/register`
     - OR modify indexer to sync all wallets that have traded the token (not just registered ones)

3. **Environment Variables**
   - `DATABASE_URL` - Set ✅
   - `ALCHEMY_API_KEY` - Should be set
   - `CRON_SECRET` - Needs to be set for manual sync

4. **Testing**
   - Test manual sync triggers actual transaction processing
   - Verify swap detection is working correctly
   - Verify FIFO accounting calculates correctly
   - Verify leaderboard uses indexer data

## 🔧 Technical Details

### Implementation Choice
- **Option A: Alchemy Only** (chosen - no Covalent)
- Decodes swaps from Alchemy transaction receipts and Transfer events
- No external API costs beyond existing Alchemy plan

### Database Connection
- Using Supabase pooler (port 6543)
- Connection termination errors handled gracefully
- Automatic retry on termination

### Sync Process
1. Get all registered wallets from `users` table
2. For each wallet:
   - Get last synced block (or start 30 days back)
   - Fetch transactions via Alchemy `getAssetTransfers`
   - Detect swaps involving tracked tokens
   - Decode swap details (side, amounts, tokens)
   - Get historical price
   - Insert trade record
   - Update FIFO position
   - Update last synced block

### Next Steps for Testing

1. **Check registered wallets:**
   ```sql
   SELECT wallet_address FROM users WHERE opt_in_status = true;
   ```

2. **If wallets exist, trigger manual sync:**
   - Use the UI button on `/indexer` page
   - OR test endpoint directly:
   ```bash
   curl -X GET http://localhost:3000/api/cron/indexer \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. **Verify sync worked:**
   ```sql
   SELECT COUNT(*) FROM trades;
   SELECT COUNT(*) FROM positions;
   SELECT * FROM wallets WHERE last_synced_block IS NOT NULL;
   ```

## 📝 Known Issues / Considerations

1. **Indexer only syncs registered wallets** - If you want to track ALL wallets that trade the token (not just registered users), we need to modify `syncAllWallets()` to use `getEligibleWallets()` instead of registered users.

2. **Historical price approximation** - Uses current price as approximation for historical (acceptable for lightweight indexer per plan)

3. **Swap detection** - Currently detects swaps via Transfer events. May miss some edge cases. Can be enhanced later.

4. **Initial sync** - For wallets with existing trades, initial sync will process last 30 days. First sync might take a while if there's a lot of history.

## 🚀 Deployment Checklist

Before deploying to production:
- [ ] Set `CRON_SECRET` in Vercel environment variables
- [ ] Verify `DATABASE_URL` is set in Vercel
- [ ] Verify `ALCHEMY_API_KEY` is set in Vercel
- [ ] Test manual sync works in production
- [ ] Verify cron job runs automatically (check Vercel logs after 12 hours)
- [ ] Monitor API usage (Alchemy calls)

## 📁 Files Changed/Added

### New Files
- `migrations/003_create_indexer_tables.sql`
- `lib/services/fifoAccounting.ts`
- `lib/services/swapDecoder.ts`
- `lib/services/priceService.ts`
- `lib/services/indexerService.ts`
- `app/indexer/page.tsx`
- `app/api/cron/indexer/route.ts`
- `app/api/indexer/wallets/route.ts`
- `app/api/indexer/trades/route.ts`
- `app/api/indexer/positions/route.ts`
- `vercel.json`
- `scripts/test-indexer-sync.ts` (helper script)

### Modified Files
- `lib/services/userService.ts` - Added wallet registration on user signup
- `lib/services/blockchainService.ts` - Replaced placeholder PnL calculation
- `lib/db/connection.ts` - Improved error handling
- `components/Navigation.tsx` - Added INDEXER link

### Deleted Files
- `lib/services/covalentService.ts` - Removed (switched to Alchemy-only)

## 🎯 Next Session Goals

1. Test the manual sync and verify trades are being detected
2. Verify FIFO accounting is calculating correctly
3. Check that leaderboard uses the new indexer data
4. Consider whether to sync all eligible wallets vs just registered ones
5. Fine-tune swap detection if needed


