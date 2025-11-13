"use client"

import MintNFT from '@/components/leaderboard/MintNFT';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useCallback, useEffect, useState, useRef } from 'react';

const FARCASTER_ELIGIBILITY_THRESHOLD = 10_000_000; // 10M for Farcaster miniapp users (NFT mint threshold)
const WEBSITE_ELIGIBILITY_THRESHOLD = 10_000_000; // 10M for website users (NFT mint threshold)

export default function MintPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userFid, setUserFid] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isEligible, setIsEligible] = useState<boolean>(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [eligibilityThreshold, setEligibilityThreshold] = useState<number>(WEBSITE_ELIGIBILITY_THRESHOLD);
  const [error, setError] = useState<string | null>(null);

  // Track initialization to prevent multiple calls
  const hasInitialized = useRef(false);
  const walletAddressRef = useRef<string | null>(null);

  const loadTokenBalance = useCallback(async (fid: number | null, address: string | null = null) => {
    setIsLoadingBalance(true);
    try {
      // Prefer FID-based lookup via Neynar API
      const url = fid
        ? `/api/token-balance?fid=${fid}`
        : address
          ? `/api/token-balance?address=${address}`
          : null

      if (!url) {
        setUserBalance(0);
        setIsEligible(false);
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        // API failed - use client-side contract query instead
        if (address) {
          console.warn('API failed, using client-side contract query');
          try {
            const { ethers } = await import('ethers');
            // Use JsonRpcProvider for direct contract queries (doesn't need wallet connection)
            const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
            const tokenAddress = '0x0774409Cda69A47f272907fd5D0d80173167BB07';
            const tokenAbi = [
              'function balanceOf(address owner) view returns (uint256)',
              'function decimals() view returns (uint8)'
            ];
            const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
            const balance = await tokenContract.balanceOf(address);
            const decimals = await tokenContract.decimals().catch(() => 18);
            const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
            setUserBalance(balanceFormatted);
            // Use appropriate threshold based on whether we have FID (Farcaster user)
            const threshold = userFid ? FARCASTER_ELIGIBILITY_THRESHOLD : WEBSITE_ELIGIBILITY_THRESHOLD;
            setEligibilityThreshold(threshold);
            setIsEligible(balanceFormatted >= threshold);
            return;
          } catch (fallbackErr) {
            console.warn('Client-side contract query failed:', fallbackErr);
            // Gracefully continue with zero balance
          }
        }
        // No address available - set to zero gracefully
        setUserBalance(0);
        setIsEligible(false);
        return;
      }
      const data = await response.json();
      const balance = data.balance || 0;
      const threshold = data.threshold || (userFid ? FARCASTER_ELIGIBILITY_THRESHOLD : WEBSITE_ELIGIBILITY_THRESHOLD);
      setUserBalance(balance);
      setEligibilityThreshold(threshold);
      // Calculate eligibility client-side (just balance >= threshold)
      setIsEligible(balance >= threshold);
      // Update wallet address from response if provided
      if (data.address && !walletAddress) {
        setWalletAddress(data.address);
      }
    } catch (err) {
      // Graceful error handling - don't throw, just log and set defaults
      console.warn('Error loading token balance (gracefully handled):', err);
      setUserBalance(0);
      setIsEligible(false);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [walletAddress, userFid]);

  // Get user context from Farcaster SDK - only run once on mount
  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitialized.current) return;

    const getUserContext = async () => {
      try {
        // sdk.context is a Promise - need to await it
        const context = await sdk.context;

        // Check if we're in a Mini App and user is logged in
        if (context?.user?.fid) {
          const fid = context.user.fid;
          setUserFid(fid);

          // In Farcaster, skip wallet provider calls to avoid triggering wallet popups
          // Just use the API with FID - it can get the address from Neynar if needed
          await loadTokenBalance(fid, null);
          hasInitialized.current = true;
        }
      } catch (err) {
        // Not in Farcaster client or context not available - that's okay
        console.log('Farcaster context not available (normal if not in Farcaster client)', err);
      }
    };

    getUserContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Listen for wallet account changes ONLY (website users only - NOT in Farcaster)
  // NO automatic connection attempts - only listen for changes when user manually connects
  useEffect(() => {
    // Don't run if in Farcaster miniapp - wallet is handled by Farcaster SDK
    if (userFid !== null) return; // If we have FID, we're in Farcaster, skip this

    if (typeof window === 'undefined' || !window.ethereum) return;

    // ONLY listen for account changes - NO automatic checks, NO connect listeners
    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length > 0) {
        const address = accounts[0];
        walletAddressRef.current = address;
        setWalletAddress(address);
        await loadTokenBalance(null, address);
      } else {
        walletAddressRef.current = null;
        setWalletAddress(null);
        setUserBalance(0);
        setIsEligible(false);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [loadTokenBalance, userFid]); // Add userFid to deps - if we have FID, skip wallet checks

  const handleConnectWallet = useCallback(async () => {
    try {
      // Don't do anything if in Farcaster - wallet is handled by Farcaster SDK
      const context = await sdk.context;
      if (context?.user?.fid) {
        const fid = context.user.fid;
        setUserFid(fid);
        await loadTokenBalance(fid, null);
        return; // In Farcaster, don't try to connect external wallet
      }

      // Website users only - connect via window.ethereum
      if (typeof window === 'undefined' || !window.ethereum) {
        alert('Please install a wallet extension like MetaMask');
        return;
      }

      // ONLY call eth_requestAccounts when user explicitly clicks button
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts[0]) {
        const address = accounts[0];
        walletAddressRef.current = address;
        setWalletAddress(address);
        await loadTokenBalance(null, address);
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      if (err.code !== 4001) { // User rejected
        setError('Failed to connect wallet. Please try again.');
      }
    }
  }, [loadTokenBalance]);

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      {/* Main content */}
      <div className="relative z-10">
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
          <div className="container mx-auto max-w-4xl relative">
            {/* Info Button - Top Right Corner */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 h-8 w-8 rounded-full border-2 border-primary hover:bg-primary/10"
                  aria-label="About NFT Minting"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-bold uppercase text-primary">
                    About NFT Minting 🎨
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    Learn how the BadTraders NFT system works
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold uppercase text-primary">BURN TO EARN NFTS (V1 & V2)</h3>
                    <p className="text-base leading-relaxed">
                      Prove your commitment to bad trading by <span className="font-bold text-primary">burning $BADTRADERS tokens</span> to mint exclusive NFTs.
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                      <li>
                        <span className="font-bold">V1 NFTs:</span> Burn <span className="font-bold text-primary">10M tokens</span> to mint. Limited to <span className="font-bold">100 NFTs</span> total.
                      </li>
                      <li>
                        <span className="font-bold">V2 NFTs:</span> Burn <span className="font-bold text-primary">25M tokens</span> to mint. Limited to <span className="font-bold">900 NFTs</span> total.
                      </li>
                      <li>
                        Each NFT is numbered and includes your mint number in its metadata, making each one unique.
                      </li>
                      <li>
                        These NFTs use <span className="font-bold">ERC-7401</span> composability, meaning they can be attached to parent NFTs.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-bold uppercase text-primary">BADTRADERS BAG (PARENT NFT)</h3>
                    <p className="text-base leading-relaxed">
                      The <span className="font-bold text-primary">BadTradersBag</span> is a special parent NFT that can hold your V1 and V2 NFTs as children.
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                      <li>
                        <span className="font-bold">Free to mint</span> if you hold <span className="font-bold text-primary">5M $BADTRADERS tokens</span>.
                      </li>
                      <li>
                        <span className="font-bold">Unlimited supply</span> - no cap on how many can be minted.
                      </li>
                      <li>
                        <span className="font-bold">Auto-revocation:</span> If your token balance drops below 5M, keepers will automatically revoke (burn) your Bag NFT.
                      </li>
                      <li>
                        Attach your V1 and V2 NFTs to your Bag to create a collection. The Bag's metadata updates to show which children are attached.
                      </li>
                      <li>
                        The Bag NFT uses <span className="font-bold">ERC-7401</span> for cross-contract parent-child relationships.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-bold uppercase text-primary">HOW IT WORKS</h3>
                    <ol className="list-decimal list-inside space-y-2 ml-4 text-base">
                      <li>
                        <span className="font-bold">For V1/V2:</span> Approve the NFT contract to spend your tokens, then mint. The tokens are permanently burned.
                      </li>
                      <li>
                        <span className="font-bold">For Bag:</span> If you hold 5M+ tokens, mint for free. No tokens are burned.
                      </li>
                      <li>
                        <span className="font-bold">Attach Children:</span> Use the <span className="font-bold">attachChild</span> function to link your V1/V2 NFTs to your Bag NFT.
                      </li>
                      <li>
                        <span className="font-bold">Maintain Balance:</span> Keep 5M+ tokens to keep your Bag NFT. If you drop below, it will be auto-revoked.
                      </li>
                    </ol>
                  </div>

                  <div className="bg-primary/10 border-4 border-primary p-4 rounded-lg">
                    <p className="text-sm font-bold text-primary uppercase mb-2">⚠️ Important Notes</p>
                    <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                      <li>Burned tokens are permanently removed from circulation</li>
                      <li>Bag NFTs require maintaining a 5M token balance</li>
                      <li>All NFTs use IPFS for decentralized image storage</li>
                      <li>Contracts are upgradeable via UUPS proxy</li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <h1 className="text-5xl md:text-6xl font-bold mb-8 text-center text-foreground uppercase">
              MINT NFT
            </h1>
            <p className="text-xl md:text-2xl text-center text-muted-foreground mb-12 uppercase">
              Mint your BadTraders NFTs
            </p>
            <p className="text-lg text-center text-muted-foreground mb-12">
              Bag: Free mint (5M tokens required, unlimited) • V1: Burn 10M tokens (100 NFTs max) • V2: Burn 25M tokens (900 NFTs max)
            </p>

            {/* Wallet status */}
            {walletAddress && (
              <div className="text-center mb-6">
                <div className="inline-block bg-card border-2 border-primary p-2 rounded">
                  <div className="text-xs text-muted-foreground uppercase">
                    Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </div>
                  {userBalance > 0 && (
                    <div className="text-xs text-primary font-bold">
                      {userBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $BADTRADERS
                    </div>
                  )}
                </div>
              </div>
            )}
            {!walletAddress && (
              <div className="text-center mb-6">
                <Button
                  onClick={handleConnectWallet}
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  Connect Wallet
                </Button>
              </div>
            )}

            {/* Mint NFT Component */}
            <div className="flex justify-center">
              <div className="w-full max-w-6xl">
                <MintNFT
                  hasEnoughTokens={isEligible}
                  balance={userBalance}
                  threshold={eligibilityThreshold}
                  walletAddress={walletAddress}
                />
              </div>
            </div>

            {error && (
              <div className="mt-6 text-center">
                <div className="bg-destructive/20 border-2 border-destructive p-4 rounded inline-block">
                  <p className="text-destructive text-sm uppercase">{error}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}

