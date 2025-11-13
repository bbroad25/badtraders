// lib/services/chainlinkOracle.ts
// Chainlink price oracle integration for accurate price data

import { ethers } from 'ethers';

const CHAINLINK_ETH_USD_ORACLE = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'; // Base mainnet
const CHAINLINK_ORACLE_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

/**
 * Get ETH/USD price from Chainlink oracle
 */
export async function getEthUsdPrice(): Promise<number | null> {
  try {
    const { getProvider } = await import('./apiProviderManager');
    const provider = await getProvider();
    const oracle = new ethers.Contract(CHAINLINK_ETH_USD_ORACLE, CHAINLINK_ORACLE_ABI, provider);

    const roundData = await oracle.latestRoundData();
    const price = Number(roundData.answer) / 1e8; // Chainlink uses 8 decimals

    if (price > 0 && price < 100000) { // Sanity check
      return price;
    }

    return null;
  } catch (error) {
    console.warn('Failed to fetch Chainlink ETH/USD price:', error);
    return null;
  }
}

/**
 * Get token price from Chainlink (if oracle exists for token)
 */
export async function getTokenPriceFromChainlink(tokenAddress: string): Promise<number | null> {
  // This would require knowing the Chainlink oracle address for each token
  // For now, return null to indicate Chainlink price not available
  // This allows fallback to other price sources
  return null;
}

