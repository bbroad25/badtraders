# Indexer Implementation Plan

## Overview
This plan implements the advanced indexer improvements from `INDEXER_IMPROVEMENTS.md`. The indexer will run **locally only** (git ignored) and write to the same production database, allowing the website to read the indexed data.

## Architecture

```
┌─────────────────┐
│  Local Indexer  │  (Runs locally, git ignored)
│  - Envio        │  → Streams to Supabase Postgres
│  - Trace Parser │
│  - Price Oracle │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB     │  (Production database)
│  - trades       │  ← Read by production website
│  - positions    │
│  - wallets      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vercel Website │  (Production)
│  - Reads data   │  ← No indexing, just reads
│  - API routes   │
└─────────────────┘
```

## Implementation Phases

### Phase 1: Local Development Setup (Week 1)

#### 1.1 Create Local Indexer Directory (Git Ignored)
- Create `indexer-local/` directory
- Add to `.gitignore`
- Set up separate Node.js project for local indexer

#### 1.2 Database Schema Updates
- Add new columns to `trades` table:
  - `price_source` (VARCHAR)
  - `price_confidence` (FLOAT)
  - `trace_data` (JSONB)
- Create migration script

#### 1.3 Trace Parser Implementation
- Create `lib/services/traceParser.ts`
- Implement `trace_transaction` RPC calls
- Extract exact token amounts from traces
- Handle routed swaps (0x, 1inch, aggregators)

### Phase 2: Envio Integration (Week 2)

#### 2.1 Envio Setup
- Clone Envio local example
- Configure for Base mainnet
- Set up Docker compose
- Test with Base testnet first

#### 2.2 Event Handlers
- Configure Transfer event handlers
- Configure Swap event handlers (Uniswap, etc.)
- Configure trace handlers
- Map events to database schema

#### 2.3 Integration Testing
- Test event ingestion
- Verify trace parsing
- Test with real Base transactions

### Phase 3: Price Resolution (Week 3)

#### 3.1 Chainlink Oracle Integration
- Check Chainlink feeds on Base
- Create `lib/services/chainlinkOracle.ts`
- Use Chainlink as authoritative source when available

#### 3.2 DEX Pool State Reading
- Install `univ3prices` library
- Read Uniswap v3 pool ticks/sqrtPrice
- Calculate price from pool state
- Create `lib/services/poolPriceService.ts`

#### 3.3 Price Confidence Scoring
- Cross-check Chainlink vs DEX vs swap-derived
- Calculate confidence score (0-1)
- Store source and confidence in database

### Phase 4: Production Integration (Week 4)

#### 4.1 Local Indexer Production
- Set up local indexer to run continuously
- Configure to write to production Supabase
- Add monitoring/logging

#### 4.2 Website Updates
- Update API routes to read new columns
- Filter by price confidence if needed
- Display price source in UI

#### 4.3 Migration Path
- Keep old indexer code as fallback
- Gradually migrate to new indexer
- Monitor for issues

## File Structure

```
badtraders/
├── indexer-local/              # Git ignored - local indexer
│   ├── .gitignore
│   ├── package.json
│   ├── docker-compose.yml      # Envio setup
│   ├── envio.config.ts         # Envio configuration
│   ├── src/
│   │   ├── handlers/           # Event handlers
│   │   ├── services/
│   │   │   ├── traceParser.ts
│   │   │   ├── chainlinkOracle.ts
│   │   │   ├── poolPriceService.ts
│   │   │   └── priceConfidence.ts
│   │   └── index.ts            # Main entry point
│   └── README.md
├── migrations/
│   └── 004_add_price_metadata.sql
├── lib/services/               # Shared services (can be used by both)
│   └── traceParser.ts          # (if shared between local and web)
└── .gitignore                  # Add indexer-local/
```

## Database Schema Updates

```sql
-- Migration: 004_add_price_metadata.sql
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS price_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS price_confidence FLOAT,
  ADD COLUMN IF NOT EXISTS trace_data JSONB;

-- Add index for price_source
CREATE INDEX IF NOT EXISTS idx_trades_price_source ON trades(price_source);

-- Add index for price_confidence (for filtering)
CREATE INDEX IF NOT EXISTS idx_trades_price_confidence ON trades(price_confidence);

-- Update existing rows (optional)
UPDATE trades SET price_source = 'swap_derived' WHERE price_source IS NULL;
UPDATE trades SET price_confidence = 0.7 WHERE price_confidence IS NULL;
```

## Environment Variables

### Local Indexer (.env.local - git ignored)
```env
# Database (Production Supabase)
DATABASE_URL=postgresql://...

# Alchemy/Envio
ALCHEMY_API_KEY=...
ENVIO_API_KEY=...

# Chainlink
CHAINLINK_BASE_MAINNET=...

# Base Network
BASE_RPC_URL=https://mainnet.base.org
BASE_CHAIN_ID=8453
```

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `indexer-local/` directory
- [ ] Add to `.gitignore`
- [ ] Create migration `004_add_price_metadata.sql`
- [ ] Implement `traceParser.ts`
- [ ] Test trace parsing with real transactions

### Phase 2: Envio
- [ ] Clone Envio local example
- [ ] Configure for Base mainnet
- [ ] Set up event handlers
- [ ] Test event ingestion
- [ ] Integrate trace parsing

### Phase 3: Price Resolution
- [ ] Research Chainlink feeds on Base
- [ ] Implement Chainlink oracle service
- [ ] Install and configure `univ3prices`
- [ ] Implement pool price reading
- [ ] Implement price confidence scoring

### Phase 4: Production
- [ ] Set up local indexer to run continuously
- [ ] Configure production database connection
- [ ] Update website API routes
- [ ] Test end-to-end
- [ ] Monitor and iterate

## Testing Strategy

1. **Local Testing**: Test with Base testnet first
2. **Small Batch**: Test with small number of transactions
3. **Validation**: Compare old vs new indexer results
4. **Production**: Gradually roll out to production

## Rollback Plan

- Keep old indexer code as fallback
- Can switch back to old API if issues arise
- Database changes are additive (no breaking changes)

## Next Steps

1. Start with Phase 1: Create local indexer structure
2. Implement trace parser first (most critical)
3. Then move to Envio integration
4. Finally add price resolution

