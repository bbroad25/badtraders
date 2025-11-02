"use client"

import { LeaderboardEntry } from '@/types/leaderboard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Loader from './Loader';

interface MemeOfTheWeekProps {
  winner?: LeaderboardEntry;
  onGenerate: () => void;
  isLoading: boolean;
  imageUrl: string | null;
}

export default function MemeOfTheWeek({ winner, onGenerate, isLoading, imageUrl }: MemeOfTheWeekProps) {
  return (
    <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
      <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground uppercase">NFT MY LOSSES FOR $1</h2>
      {winner && (
        <p className="text-muted-foreground mb-6 uppercase">
          {winner.username || winner.display_name} lost ${winner.loss.toLocaleString()} - NFT it for $1! 😭
        </p>
      )}

      <div className="aspect-square w-full bg-secondary border-4 border-primary flex items-center justify-center overflow-hidden transition-all duration-300 mb-6 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
        {isLoading && <Loader text="Minting NFT..." />}
        {!isLoading && !imageUrl && (
          <div className="text-center text-muted-foreground uppercase p-4">
            Click below to NFT your losses for $1! 😂
          </div>
        )}
        {imageUrl && !isLoading && (
          <img
            src={imageUrl}
            alt="Your loss NFT"
            className="w-full h-full object-cover animate-fade-in"
          />
        )}
      </div>

      <Button
        onClick={onGenerate}
        disabled={isLoading || !winner}
        className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl py-6 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Minting NFT...' : 'NFT My Losses for $1'}
      </Button>

      <p className="text-xs text-muted-foreground mt-4 text-center uppercase">
        Immortalize your trading failure forever 😂
      </p>
    </Card>
  );
}

