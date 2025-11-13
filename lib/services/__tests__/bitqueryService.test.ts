import { describe, it, expect } from 'vitest';
import { testMinimalBitqueryQuery } from '../bitqueryService';
import { BADTRADER_TOKEN_ADDRESS } from '@/lib/utils/constants';

describe('Bitquery Service - Minimal Query Test', () => {
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

