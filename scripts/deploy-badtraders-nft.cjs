const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying BadTradersBurnToEarnNFTV1 contract...");

  // Configuration
  // Use testnet token if on testnet, otherwise use mainnet token
  const isTestnet = hre.network.name === "base-sepolia" || hre.network.name === "sepolia";
  const BADTRADERS_TOKEN_ADDRESS = isTestnet
    ? (process.env.TESTNET_BADTRADERS_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") // Set this after deploying test token
    : "0x0774409cda69a47f272907fd5d0d80173167bb07"; // Mainnet token from constants.ts
  const BURN_AMOUNT = ethers.parseUnits("10000000", 18); // V1: 10M tokens, V2: 25M tokens (assuming 18 decimals)
  const MAX_SUPPLY = 100; // V1: 100 NFTs, V2: 900 NFTs
  const V1_IMAGE_IPFS_URL = "ipfs://QmSMwi4gTwdogBUq5Yap15MV7GN4eZF4c4DsnQwizN9LmY"; // Shared image for all V1 NFTs

  if (isTestnet && BADTRADERS_TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("\n❌ ERROR: Testnet token address not set!");
    console.error("   Please deploy a test token first:");
    console.error("   npx hardhat run scripts/deploy-test-token.cjs --network base-sepolia");
    console.error("   Then set TESTNET_BADTRADERS_TOKEN_ADDRESS in .env or update this script");
    process.exit(1);
  }

  console.log("Deployment configuration:");
  console.log("  BadTraders Token:", BADTRADERS_TOKEN_ADDRESS);
  console.log("  Burn Amount:", ethers.formatUnits(BURN_AMOUNT, 18), "tokens");
  console.log("  Max Supply:", MAX_SUPPLY, "NFTs");
  console.log("  Network:", hre.network.name);

  // Get the contract factory
  const BadTradersNFT = await ethers.getContractFactory("BadTradersBurnToEarnNFTV1");

  // Deploy using upgradeable proxy
  const badTradersNFT = await upgrades.deployProxy(
    BadTradersNFT,
    [BADTRADERS_TOKEN_ADDRESS, BURN_AMOUNT, MAX_SUPPLY],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await badTradersNFT.waitForDeployment();

  const proxyAddress = await badTradersNFT.getAddress();
  console.log("✅ BadTradersBurnToEarnNFTV1 deployed to:", proxyAddress);

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
  const currentOwner = await badTradersNFT.owner();
  console.log("Current owner:", currentOwner);

  console.log("\n📝 Contract Details:");
  console.log("  Name:", await badTradersNFT.name());
  console.log("  Symbol:", await badTradersNFT.symbol());
  console.log("  BadTraders Token:", await badTradersNFT.badTradersToken());
  console.log("  Burn Amount:", ethers.formatUnits(await badTradersNFT.burnAmount(), 18), "tokens");
  console.log("  Max Supply:", (await badTradersNFT.maxSupply()).toString(), "NFTs");

  const deploymentInfo = {
    network: hre.network.name,
    deployerAddress: currentOwner,
    badTradersToken: BADTRADERS_TOKEN_ADDRESS,
    burnAmount: BURN_AMOUNT.toString(),
    maxSupply: MAX_SUPPLY.toString(),
    v1ImageIpfsUrl: V1_IMAGE_IPFS_URL,
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress || "N/A",
    deploymentDate: new Date().toISOString(),
  };

  fs.writeFileSync("deployment-output.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment information saved to deployment-output.json");

  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Verify the contract on BaseScan:");
  console.log(`   npx hardhat verify --network base ${proxyAddress}`);
  console.log("2. Add to your .env file:");
  console.log("   NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V1_CONTRACT_ADDRESS=" + proxyAddress);
  console.log("\n💡 V1 Image IPFS URL (use for all mints):");
  console.log("   " + V1_IMAGE_IPFS_URL);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

