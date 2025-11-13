"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFarcasterContext } from '@/lib/hooks/useFarcasterContext';
import { ethers } from 'ethers';
import { sdk } from '@farcaster/miniapp-sdk';

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
  const CONTEST_ELIGIBILITY_THRESHOLD = 5_000_000; // 5M tokens required
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
        setMessage({ type: 'success', text: data.message || 'Registration successful! Indexing started.' });

        // Poll for position update
        setTimeout(() => {
          loadPosition();
          // Poll every 5 seconds until indexed
          const pollInterval = setInterval(async () => {
            await loadPosition();
            // Check if indexed (position will be updated by loadPosition)
            const currentPos = position;
            if (currentPos?.status === 'indexed') {
              clearInterval(pollInterval);
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
    <div className="min-h-screen bg-background text-foreground pt-16">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-5xl md:text-6xl font-bold mb-8 text-center text-foreground uppercase">
          Weekly Contests
        </h1>
        <p className="text-xl md:text-2xl text-center text-muted-foreground mb-12">
          Enter weekly trading contests and compete for the worst PnL
        </p>

        {/* Disclaimer */}
        <Card className="p-6 mb-6 border-4 border-yellow-500 bg-yellow-500/10">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⚠️</span>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2 text-yellow-600 uppercase">Beta Disclaimer</h2>
              <p className="text-base leading-relaxed">
                Contests are in <strong>beta</strong> and may experience issues as we iron out the details. 
                We encourage you to enter contests anyway! Your participation helps us improve the system. 
                If you encounter any problems, please let us know.
              </p>
            </div>
          </div>
        </Card>

        {/* Vote for Next Contest Token */}
        <Card className="p-6 mb-6 border-4 border-primary">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Vote for Next Contest Token</h2>

          {isLoadingVoting ? (
            <p className="text-center">Loading voting options...</p>
          ) : !votingPeriod ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-2">No active voting period</p>
              <p className="text-sm text-muted-foreground">
                Check back soon to vote for the next contest token!
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Voting ends: {new Date(votingPeriod.endDate).toLocaleDateString()}
              </p>

              {votingOptions.length === 0 ? (
                <p className="text-center text-muted-foreground">No voting options available</p>
              ) : (
                <div className="space-y-3">
                  {votingOptions.map((option) => {
                    const percentage = getVotePercentage(option.voteCount);
                    const isMyVote = myVote === option.id;

                    return (
                      <div
                        key={option.id}
                        className={`p-4 border-2 rounded ${
                          isMyVote
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-primary'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-bold text-primary uppercase">
                                {option.tokenSymbol || option.tokenAddress.slice(0, 10)}...
                              </h3>
                              {isMyVote && (
                                <span className="text-green-600 font-bold text-xs">✓ Your Vote</span>
                              )}
                            </div>
                            {option.description && (
                              <p className="text-xs text-muted-foreground mb-2">{option.description}</p>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-xl font-bold text-primary">{option.voteCount}</div>
                            <div className="text-xs text-muted-foreground">{percentage}%</div>
                          </div>
                        </div>

                        {/* Vote Progress Bar */}
                        <div className="mb-2">
                          <div className="w-full bg-muted h-2 rounded-full overflow-hidden border border-primary">
                            <div
                              className={`h-full transition-all ${
                                isMyVote ? 'bg-green-500' : 'bg-primary'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>

                        <Button
                          onClick={() => submitVote(option.id)}
                          disabled={isVoting || (!walletAddress && !currentFid)}
                          size="sm"
                          className={`w-full text-xs ${
                            isMyVote ? 'bg-green-600 hover:bg-green-700' : ''
                          }`}
                        >
                          {isMyVote
                            ? '✓ Voted'
                            : isVoting
                            ? 'Submitting...'
                            : 'Vote'}
                        </Button>
                      </div>
                    );
                  })}
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Total Votes: {totalVotes}
                  </p>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Contest Selection */}
        <Card className="p-6 mb-6 border-4 border-primary">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Select Contest</h2>

          {isLoadingContests ? (
            <p className="text-center">Loading contests...</p>
          ) : contests.length === 0 ? (
            <p className="text-center text-muted-foreground">No active contests available</p>
          ) : (
            <div className="space-y-2">
              {contests.map((contest) => (
                <div
                  key={contest.id}
                  className={`p-4 border-2 rounded cursor-pointer transition-all ${
                    selectedContest?.id === contest.id
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedContest(contest)}
                >
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      {contest.tokenLogo && (
                        <img
                          src={contest.tokenLogo}
                          alt={contest.tokenName || contest.tokenSymbol || 'Token'}
                          className="w-10 h-10 rounded-full border-2 border-primary"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-lg">
                          {contest.tokenName || contest.tokenSymbol || `${contest.tokenAddress.slice(0, 6)}...${contest.tokenAddress.slice(-4)}`}
                        </p>
                        {contest.tokenSymbol && contest.tokenName && (
                          <p className="text-xs text-muted-foreground uppercase">{contest.tokenSymbol}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(contest.startDate).toLocaleDateString()} - {new Date(contest.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {selectedContest?.id === contest.id && (
                      <span className="text-primary font-bold">✓ Selected</span>
                    )}
                  </div>
                </div>
              ))}
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
        {walletAddress && selectedContest && (
          <Card className="p-6 mb-6 border-4 border-primary">
            <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Enter Contest</h2>
            <p className="text-muted-foreground mb-4">
              Sign a message to authorize indexing of your wallet for this contest
            </p>
            <p className="text-sm text-muted-foreground mb-4">
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
                className={`mt-4 p-3 rounded ${
                  message.type === 'success'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                }`}
              >
                {message.text}
              </div>
            )}
          </Card>
        )}

        {/* Position Display */}
        {position && (
          <Card className="p-6 border-4 border-primary">
            <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Your Position</h2>

            {position.status === 'indexing' ? (
              <div className="text-center">
                <p className="text-lg mb-2">⏳ Indexing your trades...</p>
                <p className="text-sm text-muted-foreground">This may take a few moments</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary mb-2">Rank #{position.rank}</p>
                  <p className="text-muted-foreground">out of {position.totalParticipants} participants</p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold">
                    PnL: ${position.pnl.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {position.pnl < 0 ? 'You\'re losing! 🎉' : 'You\'re winning... 😢'}
                  </p>
                </div>

                <Button
                  onClick={() => window.location.href = `/contests/leaderboard?contestId=${selectedContest?.id}`}
                  className="w-full"
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

