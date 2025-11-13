BadTraders NFT Contract Implementation Plan
Overview
Create a new ERC-7401 composable NFT contract for BadTraders that allows minting by burning 1 million BadTraders tokens. The contract will be based on the Gen1 structure from pumpkin-carving-nft but simplified for the burn-to-mint use case.

Project Structure
Create contracts/ directory in badtraders/
Create contracts/BadTradersNFT.sol - Main NFT contract
Create hardhat.config.cjs - Hardhat configuration
Create scripts/deploy-badtraders-nft.cjs - Deployment script
Update package.json - Add Hardhat dependencies
Implementation Details
1. Contract: contracts/BadTradersNFT.sol
Based on Gen1.sol structure from [pumpkin-carving-nft/contracts/Gen1.sol](C:\Users\epj33\Desktop\Pumpkin\pumpkin-carving-nft\contracts\Gen1.sol)
Use upgradeable pattern (UUPS) like Gen1
Replace ETH payment with ERC20 token burn mechanism
Integrate with BadTraders token at 0x0774409cda69a47f272907fd5d0d80173167bb07 (from [lib/utils/constants.ts](C:\Users\epj33\Desktop\BadTraders\badtraders\lib\utils\constants.ts))
Burn amount: 1,000,000 tokens (1M * 10^18)
Keep ERC-7401 parent-child relationship functions
Remove: energy system, relayer, cousin relationships (keep simple)
Add: ERC20 approval/transfer/burn logic in mint function
2. Hardhat Configuration: hardhat.config.cjs
Copy structure from [pumpkin-carving-nft/hardhat.config.cjs](C:\Users\epj33\Desktop\Pumpkin\pumpkin-carving-nft\hardhat.config.cjs)
Configure for Base mainnet and Base Sepolia
Set Solidity version 0.8.22
Include OpenZeppelin upgrades plugin
3. Deployment Script: scripts/deploy-badtraders-nft.cjs
Based on [pumpkin-carving-nft/scripts/deploy-gen1.cjs](C:\Users\epj33\Desktop\Pumpkin\pumpkin-carving-nft\scripts\deploy-gen1.cjs)
Use BadTraders token address from constants
Deploy as upgradeable proxy (UUPS)
Save deployment info to deployment-output.json
4. Package Dependencies
Add to package.json devDependencies:

@nomicfoundation/hardhat-toolbox
@openzeppelin/contracts
@openzeppelin/contracts-upgradeable
@openzeppelin/hardhat-upgrades
hardhat
dotenv
Key Features
ERC-721 standard with metadata support
ERC-7401 parent-child composability
ERC-4906 metadata update events
Burn-to-mint: requires burning 1M BadTraders tokens
Upgradeable via UUPS proxy pattern
Owner functions: update burn amount, update metadata
Branch Strategy
Create new branch for this feature (branch name TBD)
Keep changes isolated until ready to merge
Files to Create/Modify
contracts/BadTradersNFT.sol (new)
hardhat.config.cjs (new)
scripts/deploy-badtraders-nft.cjs (new)
package.json (modify - add devDependencies)
.gitignore (verify - ensure artifacts/ and cache/ are ignored)
Next Steps After Implementation
Test contract compilation
Deploy to testnet
Verify contract on BaseScan
Update frontend to integrate minting functionality
