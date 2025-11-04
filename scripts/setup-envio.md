# Envio Setup Guide

## Overview
Envio (HyperIndex) is a production-ready multi-chain indexer that streams logs, traces, and transactions directly into Postgres. This is the recommended approach for production indexing.

## Quick Start

### 1. Clone Envio Local Example
```bash
git clone https://github.com/envio-dev/hyperindex-local-docker-example
cd hyperindex-local-docker-example
```

### 2. Configure for Base Mainnet
- Update config to point to Base RPC endpoint
- Configure Postgres connection (can use same Supabase DB)
- Set up event handlers for:
  - ERC20 Transfer events
  - DEX Swap events (Uniswap, etc.)
  - Transaction traces

### 3. Test with Base Testnet First
- Start with Base Sepolia testnet
- Verify Transfer events ingestion
- Verify trace parsing works
- Then switch to mainnet

### 4. Integration with Current System
- Envio streams data to Postgres
- Our existing queries/API routes can read from same DB
- No need to change frontend/API logic

## Key Benefits

1. **Streaming**: Real-time updates instead of batch polling
2. **Traces**: Built-in support for transaction traces
3. **Multi-chain**: Easy to add more chains later
4. **Battle-tested**: Used in production by many projects
5. **No time limits**: Runs as a service, not a serverless function

## Resources

- Envio Docs: https://docs.envio.dev
- HyperIndex Local Example: https://github.com/envio-dev/hyperindex-local-docker-example
- Base Chain Support: Envio supports Base out of the box

## Next Steps

1. Set up Envio locally
2. Configure for BadTraders token tracking
3. Migrate from Alchemy API calls to Envio streaming
4. Deploy Envio as a separate service (Railway, Render, etc.)

