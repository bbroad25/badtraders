"use client"

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import {
  BADTRADERS_BURN_TO_EARN_NFT_V1_IMAGE_GATEWAY,
  BADTRADERS_BURN_TO_EARN_NFT_V1_IMAGE_IPFS,
  BADTRADERS_BURN_TO_EARN_NFT_V2_IMAGE_GATEWAY,
  BADTRADERS_BURN_TO_EARN_NFT_V2_IMAGE_IPFS,
  BADTRADERS_BAG_IMAGE_GATEWAY,
  BADTRADER_TOKEN_ADDRESS
} from '@/lib/utils/constants';

interface MintNFTProps {
  hasEnoughTokens: boolean;
  balance: number;
  threshold: number;
  walletAddress: string | null;
}

interface SupplyInfo {
  remaining: number | null;
  total: number | null;
  max: number;
}

export default function MintNFT({ hasEnoughTokens, balance, threshold, walletAddress }: MintNFTProps) {
  // Constants - must be declared before useState
  const NFT_BAG_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BADTRADERS_BAG_CONTRACT_ADDRESS || null;
  const NFT_V1_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V1_CONTRACT_ADDRESS || null;
  const NFT_V2_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BADTRADERS_BURN_TO_EARN_NFT_V2_CONTRACT_ADDRESS || null;
  const MINIMUM_BALANCE_BAG = 5_000_000; // 5M tokens required (free mint, no burn)
  const BURN_AMOUNT_V1 = 10_000_000; // 10M tokens
  const BURN_AMOUNT_V2 = 25_000_000; // 25M tokens
  const MAX_SUPPLY_V1 = 100;
  const MAX_SUPPLY_V2 = 900;
  // Bag has no max supply (unlimited)

  const [isMintingBag, setIsMintingBag] = useState(false);
  const [isMintingV1, setIsMintingV1] = useState(false);
  const [isMintingV2, setIsMintingV2] = useState(false);
  const [mintStatus, setMintStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bagSupply, setBagSupply] = useState<number | null>(null);
  const [supplyInfo, setSupplyInfo] = useState<{ v1: SupplyInfo; v2: SupplyInfo }>({
    v1: { remaining: null, total: null, max: MAX_SUPPLY_V1 },
    v2: { remaining: null, total: null, max: MAX_SUPPLY_V2 },
  });

  // Fetch supply info for all contracts
  useEffect(() => {
    const fetchSupplyInfo = async () => {
      try {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');

        const nftAbi = [
          'function getRemainingSupply() view returns (uint256)',
          'function totalSupply() view returns (uint256)',
          'function maxSupply() view returns (uint256)',
        ];

        // Fetch Bag supply info (no max supply, just total)
        if (NFT_BAG_CONTRACT_ADDRESS) {
          try {
            const bagContract = new ethers.Contract(NFT_BAG_CONTRACT_ADDRESS, ['function totalSupply() view returns (uint256)'], provider);
            const totalBag = await bagContract.totalSupply();
            setBagSupply(Number(totalBag));
          } catch (err: any) {
            console.warn('Could not fetch Bag supply info (contract may not be deployed):', err?.message || err);
            setBagSupply(0);
          }
        } else {
          setBagSupply(0);
        }

        // Fetch V1 supply info
        if (NFT_V1_CONTRACT_ADDRESS) {
          try {
            const nftContractV1 = new ethers.Contract(NFT_V1_CONTRACT_ADDRESS, nftAbi, provider);
            const [remainingV1, totalV1] = await Promise.all([
              nftContractV1.getRemainingSupply(),
              nftContractV1.totalSupply(),
            ]);
            setSupplyInfo(prev => ({
              ...prev,
              v1: {
                remaining: Number(remainingV1),
                total: Number(totalV1),
                max: MAX_SUPPLY_V1,
              },
            }));
          } catch (err: any) {
            // Contract might not be deployed yet or network error - that's okay
            console.warn('Could not fetch V1 supply info (contract may not be deployed):', err?.message || err);
            // Set to max supply if contract exists but call fails (might be not initialized)
            setSupplyInfo(prev => ({
              ...prev,
              v1: {
                remaining: MAX_SUPPLY_V1,
                total: 0,
                max: MAX_SUPPLY_V1,
              },
            }));
          }
        } else {
          // No contract address - set to max supply (not deployed yet)
          setSupplyInfo(prev => ({
            ...prev,
            v1: {
              remaining: MAX_SUPPLY_V1,
              total: 0,
              max: MAX_SUPPLY_V1,
            },
          }));
        }

        // Fetch V2 supply info
        if (NFT_V2_CONTRACT_ADDRESS) {
          try {
            const nftContractV2 = new ethers.Contract(NFT_V2_CONTRACT_ADDRESS, nftAbi, provider);
            const [remainingV2, totalV2] = await Promise.all([
              nftContractV2.getRemainingSupply(),
              nftContractV2.totalSupply(),
            ]);
            setSupplyInfo(prev => ({
              ...prev,
              v2: {
                remaining: Number(remainingV2),
                total: Number(totalV2),
                max: MAX_SUPPLY_V2,
              },
            }));
          } catch (err: any) {
            // Contract might not be deployed yet or network error - that's okay
            console.warn('Could not fetch V2 supply info (contract may not be deployed):', err?.message || err);
            // Set to max supply if contract exists but call fails (might be not initialized)
            setSupplyInfo(prev => ({
              ...prev,
              v2: {
                remaining: MAX_SUPPLY_V2,
                total: 0,
                max: MAX_SUPPLY_V2,
              },
            }));
          }
        } else {
          // No contract address - set to max supply (not deployed yet)
          setSupplyInfo(prev => ({
            ...prev,
            v2: {
              remaining: MAX_SUPPLY_V2,
              total: 0,
              max: MAX_SUPPLY_V2,
            },
          }));
        }
      } catch (err) {
        console.warn('Error fetching supply info:', err);
      }
    };

    fetchSupplyInfo();
    // Refresh every 5 seconds for live updates
    const interval = setInterval(fetchSupplyInfo, 5000);
    return () => clearInterval(interval);
  }, [NFT_BAG_CONTRACT_ADDRESS, NFT_V1_CONTRACT_ADDRESS, NFT_V2_CONTRACT_ADDRESS]);

  const handleMintBag = async () => {
    if (!walletAddress || !NFT_BAG_CONTRACT_ADDRESS) {
      setError('Wallet not connected or contract not deployed');
      return;
    }

    setIsMintingBag(true);
    setError(null);
    setMintStatus('Minting Bag NFT...');

    try {
      const { ethers } = await import('ethers');

      if (!window.ethereum) {
        throw new Error('Please install a wallet extension like MetaMask');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Bag minting is free (no token approval needed), just requires balance check
      const bagAbi = [
        'function mint(address to)',
      ];
      const bagContract = new ethers.Contract(NFT_BAG_CONTRACT_ADDRESS, bagAbi, signer);

      const mintTx = await bagContract.mint(walletAddress);
      setMintStatus('Waiting for confirmation...');
      const receipt = await mintTx.wait();

      setMintStatus('Success! Bag NFT minted!');

      // Find the token ID from the event
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = bagContract.interface.parseLog(log);
          return parsed?.name === 'BadTradersBagMinted';
        } catch {
          return false;
        }
      });

      if (mintEvent) {
        const parsed = bagContract.interface.parseLog(mintEvent);
        const tokenId = parsed?.args[1];
        console.log('Minted Bag NFT token ID:', tokenId.toString());
      }

      // Refresh supply info
      const bagAbiView = ['function totalSupply() view returns (uint256)'];
      const bagContractView = new ethers.Contract(NFT_BAG_CONTRACT_ADDRESS, bagAbiView, provider);
      const total = await bagContractView.totalSupply();
      setBagSupply(Number(total));

      // Reset after 3 seconds
      setTimeout(() => {
        setMintStatus(null);
      }, 3000);

    } catch (err: any) {
      console.error('Mint error:', err);
      if (err.code === 4001) {
        setError('Transaction cancelled');
      } else {
        setError(err.message || 'Failed to mint Bag NFT');
      }
      setMintStatus(null);
    } finally {
      setIsMintingBag(false);
    }
  };

  const handleMint = async (version: 'v1' | 'v2') => {
    if (!walletAddress) {
      setError('Wallet not connected');
      return;
    }

    const contractAddress = version === 'v1' ? NFT_V1_CONTRACT_ADDRESS : NFT_V2_CONTRACT_ADDRESS;
    const burnAmount = version === 'v1' ? BURN_AMOUNT_V1 : BURN_AMOUNT_V2;
    const imageIpfs = version === 'v1' ? BADTRADERS_BURN_TO_EARN_NFT_V1_IMAGE_IPFS : BADTRADERS_BURN_TO_EARN_NFT_V2_IMAGE_IPFS;
    const eventName = version === 'v1' ? 'BadTradersBurnToEarnNFTV1Minted' : 'BadTradersBurnToEarnNFTV2Minted';

    if (!contractAddress) {
      setError(`${version.toUpperCase()} contract not deployed`);
      return;
    }

    if (version === 'v1') {
      setIsMintingV1(true);
    } else {
      setIsMintingV2(true);
    }
    setError(null);
    setMintStatus('Approving tokens...');

    try {
      const { ethers } = await import('ethers');

      if (!window.ethereum) {
        throw new Error('Please install a wallet extension like MetaMask');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Step 1: Approve NFT contract to spend tokens
      const tokenAbi = [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
      ];
      const tokenContract = new ethers.Contract(BADTRADER_TOKEN_ADDRESS, tokenAbi, signer);

      const burnAmountWei = ethers.parseUnits(burnAmount.toString(), 18);
      const currentAllowance = await tokenContract.allowance(walletAddress, contractAddress);

      if (currentAllowance < burnAmountWei) {
        setMintStatus('Approving tokens...');
        const approveTx = await tokenContract.approve(contractAddress, burnAmountWei);
        await approveTx.wait();
      }

      // Step 2: Mint NFT
      setMintStatus('Minting NFT...');
      const nftAbi = [
        'function mint(string memory imageUrl, string memory metadataJSON)',
      ];
      const nftContract = new ethers.Contract(contractAddress, nftAbi, signer);

      const mintTx = await nftContract.mint(imageIpfs, '');
      setMintStatus('Waiting for confirmation...');
      const receipt = await mintTx.wait();

      setMintStatus('Success! NFT minted!');

      // Find the token ID from the event
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = nftContract.interface.parseLog(log);
          return parsed?.name === eventName;
        } catch {
          return false;
        }
      });

      if (mintEvent) {
        const parsed = nftContract.interface.parseLog(mintEvent);
        const tokenId = parsed?.args[1];
        console.log(`Minted ${version.toUpperCase()} NFT token ID:`, tokenId.toString());
      }

      // Refresh supply info immediately after mint
      const nftAbiView = [
        'function getRemainingSupply() view returns (uint256)',
        'function totalSupply() view returns (uint256)',
      ];
      const nftContractView = new ethers.Contract(contractAddress, nftAbiView, provider);
      const [remaining, total] = await Promise.all([
        nftContractView.getRemainingSupply(),
        nftContractView.totalSupply(),
      ]);
      if (version === 'v1') {
        setSupplyInfo(prev => ({
          ...prev,
          v1: {
            remaining: Number(remaining),
            total: Number(total),
            max: MAX_SUPPLY_V1,
          },
        }));
      } else {
        setSupplyInfo(prev => ({
          ...prev,
          v2: {
            remaining: Number(remaining),
            total: Number(total),
            max: MAX_SUPPLY_V2,
          },
        }));
      }

      // Reset after 3 seconds
      setTimeout(() => {
        setMintStatus(null);
      }, 3000);

    } catch (err: any) {
      console.error('Mint error:', err);
      if (err.code === 4001) {
        setError('Transaction cancelled');
      } else {
        setError(err.message || 'Failed to mint NFT');
      }
      setMintStatus(null);
    } finally {
      if (version === 'v1') {
        setIsMintingV1(false);
      } else {
        setIsMintingV2(false);
      }
    }
  };

  const hasEnoughForBag = balance >= MINIMUM_BALANCE_BAG;
  const hasEnoughForV1 = balance >= BURN_AMOUNT_V1;
  const hasEnoughForV2 = balance >= BURN_AMOUNT_V2;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Bag NFT Card - FIRST */}
      <Card className="bg-card border-4 border-primary p-6 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground uppercase">
          Bag NFT
        </h2>
        <p className="text-sm text-muted-foreground mb-4 uppercase">
          Free mint • Requires 5M tokens • Unlimited supply
        </p>
        <div className="mb-4 p-3 bg-yellow-500/10 border-2 border-yellow-500/50 rounded">
          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-bold uppercase mb-1">
            ⚠️ Important Requirements
          </p>
          <p className="text-xs text-muted-foreground">
            • Must hold 5M tokens to mint (free, no burn)
          </p>
          <p className="text-xs text-muted-foreground">
            • Must maintain 5M tokens to keep NFT
          </p>
          <p className="text-xs text-muted-foreground">
            • If balance drops below 5M, NFT will be auto-revoked by keepers
          </p>
          <p className="text-xs text-muted-foreground">
            • Can hold V1 & V2 NFTs as children
          </p>
        </div>

        {/* Wallet Info */}
        {walletAddress && (
          <div className="mb-4 p-3 bg-muted/50 border-2 border-primary rounded">
            <div className="text-xs text-muted-foreground uppercase mb-1">
              Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
            <div className="text-sm font-bold text-primary">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $BADTRADERS
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {hasEnoughForBag ? (
                <span className="text-green-600 font-bold">✓ Enough for Bag</span>
              ) : (
                <span className="text-destructive">Need {MINIMUM_BALANCE_BAG.toLocaleString()} for Bag</span>
              )}
            </div>
          </div>
        )}

        {/* Live Supply Counter */}
        {bagSupply !== null ? (
          <div className="mb-4 p-4 bg-primary/10 border-4 border-primary rounded">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                {bagSupply}
              </div>
              <div className="text-xs text-muted-foreground uppercase">
                Total Minted
              </div>
              <div className="text-sm text-foreground mt-2">
                Unlimited supply
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-muted/50 border-2 border-dashed border-primary rounded text-center">
            <div className="text-sm text-muted-foreground uppercase">
              Loading supply...
            </div>
          </div>
        )}

        {/* Show NFT Image */}
        <div className="mb-4">
          <img
            src={BADTRADERS_BAG_IMAGE_GATEWAY}
            alt="BadTraders Bag Parent NFT"
            className="w-full rounded-lg border-4 border-primary"
          />
        </div>

        {!NFT_BAG_CONTRACT_ADDRESS ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-primary uppercase mb-2">CONTRACT NOT DEPLOYED</p>
            <p className="text-xs text-muted-foreground uppercase">
              Bag contract needs to be deployed first.
            </p>
          </div>
        ) : !walletAddress ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-primary uppercase mb-2">CONNECT WALLET</p>
            <p className="text-xs text-muted-foreground uppercase">
              Connect your wallet to mint.
            </p>
          </div>
        ) : !hasEnoughForBag ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-destructive uppercase mb-2">NOT ENOUGH TOKENS</p>
            <p className="text-xs text-muted-foreground uppercase">
              You need 5M tokens to mint Bag.
            </p>
          </div>
        ) : (
          <Button
            onClick={handleMintBag}
            disabled={isMintingBag}
            className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-base py-3 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
          >
            {isMintingBag ? (mintStatus || 'Minting...') : 'MINT BAG (FREE)'}
          </Button>
        )}
      </Card>
      {/* V1 NFT Card */}
      <Card className="bg-card border-4 border-primary p-6 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground uppercase">
          V1 NFT
        </h2>
        <p className="text-sm text-muted-foreground mb-4 uppercase">
          Burn 10M tokens • Max 100 NFTs
        </p>

        {/* Wallet Info */}
        {walletAddress && (
          <div className="mb-4 p-3 bg-muted/50 border-2 border-primary rounded">
            <div className="text-xs text-muted-foreground uppercase mb-1">
              Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
            <div className="text-sm font-bold text-primary">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $BADTRADERS
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {hasEnoughForV1 ? (
                <span className="text-green-600 font-bold">✓ Enough for V1</span>
              ) : (
                <span className="text-destructive">Need {BURN_AMOUNT_V1.toLocaleString()} for V1</span>
              )}
            </div>
          </div>
        )}

        {/* Live Supply Counter */}
        {supplyInfo.v1.remaining !== null && supplyInfo.v1.total !== null ? (
          <div className="mb-4 p-4 bg-primary/10 border-4 border-primary rounded">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                {supplyInfo.v1.remaining}
              </div>
              <div className="text-xs text-muted-foreground uppercase">
                Remaining
              </div>
              <div className="text-sm text-foreground mt-2">
                {supplyInfo.v1.total} / {MAX_SUPPLY_V1} Minted
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-muted/50 border-2 border-dashed border-primary rounded text-center">
            <div className="text-sm text-muted-foreground uppercase">
              Loading supply...
            </div>
          </div>
        )}

        {/* Show NFT Image */}
        <div className="mb-4">
          <img
            src={BADTRADERS_BURN_TO_EARN_NFT_V1_IMAGE_GATEWAY}
            alt="BadTraders Burn To Earn NFT V1"
            className="w-full rounded-lg border-4 border-primary"
          />
        </div>

        {!NFT_V1_CONTRACT_ADDRESS ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-primary uppercase mb-2">CONTRACT NOT DEPLOYED</p>
            <p className="text-xs text-muted-foreground uppercase">
              V1 contract needs to be deployed first.
            </p>
          </div>
        ) : !walletAddress ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-primary uppercase mb-2">CONNECT WALLET</p>
            <p className="text-xs text-muted-foreground uppercase">
              Connect your wallet to mint.
            </p>
          </div>
        ) : !hasEnoughForV1 ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-destructive uppercase mb-2">NOT ENOUGH TOKENS</p>
            <p className="text-xs text-muted-foreground uppercase">
              You need 10M tokens to mint V1.
            </p>
          </div>
        ) : supplyInfo.v1.remaining !== null && supplyInfo.v1.remaining === 0 ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-destructive uppercase mb-2">SOLD OUT</p>
            <p className="text-xs text-muted-foreground uppercase">
              All V1 NFTs have been minted.
            </p>
          </div>
        ) : (
          <Button
            onClick={() => handleMint('v1')}
            disabled={isMintingV1}
            className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-base py-3 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
          >
            {isMintingV1 ? (mintStatus || 'Minting...') : 'MINT V1 (BURN 10M)'}
          </Button>
        )}
      </Card>

      {/* V2 NFT Card */}
      <Card className="bg-card border-4 border-primary p-6 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground uppercase">
          V2 NFT
        </h2>
        <p className="text-sm text-muted-foreground mb-4 uppercase">
          Burn 25M tokens • Max 900 NFTs
        </p>

        {/* Wallet Info */}
        {walletAddress && (
          <div className="mb-4 p-3 bg-muted/50 border-2 border-primary rounded">
            <div className="text-xs text-muted-foreground uppercase mb-1">
              Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
            <div className="text-sm font-bold text-primary">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $BADTRADERS
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {hasEnoughForV2 ? (
                <span className="text-green-600 font-bold">✓ Enough for V2</span>
              ) : (
                <span className="text-destructive">Need {BURN_AMOUNT_V2.toLocaleString()} for V2</span>
              )}
            </div>
          </div>
        )}

        {/* Live Supply Counter */}
        {supplyInfo.v2.remaining !== null && supplyInfo.v2.total !== null ? (
          <div className="mb-4 p-4 bg-primary/10 border-4 border-primary rounded">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                {supplyInfo.v2.remaining}
              </div>
              <div className="text-xs text-muted-foreground uppercase">
                Remaining
              </div>
              <div className="text-sm text-foreground mt-2">
                {supplyInfo.v2.total} / {MAX_SUPPLY_V2} Minted
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-muted/50 border-2 border-dashed border-primary rounded text-center">
            <div className="text-sm text-muted-foreground uppercase">
              Loading supply...
            </div>
          </div>
        )}

        {/* Show NFT Image */}
        <div className="mb-4">
          <img
            src={BADTRADERS_BURN_TO_EARN_NFT_V2_IMAGE_GATEWAY}
            alt="BadTraders Burn To Earn NFT V2"
            className="w-full rounded-lg border-4 border-primary"
          />
        </div>

        {!NFT_V2_CONTRACT_ADDRESS ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-primary uppercase mb-2">CONTRACT NOT DEPLOYED</p>
            <p className="text-xs text-muted-foreground uppercase">
              V2 contract needs to be deployed first.
            </p>
          </div>
        ) : !walletAddress ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-primary uppercase mb-2">CONNECT WALLET</p>
            <p className="text-xs text-muted-foreground uppercase">
              Connect your wallet to mint.
            </p>
          </div>
        ) : !hasEnoughForV2 ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-destructive uppercase mb-2">NOT ENOUGH TOKENS</p>
            <p className="text-xs text-muted-foreground uppercase">
              You need 25M tokens to mint V2.
            </p>
          </div>
        ) : supplyInfo.v2.remaining !== null && supplyInfo.v2.remaining === 0 ? (
          <div className="bg-muted/50 border-4 border-dashed border-primary p-6 text-center">
            <p className="text-lg font-bold text-destructive uppercase mb-2">SOLD OUT</p>
            <p className="text-xs text-muted-foreground uppercase">
              All V2 NFTs have been minted.
            </p>
          </div>
        ) : (
          <Button
            onClick={() => handleMint('v2')}
            disabled={isMintingV2}
            className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-base py-3 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
          >
            {isMintingV2 ? (mintStatus || 'Minting...') : 'MINT V2 (BURN 25M)'}
          </Button>
        )}
      </Card>

      {/* Error Message */}
      {error && (
        <div className="col-span-1 md:col-span-3 mt-4">
          <div className="bg-destructive/20 border-2 border-destructive p-4 rounded">
            <p className="text-destructive text-sm uppercase">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
