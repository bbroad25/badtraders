# Keepers and Child Attachment Explained

## Keepers

### What is a Keeper?
A "keeper" is any address (wallet or automated service) that calls the revocation functions to check and burn NFTs whose holders have dropped below the 5M token threshold.

### Current Implementation
**By default, ANYONE can be a keeper** - the contract starts with `keepersRestricted = false`. This means:
- ✅ Decentralized - anyone can help maintain the system
- ✅ No single point of failure
- ✅ Multiple keepers = redundancy
- ⚠️ Could be spammed (though it's harmless - just checks balances)

### Who Can Be a Keeper?

**Default (Open Keepers):**
1. **You (the deployer)** - You can call the functions manually or via scripts
2. **Any wallet** - Anyone can call `batchRevokeIfBelowThreshold()`
3. **Automated Services**:
   - **Chainlink Automation** - Decentralized automation network
   - **Gelato Network** - Automated smart contract execution
   - **Your own bot/server** - Run the keeper script on a cron job
   - **Community members** - Anyone who wants to help

**If You Enable Restrictions:**
- Call `setKeepersRestricted(true)` as owner
- Then only addresses you whitelist via `setKeeper(address, true)` can call keeper functions
- This makes it more centralized but prevents spam

### Managing Keepers

**As the contract owner, you can:**

```solidity
// Enable keeper restrictions (only whitelisted addresses can be keepers)
setKeepersRestricted(true)

// Add a keeper address (e.g., your deployer wallet, Chainlink, Gelato, etc.)
setKeeper(0xYourKeeperAddress, true)

// Remove a keeper
setKeeper(0xOldKeeperAddress, false)

// Disable restrictions (go back to open keepers)
setKeepersRestricted(false)
```

**Recommendation:**
- Start with open keepers (default) for decentralization
- If you need to restrict later, you can enable restrictions and whitelist specific addresses
- Most projects use open keepers because the functions are harmless (just balance checks)

## How Children Are Attached

### Current Flow

1. **User owns both NFTs**:
   - User owns a BadTradersBag parent NFT (e.g., token #1)
   - User owns a V1 or V2 child NFT (e.g., V1 token #5)

2. **User calls `attachChild()` on BadTradersBag contract**:
   ```solidity
   attachChild(
       parentId: 1,                    // Their BadTradersBag NFT
       childContract: V1_CONTRACT,      // Address of V1 contract
       childTokenId: 5                  // Their V1 NFT token ID
   )
   ```

3. **What happens**:
   - BadTradersBag contract checks:
     - ✅ Parent NFT exists and is owned by caller
     - ✅ Child contract is allowed (V1 or V2)
     - ✅ Child NFT exists and is owned by caller
     - ✅ Child isn't already attached to another parent
   - BadTradersBag stores the relationship:
     - `_children[1]` = array containing `(V1_CONTRACT, 5)`
     - `_parent[V1_CONTRACT][5]` = 1 (parent token ID)
   - Emits `ChildAttached` event
   - Emits `MetadataUpdate` for the parent (so metadata can update)

4. **Result**:
   - The V1/V2 NFT stays in its original contract
   - The BadTradersBag contract tracks the relationship
   - The parent NFT's metadata can reflect the attached children
   - The child NFT is now "attached" to the parent

### Important Notes

**The child NFTs (V1/V2) don't know about the parent** - they stay in their original contracts. This is fine for the parent to track children, but for full ERC-7401 compliance, we could also update the child contracts to track their parent.

**To detach**, user calls:
```solidity
detachChild(
    parentId: 1,
    childContract: V1_CONTRACT,
    childTokenId: 5
)
```

### Frontend Flow Example

```javascript
// User wants to attach their V1 NFT #5 to their Bad NFT #1

// 1. Get contracts
const badContract = new ethers.Contract(BAD_CONTRACT_ADDRESS, badAbi, signer);
const v1Contract = new ethers.Contract(V1_CONTRACT_ADDRESS, v1Abi, signer);

// 2. User calls attachChild on BadTradersBag contract
const tx = await badContract.attachChild(1, V1_CONTRACT_ADDRESS, 5);
await tx.wait();

// 3. Done! The relationship is stored in BadTradersBag contract
// The V1 NFT #5 is now attached to Bad NFT #1
```

### Metadata Updates

When children are attached/detached, the parent NFT emits `MetadataUpdate` events. This allows:
- Frontends to refresh the NFT's appearance
- Marketplaces to show updated metadata
- The parent NFT's image/attributes to change based on children

