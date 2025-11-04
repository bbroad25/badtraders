# Database Behavior - Appending vs Overwriting

## How the Indexer Writes to Supabase

### **Trades Table** - APPENDING (with deduplication)

**Table Schema:**
```sql
UNIQUE(wallet_address, tx_hash, token_address, side)
```

**Insert Behavior:**
```sql
INSERT INTO trades (...) VALUES (...)
ON CONFLICT (wallet_address, tx_hash, token_address, side) DO NOTHING
```

**What This Means:**
- ✅ **Appends** new trades (database keeps growing)
- ✅ **Prevents duplicates** - if the same trade already exists, it skips it
- ✅ **Safe to re-run** - running the indexer multiple times won't create duplicates
- ✅ **Historical record** - every trade is stored forever

**Example:**
- First sync: 100 trades inserted
- Second sync: 50 new trades + 100 old trades (old ones skipped, new ones added)
- Result: 150 trades total

---

### **Positions Table** - UPDATING (overwriting)

**Table Schema:**
```sql
PRIMARY KEY (wallet_address, token_address)
```

**Update Behavior:**
```sql
-- If position exists: UPDATE
UPDATE positions SET remaining_amount = ..., cost_basis_usd = ..., updated_at = NOW()
WHERE wallet_address = ... AND token_address = ...

-- If position doesn't exist: INSERT
INSERT INTO positions (...) VALUES (...)
```

**What This Means:**
- ✅ **Overwrites** existing positions (one row per wallet/token pair)
- ✅ **Always current** - shows the latest position state
- ✅ **No duplicates** - each wallet can only have ONE position per token
- ⚠️ **No history** - old position values are lost (only current state kept)

**Example:**
- Wallet has 1000 tokens → Position: `remaining_amount = 1000`
- Wallet sells 500 tokens → Position: `remaining_amount = 500` (overwrites previous)
- Old value (1000) is lost, only current value (500) remains

---

### **Wallets Table** - UPDATING (overwriting)

**Table Schema:**
```sql
wallet_address VARCHAR(42) UNIQUE NOT NULL
```

**Update Behavior:**
```sql
-- Update last synced block
UPDATE wallets SET last_synced_block = ..., updated_at = NOW()
WHERE wallet_address = ...
```

**What This Means:**
- ✅ **Overwrites** the `last_synced_block` field
- ✅ **Tracks progress** - only stores the latest synced block number
- ✅ **No duplicates** - one row per wallet
- ⚠️ **No history** - old block numbers are lost

---

## Summary

| Table | Behavior | Grows Over Time? | Can Duplicate? | History Kept? |
|-------|----------|-------------------|----------------|---------------|
| **trades** | APPEND (with dedupe) | ✅ Yes | ❌ No (UNIQUE constraint) | ✅ Yes - full history |
| **positions** | UPDATE (overwrite) | ❌ No (one row per wallet/token) | ❌ No | ❌ No - only current state |
| **wallets** | UPDATE (overwrite) | ❌ No (one row per wallet) | ❌ No | ❌ No - only current state |

---

## What Happens When You Re-Run the Indexer?

### Scenario 1: Full Sync (All Wallets)
1. **Trades**: Checks each transaction, inserts new ones, skips existing ones
   - Result: Database grows, but no duplicates
2. **Positions**: Recalculates from scratch, overwrites existing positions
   - Result: Current positions updated, old values lost
3. **Wallets**: Updates `last_synced_block` to latest
   - Result: Progress tracking updated

### Scenario 2: Incremental Sync (New Blocks Only)
1. **Trades**: Only processes transactions from `last_synced_block` to current
   - Result: Only new trades added (faster)
2. **Positions**: Updates positions based on new trades
   - Result: Positions updated incrementally
3. **Wallets**: Updates `last_synced_block` to new current block
   - Result: Progress tracking updated

---

## Database Growth

**Will it get huge?**
- **Trades table**: Yes, it grows over time (but that's intentional - full history)
- **Positions table**: No, stays small (one row per wallet/token pair)
- **Wallets table**: No, stays small (one row per wallet)

**Example Growth:**
- 1000 wallets
- 10 trades per wallet average
- = ~10,000 trades (grows with each sync if new trades found)
- = ~1000 positions (stays constant)
- = ~1000 wallets (stays constant)

---

## Optimization Notes

1. **Trades table** could get large over time - consider:
   - Partitioning by date (if needed in future)
   - Archiving old trades (if needed)
   - Currently fine for most use cases

2. **Positions table** is efficient - always current, no bloat

3. **Wallets table** is efficient - minimal data per wallet

---

## Conclusion

✅ **Trades**: Append-only (safe, no duplicates, full history)
✅ **Positions**: Update-only (always current, efficient)
✅ **Wallets**: Update-only (progress tracking)

The database is designed to:
- Keep full trade history (trades table grows)
- Keep current positions (positions table stays small)
- Track sync progress (wallets table stays small)

This is the correct design for a PnL indexer!

