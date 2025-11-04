# BadTraders Local Indexer

This is a **local-only** indexer that runs separately from the production website. It uses advanced indexing techniques and writes to the same Supabase database that the production website reads from.

## Architecture

```
Local Indexer (this directory)
    ↓
    Writes to Supabase Postgres
    ↓
Production Website (Vercel)
    Reads from Supabase Postgres
```

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
Create `.env` file:
```env
DATABASE_URL=postgresql://...  # Your Supabase connection string
ALCHEMY_API_KEY=...            # For trace parsing
BASE_RPC_URL=https://mainnet.base.org
BASE_CHAIN_ID=8453
```

3. **Run:**
```bash
npm run dev    # Development mode with watch
npm start      # Production mode
```

## Features (In Progress)

- ✅ Database connection
- ✅ Transaction trace parsing
- ⏳ Envio integration
- ⏳ Chainlink oracle support
- ⏳ DEX pool state reading
- ⏳ Price confidence scoring

## Status

This is a work in progress. See `INDEXER_IMPLEMENTATION_PLAN.md` in the root directory for the full roadmap.

## Note

This directory is **git ignored** - it's for local development only. The production website doesn't need this code.

