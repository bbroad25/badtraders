"use client"

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcasterContext } from '@/lib/hooks/useFarcasterContext';

interface MyStatusProps {
  walletAddress: string | null;
  balance: number;
  isEligible: boolean;
  threshold: number;
  isLoadingBalance: boolean;
  fid: number | null;
  onBuyMore?: () => void;
  onRegister?: () => Promise<void>;
}

export default function MyStatus({
  walletAddress,
  balance,
  isEligible,
  threshold,
  isLoadingBalance,
  fid,
  onBuyMore,
  onRegister
}: MyStatusProps) {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoadingRegistration, setIsLoadingRegistration] = useState(false);
  const [showFarcasterPopup, setShowFarcasterPopup] = useState(false);
  const { isInFarcaster } = useFarcasterContext();

  const FARCASTER_REFERRAL_URL = 'https://farcaster.xyz/~/code/98TW42';

  // Fetch registration status
  useEffect(() => {
    if (!fid) return;

    let cancelled = false;
    setIsLoadingRegistration(true);

    fetch(`/api/users/${fid}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setIsRegistered(data.isRegistered || false);
          setIsLoadingRegistration(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Error fetching registration status:', err);
          setIsRegistered(false);
          setIsLoadingRegistration(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fid]); // Removed isLoadingRegistration from deps to prevent loops

  const handleRegister = async () => {
    if (!walletAddress || !fid || isRegistering) return;

    setIsRegistering(true);
    try {
      // Get username from Farcaster SDK context (it's RIGHT THERE!)
      let username: string | null = null;
      try {
        const context = await sdk.context;
        username = context?.user?.username || null;
      } catch (e) {
        console.warn('Could not get username from SDK context:', e);
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid,
          walletAddress,
          username
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsRegistered(true);

        // Compose a cast to share the miniapp and token
        try {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://badtraders.xyz';
          const miniappUrl = baseUrl;
          const tokenAddress = '0x0774409Cda69A47f272907fd5D0d80173167BB07';

          // Open compose cast with miniapp embed and token info
          const castResult = await sdk.actions.composeCast({
            text: `Just signed up for the $BADTRADERS competition! 🎯

The worst trader wins a share of trading fees. You need 10M+ tokens to compete.

Try it: ${miniappUrl}`,
            embeds: [
              miniappUrl, // Embed the miniapp URL
            ]
          });

          if (castResult?.cast) {
            console.log('Cast posted successfully:', castResult.cast.hash);
          }
        } catch (castError) {
          console.error('Error composing cast:', castError);
          // Don't fail registration if cast fails
        }

        if (onRegister) {
          await onRegister();
        }
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to register. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBuyTokens = async () => {
    // On website, go to clanker.world
    if (!isInFarcaster) {
      window.open('https://clanker.world', '_blank', 'noopener,noreferrer');
      return;
    }

    // In Farcaster miniapp, use Farcaster SDK swapToken action
    try {
      const result = await sdk.actions.swapToken({
        buyToken: 'eip155:8453/erc20:0x0774409Cda69A47f272907fd5D0d80173167BB07'
      });

      if (result.success) {
        console.log('Swap initiated:', result.swap);
      } else {
        console.error('Swap failed:', result.reason, result.error);
      }
    } catch (error: any) {
      console.error('Error opening swap:', error);
    }
  };

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
            {/* Registration button - only show if eligible */}
            {isEligible && fid && (
              <>
                {/* Show button if not registered, or if we haven't checked yet */}
                {isRegistered === false || isRegistered === null ? (
                  <Button
                    onClick={handleRegister}
                    disabled={isRegistering || isLoadingRegistration}
                    className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-lg py-4 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                  >
                    {isRegistering ? 'Signing Up...' : isLoadingRegistration ? 'Checking...' : 'Sign Up for Competition'}
                  </Button>
                ) : (
                  <div className="w-full bg-green-600 text-white text-center py-4 font-bold uppercase border-4 border-green-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    Registered ✓
                  </div>
                )}
              </>
            )}

            {/* Debug info */}
            {isEligible && !fid && (
              <div className="w-full text-center py-2 text-xs text-muted-foreground">
                (FID not available - connect wallet to register)
              </div>
            )}

            {/* Buy tokens button - only show if not eligible */}
            {!isEligible && walletAddress && (
              <div className="space-y-3">
                <Button
                  onClick={handleBuyTokens}
                  className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-lg py-4 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  Buy Tokens
                </Button>
                {/* Farcaster referral button - only show for website users (threshold 2M) or if not in Farcaster */}
                {!isInFarcaster && threshold >= 2_000_000 && (
                  <Button
                    onClick={() => setShowFarcasterPopup(true)}
                    className="w-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground text-lg py-4 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Join Farcaster to Save Money
                  </Button>
                )}
              </div>
            )}

            {/* Farcaster Referral Popup */}
            {showFarcasterPopup && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowFarcasterPopup(false)}>
                <Card
                  className="bg-card border-4 border-primary p-6 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)] max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-2xl font-bold uppercase mb-4">Join Farcaster & Save</h3>
                  <div className="space-y-4 mb-6">
                    <p className="text-lg">
                      Join Farcaster to lower the eligibility requirement from <span className="font-bold">{threshold.toLocaleString()}</span> to <span className="font-bold">1,000,000 tokens</span>!
                    </p>
                    <p className="text-lg">
                      <span className="font-bold">🔥 Bonus:</span> Get free swaps on Farcaster in November!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Farcaster users get better rates and a lower threshold. Join now and start trading with better benefits.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        window.open(FARCASTER_REFERRAL_URL, '_blank', 'noopener,noreferrer');
                        setShowFarcasterPopup(false);
                      }}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                    >
                      Join Farcaster
                    </Button>
                    <Button
                      onClick={() => setShowFarcasterPopup(false)}
                      variant="outline"
                      className="flex-1 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                    >
                      Close
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
