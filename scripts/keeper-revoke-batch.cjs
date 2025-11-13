const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * Keeper script to batch check and revoke NFTs below threshold
 * Can be run periodically via cron, Chainlink Automation, Gelato, etc.
 */

async function main() {
  console.log("Running keeper: Batch revoke NFTs below threshold...");

  const deploymentOutput = "deployment-output-bag.json";
  let proxyAddress;

  if (fs.existsSync(deploymentOutput)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentOutput, "utf8"));
    proxyAddress = deployment.proxyAddress;
    console.log("Found proxy address from deployment output:", proxyAddress);
  } else {
    proxyAddress = process.env.BADTRADERS_BAG_PROXY_ADDRESS;
    if (!proxyAddress) {
      console.error("\n❌ ERROR: Could not find proxy address!");
      console.error("   Either provide deployment-output-bag.json or set BADTRADERS_BAG_PROXY_ADDRESS in .env");
      process.exit(1);
    }
  }

  console.log("Proxy address:", proxyAddress);
  console.log("Network:", hre.network.name);

  // Get contract
  const BadTradersBag = await ethers.getContractAt("BadTradersBag", proxyAddress);

  // Get total supply
  const totalSupply = await BadTradersBag.totalSupply();
  console.log("Total supply:", totalSupply.toString());

  if (totalSupply === 0n) {
    console.log("No NFTs to check. Exiting.");
    return;
  }

  // Collect all token IDs (assuming sequential minting starting from 1)
  const tokenIds = [];
  for (let i = 1; i <= Number(totalSupply); i++) {
    try {
      // Check if token exists by trying to get owner
      const owner = await BadTradersBag.ownerOf(i);
      if (owner && owner !== "0x0000000000000000000000000000000000000000") {
        tokenIds.push(i);
      }
    } catch (err) {
      // Token doesn't exist or was already burned, skip
      continue;
    }
  }

  console.log(`Found ${tokenIds.length} active NFTs to check`);

  if (tokenIds.length === 0) {
    console.log("No active NFTs to check. Exiting.");
    return;
  }

  // Batch process in chunks to avoid gas limits
  const BATCH_SIZE = 50; // Adjust based on gas limits
  let totalRevoked = 0;

  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} tokens)...`);

    try {
      const tx = await BadTradersBag.batchRevokeIfBelowThreshold(batch);
      console.log("  Transaction hash:", tx.hash);

      const receipt = await tx.wait();
      console.log("  Confirmed in block:", receipt.blockNumber);

      // Parse events to count revoked
      const revokedEvents = receipt.logs.filter((log) => {
        try {
          const parsed = BadTradersBag.interface.parseLog(log);
          return parsed?.name === "BadTradersBagRevoked";
        } catch {
          return false;
        }
      });

      const batchRevoked = revokedEvents.length;
      totalRevoked += batchRevoked;
      console.log(`  Revoked ${batchRevoked} NFTs in this batch`);
    } catch (err) {
      console.error(`  Error processing batch:`, err.message);
      // Continue with next batch
    }
  }

  console.log(`\n✅ Keeper run complete!`);
  console.log(`   Total NFTs checked: ${tokenIds.length}`);
  console.log(`   Total NFTs revoked: ${totalRevoked}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

