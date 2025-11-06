// lib/services/swapTypes.ts
// Shared types for swap processing

export interface SwapDetails {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  side: 'BUY' | 'SELL';
  walletAddress: string;
  source: 'trace' | 'log' | 'receipt' | 'bitquery';
  confidence: 'high' | 'medium' | 'low';
  baseTokenAddress: string; // ETH/WETH/USDC used as payment
  baseTokenAmount: bigint; // Amount of base token used
  tokenInDecimals: number;
  tokenOutDecimals: number;
  route?: Array<{
    pool: string;
    tokenIn: string;
    tokenOut: string;
  }>;
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  // Optional USD values (from Bitquery)
  trackedTokenUsdValue?: number;
  baseTokenUsdValue?: number;
  priceUsd?: number;
}

