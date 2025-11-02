import { ethers } from 'ethers';

// BadTraders ERC-20 Token Contract
export const BADTRADERS_CONTRACT_ADDRESS = '0x0774409Cda69A47f272907fd5D0d80173167BB07';

// Standard ERC-20 ABI (only need balanceOf)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

/**
 * Gets the BadTraders token balance for a wallet address
 * @param walletAddress - The Ethereum wallet address to check
 * @returns Promise<number> - The token balance (in tokens, not wei)
 */
export async function getBadTradersBalance(walletAddress: string): Promise<number> {
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

  if (!ALCHEMY_API_KEY) {
    console.warn('ALCHEMY_API_KEY not set, cannot fetch token balance');
    return 0;
  }

  try {
    const provider = new ethers.AlchemyProvider('base-mainnet', ALCHEMY_API_KEY);
    const contract = new ethers.Contract(BADTRADERS_CONTRACT_ADDRESS, ERC20_ABI, provider);

    // Get balance in wei
    const balanceWei = await contract.balanceOf(walletAddress);

    // Get decimals (usually 18 for ERC-20)
    let decimals = 18;
    try {
      decimals = await contract.decimals();
    } catch {
      // Default to 18 if decimals() fails
    }

    // Convert from wei to tokens
    const balance = Number(ethers.formatUnits(balanceWei, decimals));

    return balance;
  } catch (error) {
    console.error(`Error fetching BadTraders balance for ${walletAddress}:`, error);
    return 0;
  }
}

/**
 * Checks if a wallet has at least the threshold amount of BadTraders tokens
 * @param walletAddress - The Ethereum wallet address to check
 * @param threshold - The minimum token balance required (default: 1,000,000)
 * @returns Promise<boolean> - True if balance >= threshold
 */
export async function checkEligibility(
  walletAddress: string,
  threshold: number = 1_000_000
): Promise<boolean> {
  const balance = await getBadTradersBalance(walletAddress);
  return balance >= threshold;
}

