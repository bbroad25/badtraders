// lib/services/fifoAccounting.ts
import { query } from '@/lib/db/connection';
import { ethers } from 'ethers';

export interface Position {
  wallet_address: string;
  token_address: string;
  remaining_amount: string;
  cost_basis_usd: string;
  realized_pnl_usd: string;
  updated_at: Date;
}

/**
 * Get current position for a wallet/token pair
 */
export async function getPosition(
  walletAddress: string,
  tokenAddress: string
): Promise<Position | null> {
  try {
    const result = await query(
      'SELECT * FROM positions WHERE wallet_address = $1 AND token_address = $2',
      [walletAddress.toLowerCase(), tokenAddress.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as Position;
  } catch (error) {
    console.error('Error getting position:', error);
    throw error;
  }
}

/**
 * Process a BUY transaction - add to position with cost basis
 */
export async function processBuy(
  walletAddress: string,
  tokenAddress: string,
  amount: bigint,
  priceUsd: number,
  costBasis: number
): Promise<void> {
  try {
    const walletAddr = walletAddress.toLowerCase();
    const tokenAddr = tokenAddress.toLowerCase();
    const amountStr = amount.toString();

    // Get current position
    const currentPosition = await getPosition(walletAddress, tokenAddress);

    if (currentPosition) {
      // Update existing position
      const newRemainingAmount = BigInt(currentPosition.remaining_amount) + amount;
      const newCostBasis = parseFloat(currentPosition.cost_basis_usd) + costBasis;

      await query(
        `UPDATE positions
         SET remaining_amount = $1,
             cost_basis_usd = $2,
             updated_at = NOW()
         WHERE wallet_address = $3 AND token_address = $4`,
        [newRemainingAmount.toString(), newCostBasis.toFixed(8), walletAddr, tokenAddr]
      );
    } else {
      // Create new position
      await query(
        `INSERT INTO positions (wallet_address, token_address, remaining_amount, cost_basis_usd, realized_pnl_usd, updated_at)
         VALUES ($1, $2, $3, $4, 0, NOW())`,
        [walletAddr, tokenAddr, amountStr, costBasis.toFixed(8)]
      );
    }
  } catch (error) {
    console.error('Error processing buy:', error);
    throw error;
  }
}

/**
 * Process a SELL transaction - remove FIFO, calculate realized PnL
 * Returns the realized PnL in USD
 */
export async function processSell(
  walletAddress: string,
  tokenAddress: string,
  amount: bigint,
  priceUsd: number
): Promise<number> {
  try {
    const walletAddr = walletAddress.toLowerCase();
    const tokenAddr = tokenAddress.toLowerCase();
    const sellAmount = amount;

    // Get current position
    const currentPosition = await getPosition(walletAddress, tokenAddress);

    if (!currentPosition) {
      console.warn(`No position found for ${walletAddress} / ${tokenAddress}`);
      return 0;
    }

    const remainingAmount = BigInt(currentPosition.remaining_amount);
    const costBasisUsd = parseFloat(currentPosition.cost_basis_usd);
    const realizedPnLUsd = parseFloat(currentPosition.realized_pnl_usd);

    if (remainingAmount === BigInt(0)) {
      console.warn(`Position has zero balance for ${walletAddress} / ${tokenAddress}`);
      return 0;
    }

    // Calculate how much we're selling
    const sellAmountToProcess = sellAmount > remainingAmount ? remainingAmount : sellAmount;
    const sellValueUsd = Number(ethers.formatUnits(sellAmountToProcess, 18)) * priceUsd;

    // Calculate cost basis proportion
    const costBasisProportion = Number(sellAmountToProcess) / Number(remainingAmount);
    const costBasisForSell = costBasisUsd * costBasisProportion;

    // Calculate realized PnL for this sell
    const realizedPnLForSell = sellValueUsd - costBasisForSell;
    const newRealizedPnL = realizedPnLUsd + realizedPnLForSell;

    // Update position
    const newRemainingAmount = remainingAmount - sellAmountToProcess;
    const newCostBasis = costBasisUsd - costBasisForSell;

    if (newRemainingAmount === BigInt(0)) {
      // Position fully closed
      await query(
        `UPDATE positions
         SET remaining_amount = 0,
             cost_basis_usd = 0,
             realized_pnl_usd = $1,
             updated_at = NOW()
         WHERE wallet_address = $2 AND token_address = $3`,
        [newRealizedPnL.toFixed(8), walletAddr, tokenAddr]
      );
    } else {
      // Partial sell
      await query(
        `UPDATE positions
         SET remaining_amount = $1,
             cost_basis_usd = $2,
             realized_pnl_usd = $3,
             updated_at = NOW()
         WHERE wallet_address = $4 AND token_address = $5`,
        [
          newRemainingAmount.toString(),
          newCostBasis.toFixed(8),
          newRealizedPnL.toFixed(8),
          walletAddr,
          tokenAddr
        ]
      );
    }

    return realizedPnLForSell;
  } catch (error) {
    console.error('Error processing sell:', error);
    throw error;
  }
}

/**
 * Calculate unrealized PnL for a position using current price
 */
export async function calculateUnrealizedPnL(
  walletAddress: string,
  tokenAddress: string,
  currentPrice: number
): Promise<number> {
  try {
    const position = await getPosition(walletAddress, tokenAddress);

    if (!position || BigInt(position.remaining_amount) === BigInt(0)) {
      return 0;
    }

    const remainingAmount = Number(ethers.formatUnits(position.remaining_amount, 18));
    const currentValue = remainingAmount * currentPrice;
    const costBasis = parseFloat(position.cost_basis_usd);

    return currentValue - costBasis;
  } catch (error) {
    console.error('Error calculating unrealized PnL:', error);
    return 0;
  }
}

