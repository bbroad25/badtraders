"use client"

import ErrorMessage from '@/components/leaderboard/ErrorMessage';
import Header from '@/components/leaderboard/Header';
import Leaderboard from '@/components/leaderboard/Leaderboard';
import MyStatus from '@/components/leaderboard/MyStatus';
import { Button } from '@/components/ui/button';
import { WEBSITE_ELIGIBILITY_THRESHOLD, getEligibilityThreshold } from '@/lib/config/eligibility';
import { LeaderboardEntry } from '@/types/leaderboard';
import { sdk } from '@farcaster/miniapp-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
const BADTRADERS_CONTRACT = '0x0774409Cda69A47f272907fd5D0d80173167BB07';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userFid, setUserFid] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isEligible, setIsEligible] = useState<boolean>(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [eligibilityThreshold, setEligibilityThreshold] = useState<number>(WEBSITE_ELIGIBILITY_THRESHOLD);
  const [error, setError] = useState<string | null>(null);

  // Track initialization to prevent multiple calls
  const hasInitialized = useRef(false);
  const providerRef = useRef<any>(null);
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
            const threshold = getEligibilityThreshold(!!userFid);
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
      const threshold = data.threshold || getEligibilityThreshold(!!userFid);
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
  }, [walletAddress]);

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

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoadingLeaderboard(true);
      setError(null);
      try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const data: LeaderboardEntry[] = await response.json();
        setLeaderboard(data);
      } catch (err) {
         console.error(err);
         setError(err instanceof Error ? err.message : 'Could not load the leaderboard. Please check if the API is working.');
      } finally {
        setIsLoadingLeaderboard(false);
      }
    };
    loadLeaderboard();
  }, []);

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

  // handleBuyMore removed - now handled by MyStatus component with swapToken

  // Remove duplicate addMiniApp call - already handled by FarcasterSDKInit in layout

  // Notifications are handled by Farcaster client's native menu
  // No custom UI needed

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      {/* Floating emojis */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[5%] text-6xl opacity-20 emoji-float-1">😂</div>
        <div className="absolute top-[20%] right-[10%] text-5xl opacity-15 emoji-float-2">😭</div>
        <div className="absolute top-[40%] left-[15%] text-7xl opacity-10 emoji-float-3">😂</div>
        <div className="absolute top-[60%] right-[20%] text-6xl opacity-20 emoji-float-1">😭</div>
        <div className="absolute top-[80%] left-[25%] text-5xl opacity-15 emoji-float-2">😂</div>
        <div className="absolute top-[30%] right-[5%] text-8xl opacity-10 emoji-float-3">😭</div>
        <div className="absolute top-[70%] right-[40%] text-6xl opacity-15 emoji-float-1">😂</div>
        <div className="absolute top-[15%] left-[40%] text-5xl opacity-20 emoji-float-2">😭</div>
      </div>

      {/* Main content */}
      <div className="relative z-10">
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20 border-b-4 border-primary">
          <div className="container mx-auto max-w-6xl">
            <Header />
            {/* Wallet status inline in leaderboard */}
            {walletAddress && (
              <div className="text-center mb-4">
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
              <div className="text-center mb-4">
                <Button
                  onClick={handleConnectWallet}
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground uppercase border-2 border-foreground"
                >
                  Connect Wallet
                </Button>
              </div>
            )}
            <main className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2">
                <Leaderboard data={leaderboard} isLoading={isLoadingLeaderboard} />
              </div>
              <div className="flex flex-col gap-8">
                <MyStatus
                  walletAddress={walletAddress}
                  balance={userBalance}
                  isEligible={isEligible}
                  threshold={eligibilityThreshold}
                  isLoadingBalance={isLoadingBalance}
                  fid={userFid}
                />
              </div>
            </main>
            {error && <ErrorMessage message={error} />}
            <footer className="text-center text-muted-foreground mt-12 pb-4">
              <p className="uppercase">Powered by Farcaster, Neynar, Alchemy & Gemini.</p>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

