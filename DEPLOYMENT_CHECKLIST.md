# NFT Contract Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Variables
- [ ] Create/update `.env` file in project root
- [ ] Add `PRIVATE_KEY=your_wallet_private_key_here` (deployer wallet)
- [ ] Add `ETHERSCAN_API_KEY=your_basescan_api_key` (optional, for verification)
- [ ] Ensure wallet has sufficient ETH/Base for gas fees

### 2. Dependencies
- [ ] Run `npm install` to ensure all dependencies are installed
- [ ] Verify Hardhat is configured correctly (`hardhat.config.cjs`)

### 3. Network Configuration
- [ ] Decide: Mainnet (`base`) or Testnet (`base-sepolia`)
- [ ] If testnet: Deploy test token first (see Testnet section below)

---

## Mainnet Deployment (Base)

### Step 1: Deploy V1 NFT Contract
```powershell
npx hardhat run scripts/deploy-badtraders-nft.cjs --network base
```

**What it does:**
- Deploys `BadTradersBurnToEarnNFTV1` contract
- Burn amount: 10M tokens
- Max supply: 100 NFTs
- Uses UUPS upgradeable proxy

**After deployment:**
- [ ] Copy proxy address from output
- [ ] Verify `deployment-output.json` was created
- [ ] Save proxy address: `NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V1_CONTRACT_ADDRESS`

---

### Step 2: Deploy V2 NFT Contract
```powershell
npx hardhat run scripts/deploy-badtraders-nft-v2.cjs --network base
```

**What it does:**
- Deploys `BadTradersBurnToEarnNFTV2` contract
- Burn amount: 25M tokens
- Max supply: 900 NFTs
- Uses UUPS upgradeable proxy

**After deployment:**
- [ ] Copy proxy address from output
- [ ] Verify `deployment-output-v2.json` was created
- [ ] Save proxy address: `NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V2_CONTRACT_ADDRESS`

---

### Step 3: Deploy Bag NFT Contract (Parent)
```powershell
npx hardhat run scripts/deploy-badtraders-bad.cjs --network base
```

**What it does:**
- Deploys `BadTradersBag` parent NFT contract
- Minimum balance: 5M tokens required
- Unlimited supply
- Uses UUPS upgradeable proxy

**After deployment:**
- [ ] Copy proxy address from output
- [ ] Verify `deployment-output-bag.json` was created
- [ ] Save proxy address: `NEXT_PUBLIC_BADTRADERS_BAG_CONTRACT_ADDRESS`

---

## Post-Deployment Configuration

### 1. Update Environment Variables
Add to `.env` file:
```env
NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V1_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V2_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_BADTRADERS_BAG_CONTRACT_ADDRESS=0x...
```

- [ ] V1 contract address added
- [ ] V2 contract address added
- [ ] Bag contract address added

### 2. Configure Bag Contract
The Bag contract needs to allow V1 and V2 as child contracts.

**Option A: Using the Configuration Script** (Recommended)
```powershell
npx hardhat run scripts/configure-bag-contract.cjs --network base
```
This script automatically:
- Reads contract addresses from deployment JSON files or `.env`
- Configures V1 and V2 as allowed child contracts
- Verifies the configuration

**Option B: Using Hardhat Console**
```powershell
npx hardhat console --network base
```
Then:
```javascript
const Bag = await ethers.getContractAt("BadTradersBag", "BAG_PROXY_ADDRESS");
await Bag.setAllowedChildContract("V1_CONTRACT_ADDRESS", true);
await Bag.setAllowedChildContract("V2_CONTRACT_ADDRESS", true);
```

- [ ] V1 contract added as allowed child
- [ ] V2 contract added as allowed child

### 3. (Optional) Contract Verification
Verify contracts on Basescan for transparency:

```powershell
# V1 Contract
npx hardhat verify --network base <V1_PROXY_ADDRESS> <CONSTRUCTOR_ARGS>

# V2 Contract
npx hardhat verify --network base <V2_PROXY_ADDRESS> <CONSTRUCTOR_ARGS>

# Bag Contract
npx hardhat verify --network base <BAG_PROXY_ADDRESS> <CONSTRUCTOR_ARGS>
```

- [ ] V1 contract verified (optional)
- [ ] V2 contract verified (optional)
- [ ] Bag contract verified (optional)

### 4. Test Minting
- [ ] Test V1 mint (burn 10M tokens)
- [ ] Test V2 mint (burn 25M tokens)
- [ ] Test Bag mint (hold 5M tokens, free mint)
- [ ] Test attaching V1/V2 to Bag
- [ ] Verify metadata generation
- [ ] Verify IPFS images load correctly

### 5. Frontend Integration
- [ ] Restart Next.js dev server to load new env vars
- [ ] Verify mint page shows all three NFT cards
- [ ] Test wallet connection
- [ ] Test minting from frontend
- [ ] Verify supply counters update correctly

---

## Testnet Deployment (Base Sepolia)

### Pre-Testnet Setup

#### 1. Deploy Test Token
```powershell
npx hardhat run scripts/deploy-test-token.cjs --network base-sepolia
```

**After deployment:**
- [ ] Copy test token address
- [ ] Add to `.env`: `TESTNET_BADTRADERS_TOKEN_ADDRESS=0x...`

#### 2. Mint Test Tokens
You'll need test tokens to test minting. The test token contract has a `mintForSelf()` function.

### Testnet Deployment Steps
Follow the same steps as Mainnet, but use `--network base-sepolia`:

- [ ] Deploy V1 to testnet
- [ ] Deploy V2 to testnet
- [ ] Deploy Bag to testnet
- [ ] Configure Bag contract with V1/V2 addresses
- [ ] Test all minting functionality
- [ ] Verify everything works before mainnet deployment

---

## Keeper Setup (For Bag Auto-Revocation)

### 1. Understand Keeper System
- [ ] Read `KEEPER_AND_CHILDREN_EXPLANATION.md`
- [ ] Understand how auto-revocation works
- [ ] Decide if you want restricted keepers or open keepers

### 2. Configure Keepers (Optional)
If you want to restrict keeper access:

```javascript
// Using Hardhat console
const Bag = await ethers.getContractAt("BadTradersBag", "BAG_PROXY_ADDRESS");
await Bag.setKeepersRestricted(true);
await Bag.setKeeper("KEEPER_WALLET_ADDRESS", true);
```

- [ ] Keeper system configured (if needed)

### 3. Set Up Keeper Script
The keeper script (`scripts/keeper-revoke-batch.cjs`) can be run periodically to check and revoke Bag NFTs whose owners fall below 5M tokens.

- [ ] Review keeper script
- [ ] Set up cron job or scheduled task (if needed)
- [ ] Test keeper script manually first

---

## Important Notes

### Contract Addresses
- All contracts use **proxy addresses** (not implementation addresses)
- The proxy address is what you use in the frontend
- Implementation addresses are stored in `.openzeppelin/` folder

### Upgradeability
- All contracts are upgradeable via UUPS proxy
- Use upgrade scripts if you need to fix bugs or add features:
  - `scripts/upgrade-badtraders-nft-v1.cjs`
  - `scripts/upgrade-badtraders-nft-v2.cjs`
  - `scripts/upgrade-badtraders-bag.cjs`

### IPFS Images
- V1 image: Already uploaded to IPFS (`QmSMwi4gTwdogBUq5Yap15MV7GN4eZF4c4DsnQwizN9LmY`)
- V2 image: Already uploaded to IPFS (`QmexAenCuwVzhMJQ5JWrcN92mEqGXreovk5FCMQrDZkNrf`)
- Bag image: Already uploaded to IPFS (`QmXstpY8TGKLk1di5W7jNXQuuiFzEXYfTtHsMarY2NEDcz`)
- Images are configured in `lib/utils/constants.ts`

### Security Checklist
- [ ] Private keys are secure and not committed to git
- [ ] `.env` file is in `.gitignore`
- [ ] Test contracts on testnet before mainnet
- [ ] Review contract code before deployment
- [ ] Have upgrade scripts ready in case of issues

---

## Troubleshooting

### Common Issues

**"Testnet token address not set"**
- Deploy test token first: `npx hardhat run scripts/deploy-test-token.cjs --network base-sepolia`
- Add `TESTNET_BADTRADERS_TOKEN_ADDRESS` to `.env`

**"Insufficient funds"**
- Ensure deployer wallet has enough ETH/Base for gas

**"Contract verification failed"**
- Check constructor arguments match deployment
- Ensure `ETHERSCAN_API_KEY` is set correctly

**"Frontend not showing contracts"**
- Restart Next.js dev server after adding env vars
- Check env var names match exactly (case-sensitive)
- Verify contract addresses are correct

---

## Deployment Summary

After completing all steps, you should have:

- [ ] V1 NFT contract deployed and configured
- [ ] V2 NFT contract deployed and configured
- [ ] Bag NFT contract deployed and configured
- [ ] All contract addresses in `.env` file
- [ ] Bag contract configured to accept V1/V2 as children
- [ ] Frontend displaying all three NFT cards
- [ ] Minting functionality tested and working
- [ ] IPFS images loading correctly

---

## Next Steps After Deployment

1. Announce NFT launch
2. Monitor minting activity
3. Set up keeper automation (if needed)
4. Monitor contract events and logs
5. Prepare for potential upgrades if needed

---

**Last Updated:** Check off items as you complete them to track your deployment progress!

