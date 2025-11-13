# User-Generated Indexing System

## Overview

Instead of using expensive BitQuery to index all wallets, users generate their own index by signing a message when they enter a weekly contest. This approach:

- ✅ **Cost-effective**: Uses free Alchemy RPC calls instead of BitQuery
- ✅ **On-demand**: Only indexes what's needed, when it's needed
- ✅ **User-controlled**: Users opt-in by signing a message
- ✅ **Scalable**: Each user indexes their own wallet

## How It Works

### Flow

1. **User opens app** → Selects token for weekly contest
2. **User signs message** → Proves wallet ownership, authorizes indexing
3. **Backend indexes** → Fetches user's transactions for that token
4. **PnL calculated** → Stored in database
5. **Leaderboard updated** → User sees their position and others

### Technical Approach

**Instead of BitQuery:**
- Use Alchemy's `eth_getLogs` (free tier: 300M compute units/month)
- Query Uniswap V3 Swap events directly
- Parse transaction traces for Universal Router swaps
- Calculate PnL using FIFO accounting

**Benefits:**
- Free tier covers ~1000-2000 wallets/month
- Direct blockchain queries (no third-party dependency)
- Real-time indexing when user registers
- Can cache results to avoid re-indexing

## Implementation Plan

### 1. Database Schema

```sql
-- Weekly contests
CREATE TABLE weekly_contests (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contest registrations (with signed messages)
CREATE TABLE contest_registrations (
  id SERIAL PRIMARY KEY,
  contest_id INTEGER REFERENCES weekly_contests(id),
  wallet_address TEXT NOT NULL,
  fid INTEGER, -- Farcaster ID if available
  signed_message TEXT NOT NULL, -- EIP-191 signed message
  message_hash TEXT NOT NULL, -- Hash of the message
  indexed_at TIMESTAMP, -- When indexing completed
  pnl_calculated_at TIMESTAMP, -- When PnL was calculated
  current_pnl NUMERIC, -- Current PnL for this contest
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contest_id, wallet_address)
);

-- User-specific trades (indexed on-demand)
CREATE TABLE user_trades (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER REFERENCES contest_registrations(id),
  wallet_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  trade_type TEXT NOT NULL, -- 'buy' or 'sell'
  amount_in NUMERIC NOT NULL,
  amount_out NUMERIC NOT NULL,
  token_in_address TEXT,
  token_out_address TEXT,
  price_usd NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tx_hash, wallet_address, token_address)
);
```

### 2. Message Signing

**Message Format:**
```
I authorize BadTraders to index my wallet ${walletAddress} for token ${tokenAddress} in contest ${contestId}. Timestamp: ${timestamp}
```

**Verification:**
- Use `ethers.utils.verifyMessage()` to verify signature
- Check message matches expected format
- Prevent replay attacks with timestamp/nonce

### 3. Indexing Service

**New Service: `userIndexerService.ts`**

Uses:
- Alchemy `eth_getLogs` to fetch Swap events
- Transaction traces for Universal Router swaps
- FIFO accounting for PnL calculation
- Caching to avoid re-indexing same data

**Key Functions:**
- `indexUserWalletForToken(walletAddress, tokenAddress, contestId)`
- `fetchSwapEvents(walletAddress, tokenAddress, fromBlock, toBlock)`
- `parseSwapTransaction(txHash, walletAddress)`
- `calculateUserPnL(registrationId)`

### 4. API Endpoints

**POST `/api/contests/register`**
- User signs message
- Verify signature
- Create registration
- Trigger indexing (async)
- Return registration status

**GET `/api/contests/:contestId/leaderboard`**
- Get all registrations for contest
- Return sorted by PnL (worst first)

**GET `/api/contests/:contestId/my-position`**
- Get user's registration
- Return their PnL and rank

**POST `/api/contests/:contestId/reindex`**
- Re-index user's wallet (if they want to update)
- Requires new signed message

### 5. Frontend Integration

**Contest Entry Flow:**
1. User selects token from dropdown
2. Frontend generates message
3. User signs with wallet
4. Send to `/api/contests/register`
5. Show "Indexing..." status
6. Poll for completion
7. Show PnL and leaderboard

## Comparison: BitQuery vs User-Generated Indexing

| Feature | BitQuery (Current) | User-Generated (New) |
|---------|-------------------|---------------------|
| **Use Case** | General leaderboard, discovery | Weekly contests |
| **Cost** | $$$ (per query) | Free (Alchemy free tier) |
| **Coverage** | All wallets automatically | Only opt-in users |
| **Data Source** | BitQuery API | Direct blockchain (Alchemy) |
| **When** | Continuous background sync | On-demand when user registers |
| **Privacy** | All wallets indexed | User-controlled opt-in |
| **Best For** | Admin tools, analytics | Contest participation |

**Both systems can coexist:**
- BitQuery for general leaderboard (all traders)
- User-generated for contests (opt-in participants)

## Cost Analysis

**Alchemy Free Tier:**
- 300M compute units/month
- `eth_getLogs` = ~10K compute units per call
- Can index ~30,000 queries/month
- Enough for ~1000-2000 users (assuming 15-30 queries per user)

**If you exceed free tier:**
- Pay-as-you-go: $0.0001 per 1M compute units
- Still much cheaper than BitQuery

## Security Considerations

1. **Message Signing**: Prevents unauthorized indexing
2. **Replay Protection**: Timestamp/nonce in message
3. **Rate Limiting**: Prevent abuse of indexing endpoint
4. **Validation**: Verify wallet owns the address
5. **Caching**: Don't re-index unnecessarily

## Coexistence with Current System

**This system runs alongside the existing BitQuery-based indexer:**

- **BitQuery Indexer**: Continues to run for general leaderboard, discovery, and admin features
- **User-Generated Indexer**: Used specifically for weekly contests when users opt-in

**Why Both?**

- BitQuery: Good for discovering all traders, general analytics, admin tools
- User-Generated: Cost-effective for contests, user-controlled, on-demand

**Data Sources:**

- **General Leaderboard**: Uses BitQuery data (all wallets)
- **Weekly Contests**: Uses user-generated index (opt-in users only)
- **User Dashboard**: Can show both (general stats from BitQuery, contest stats from user index)

## Implementation Notes

**This system complements the existing BitQuery indexer:**

- Existing leaderboard continues to use BitQuery data
- Weekly contests use user-generated indexing
- Users can see both:
  - General leaderboard (all traders, from BitQuery)
  - Contest leaderboard (participants only, from user index)

**Database:**
- Existing `trades` table: BitQuery data (all wallets)
- New `user_trades` table: User-generated data (contest participants)
- Both can coexist without conflicts

## Next Steps

1. Create database migrations (add new tables, keep existing)
2. Implement message signing/verification
3. Build user indexer service (alongside existing indexer)
4. Create API endpoints for contests
5. Build frontend contest entry UI
6. Test with small group
7. Roll out alongside existing system

