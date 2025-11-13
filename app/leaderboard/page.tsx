"use client"

import ErrorMessage from '@/components/leaderboard/ErrorMessage';
import Header from '@/components/leaderboard/Header';
import Leaderboard from '@/components/leaderboard/Leaderboard';
import MemeOfTheWeek from '@/components/leaderboard/MemeOfTheWeek';
import MintNFT from '@/components/leaderboard/MintNFT';
import MyStatus from '@/components/leaderboard/MyStatus';
import { Button } from '@/components/ui/button';
import { LeaderboardEntry } from '@/types/leaderboard';
import { sdk } from '@farcaster/miniapp-sdk';
import { useCallback, useEffect, useState, useRef } from 'react';

const FARCASTER_ELIGIBILITY_THRESHOLD = 1_000_000; // 1M for Farcaster miniapp users
const WEBSITE_ELIGIBILITY_THRESHOLD = 2_000_000; // 2M for website users
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
  const [memeImageUrl, setMemeImageUrl] = useState<string | null>(null);
  const [isGeneratingMeme, setIsGeneratingMeme] = useState<boolean>(false);
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

          // Get wallet address - cache provider to avoid repeated calls
          if (!providerRef.current) {
            providerRef.current = await sdk.wallet.getEthereumProvider();
          }

          const ethProvider = providerRef.current;
          if (ethProvider) {
            try {
              const accounts = await ethProvider.request({ method: 'eth_accounts' });
              if (accounts && accounts[0]) {
                const address = accounts[0];
                walletAddressRef.current = address;
                setWalletAddress(address);
                // Try API with FID first, but pass address for client-side fallback
                await loadTokenBalance(fid, address);
                hasInitialized.current = true;
                return;
              }
            } catch (e) {
              console.log('Could not get wallet address:', e);
            }
          }

          // No address yet - try API with just FID (API may return address from Neynar)
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

  // Listen for wallet connections from WalletConnect (website users only - NOT in Farcaster)
  useEffect(() => {
    // Don't run if in Farcaster miniapp - wallet is handled by Farcaster SDK
    if (userFid !== null) return; // If we have FID, we're in Farcaster, skip this
    
    if (typeof window === 'undefined' || !window.ethereum) return;

    const checkWalletConnection = async () => {
      try {
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const address = accounts[0].address;
          // Only update if different or if we don't have one yet
          if (!walletAddressRef.current || walletAddressRef.current.toLowerCase() !== address.toLowerCase()) {
            walletAddressRef.current = address;
            setWalletAddress(address);
            // Load balance for website user (no FID)
            await loadTokenBalance(null, address);
          }
        }
      } catch (error) {
        // Wallet not connected or not available
        console.log('Wallet check error:', error);
      }
    };

    // Check immediately ONCE on mount (passive check - only reads existing connection)
    checkWalletConnection();

    // Listen for account changes (passive - only fires when user manually changes accounts)
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

    // Listen for connect event (passive - only fires when wallet connects)
    window.ethereum.on('connect', checkWalletConnection);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('connect', checkWalletConnection);
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
      // First try to get FID from context
      const context = await sdk.context;
      if (context?.user?.fid) {
        const fid = context.user.fid;
        setUserFid(fid);
        await loadTokenBalance(fid);
      }

      // Also get wallet address for display - reuse cached provider if available
      const ethProvider = providerRef.current || await sdk.wallet.getEthereumProvider();
      if (ethProvider) {
        // Cache it for future use
        if (!providerRef.current) {
          providerRef.current = ethProvider;
        }
        try {
          const accounts = await ethProvider.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) {
            setWalletAddress(accounts[0]);
            // If no FID available, fallback to address-based lookup
            if (!context?.user?.fid) {
              await loadTokenBalance(null, accounts[0]);
            }
          }
        } catch (e) {
          console.log('Could not get wallet address:', e);
        }
      } else {
        setError('Ethereum provider not available. Make sure you\'re using Farcaster client.');
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet. Please try again.');
    }
  }, [loadTokenBalance]);

  // handleBuyMore removed - now handled by MyStatus component with swapToken

  // Remove duplicate addMiniApp call - already handled by FarcasterSDKInit in layout

  // Notifications are handled by Farcaster client's native menu
  // No custom UI needed

  const handleGenerateMeme = useCallback(async () => {
    const winner = leaderboard[0];
    if (!winner) {
      setError('Leaderboard is empty, cannot NFT your losses.');
      return;
    }
    setIsGeneratingMeme(true);
    setError(null);
    setMemeImageUrl(null);

    try {
      const response = await fetch('/api/meme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(winner),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mint NFT');
      }

      const { imageUrl } = await response.json();
      setMemeImageUrl(imageUrl);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while minting your loss NFT.');
    } finally {
      setIsGeneratingMeme(false);
    }
  }, [leaderboard]);

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
                <MintNFT
                  hasEnoughTokens={isEligible}
                  balance={userBalance}
                  threshold={eligibilityThreshold}
                />
                <MemeOfTheWeek
                  winner={leaderboard[0]}
                  onGenerate={handleGenerateMeme}
                  isLoading={isGeneratingMeme}
                  imageUrl={memeImageUrl}
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

