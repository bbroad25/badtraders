const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  console.log("Configuring BadTradersBag contract...\n");

  // Read deployment outputs
  let bagAddress, v1Address, v2Address;

  // Try to read from deployment output files
  try {
    const bagDeployment = JSON.parse(fs.readFileSync("deployment-output-bag.json", "utf8"));
    bagAddress = bagDeployment.proxyAddress;
    console.log("✅ Found Bag contract address from deployment-output-bag.json");
  } catch (e) {
    bagAddress = process.env.NEXT_PUBLIC_BADTRADERS_BAG_CONTRACT_ADDRESS;
    if (!bagAddress) {
      console.error("❌ ERROR: Bag contract address not found!");
      console.error("   Either provide deployment-output-bag.json or set NEXT_PUBLIC_BADTRADERS_BAG_CONTRACT_ADDRESS in .env");
      process.exit(1);
    }
    console.log("✅ Using Bag contract address from .env");
  }

  try {
    const v1Deployment = JSON.parse(fs.readFileSync("deployment-output.json", "utf8"));
    v1Address = v1Deployment.proxyAddress;
    console.log("✅ Found V1 contract address from deployment-output.json");
  } catch (e) {
    v1Address = process.env.NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V1_CONTRACT_ADDRESS;
    if (!v1Address) {
      console.warn("⚠️ WARNING: V1 contract address not found. Skipping V1 configuration.");
    } else {
      console.log("✅ Using V1 contract address from .env");
    }
  }

  try {
    const v2Deployment = JSON.parse(fs.readFileSync("deployment-output-v2.json", "utf8"));
    v2Address = v2Deployment.proxyAddress;
    console.log("✅ Found V2 contract address from deployment-output-v2.json");
  } catch (e) {
    v2Address = process.env.NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V2_CONTRACT_ADDRESS;
    if (!v2Address) {
      console.warn("⚠️ WARNING: V2 contract address not found. Skipping V2 configuration.");
    } else {
      console.log("✅ Using V2 contract address from .env");
    }
  }

  console.log("\nConfiguration:");
  console.log("  Bag Contract:", bagAddress);
  console.log("  V1 Contract:", v1Address || "Not set");
  console.log("  V2 Contract:", v2Address || "Not set");
  console.log("  Network:", hre.network.name);
  console.log("");

  // Get the contract
  const BadTradersBag = await ethers.getContractAt("BadTradersBag", bagAddress);
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("");

  // Configure V1 as allowed child
  if (v1Address && v1Address !== "0x0000000000000000000000000000000000000000") {
    try {
      console.log("Setting V1 contract as allowed child...");
      const tx1 = await BadTradersBag.setAllowedChildContract(v1Address, true);
      console.log("  Transaction hash:", tx1.hash);
      await tx1.wait();
      console.log("  ✅ V1 contract configured as allowed child");
    } catch (error) {
      console.error("  ❌ Failed to configure V1:", error.message);
    }
  }

  // Configure V2 as allowed child
  if (v2Address && v2Address !== "0x0000000000000000000000000000000000000000") {
    try {
      console.log("Setting V2 contract as allowed child...");
      const tx2 = await BadTradersBag.setAllowedChildContract(v2Address, true);
      console.log("  Transaction hash:", tx2.hash);
      await tx2.wait();
      console.log("  ✅ V2 contract configured as allowed child");
    } catch (error) {
      console.error("  ❌ Failed to configure V2:", error.message);
    }
  }

  // Verify configuration
  console.log("\n✅ Configuration complete!");
  console.log("\nVerifying configuration...");

  if (v1Address && v1Address !== "0x0000000000000000000000000000000000000000") {
    const v1Allowed = await BadTradersBag.allowedChildContracts(v1Address);
    console.log("  V1 allowed:", v1Allowed ? "✅ Yes" : "❌ No");
  }

  if (v2Address && v2Address !== "0x0000000000000000000000000000000000000000") {
    const v2Allowed = await BadTradersBag.allowedChildContracts(v2Address);
    console.log("  V2 allowed:", v2Allowed ? "✅ Yes" : "❌ No");
  }

  console.log("\n💡 You can now attach V1 and V2 NFTs to Bag NFTs!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

