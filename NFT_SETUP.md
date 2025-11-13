# BadTraders Burn To Earn NFT Setup Guide

## Overview
Simple setup: V1 uses ONE shared image for all 100 NFTs. Upload once, use the same IPFS URL for all mints.

## Prerequisites

### IPFS Storage Provider
You need either:
- **Pinata JWT**: Get from https://pinata.cloud
- **Web3.Storage Token**: Get from https://web3.storage

Add to your `.env`:
```env
PINATA_JWT=your_pinata_jwt_token
# OR
WEB3_STORAGE_TOKEN=your_web3_storage_token
```

## Setup

### Step 1: Upload V1 Image to IPFS (ONE TIME)
```bash
node scripts/upload-v1-image.cjs
```

This uploads `public/goodmoney.png` to IPFS and saves the URL to `v1-image-ipfs.json`.

**Result**: You get ONE IPFS URL like `ipfs://Qm...` that you'll use for ALL 100 V1 NFTs.

### Step 2: Mint NFTs
When minting, use the SAME IPFS URL for all mints. The contract generates metadata on-the-fly with the token ID.

Example mint call:
```solidity
// Use the SAME imageUrl for all 100 NFTs
string memory imageUrl = "ipfs://Qm..."; // From step 1
string memory metadataJSON = ""; // Empty - contract generates it

nftContract.mint(imageUrl, metadataJSON);
```

The contract's `tokenURI()` will generate metadata like:
```json
{
  "name": "BadTraders Burn To Earn NFT V1 #1",
  "description": "BadTraders Burn To Earn NFT V1 minted by burning tokens",
  "image": "ipfs://Qm...",
  "attributes": [
    {"trait_type": "Type", "value": "BadTraders Burn To Earn NFT V1"},
    {"trait_type": "Token ID", "value": "1"}
  ]
}
```

## Files

- **Image**: `public/goodmoney.png` ✅ (already in place)
- **IPFS Service**: `lib/services/ipfs.ts` - Handles uploads
- **Upload Script**: `scripts/upload-v1-image.cjs` - One-time image upload

## Version Differences

- **V1**: Burn 10M tokens, Max Supply: 100 NFTs, ONE shared image
- **V2**: Burn 25M tokens, Max Supply: 900 NFTs, different image (separate contract)

