# Bitquery V1 vs V2 API Analysis

## The Problem

You need **historical data** from Bitquery for Base network. Historical data requires the **V1 API**, not V2.

## V1 vs V2 - Key Differences

### V2 API (Streaming/Real-time)
- **Endpoint**: `https://graphql.bitquery.io` or `https://streaming.bitquery.io/graphql`
- **Purpose**: Real-time data, WebSocket subscriptions
- **Syntax**: Uses `where` clauses with nested structures
  ```graphql
  EVM(network: base, dataset: combined) {
    DEXTrades(
      where: {
        any: [...]
        Block: { Time: { since: ..., till: ... } }
      }
    )
  }
  ```
- **Field Names**: Uppercase (`Block`, `Transaction`, `Trade`, `DEXTrades`)

### V1 API (Historical)
- **Endpoint**: `https://graphql.bitquery.io` (same endpoint, different syntax)
- **Purpose**: Historical/archival data queries
- **Syntax**: Uses **top-level filters**, not `where` clauses
  ```graphql
  ethereum(network: ethereum) {
    dexTrades(
      date: { since: "2023-07-10", till: "2023-07-11" }
      baseCurrency: { is: "0x..." }
    )
  }
  ```
- **Field Names**: Lowercase (`block`, `transaction`, `dexTrades`)

## The Core Issue

The V1 examples you shared are for **Ethereum network**:
```graphql
ethereum(network: ethereum) {
  dexTrades(...)
}
```

But you're querying **Base network**. The question is: **Does Base network use `EVM(network: base)` in V1, or a different root type?**

## What We Know

1. **Your working `getWalletSwaps` query** uses V2 syntax:
   - `EVM(network: base)`
   - `DEXTrades` (uppercase)
   - `where` clause with `any` operator
   - This works, but it's V2 syntax

2. **V1 examples you shared** use:
   - `ethereum(network: ethereum)` (not `EVM`)
   - `dexTrades` (lowercase)
   - Top-level filters like `baseCurrency: { is: "0x..." }`
   - No `where` clauses

## The Real Question

**For Base network in V1 API:**
- Does it use `EVM(network: base)` or `base(network: base)` or something else?
- Does it support top-level filters like `buyCurrency: { is: $token }`?
- Or does Base network only support V2 syntax even for historical queries?

## What Needs to Happen

1. **Find Base network V1 documentation** - The examples you shared are Ethereum-specific
2. **Test if Base network supports V1 top-level filters** - The error "Field does not exist on type" suggests `buyCurrency`/`sellCurrency` aren't valid for Base
3. **Determine if Base network requires V2 syntax even for historical data** - This would be unusual but possible

## Possible Solutions

### Option 1: Base network uses V1 but with different field names
- Need to find Base-specific V1 documentation
- May need different filter field names than Ethereum

### Option 2: Base network only supports V2 syntax
- Even for historical data, Base might require V2 `where` clauses
- Your `getWalletSwaps` already works with V2 syntax
- The issue might be the `Block.Number.ge` filter, not the overall structure

### Option 3: Use time-based pagination instead of block-based
- V1 examples use `date: { since: ..., till: ... }` or `time: { since: ..., till: ... }`
- Could paginate by time ranges instead of block numbers
- This matches the V1 pattern you showed

## What I Did Wrong

1. **Assumed V1 syntax would work for Base** - The examples were Ethereum-specific
2. **Kept reverting to V2** - Because that's what works in your codebase
3. **Didn't find Base-specific V1 documentation** - Need actual Base network V1 examples

## Next Steps

1. **Find Base network V1 API documentation** - Specifically for `dexTrades` queries
2. **Or confirm Base only supports V2** - In which case, fix the block filtering issue in V2 syntax
3. **Test time-based pagination** - Use `Block.Time` filters like `getWalletSwaps` does, but paginate by time ranges

## The Block Filtering Issue

Even if we use V2 syntax (which works), the original error was:
- `Block: { Number: { ge: $minBlock } }` - "Field does not exist on type"

But `getWalletSwaps` successfully uses:
- `Block: { Time: { since: $fromDate, till: $toDate } }` - This works!

**Solution**: Use time-based pagination instead of block number filtering, even in V2 syntax.

