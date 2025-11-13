// The address of the $BadTrader token contract.
export const BADTRADER_TOKEN_ADDRESS = '0x0774409cda69a47f272907fd5d0d80173167bb07';

// The address for WETH on Base Mainnet
export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// The address for USDC on Base Mainnet
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// BadTraders Burn To Earn NFT V1 - IPFS image URL (shared by all 100 V1 NFTs)
export const BADTRADERS_BURN_TO_EARN_NFT_V1_IMAGE_IPFS = 'ipfs://QmSMwi4gTwdogBUq5Yap15MV7GN4eZF4c4DsnQwizN9LmY';
export const BADTRADERS_BURN_TO_EARN_NFT_V1_IMAGE_GATEWAY = 'https://gateway.pinata.cloud/ipfs/QmSMwi4gTwdogBUq5Yap15MV7GN4eZF4c4DsnQwizN9LmY';

// BadTraders Burn To Earn NFT V2 - IPFS image URL (shared by all 900 V2 NFTs)
export const BADTRADERS_BURN_TO_EARN_NFT_V2_IMAGE_IPFS = 'ipfs://QmexAenCuwVzhMJQ5JWrcN92mEqGXreovk5FCMQrDZkNrf';
export const BADTRADERS_BURN_TO_EARN_NFT_V2_IMAGE_GATEWAY = 'https://gateway.pinata.cloud/ipfs/QmexAenCuwVzhMJQ5JWrcN92mEqGXreovk5FCMQrDZkNrf';

// BadTraders Bag Parent NFT - IPFS image URL (shared by all Bag NFTs)
export const BADTRADERS_BAG_IMAGE_IPFS = 'ipfs://QmXstpY8TGKLk1di5W7jNXQuuiFzEXYfTtHsMarY2NEDcz';
export const BADTRADERS_BAG_IMAGE_GATEWAY = 'https://ipfs.io/ipfs/QmXstpY8TGKLk1di5W7jNXQuuiFzEXYfTtHsMarY2NEDcz';

// Uniswap V3 Universal Router
export const UNISWAP_UNIVERSAL_ROUTER_ADDRESS = '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD';

// A minimal ABI for the Uniswap V3 Universal Router 'Commands' event
export const UNISWAP_ROUTER_ABI = [
  "event Commands(address indexed sender, bytes commands, bytes[] inputs)"
];

// A minimal ABI for a Uniswap V3 Pool 'Swap' event and other necessary functions
export const UNISWAP_V3_POOL_ABI = [
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)"
];

