const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying TestBadTradersToken for testnet testing...");

  // Get the contract factory
  const TestToken = await ethers.getContractFactory("TestBadTradersToken");

  // Deploy the token
  const testToken = await TestToken.deploy();
  await testToken.waitForDeployment();

  const tokenAddress = await testToken.getAddress();
  console.log("✅ TestBadTradersToken deployed to:", tokenAddress);

  // Get deployer address
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;

  // Check initial balance
  const balance = await testToken.balanceOf(deployerAddress);
  console.log("  Deployer balance:", ethers.formatUnits(balance, 18), "TBT");

  const deploymentInfo = {
    network: hre.network.name,
    deployerAddress: deployerAddress,
    tokenAddress: tokenAddress,
    tokenName: await testToken.name(),
    tokenSymbol: await testToken.symbol(),
    deploymentDate: new Date().toISOString(),
  };

  fs.writeFileSync("test-token-deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment information saved to test-token-deployment.json");

  console.log("\n✅ Test token deployment complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Use this token address when deploying NFT contract on testnet:");
  console.log(`   Update BADTRADERS_TOKEN_ADDRESS in deploy-badtraders-nft.cjs to: ${tokenAddress}`);
  console.log("2. Or set it as an environment variable:");
  console.log(`   TESTNET_BADTRADERS_TOKEN_ADDRESS=${tokenAddress}`);
  console.log("\n3. To mint more tokens for testing, call:");
  console.log(`   testToken.mintForSelf(ethers.parseUnits("10000000", 18))`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

