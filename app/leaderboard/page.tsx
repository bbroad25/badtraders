"use client"

import { useState, useCallback, useEffect } from 'react';
import Header from '@/components/leaderboard/Header';
import ErrorMessage from '@/components/leaderboard/ErrorMessage';
import Leaderboard from '@/components/leaderboard/Leaderboard';
import MyStatus from '@/components/leaderboard/MyStatus';
import MemeOfTheWeek from '@/components/leaderboard/MemeOfTheWeek';
import { LeaderboardEntry } from '@/types/leaderboard';

const ELIGIBILITY_THRESHOLD = 1_000_000;

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(true);
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isEligible, setIsEligible] = useState<boolean>(false);
  const [memeImageUrl, setMemeImageUrl] = useState<string | null>(null);
  const [isGeneratingMeme, setIsGeneratingMeme] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleConnectWallet = useCallback(() => {
    // This is a simulation. In a real app, you'd use ethers.js, wagmi, etc.
    setIsWalletConnected(true);
    const mockBalance = Math.random() > 0.3 ? Math.random() * 2_000_000 : Math.random() * 500_000;
    setUserBalance(mockBalance);
    setIsEligible(mockBalance >= ELIGIBILITY_THRESHOLD);
  }, []);

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Floating emojis */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[5%] text-6xl opacity-20">😂</div>
        <div className="absolute top-[20%] right-[10%] text-5xl opacity-15">😭</div>
        <div className="absolute top-[40%] left-[15%] text-7xl opacity-10">😂</div>
        <div className="absolute top-[60%] right-[20%] text-6xl opacity-20">😭</div>
        <div className="absolute top-[80%] left-[25%] text-5xl opacity-15">😂</div>
        <div className="absolute top-[30%] right-[5%] text-8xl opacity-10">😭</div>
        <div className="absolute top-[70%] right-[40%] text-6xl opacity-15">😂</div>
        <div className="absolute top-[15%] left-[40%] text-5xl opacity-20">😭</div>
      </div>

      {/* Main content */}
      <div className="relative z-10">
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20 border-b-4 border-primary">
          <div className="container mx-auto max-w-6xl">
            <Header />
            <main className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2">
                <Leaderboard data={leaderboard} isLoading={isLoadingLeaderboard} />
              </div>
              <div className="flex flex-col gap-8">
                <MyStatus
                  isConnected={isWalletConnected}
                  onConnect={handleConnectWallet}
                  balance={userBalance}
                  isEligible={isEligible}
                  threshold={ELIGIBILITY_THRESHOLD}
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

