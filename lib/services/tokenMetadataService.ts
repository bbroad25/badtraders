import { ethers } from 'ethers';

// Standard ERC-20 ABI for name, symbol, decimals
const ERC20_METADATA_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
] as const;

interface TokenMetadata {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  logoUrl: string | null;
}

/**
 * Fetch token metadata from the chain
 */
export async function getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

  if (!ALCHEMY_API_KEY) {
    console.warn('ALCHEMY_API_KEY not set, cannot fetch token metadata');
    return { name: null, symbol: null, decimals: null, logoUrl: null };
  }

  try {
    // Base mainnet chain ID: 8453
    const provider = new ethers.AlchemyProvider(8453, ALCHEMY_API_KEY);
    const contract = new ethers.Contract(tokenAddress, ERC20_METADATA_ABI, provider);

    // Fetch metadata in parallel
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => null),
      contract.symbol().catch(() => null),
      contract.decimals().catch(() => null),
    ]);

    // Try to get logo from common sources
    const logoUrl = await getTokenLogo(tokenAddress, symbol);

    return {
      name: name || null,
      symbol: symbol || null,
      decimals: decimals ? Number(decimals) : null,
      logoUrl,
    };
  } catch (error) {
    console.error(`Error fetching token metadata for ${tokenAddress}:`, error);
    return { name: null, symbol: null, decimals: null, logoUrl: null };
  }
}

/**
 * Try to get token logo from various sources
 */
async function getTokenLogo(tokenAddress: string, symbol: string | null): Promise<string | null> {
  const checksumAddress = ethers.getAddress(tokenAddress.toLowerCase());

  // Try Base token list first
  try {
    const baseTokenListUrl = 'https://raw.githubusercontent.com/base-org/baseswap-token-list/main/src/tokens/base.json';
    const response = await fetch(baseTokenListUrl);
    if (response.ok) {
      const tokens = await response.json();
      const token = tokens.find((t: any) =>
        t.address?.toLowerCase() === checksumAddress.toLowerCase()
      );
      if (token?.logoURI) {
        return token.logoURI;
      }
    }
  } catch (error) {
    // Ignore errors, try next source
  }

  // Try CoinGecko Base chain
  if (symbol) {
    try {
      // This is a simplified approach - CoinGecko API would need API key for production
      // For now, try common token list URLs
      const trustWalletUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${checksumAddress}/logo.png`;
      const response = await fetch(trustWalletUrl, { method: 'HEAD' });
      if (response.ok) {
        return trustWalletUrl;
      }
    } catch (error) {
      // Ignore errors
    }
  }

  return null;
}

