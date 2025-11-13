const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying BadTradersBag parent NFT contract...");

  // Configuration
  const isTestnet = hre.network.name === "base-sepolia" || hre.network.name === "sepolia";
  const BADTRADERS_TOKEN_ADDRESS = isTestnet
    ? (process.env.TESTNET_BADTRADERS_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000")
    : "0x0774409cda69a47f272907fd5d0d80173167bb07"; // Mainnet token
  const MINIMUM_BALANCE = ethers.parseUnits("5000000", 18); // 5M tokens required

  // Get V1 and V2 contract addresses
  const V1_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V1_CONTRACT_ADDRESS || null;
  const V2_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V2_CONTRACT_ADDRESS || null;

  if (isTestnet && BADTRADERS_TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("\n❌ ERROR: Testnet token address not set!");
    console.error("   Please deploy a test token first or set TESTNET_BADTRADERS_TOKEN_ADDRESS in .env");
    process.exit(1);
  }

  if (!V1_CONTRACT_ADDRESS && !V2_CONTRACT_ADDRESS) {
    console.warn("\n⚠️ WARNING: No V1 or V2 contract addresses provided!");
    console.warn("   You can add them later using setAllowedChildContract()");
  }

  console.log("Deployment configuration:");
  console.log("  BadTraders Token:", BADTRADERS_TOKEN_ADDRESS);
  console.log("  Minimum Balance:", ethers.formatUnits(MINIMUM_BALANCE, 18), "tokens (5M)");
  console.log("  V1 Contract:", V1_CONTRACT_ADDRESS || "Not set");
  console.log("  V2 Contract:", V2_CONTRACT_ADDRESS || "Not set");
  console.log("  Network:", hre.network.name);

  // Get the contract factory
  const BadTradersBag = await ethers.getContractFactory("BadTradersBag");

  // Deploy using upgradeable proxy
  const badTradersBag = await upgrades.deployProxy(
    BadTradersBag,
    [
      BADTRADERS_TOKEN_ADDRESS,
      MINIMUM_BALANCE,
      V1_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
      V2_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000"
    ],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await badTradersBag.waitForDeployment();

  const proxyAddress = await badTradersBag.getAddress();
  console.log("✅ BadTradersBag deployed to:", proxyAddress);

  // Wait a bit for proxy to be fully set up
  console.log("\n⏳ Waiting for proxy to be fully initialized...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get the implementation address
  let implementationAddress;
  try {
    implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Implementation address:", implementationAddress);
  } catch (err) {
    console.log("⚠️ Could not get implementation address yet:", err.message);
    console.log("   This is OK - the contract is deployed, implementation address will be available soon");
  }

  // Get current owner
  const currentOwner = await badTradersBag.owner();
  console.log("Current owner:", currentOwner);

  console.log("\n📝 Contract Details:");
  console.log("  Name:", await badTradersBag.name());
  console.log("  Symbol:", await badTradersBag.symbol());
  console.log("  BadTraders Token:", await badTradersBag.badTradersToken());
  console.log("  Minimum Balance:", ethers.formatUnits(await badTradersBag.minimumBalance(), 18), "tokens");
  if (V1_CONTRACT_ADDRESS) {
    console.log("  V1 Allowed:", await badTradersBag.allowedChildContracts(V1_CONTRACT_ADDRESS));
  }
  if (V2_CONTRACT_ADDRESS) {
    console.log("  V2 Allowed:", await badTradersBag.allowedChildContracts(V2_CONTRACT_ADDRESS));
  }

  const deploymentInfo = {
    network: hre.network.name,
    deployerAddress: currentOwner,
    badTradersToken: BADTRADERS_TOKEN_ADDRESS,
    minimumBalance: MINIMUM_BALANCE.toString(),
    v1Contract: V1_CONTRACT_ADDRESS || null,
    v2Contract: V2_CONTRACT_ADDRESS || null,
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress || "N/A",
    deploymentDate: new Date().toISOString(),
  };

  fs.writeFileSync("deployment-output-bag.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment information saved to deployment-output-bag.json");

  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Verify the contract on BaseScan:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${proxyAddress}`);
  console.log("2. Add to your .env file:");
  console.log("   NEXT_PUBLIC_BADTRADERS_BAG_CONTRACT_ADDRESS=" + proxyAddress);
  console.log("\n💡 This parent NFT:");
  console.log("   - Requires 5M tokens to mint (free if you have enough)");
  console.log("   - AUTO-REVOKES if balance drops below 5M (checked on interactions)");
  console.log("   - Can hold V1 and V2 NFTs as children");
  console.log("   - Users can attach their V1/V2 NFTs using attachChild()");
  console.log("\n⚠️  AUTO-REVOCATION:");
  console.log("   - NFTs are automatically checked and revoked when:");
  console.log("     * User tries to attach/detach children");
  console.log("     * User tries to transfer the NFT");
  console.log("   - For batch checking, use batchRevokeIfBelowThreshold()");
  console.log("   - For keeper automation, call batchRevokeIfBelowThreshold() periodically");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

