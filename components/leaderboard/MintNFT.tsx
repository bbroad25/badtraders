"use client"

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MintNFTProps {
  hasEnoughTokens: boolean;
  balance: number;
  threshold: number;
}

export default function MintNFT({ hasEnoughTokens, balance, threshold }: MintNFTProps) {
  return (
    <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
      <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground uppercase">
        MINT NFT FOR 1M BADTRADERS
      </h2>

      {hasEnoughTokens ? (
        <div className="space-y-4">
          <p className="text-muted-foreground uppercase text-sm mb-4">
            You have {balance.toLocaleString()} $BadTrader tokens. You qualify for NFT minting!
          </p>
          <div className="bg-muted/50 border-4 border-dashed border-primary p-8 text-center">
            <p className="text-2xl font-bold text-primary uppercase mb-4">COMING SOON</p>
            <p className="text-sm text-muted-foreground uppercase">
              NFT minting will be available soon. Check back later!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground uppercase text-sm mb-4">
            You need {threshold.toLocaleString()} $BadTrader tokens to mint an NFT.
          </p>
          <div className="bg-muted/50 border-4 border-dashed border-primary p-8 text-center">
            <p className="text-2xl font-bold text-destructive uppercase mb-4">NOT ENOUGH TOKENS</p>
            <p className="text-sm text-muted-foreground uppercase">
              You have {balance.toLocaleString()} tokens. Get more to unlock NFT minting!
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

