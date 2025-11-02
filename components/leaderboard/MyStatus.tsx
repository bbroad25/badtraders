"use client"

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';

interface MyStatusProps {
  walletAddress: string | null;
  balance: number;
  isEligible: boolean;
  threshold: number;
  isLoadingBalance: boolean;
  onBuyMore?: () => void;
}

export default function MyStatus({ walletAddress, balance, isEligible, threshold, isLoadingBalance, onBuyMore }: MyStatusProps) {
  if (!walletAddress) {
    return (
      <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground uppercase">MY STATUS</h2>
        <p className="text-muted-foreground uppercase text-center">
          Connect your wallet to check your $BadTrader balance and eligibility.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
      <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground uppercase">MY STATUS</h2>
      <div className="space-y-6">
        {isLoadingBalance ? (
          <p className="text-muted-foreground uppercase">Loading balance...</p>
        ) : (
          <>
            <div>
              <p className="text-sm text-muted-foreground uppercase mb-2">Your $BadTrader Balance</p>
              <p className="text-3xl font-bold font-mono text-foreground">
                {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase mb-2">
                Eligibility (Hold &gt;{threshold.toLocaleString()})
              </p>
              {isEligible ? (
                <p className="text-3xl font-bold text-primary uppercase">Eligible! 😂</p>
              ) : (
                <p className="text-3xl font-bold text-destructive uppercase">Not Eligible 😭</p>
              )}
            </div>
            {!isEligible && onBuyMore && (
              <Button
                onClick={onBuyMore}
                className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-lg py-4 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Buy More Tokens
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

