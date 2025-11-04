Cost-first answer:

Alchemy only = cheapest (you already pay, no extra vendor)
But requires building your own swap decoding logic.

Covalent = faster dev, easier decoding, costs extra

Hybrid = lowest paid cost if you only use Covalent for swap decode of tx hashes you already identified via Alchemy

Dune = cheap if you stay within free API tier, but slower + rate limits

Since you want lightweight + no real-time + small scope, your choices reduce to:

Alchemy-only

Alchemy + Covalent hybrid

Either one is valid.
Alchemy-only = more engineering time, no added cost.
Hybrid = tiny cost, easier life, faster to ship.

Below is the full technical plan definition.
This is formatted for you to drop into your agent system / IDE LLM.

PnL Tracking System Plan (Base Chain, Farcaster Mini-App)
Objective

Track PnL for registered wallets across selected tokens on Base, over a rolling 7–30-day window, without running a full indexer or real-time pipeline.

Constraints

Polling only (no webhooks)

Lightweight footprint

Only track:

registered wallets

pre-selected tokens

Update frequency: 1–6 hours

FIFO accounting for PnL

Store minimal trade rows (no full chain logs)

Data Sources
Purpose	Source
Wallet tx fetch	Alchemy
Swap decoding	Alchemy logs OR Covalent decode endpoint
Token price at timestamp	Dexscreener API (primary), fallback 0x API
Database (Supabase)
Tables

wallets

id (pk)
wallet_address
last_synced_block


tracked_tokens

token_address
symbol
decimals


trades

id (pk)
wallet_address
token_address
tx_hash
block_number
timestamp
side ("BUY" or "SELL")
token_amount
price_usd
usd_value
parsed_source ("alchemy" | "covalent")


positions

wallet_address
token_address
remaining_amount
cost_basis_usd
realized_pnl_usd
updated_at

Processing Loop (Polling)

Every X hours (1–6):

For each wallet:

cursor = wallet.last_synced_block

tx_list = alchemy.get_transactions(wallet, since=cursor)

for tx in tx_list:
    if tx involves token in tracked list:
        if using Alchemy-only:
            decode swap events from logs via ABI
        else if using hybrid:
            call Covalent decode for this tx hash

        extract:
          side = BUY or SELL
          token_amount
          timestamp
          token_price = getPriceAtTimestamp(token, timestamp)
          update FIFO cost basis + PnL

        insert row into trades
        update positions table

update wallet.last_synced_block = latest block seen

FIFO Accounting Logic (Summary)
for SELL event:
  iterate FIFO lots oldest→newest
  apply cost removal
  realized_pnl += (sell_price * amount) - cost

for BUY event:
  append FIFO lot:
    amount, price, cost


Recalculate unrealized PnL on read:

current_value = remaining_amount * current_price
unrealized_pnl = current_value - cost_basis

Update Strategy

Only process new transactions

Never rescan chain

Limit lookback to last 30 days

Store cursor block per wallet

Options Summary
Option A: Alchemy Only (cheapest)

RPC for tx list + logs

Manual swap decode (Router ABI + Transfer logs)

Free (aside from existing plan)

More dev work

Option B: Hybrid (recommended practical)

Use Alchemy to detect wallet txs

Only call Covalent for suspected swap txs

Saves API calls and dev time

Option C: Covalent Only (not recommended)

Easy, but wastes your existing Alchemy infra

More paid calls

Edge Rules

Ignore a tx if no tracked token appears

Handle only ERC-20 swaps (no LP positions for now)

Cache recent prices to avoid repeated lookups

Only update PnL on token balance changes not raw ETH

Deployment Notes

One cron job (serverless or Supabase cron)

Lambda-style worker to poll + compute FIFO

Supabase as persistent source of truth

Query positions for mini-app UI

Output Responses Needed by UI

For each wallet × token:

current_balance
avg_cost_basis
realized_pnl
unrealized_pnl
total_pnl
holding_period
last_update


That is your complete system blueprint.
You can now feed this to your LLM in the IDE and say:

implement the Base-chain PnL tracker defined above, Option B (hybrid Alchemy + Covalent), using Supabase, Node, and cron polling every 3 hours.

If you want, next I can generate:

Supabase schema migrations

TypeScript service scaffold

Cron worker entrypoint

Swap decoding helper

Unit test outline for FIFO engine

Tell me which artifact you want first.
