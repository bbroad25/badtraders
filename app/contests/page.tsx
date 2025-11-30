"use client"

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CONTEST_ELIGIBILITY_THRESHOLD } from '@/lib/config/eligibility';
import { useFarcasterContext } from '@/lib/hooks/useFarcasterContext';
import { sdk } from '@farcaster/miniapp-sdk';
import { ethers } from 'ethers';
import { useEffect, useRef, useState } from 'react';

interface Contest {
  id: number;
  tokenAddress: string;
  tokenSymbol: string | null;
  startDate: string;
  endDate: string;
  status: string;
  tokenName?: string | null;
  tokenLogo?: string | null;
}

interface Position {
  rank: number;
  totalParticipants: number;
  pnl: number;
  status: 'indexing' | 'indexed';
}

interface VotingOption {
  id: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string | null;
  description: string | null;
  voteCount: number;
}

interface VotingPeriod {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
}

export default function ContestsPage() {
  const { currentFid, isInFarcaster } = useFarcasterContext();
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoadingContests, setIsLoadingContests] = useState(true);
  const [position, setPosition] = useState<Position | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const hasInitialized = useRef(false);

  // Voting state
  const [votingPeriod, setVotingPeriod] = useState<VotingPeriod | null>(null);
  const [votingOptions, setVotingOptions] = useState<VotingOption[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isLoadingVoting, setIsLoadingVoting] = useState(true);

  // Load contests and voting on mount
  useEffect(() => {
    loadContests();
    loadVotingData();
  }, []);

  // Load my vote when wallet or fid changes
  useEffect(() => {
    if ((walletAddress || currentFid) && votingPeriod) {
      loadMyVote();
    }
  }, [walletAddress, currentFid, votingPeriod]);

  // Load position when contest or wallet changes
  useEffect(() => {
    if (selectedContest && walletAddress) {
      loadPosition();
    }
  }, [selectedContest, walletAddress]);

  // Get user context from Farcaster SDK on mount
  useEffect(() => {
    if (hasInitialized.current) return;

    const getUserContext = async () => {
      try {
        const context = await sdk.context;

        if (context?.user?.fid) {
          const fid = context.user.fid;

          // Get wallet address from API using FID
          try {
            const response = await fetch(`/api/token-balance?fid=${fid}`);
            const data = await response.json();

            // API returns { address, balance, isEligible, threshold } or { error }
            if (data.error) {
              console.error('API returned error:', data.error);
            } else {
              // API returns address and balance directly
              if (data.address) {
                setWalletAddress(data.address);
              }
              if (data.balance !== undefined) {
                setTokenBalance(data.balance);
              }
            }
          } catch (error) {
            console.error('Error fetching wallet from FID:', error);
          }

          hasInitialized.current = true;
        }
      } catch (err) {
        console.log('Farcaster context not available (normal if not in Farcaster client)', err);
        hasInitialized.current = true; // Mark as initialized even if not in Farcaster
      }
    };

    getUserContext();
  }, []);

  // Check token balance when wallet changes
  useEffect(() => {
    if (walletAddress) {
      checkTokenBalance();
    } else {
      setTokenBalance(null);
    }
  }, [walletAddress]);

  const loadContests = async () => {
    try {
      setIsLoadingContests(true);
      const response = await fetch('/api/contests/list?status=active');
      const data = await response.json();

      if (data.success) {
        // Fetch metadata for each contest token
        const contestsWithMetadata = await Promise.all(
          data.contests.map(async (contest: Contest) => {
            try {
              const metadataResponse = await fetch(`/api/token-metadata?address=${contest.tokenAddress}`);
              const metadataData = await metadataResponse.json();

              if (metadataData.success && metadataData.metadata) {
                return {
                  ...contest,
                  tokenName: metadataData.metadata.name || contest.tokenSymbol,
                  tokenSymbol: metadataData.metadata.symbol || contest.tokenSymbol,
                  tokenLogo: metadataData.metadata.logoUrl || null,
                };
              }
              return contest;
            } catch (error) {
              console.error(`Error fetching metadata for ${contest.tokenAddress}:`, error);
              return contest;
            }
          })
        );

        setContests(contestsWithMetadata);
        if (contestsWithMetadata.length > 0) {
          setSelectedContest(contestsWithMetadata[0]);
        }
      }
    } catch (error) {
      console.error('Error loading contests:', error);
    } finally {
      setIsLoadingContests(false);
    }
  };

  const loadPosition = async () => {
    if (!selectedContest || !walletAddress) return;

    try {
      setIsLoadingPosition(true);
      const response = await fetch(
        `/api/contests/my-position?contestId=${selectedContest.id}&walletAddress=${walletAddress}`
      );
      const data = await response.json();

      if (data.success) {
        setPosition(data.position);
      } else if (response.status === 404) {
        // Not registered yet
        setPosition(null);
      }
    } catch (error) {
      console.error('Error loading position:', error);
    } finally {
      setIsLoadingPosition(false);
    }
  };

  const loadVotingData = async () => {
    try {
      setIsLoadingVoting(true);
      const response = await fetch('/api/votes/list');
      const data = await response.json();

      if (data.success && data.hasActiveVoting) {
        setVotingPeriod(data.votingPeriod);
        setVotingOptions(data.options);
        setTotalVotes(data.totalVotes);
      }
    } catch (error) {
      console.error('Error loading voting data:', error);
    } finally {
      setIsLoadingVoting(false);
    }
  };

  const loadMyVote = async () => {
    if (!votingPeriod) return;

    try {
      const params = new URLSearchParams();
      if (walletAddress) params.append('walletAddress', walletAddress);
      if (currentFid) params.append('fid', currentFid.toString());

      const response = await fetch(`/api/votes/my-vote?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.hasVote) {
        setMyVote(data.vote.optionId);
      } else {
        setMyVote(null);
      }
    } catch (error) {
      console.error('Error loading my vote:', error);
    }
  };

  const submitVote = async (optionId: number) => {
    if (!walletAddress && !currentFid) {
      setMessage({ type: 'error', text: 'Please connect your wallet or log in with Farcaster' });
      return;
    }

    setIsVoting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/votes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          optionId,
          fid: currentFid
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Vote submitted successfully!' });
        setMyVote(optionId);
        // Reload voting data to update counts
        await loadVotingData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit vote' });
      }
    } catch (error: any) {
      console.error('Error submitting vote:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to submit vote' });
    } finally {
      setIsVoting(false);
    }
  };

  const getVotePercentage = (voteCount: number): number => {
    if (totalVotes === 0) return 0;
    return Math.round((voteCount / totalVotes) * 100);
  };

  const checkTokenBalance = async () => {
    if (!walletAddress) return;

    setIsCheckingBalance(true);
    try {
      const response = await fetch(`/api/token-balance?address=${walletAddress}`);
      const data = await response.json();

      // API returns { address, balance, isEligible, threshold } or { error }
      if (data.error) {
        console.error('API returned error:', data.error);
      } else if (data.balance !== undefined) {
        setTokenBalance(data.balance);
      }
    } catch (error) {
      console.error('Error checking token balance:', error);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const connectWallet = async () => {
    // If in Farcaster, wallet is already connected via SDK
    if (isInFarcaster && currentFid) {
      try {
        const response = await fetch(`/api/token-balance?fid=${currentFid}`);
        const data = await response.json();
        if (data.error) {
          setMessage({ type: 'error', text: data.error || 'Unable to get wallet address from Farcaster' });
        } else if (data.address) {
          setWalletAddress(data.address);
          setTokenBalance(data.balance || 0);
        } else {
          setMessage({ type: 'error', text: 'No wallet address found for your Farcaster account' });
        }
      } catch (error: any) {
        setMessage({ type: 'error', text: 'Failed to get wallet from Farcaster' });
      }
      return;
    }

    // Website users only - connect via MetaMask
    if (typeof window === 'undefined' || !window.ethereum) {
      setMessage({ type: 'error', text: 'Please install MetaMask or another wallet' });
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts[0]) {
        setWalletAddress(accounts[0]);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to connect wallet' });
    }
  };

  const registerForContest = async () => {
    if (!selectedContest || !walletAddress) {
      setMessage({ type: 'error', text: 'Please select a contest and connect your wallet' });
      return;
    }

    setIsRegistering(true);
    setMessage(null);

    try {
      // Create message to sign
      const messageText = `I authorize BadTraders to index my wallet ${walletAddress.toLowerCase()} for token ${selectedContest.tokenAddress.toLowerCase()} in contest ${selectedContest.id}. Timestamp: ${Date.now()}`;

      let signature: string;

      // Use Farcaster SDK integrated wallet if available, otherwise fallback to window.ethereum
      let ethereumProvider;

      if (isInFarcaster) {
        // Use Farcaster SDK's integrated wallet - no popups!
        ethereumProvider = await sdk.wallet.getEthereumProvider();
      } else if (window.ethereum) {
        // Website users - use MetaMask
        ethereumProvider = window.ethereum;
      } else {
        throw new Error('Wallet not connected');
      }

      const provider = new ethers.BrowserProvider(ethereumProvider);
      const signer = await provider.getSigner();
      signature = await signer.signMessage(messageText);

      // Send registration request
      const response = await fetch('/api/contests/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contestId: selectedContest.id,
          walletAddress,
          signedMessage: signature,
          message: messageText,
          fid: currentFid
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Show success message with clear notification
        setMessage({
          type: 'success',
          text: `✅ Successfully entered contest! Your wallet is being indexed. This may take a few moments...`
        });

        // Immediately load position to show "indexing" status
        await loadPosition();

        // Poll for position update
        setTimeout(() => {
          loadPosition();
          // Poll every 5 seconds until indexed
          const pollInterval = setInterval(async () => {
            await loadPosition();
            // Check position after loading - need to fetch fresh data
            const checkResponse = await fetch(`/api/contests/my-position?contestId=${selectedContest.id}&walletAddress=${walletAddress}`);
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              if (checkData.position?.status === 'indexed') {
                clearInterval(pollInterval);
                setMessage({
                  type: 'success',
                  text: `🎉 Indexing complete! Your trades have been analyzed. Check your position below.`
                });
                await loadPosition(); // Refresh position display
              }
            }
          }, 5000);

          // Stop polling after 5 minutes
          setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Registration failed' });
      }
    } catch (error: any) {
      console.error('Error registering:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to register' });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-16 md:pt-20">
      <div className="max-w-4xl mx-auto px-3 md:px-4 py-6 md:py-12">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-8 text-center text-foreground uppercase">
          Weekly Contests
        </h1>
        <p className="text-sm md:text-xl lg:text-2xl text-center text-muted-foreground mb-6 md:mb-12">
          Enter weekly trading contests and compete for the worst PnL
        </p>

        {/* Disclaimer - Compact */}
        <Card className="p-3 md:p-4 mb-4 border-2 border-yellow-500 bg-yellow-500/10">
          <div className="flex items-start gap-2">
            <span className="text-xl md:text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-xs md:text-sm leading-relaxed">
                <strong>Beta:</strong> Contests may have issues. We encourage participation to help us improve!
              </p>
            </div>
          </div>
        </Card>

        {/* Vote for Next Contest Token - Compact */}
        {votingPeriod && votingOptions.length > 0 && (
          <Card className="p-3 md:p-4 mb-4 border-2 border-primary bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm md:text-base font-bold text-primary uppercase">Vote for Next Token</h3>
              <span className="text-xs text-muted-foreground">
                Ends: {new Date(votingPeriod.endDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {votingOptions.map((option) => {
                const isMyVote = myVote === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => submitVote(option.id)}
                    disabled={isVoting || (!walletAddress && !currentFid)}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold border-2 rounded transition-all ${
                      isMyVote
                        ? 'bg-green-600 text-white border-green-700'
                        : 'bg-secondary border-primary hover:bg-primary/10'
                    }`}
                  >
                    {isMyVote ? '✓ ' : ''}
                    {option.tokenSymbol || option.tokenAddress.slice(0, 6)}... ({option.voteCount})
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Contest Selection */}
        <Card className="p-4 md:p-6 mb-4 md:mb-6 border-4 border-primary">
          <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-primary uppercase">Active Contests</h2>

          {isLoadingContests ? (
            <p className="text-center text-sm">Loading contests...</p>
          ) : contests.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No active contests available</p>
          ) : (
            <div className="space-y-2">
              {contests.map((contest) => {
                const isSelected = selectedContest?.id === contest.id;
                // Check if registered for THIS specific contest
                const isRegistered = isSelected && position !== null;

                return (
                  <div
                    key={contest.id}
                    className={`p-3 md:p-4 border-2 rounded cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/20 shadow-lg'
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setSelectedContest(contest);
                      setMessage(null); // Clear any previous messages
                      // Position will load automatically via useEffect
                    }}
                  >
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        {contest.tokenLogo && (
                          <img
                            src={contest.tokenLogo}
                            alt={contest.tokenName || contest.tokenSymbol || 'Token'}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-primary flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm md:text-lg truncate">
                            {contest.tokenName || contest.tokenSymbol || `${contest.tokenAddress.slice(0, 6)}...${contest.tokenAddress.slice(-4)}`}
                          </p>
                          {contest.tokenSymbol && contest.tokenName && (
                            <p className="text-xs text-muted-foreground uppercase">{contest.tokenSymbol}</p>
                          )}
                          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                            {new Date(contest.startDate).toLocaleDateString()} - {new Date(contest.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {isSelected && isRegistered && (
                          <span className="text-xs md:text-sm font-bold text-green-500 bg-green-500/20 px-2 py-1 rounded border border-green-500/50">
                            ✓ Entered
                          </span>
                        )}
                        {isSelected && !isRegistered && (
                          <span className="text-xs md:text-sm font-bold text-primary">Selected</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Wallet Connection - Only show for non-Farcaster users */}
        {!walletAddress && !isInFarcaster && (
          <Card className="p-6 mb-6 border-4 border-primary">
            <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Connect Wallet</h2>
            <p className="text-muted-foreground mb-4">
              Connect your wallet to enter the contest and authorize indexing
            </p>
            <Button onClick={connectWallet} className="w-full">
              Connect Wallet
            </Button>
          </Card>
        )}

        {/* Farcaster users - wallet is already connected */}
        {isInFarcaster && !walletAddress && (
          <Card className="p-6 mb-6 border-4 border-primary">
            <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Loading Wallet</h2>
            <p className="text-muted-foreground mb-4">
              Getting your wallet address from Farcaster...
            </p>
          </Card>
        )}

        {/* Registration */}
        {walletAddress && selectedContest && !position && (
          <Card className="p-4 md:p-6 mb-4 md:mb-6 border-4 border-primary">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-primary uppercase">Enter Contest</h2>
            <p className="text-sm md:text-base text-muted-foreground mb-2">
              Sign a message to authorize indexing of your wallet transactions for this contest token.
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mb-3 bg-primary/5 p-2 rounded border border-primary/20">
              <strong>What happens:</strong> We'll fetch all your swap transactions for this token during the contest period, calculate your PnL, and rank you on the leaderboard.
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mb-3 font-mono">
              Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>

            {/* Token Balance Check */}
            {isCheckingBalance ? (
              <p className="text-sm text-muted-foreground mb-4">Checking token balance...</p>
            ) : tokenBalance !== null ? (
              <div className={`p-3 rounded mb-4 border-2 ${
                tokenBalance >= CONTEST_ELIGIBILITY_THRESHOLD
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'bg-red-500/20 border-red-500/50 text-red-400'
              }`}>
                <p className="text-sm font-bold mb-1">
                  {tokenBalance >= CONTEST_ELIGIBILITY_THRESHOLD ? '✓ ' : '✗ '}
                  Token Balance: {tokenBalance.toLocaleString()} BadTraders
                </p>
                <p className="text-xs">
                  {tokenBalance >= CONTEST_ELIGIBILITY_THRESHOLD
                    ? `You're eligible! (Need ${CONTEST_ELIGIBILITY_THRESHOLD.toLocaleString()}+)`
                    : `You need ${(CONTEST_ELIGIBILITY_THRESHOLD - tokenBalance).toLocaleString()} more tokens to enter`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Unable to check token balance</p>
            )}

            {!position && (
              <Button
                onClick={registerForContest}
                disabled={isRegistering || (tokenBalance !== null && tokenBalance < CONTEST_ELIGIBILITY_THRESHOLD)}
                className="w-full"
              >
                {isRegistering
                  ? 'Registering...'
                  : tokenBalance !== null && tokenBalance < CONTEST_ELIGIBILITY_THRESHOLD
                  ? 'Insufficient Token Balance'
                  : 'Enter Contest & Start Indexing'}
              </Button>
            )}

            {message && (
              <div
                className={`mt-3 md:mt-4 p-3 md:p-4 rounded-lg border-2 ${
                  message.type === 'success'
                    ? 'bg-green-500/20 text-green-400 border-green-500/50'
                    : 'bg-red-500/20 text-red-400 border-red-500/50'
                }`}
              >
                <p className="text-sm md:text-base font-medium">{message.text}</p>
              </div>
            )}
          </Card>
        )}

        {/* Position Display */}
        {position && selectedContest && (
          <Card className="p-4 md:p-6 border-4 border-primary">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-primary uppercase">Your Position</h2>

            {position.status === 'indexing' ? (
              <div className="text-center py-4">
                <p className="text-base md:text-lg mb-2">⏳ Indexing your trades...</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Fetching your transactions and calculating PnL. This may take a few moments.
                </p>
                <div className="mt-4">
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                <div className="text-center p-3 md:p-4 bg-primary/10 rounded-lg border-2 border-primary">
                  <p className="text-2xl md:text-4xl font-bold text-primary mb-1">
                    Rank #{position.rank || 'N/A'}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    out of {position.totalParticipants} participants
                  </p>
                </div>

                <div className="text-center p-3 md:p-4 bg-card rounded-lg border-2 border-primary/50">
                  <p className="text-xl md:text-2xl font-bold mb-1">
                    PnL: ${position.pnl.toFixed(2)}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {position.pnl < 0 ? 'You\'re losing! 🎉' : position.pnl > 0 ? 'You\'re winning... 😢' : 'Break even 🤷'}
                  </p>
                </div>

                <Button
                  onClick={() => window.location.href = `/contests/leaderboard?contestId=${selectedContest?.id}`}
                  className="w-full text-sm md:text-base"
                >
                  View Full Leaderboard
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// Extend Window interface
declare global {
  interface Window {
    ethereum?: any;
  }
}

