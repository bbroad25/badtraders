const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Upgrading BadTradersBurnToEarnNFTV1 contract...");

  // Get proxy address from deployment output or environment
  const deploymentOutput = "deployment-output.json";
  let proxyAddress;

  if (fs.existsSync(deploymentOutput)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentOutput, "utf8"));
    proxyAddress = deployment.proxyAddress;
    console.log("Found proxy address from deployment output:", proxyAddress);
  } else {
    // Fallback to environment variable
    proxyAddress = process.env.BADTRADERS_BURN_TO_EARN_NFT_V1_PROXY_ADDRESS;
    if (!proxyAddress) {
      console.error("\n❌ ERROR: Could not find proxy address!");
      console.error("   Either provide deployment-output.json or set BADTRADERS_BURN_TO_EARN_NFT_V1_PROXY_ADDRESS in .env");
      process.exit(1);
    }
  }

  console.log("Proxy address:", proxyAddress);
  console.log("Network:", hre.network.name);

  // Get the new contract factory
  const BadTradersNFTV1 = await ethers.getContractFactory("BadTradersBurnToEarnNFTV1");

  console.log("\n⏳ Upgrading proxy to new implementation...");

  // Upgrade the proxy
  const upgraded = await upgrades.upgradeProxy(proxyAddress, BadTradersNFTV1);
  await upgraded.waitForDeployment();

  console.log("✅ Proxy upgraded successfully!");

  // Get the new implementation address
  let newImplementationAddress;
  try {
    newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("New implementation address:", newImplementationAddress);
  } catch (err) {
    console.log("⚠️ Could not get implementation address yet:", err.message);
  }

  // Verify the upgrade worked
  const contract = await ethers.getContractAt("BadTradersBurnToEarnNFTV1", proxyAddress);
  console.log("\n📝 Contract Details (after upgrade):");
  console.log("  Name:", await contract.name());
  console.log("  Symbol:", await contract.symbol());
  console.log("  BadTraders Token:", await contract.badTradersToken());
  console.log("  Burn Amount:", ethers.formatUnits(await contract.burnAmount(), 18), "tokens");
  console.log("  Max Supply:", (await contract.maxSupply()).toString(), "NFTs");

  // Update deployment output
  if (fs.existsSync(deploymentOutput)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentOutput, "utf8"));
    deployment.implementationAddress = newImplementationAddress || deployment.implementationAddress;
    deployment.lastUpgradeDate = new Date().toISOString();
    fs.writeFileSync(deploymentOutput, JSON.stringify(deployment, null, 2));
    console.log("\n✅ Updated deployment-output.json");
  }

  console.log("\n✅ Upgrade complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Verify the new implementation on BaseScan:");
  if (newImplementationAddress) {
    console.log(`   npx hardhat verify --network ${hre.network.name} ${newImplementationAddress}`);
  }
  console.log("\n💡 The proxy address remains the same:", proxyAddress);
  console.log("   All existing NFTs and data are preserved!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

