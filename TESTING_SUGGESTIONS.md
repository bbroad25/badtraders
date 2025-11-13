## Indexer Test Suite Suggestions

### Summary

All existing unit and integration tests are passing. However, the test suite is not comprehensive and does not fully validate the indexer's functionality with real data.

### Recommendations

1.  **Add known transaction hashes**: To properly test the indexer, you need to add known transaction hashes to `tests/fixtures/transactions.ts`. This will allow the integration tests to run against real data and validate the full indexing process.
2.  **Add more test cases**: Add more test cases to cover edge cases and error conditions. For example, you could add tests for different types of swaps, different tokens, and different wallet activities.
3.  **Clean up test output**: The tests are logging some expected errors and warnings, which makes the output noisy. You can clean this up by using `vi.spyOn(console, 'warn').mockImplementation(() => {})` to suppress the warnings in the tests where they are expected.

### Example of a known transaction to add

```typescript
// tests/fixtures/transactions.ts

export const KNOWN_SWAPS: KnownSwap[] = [
  {
    txHash: '0xYourTransactionHashHere',
    description: 'A brief description of the transaction',
    expectedTokenIn: '0xTokenAddressIn',
    expectedTokenOut: '0xTokenAddressOut',
    expectedAmountIn: '1000000000000000000', // 1 ETH
    expectedAmountOut: '10000000000000000000000', // 10000 tokens
    walletAddress: '0xYourWalletAddressHere'
  }
]
```
