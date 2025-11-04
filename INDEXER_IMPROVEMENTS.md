# Indexer Improvements & Best Practices

## Current Implementation Status

### ✅ What We're Doing
- **Basic indexing**: Using Alchemy API to fetch ERC20 transfers
- **Swap detection**: Detecting swaps from Transfer events only
- **Price calculation**: Calculating from swap amounts (ETH amount / token amount)
- **Historical prices**: Using CoinGecko for historical ETH prices
- **FIFO accounting**: Tracking positions and PnL
- **Sync modes**: Full, incremental, single wallet

### ❌ Critical Gaps (Best Practices)

1. **Envio/HyperIndex**: Currently using direct Alchemy API calls
   - **Should use**: Envio or HyperIndex for streaming logs/traces into Postgres
   - **Benefit**: Faster, more reliable, multi-chain support, battle-tested
   - **Resources**: https://github.com/envio-dev/hyperindex-local-docker-example

2. **Transaction Traces**: Only using Transfer events
   - **Should use**: Transaction traces (call logs) to get exact swap calldata
   - **Benefit**: More accurate amountIn/amountOut, detect multi-step routed swaps
   - **Critical**: Transfer events alone misattribute amounts in routed swaps (0x, 1inch, aggregators)
   - **Resources**: Use RPC `trace_transaction` or Envio's HyperSync

3. **Chainlink Oracles**: Using CoinGecko/Dexscreener
   - **Should use**: Chainlink price feeds on Base (when available)
   - **Benefit**: On-chain, decentralized, real-time prices
   - **Resources**: https://docs.base.org/docs/developers/oracles/chainlink/

4. **DEX Pool State**: Not reading pool state
   - **Should use**: Read Uniswap v3 pool sqrtPrice/tick or recent swap events
   - **Should use**: `univ3prices` library instead of ad-hoc math
   - **Benefit**: More accurate pricing from actual DEX state, avoid arithmetic bugs
   - **Resources**: https://github.com/Uniswap/v3-subgraph, univ3prices library

5. **Price Confidence**: No validation/cross-checking
   - **Should add**: Cross-check oracle vs DEX price, store confidence flag and source
   - **Benefit**: Know which prices are reliable, reconcile conflicts

6. **Decimal Handling**: May have off-by-power-of-10 errors
   - **Should add**: Always normalize by decimals from token contract
   - **Benefit**: Avoid decimal errors

## Recommended Implementation Roadmap

### Phase 1: Foundation (Do Now)
1. ✅ Add sync modes (full, incremental, single wallet) - **DONE**
2. ✅ Add batch size controls - **DONE**
3. **Spike Envio**: Spin up Envio local-docker-example to index Base blocks
   - Verify ingestion of Transfer events and traces
   - Test with Base testnet/mainnet
   - **Action**: Create `scripts/setup-envio.md` with setup steps

4. **Trace Parsing**: Add transaction trace support
   - Use `trace_transaction` RPC calls or Envio traces
   - Extract exact token in/out amounts from traces
   - Handle routed swaps (0x, 1inch, Uniswap Router)
   - **Action**: Create `lib/services/traceParser.ts`

### Phase 2: Infrastructure Migration
1. **Migrate to Envio/HyperIndex**
   - Replace Alchemy API calls with Envio streaming
   - Configure for Base mainnet
   - Set up Postgres schema for Envio events
   - **Resources**: https://github.com/envio-dev/hyperindex-local-docker-example

2. **DEX Pool Tracking**
   - Add indexer config for DEX pool contracts (factory → Pool events)
   - Track Swap/Mint/Burn events from pools
   - Use Uniswap v3 price helpers for tick/sqrtPrice → price
   - **Resources**: https://github.com/envio-dev/hyperindex (Uniswap examples)

3. **Chainlink Oracle Integration**
   - Check if Chainlink feed exists for token pairs on Base
   - Use Chainlink as authoritative price when available
   - Store price source (Chainlink / pool derived / swap-derived)
   - **Resources**: https://docs.base.org/docs/developers/oracles/chainlink/

### Phase 3: Advanced Features
1. **Price Confidence Scoring**
   - Cross-check oracle vs DEX price vs swap-derived price
   - Store confidence metric and source for each price
   - Reconcile conflicts over time
   - Add `price_confidence` and `price_source` columns to trades table

2. **Multi-step Swap Detection**
   - Parse traces to detect routed swaps
   - Attribute amounts correctly through aggregators
   - Handle contract wrappers (0x, 1inch, routers)
   - **Resources**: mev-inspect-py/js for reference patterns

3. **Database Schema Improvements**
   - Add `price_source` enum (chainlink, pool_derived, swap_derived)
   - Add `price_confidence` float (0-1)
   - Add `trace_data` JSONB for storing parsed trace information
   - Normalize decimals in all calculations

## Reference Repositories

### High-Value Repos to Explore
1. **Envio/HyperIndex**: https://github.com/envio-dev/hyperindex-local-docker-example
   - Production-ready multi-chain indexer
   - Docker examples for Base
   - Perfect starting point

2. **Envio DEX Examples**: https://github.com/envio-dev/hyperindex (Uniswap v4, Velodrome)
   - Example indexers showing pool events → analytics
   - Good pattern code for mapping events

3. **Blockscout**: https://github.com/blockscout/blockscout
   - Full open-source block explorer
   - Useful for reference implementations of trace parsing

4. **MEV Inspect**: https://github.com/flashbots/mev-inspect-py
   - Parses blocks/traces, extracts swaps/arbs
   - Stores in Postgres
   - Good model for parsing traces into canonical events

5. **Uniswap Price Helpers**: https://github.com/Uniswap/v3-subgraph
   - univ3prices library for reliable tick/sqrtPrice calculations
   - Avoid arithmetic bugs

6. **TheGraph Subgraph Examples**: https://thegraph.com/docs/en/developing/creating-a-subgraph/
   - GraphQL-subgraph indexing on Base
   - Good for queryable analytics layers

## Specific Concrete Steps (Do Now)

### Step 1: Envio Setup
```bash
# Clone Envio local example
git clone https://github.com/envio-dev/hyperindex-local-docker-example
cd hyperindex-local-docker-example

# Configure for Base mainnet
# Test with Base testnet first
# Verify Transfer events and traces ingestion
```

### Step 2: Add Trace Parser
- Create `lib/services/traceParser.ts`
- Use `trace_transaction` RPC calls
- Extract exact token in/out amounts
- Handle decimal normalization

### Step 3: Add Chainlink Price Feeds
- Check Chainlink feeds on Base for tracked tokens
- Integrate Chainlink price reading
- Use as authoritative source when available

### Step 4: Add Uniswap Pool State Reading
- Use `univ3prices` library
- Read pool ticks/sqrtPrice
- Calculate price from pool state

### Step 5: Database Schema Updates
```sql
-- Add price source tracking
ALTER TABLE trades ADD COLUMN price_source VARCHAR(20);
ALTER TABLE trades ADD COLUMN price_confidence FLOAT;
ALTER TABLE trades ADD COLUMN trace_data JSONB;

-- Add index for price_source
CREATE INDEX idx_trades_price_source ON trades(price_source);
```

## Notes & Pitfalls

⚠️ **Traces are necessary**: Transfer events alone will misattribute amounts in routed swaps, aggregator trades, and contract wrappers. Always use traces.

⚠️ **Decimals**: Always normalize by decimals from token contract to avoid off-by-power-of-10 errors.

⚠️ **Price Confidence**: Store price source and confidence metric. Reconcile conflicts over time.

⚠️ **Arithmetic Bugs**: Use proven libraries (univ3prices) instead of reimplementing pool math.

