# Bitquery Indexer Redesign Blueprint

This document captures the concrete changes required to harden the Bitquery-backed indexer and prepare it for chart-quality analytics. It expands on the existing `INDEXERGUIDE.md` with specific schema, ingestion, and operations updates that we can now execute.

---

## 1. Database Schema Upgrades

### 1.1 `swap_transactions` (new)
Stores transaction-level aggregates and metadata.

- `id` `bigserial` primary key
- `tx_hash` `varchar(66)` unique (lowercase)
- `block_number` `bigint` + `block_time` `timestamptz`
- `source` `varchar(20)` (`bitquery`, `alchemy`, etc.)
- `protocol_name` `varchar(120)` nullable
- `wallet_initiator` `varchar(42)` nullable (tx sender)
- Aggregates: `net_token_in`/`net_token_out` (JSONB keyed by token), `net_usd_value` `numeric(38,12)`
- Auditing: `legs_count`, `created_at`, `updated_at`

### 1.2 `trade_legs` (new)
Represents each Bitquery leg (buy/sell pair) and links back to `swap_transactions`.

- `id` `bigserial` primary key
- `transaction_id` `bigint` FK → `swap_transactions.id`
- `leg_index` `integer` (Bitquery `Sequence` or our incremental order)
- `protocol_name`, `route_hint` (varchar)
- `side` `varchar(4)` (`BUY` / `SELL`) from tracked wallet perspective
- `wallet_address` `varchar(42)` (extracted buyer/seller)
- `token_in_address`, `token_out_address` `varchar(42)`
- `amount_in`, `amount_out` `numeric(78,0)`
- `token_in_decimals`, `token_out_decimals` `smallint`
- `usd_value` `numeric(38,12)` (base token USD for side)
- `price_usd` `numeric(38,12)`
- `is_protocol_fee` `boolean` default `false`
- `raw_payload` `jsonb` (full Bitquery leg for auditing/debug)
- Indexes:
  - `idx_trade_legs_tx_leg` on (`transaction_id`, `leg_index`)
  - `idx_trade_legs_wallet_token_time` on (`wallet_address`, `token_out_address`, `transaction_id`)

### 1.3 `trades` alignment

- Add `transaction_id` FK so existing downstream code can pivot from leg data.
- Relax the current unique constraint: change to `UNIQUE(transaction_id, wallet_address, token_address, side)` to allow multiple legs per hash when wallets differ.
- Expand `parsed_source` constraint (already includes `bitquery` via migration 011).

### 1.4 `indexer_runs` (new)
Tracks every indexed run to support guardrails and cost monitoring.

- `id` `bigserial`
- `started_at`, `finished_at`
- `initiator` (api key / user id / cron)
- `sync_type` (`full`, `incremental`, `token-only`)
- `tokens_scanned` `integer`, `bitquery_pages` `integer`, `bitquery_calls` `integer`
- `status` (`running`, `succeeded`, `failed`, `aborted`)
- `error_message` `text` nullable
- `credits_spent_estimate` `numeric(20,4)` nullable

### 1.5 Migration Notes

- Create migration `012_trade_legs.sql` implementing the tables + FK updates.
- Backfill: populate `swap_transactions` & `trade_legs` from existing `trades` once ingestion is refactored (one-time job).
- Adjust TypeORM/SQL triggers if any automatic timestamp updates are required (current setup uses raw SQL, so explicit triggers may not be necessary).

---

## 2. Bitquery Ingestion Refactor

### 2.1 Fetch Layer (`bitqueryService.ts`)

- Maintain `Map<tx_hash, BitqueryDEXTrade[]>` instead of overwriting with the last leg.
- Include Bitquery sequence/order fields in the GraphQL query (`Transaction.Position`, `Trade.TradeIndex` if available).
- Return grouped data: `Record<string, BitqueryDEXTrade[]>`.

### 2.2 Transformation (`swapProcessor.ts`)

- For each transaction group:
  1. Determine tracked wallet(s) using both buyer/seller fields for each leg.
  2. Flag legs that appear to be protocol fee transfers (`minUsdValue`, `protocolName`, repeated addresses) and mark them rather than drop them.
  3. Insert a `swap_transactions` row once per tx and `trade_legs` rows per leg.
  4. Derive or update consolidated `trades` rows for FIFO by summing legs per wallet-side.
- Ensure FIFO accounting consumes leg-level data (still aggregated to wallet-level sells/buys).

### 2.3 Performance & Cost Controls

- Batch inserts using `pg` parameter arrays to reduce round-trips.
- Add per-token paging limit guards (stop after N empty pages, track highest block as already implemented).
- Add instrumentation to write `bitquery_pages` and `bitquery_calls` into `indexer_runs`.

---

## 3. Run Guardrails & Controls

### 3.1 Authentication

- Require both `CRON_SECRET` and `SYNC_PASSWORD` for manual triggers unless `NODE_ENV=production` cron job is calling.
- Add role-based allow list (simple: environment var of comma-separated wallet addresses or user IDs allowed to POST to `/api/indexer/sync`).

### 3.2 Feature Flag

- Introduce `ENABLE_BITQUERY_SYNC=false` by default. Routes exit early with `403` unless flag is true.
- Optional secondary flag `BITQUERY_WRITE_MODE` to allow dry-runs (`fetch grouped data but do not write to DB`).

### 3.3 Run Logging

- Insert into `indexer_runs` on entry; update row on completion/failure.
- Surface latest run status via `/api/indexer/status` (existing metrics service can hydrate from DB instead of in-memory only).
- Emit structured logs with run id + Bitquery pagination stats to help correlate with credit consumption.

---

## 4. Chart-Ready Aggregations

### 4.1 Time-Series Layers

- `materialized view trade_leg_intervals_5m` grouped by token, 5-minute buckets.
- Additional 1h / 1d views as needed for UI.
- Compute net token volume, net USD, unique wallets per interval.

### 4.2 Wallet Analytics

- Background job to aggregate per-wallet holdings using `trade_legs` and `positions`.
- Store snapshots in `wallet_portfolios` table (wallet, token, quantity, cost basis, last_update).

### 4.3 Job Scheduling

- Use Supabase cron (or Vercel cron hitting an API) to:
  - Run Bitquery sync (still manual until costs are acceptable).
  - Refresh materialized views (`REFRESH MATERIALIZED VIEW CONCURRENTLY`).
  - Recompute portfolio snapshots.

### 4.4 API Surface

- Extend `/api/indexer/stats` to pull from materialized views instead of raw `trades`.
- Add `/api/chart/tokens/[token]/candles` returning aggregated intervals.

---

## 5. Implementation Order

1. Land migration `012_trade_legs.sql` + update database client types.
2. Refactor Bitquery ingestion & swap processor to populate new tables (dry-run mode first).
3. Hook FIFO + leaderboard queries to `trade_legs` data.
4. Add guardrails (`ENABLE_BITQUERY_SYNC`, run logging).
5. Layer on charting materialized views and API endpoints.

This blueprint keeps Bitquery usage deliberate, captures every swap leg for future analytics, and lays the groundwork for an eventual move toward an Alchemy-first ingestion pipeline.

