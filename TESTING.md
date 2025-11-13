# Indexer Testing Guide

This document explains how to use the testing infrastructure for the indexer system. All tests are located in the `tests/` directory (inside `badtraders/` folder).

## Quick Start

```bash
# Navigate to badtraders directory
cd badtraders

# Install dependencies (if not already installed)
npm install

# Run all tests
npm run test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run incremental tests
npm run test:incremental incremental
```

## Testing Workflow

Before running a full sync, follow this workflow to catch issues early:

### 1. Run Unit Tests First
```bash
npm run test tests/unit/
```
This verifies core functions (swap detection, price calculation, FIFO accounting, token sync) work correctly.

### 2. Test Token Sync
Test the new token-first sync approach:
```bash
npm run test tests/integration/token-sync.test.ts
```
This verifies tokens are synced correctly and swaps are processed directly from token transfers.

### 3. Test Known Transactions
Add known transaction hashes to `tests/fixtures/transactions.ts`, then:
```bash
npm run test:incremental known-tx
```
This verifies the indexer correctly processes real transactions from Basescan.

### 4. Test Single Wallet
Before syncing all wallets, test one wallet:
```bash
npm run test:incremental single-wallet <wallet_address>
```
This syncs a single wallet and verifies trades/positions are created correctly.

### 5. Test Single Token
Test syncing a specific token (token-first approach):
```bash
npm run test:incremental single-token <token_address>
```
This syncs token transfers and processes swaps directly.

### 6. Test Random Transaction
Test a specific transaction hash:
```bash
npm run test:incremental random-tx <transaction_hash>
```
This fetches and analyzes a transaction to verify swap detection works.

### 7. Run Full Sync
Only after all tests pass, run the full sync:
```bash
# Via UI: Go to /indexer page and click "Sync"
# Or via API: POST /api/indexer/sync
```

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual functions
│   ├── swapDecoder.test.ts
│   ├── priceCalculator.test.ts
│   ├── fifoAccounting.test.ts
│   └── indexerService.test.ts  # Token-first sync tests
├── integration/             # Integration tests with real data
│   ├── known-transactions.test.ts
│   ├── edge-cases.test.ts
│   └── token-sync.test.ts      # Token-first sync integration tests
├── fixtures/                # Test data and fixtures
│   ├── transactions.ts     # Known transaction hashes
│   ├── receipts.ts         # Mock receipt builders
│   └── prices.ts           # Mock price data
├── utils/                   # Test utilities
│   ├── test-helpers.ts     # Common helpers
│   ├── mock-provider.ts    # Mock blockchain provider
│   ├── db-helpers.ts       # Database helpers
│   ├── incremental-test.ts # Incremental testing
│   └── verify.ts           # Verification utilities
└── e2e/                    # End-to-end tests (future)
```

## Adding Known Transactions

To test with real transactions, add them to `tests/fixtures/transactions.ts`:

```typescript
export const KNOWN_SWAPS: KnownSwap[] = [
  {
    txHash: '0xYourTransactionHashHere', // Transaction hash from Basescan
    description: 'BadTrader token swap - Example transaction',
    expectedTokenIn: WETH_ADDRESS, // Or USDC_ADDRESS
    expectedTokenOut: BADTRADER_TOKEN_ADDRESS,
    expectedAmountIn: '1000000000000000000', // In wei (18 decimals)
    expectedAmountOut: '10000000000000000000000', // Token amount
    expectedPrice: 0.0001, // USD price per token (optional)
    walletAddress: '0xYourWalletAddressHere', // Wallet that made the swap
    blockNumber: 12345678, // Optional: block number
    timestamp: 1234567890 // Optional: Unix timestamp
  }
]
```

### How to Find Transaction Hashes

1. Go to [Basescan](https://basescan.org)
2. Search for a token address (e.g., BadTrader token)
3. Click on "Holders" or "Transactions" tab
4. Find a swap transaction
5. Copy the transaction hash
6. Click on the transaction to see details:
   - Token addresses swapped
   - Amounts
   - Wallet address
   - Block number
7. Add to `KNOWN_SWAPS` array with expected values

## Common Test Scenarios

### Test Token Sync
```bash
npm run test tests/unit/indexerService.test.ts
```

### Test Swap Detection
```bash
npm run test:incremental random-tx 0x<transaction_hash>
```

### Test Price Calculation
Run the integration test:
```bash
npm run test tests/integration/known-transactions.test.ts
```

### Test FIFO Accounting
Run the unit test:
```bash
npm run test tests/unit/fifoAccounting.test.ts
```

### Test Single Wallet End-to-End
```bash
npm run test:incremental single-wallet 0x<wallet_address>
```

## Verification

The test suite includes verification utilities to check:

- **Price Accuracy**: Compares calculated prices with external sources (DexScreener)
- **Swap Detection**: Verifies swaps are detected correctly
- **Token Decimals**: Verifies decimals match contract values
- **Data Consistency**: Verifies trades and positions are created correctly
- **Token Sync Efficiency**: Verifies token-first sync uses fewer API calls

## Troubleshooting

### Tests Fail with "Module not found"
Make sure all dependencies are installed:
```bash
npm install
```

### Database Errors
Ensure database migrations are run and tables exist:
```bash
# Check migrations in migrations/ directory
# Run migration 006_add_token_sync_tracking.sql to add last_synced_block column
```

### API Rate Limits
Tests use real API calls. If you hit rate limits:
- Add delays between test cases
- Use mock providers for unit tests
- Run tests sequentially instead of in parallel

### Transaction Not Found
If a transaction hash doesn't exist or isn't accessible:
- Verify the transaction hash is correct
- Check if the transaction is on Base network
- Ensure RPC providers are configured correctly

## Best Practices

1. **Always run unit tests first** - They're fast and catch basic issues
2. **Test token sync separately** - Verify token-first sync works before full sync
3. **Add known transactions** - Test with real data from Basescan
4. **Test incrementally** - Test single wallets/tokens before full syncs
5. **Verify results** - Use verification utilities to check accuracy
6. **Check logs** - Review test output for warnings and errors
7. **Test edge cases** - Test with zero amounts, invalid addresses, etc.
8. **Clean test output** - Expected warnings are suppressed in tests for cleaner output
9. **Test token-first efficiency** - Compare API call counts before/after token-first implementation

## Performance Targets

- Unit tests: < 5 seconds
- Integration tests: < 30 seconds
- Known transaction tests: < 60 seconds
- Full test suite: < 2 minutes

## Token-First Sync Testing

The new token-first implementation requires specific testing:

### Test Token Sync Function
```bash
npm run test tests/integration/token-sync.test.ts
```

### Verify Token Sync Block Tracking
- Check that `last_synced_block` is updated after token sync
- Verify incremental syncs only process new blocks
- Test full sync resets token sync blocks

### Test Wallet Extraction
- Verify wallets are correctly extracted from swaps
- Check that wallets are created in database
- Test that wallet sync happens after token sync

## Next Steps

1. Add real transaction hashes to `tests/fixtures/transactions.ts`
2. Run `npm run test:incremental incremental` to test your setup
3. Add more test cases as you discover edge cases
4. Use tests before every full sync to catch issues early
5. Test token-first sync efficiency vs old wallet-first approach

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Basescan](https://basescan.org/) - Find transaction hashes for testing
- [DexScreener](https://dexscreener.com/) - Verify price data
