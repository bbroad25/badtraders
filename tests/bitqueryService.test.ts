import { describe, it, expect } from 'vitest';
import { testMinimalBitqueryQuery, testTimeFilteredQuery, testCompleteFieldsQuery } from '../lib/services/bitqueryService';
import { BADTRADER_TOKEN_ADDRESS } from '../lib/utils/constants';

describe('Bitquery Service - Step 1: Minimal Query Test', () => {
  it('should fetch a single DEX trade using V2 syntax', async () => {
    const result = await testMinimalBitqueryQuery(BADTRADER_TOKEN_ADDRESS);

    // Verify response structure matches V2 format (uppercase fields)
    expect(result).toBeDefined();
    expect(result.EVM).toBeDefined();
    expect(result.EVM.DEXTrades).toBeDefined();
    expect(Array.isArray(result.EVM.DEXTrades)).toBe(true);

    if (result.EVM.DEXTrades.length > 0) {
      const trade = result.EVM.DEXTrades[0];

      // Verify V2 uppercase field structure
      expect(trade.Block).toBeDefined();
      expect(trade.Block.Time).toBeDefined();
      expect(trade.Block.Number).toBeDefined();

      expect(trade.Transaction).toBeDefined();
      expect(trade.Transaction.Hash).toBeDefined();

      expect(trade.Trade).toBeDefined();
      expect(trade.Trade.Buy).toBeDefined();
      expect(trade.Trade.Buy.Currency).toBeDefined();
      expect(trade.Trade.Buy.Currency.SmartContract).toBeDefined();

      expect(trade.Trade.Sell).toBeDefined();
      expect(trade.Trade.Sell.Currency).toBeDefined();
      expect(trade.Trade.Sell.Currency.SmartContract).toBeDefined();

      // Verify token appears in either Buy or Sell
      const buyToken = trade.Trade.Buy.Currency.SmartContract.toLowerCase();
      const sellToken = trade.Trade.Sell.Currency.SmartContract.toLowerCase();
      const expectedToken = BADTRADER_TOKEN_ADDRESS.toLowerCase();

      expect(
        buyToken === expectedToken || sellToken === expectedToken
      ).toBe(true);
    }
  }, 30000); // 30 second timeout for API call
});

describe('Bitquery Service - Step 2: Time Filtering Test', () => {
  it('should filter trades by time range correctly', async () => {
    // Test with a 7-day range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();

    const result = await testTimeFilteredQuery(
      BADTRADER_TOKEN_ADDRESS,
      startDate.toISOString(),
      endDate.toISOString()
    );

    expect(result).toBeDefined();
    expect(result.EVM).toBeDefined();
    expect(result.EVM.DEXTrades).toBeDefined();
    expect(Array.isArray(result.EVM.DEXTrades)).toBe(true);

    // Verify all returned trades are within the date range
    if (result.EVM.DEXTrades.length > 0) {
      for (const trade of result.EVM.DEXTrades) {
        const tradeTime = new Date(trade.Block.Time);
        expect(tradeTime >= startDate).toBe(true);
        expect(tradeTime <= endDate).toBe(true);
      }
    }
  }, 30000);
});

describe('Bitquery Service - Step 3: Complete Fields Test', () => {
  it('should return all V2 fields from Base Historical Queries docs', async () => {
    const result = await testCompleteFieldsQuery(BADTRADER_TOKEN_ADDRESS);

    expect(result).toBeDefined();
    expect(result.EVM).toBeDefined();
    expect(result.EVM.DEXTrades).toBeDefined();
    expect(Array.isArray(result.EVM.DEXTrades)).toBe(true);

    if (result.EVM.DEXTrades.length > 0) {
      const trade = result.EVM.DEXTrades[0];

      // Verify all Block fields
      expect(trade.Block).toBeDefined();
      expect(trade.Block.Time).toBeDefined();
      expect(trade.Block.Number).toBeDefined();
      // Date is optional

      // Verify all Transaction fields
      expect(trade.Transaction).toBeDefined();
      expect(trade.Transaction.Hash).toBeDefined();
      expect(trade.Transaction.From).toBeDefined();
      // To, Gas, GasUsed are optional

      // Verify all Trade fields
      expect(trade.Trade).toBeDefined();

      // Verify Buy fields
      expect(trade.Trade.Buy).toBeDefined();
      expect(trade.Trade.Buy.Amount).toBeDefined();
      expect(trade.Trade.Buy.AmountInUSD).toBeDefined();
      expect(trade.Trade.Buy.Currency).toBeDefined();
      expect(trade.Trade.Buy.Currency.SmartContract).toBeDefined();
      expect(trade.Trade.Buy.Currency.Symbol).toBeDefined();
      expect(trade.Trade.Buy.Buyer).toBeDefined();

      // Verify Sell fields
      expect(trade.Trade.Sell).toBeDefined();
      expect(trade.Trade.Sell.Amount).toBeDefined();
      expect(trade.Trade.Sell.AmountInUSD).toBeDefined();
      expect(trade.Trade.Sell.Currency).toBeDefined();
      expect(trade.Trade.Sell.Currency.SmartContract).toBeDefined();
      expect(trade.Trade.Sell.Currency.Symbol).toBeDefined();
      expect(trade.Trade.Sell.Seller).toBeDefined();

      // Verify Dex fields
      expect(trade.Trade.Dex).toBeDefined();
      expect(trade.Trade.Dex.ProtocolName).toBeDefined();
    }
  }, 30000);
});

