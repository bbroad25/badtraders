const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying BadTradersBurnToEarnNFTV2 contract...");

  // Configuration
  // Use testnet token if on testnet, otherwise use mainnet token
  const isTestnet = hre.network.name === "base-sepolia" || hre.network.name === "sepolia";
  const BADTRADERS_TOKEN_ADDRESS = isTestnet
    ? (process.env.TESTNET_BADTRADERS_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") // Set this after deploying test token
    : "0x0774409cda69a47f272907fd5d0d80173167bb07"; // Mainnet token from constants.ts
  const BURN_AMOUNT = ethers.parseUnits("25000000", 18); // V2: 25M tokens (assuming 18 decimals)
  const MAX_SUPPLY = 900; // V2: 900 NFTs
  const V2_IMAGE_IPFS_URL = "ipfs://QmexAenCuwVzhMJQ5JWrcN92mEqGXreovk5FCMQrDZkNrf"; // Shared image for all V2 NFTs

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
  const BadTradersNFTV2 = await ethers.getContractFactory("BadTradersBurnToEarnNFTV2");

  // Deploy using upgradeable proxy
  const badTradersNFTV2 = await upgrades.deployProxy(
    BadTradersNFTV2,
    [BADTRADERS_TOKEN_ADDRESS, BURN_AMOUNT, MAX_SUPPLY],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await badTradersNFTV2.waitForDeployment();

  const proxyAddress = await badTradersNFTV2.getAddress();
  console.log("✅ BadTradersBurnToEarnNFTV2 deployed to:", proxyAddress);

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
  const currentOwner = await badTradersNFTV2.owner();
  console.log("Current owner:", currentOwner);

  console.log("\n📝 Contract Details:");
  console.log("  Name:", await badTradersNFTV2.name());
  console.log("  Symbol:", await badTradersNFTV2.symbol());
  console.log("  BadTraders Token:", await badTradersNFTV2.badTradersToken());
  console.log("  Burn Amount:", ethers.formatUnits(await badTradersNFTV2.burnAmount(), 18), "tokens");
  console.log("  Max Supply:", (await badTradersNFTV2.maxSupply()).toString(), "NFTs");

  const deploymentInfo = {
    network: hre.network.name,
    deployerAddress: currentOwner,
    badTradersToken: BADTRADERS_TOKEN_ADDRESS,
    burnAmount: BURN_AMOUNT.toString(),
    maxSupply: MAX_SUPPLY.toString(),
    v2ImageIpfsUrl: V2_IMAGE_IPFS_URL,
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress || "N/A",
    deploymentDate: new Date().toISOString(),
  };

  fs.writeFileSync("deployment-output-v2.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment information saved to deployment-output-v2.json");

  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Verify the contract on BaseScan:");
  console.log(`   npx hardhat verify --network base ${proxyAddress}`);
  console.log("2. Add to your .env file:");
  console.log("   NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V2_CONTRACT_ADDRESS=" + proxyAddress);
  console.log("\n💡 V2 Image IPFS URL (use for all mints):");
  console.log("   " + V2_IMAGE_IPFS_URL);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

