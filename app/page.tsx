"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { sdk } from '@farcaster/miniapp-sdk'
import MyStatus from '@/components/leaderboard/MyStatus'

const ELIGIBILITY_THRESHOLD = 1_000_000;

export default function BadTradersLanding() {
  const [copied, setCopied] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [userFid, setUserFid] = useState<number | null>(null)
  const [userBalance, setUserBalance] = useState<number>(0)
  const [isEligible, setIsEligible] = useState<boolean>(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false)
  const contractAddress = "0x0774409Cda69A47f272907fd5D0d80173167BB07"

  // Track initialization to prevent multiple calls
  const hasInitialized = useRef(false)
  const providerRef = useRef<any>(null)

  // SDK initialization is now handled by FarcasterSDKInit component in layout

  const loadTokenBalance = useCallback(async (fid: number | null, address: string | null = null) => {
    setIsLoadingBalance(true)
    try {
      // Prefer FID-based lookup via Neynar API
      const url = fid
        ? `/api/token-balance?fid=${fid}`
        : address
          ? `/api/token-balance?address=${address}`
          : null

      if (!url) {
        setUserBalance(0)
        setIsEligible(false)
        return
      }

      const response = await fetch(url)
      if (!response.ok) {
        // API failed - use client-side contract query instead
        if (address) {
          console.warn('API failed, using client-side contract query')
          try {
            const { ethers } = await import('ethers')
            // Use JsonRpcProvider for direct contract queries (doesn't need wallet connection)
            const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
            const tokenAddress = '0x0774409Cda69A47f272907fd5D0d80173167BB07'
            const tokenAbi = [
              'function balanceOf(address owner) view returns (uint256)',
              'function decimals() view returns (uint8)'
            ]
            const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider)
            const balance = await tokenContract.balanceOf(address)
            const decimals = await tokenContract.decimals().catch(() => 18)
            const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals))
            setUserBalance(balanceFormatted)
            setIsEligible(balanceFormatted >= ELIGIBILITY_THRESHOLD)
            return
          } catch (fallbackErr) {
            console.warn('Client-side contract query failed:', fallbackErr)
            // Gracefully continue with zero balance
          }
        }
        // No address available - set to zero gracefully
        setUserBalance(0)
        setIsEligible(false)
        return
      }
      const data = await response.json()
      const balance = data.balance || 0
      setUserBalance(balance)
      // Calculate eligibility client-side (just balance >= threshold)
      setIsEligible(balance >= ELIGIBILITY_THRESHOLD)
      // Update wallet address from response if provided
      if (data.address && !walletAddress) {
        setWalletAddress(data.address)
      }
    } catch (err) {
      // Graceful error handling - don't throw, just log and set defaults
      console.warn('Error loading token balance (gracefully handled):', err)
      setUserBalance(0)
      setIsEligible(false)
    } finally {
      setIsLoadingBalance(false)
    }
  }, [walletAddress])

  // Get user context from Farcaster SDK - only run once on mount
  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitialized.current) return

    const getUserContext = async () => {
      try {
        const context = await sdk.context

        if (context?.user?.fid) {
          const fid = context.user.fid
          setUserFid(fid)

          // Get wallet address - cache provider to avoid repeated calls
          if (!providerRef.current) {
            providerRef.current = await sdk.wallet.getEthereumProvider()
          }

          const ethProvider = providerRef.current
          if (ethProvider) {
            try {
              const accounts = await ethProvider.request({ method: 'eth_accounts' })
              if (accounts && accounts[0]) {
                const address = accounts[0]
                setWalletAddress(address)
                // Try API with FID first, but pass address for client-side fallback
                await loadTokenBalance(fid, address)
                hasInitialized.current = true
                return
              }
            } catch (e) {
              console.log('Could not get wallet address:', e)
            }
          }

          // No address yet - try API with just FID (API may return address from Neynar)
          await loadTokenBalance(fid, null)
          hasInitialized.current = true
        }
      } catch (err) {
        console.log('Farcaster context not available (normal if not in Farcaster client)', err)
      }
    }

    getUserContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run once on mount

  const handleConnectWallet = useCallback(async () => {
    try {
      // First try to get FID from context
      const context = await sdk.context
      if (context?.user?.fid) {
        const fid = context.user.fid
        setUserFid(fid)
        await loadTokenBalance(fid)
      }

      // Also get wallet address for display - reuse cached provider if available
      const ethProvider = providerRef.current || await sdk.wallet.getEthereumProvider()
      if (ethProvider) {
        // Cache it for future use
        if (!providerRef.current) {
          providerRef.current = ethProvider
        }
        try {
          const accounts = await ethProvider.request({ method: 'eth_requestAccounts' })
          if (accounts && accounts[0]) {
            setWalletAddress(accounts[0])
            // If no FID available, fallback to address-based lookup
            if (!context?.user?.fid) {
              await loadTokenBalance(null, accounts[0])
            }
          }
        } catch (e) {
          console.log('Could not get wallet address:', e)
        }
      } else {
        alert('Ethereum provider not available. Make sure you\'re using Farcaster client.')
      }
    } catch (err) {
      console.error('Error connecting wallet:', err)
      alert('Failed to connect wallet. Please try again.')
    }
  }, [loadTokenBalance])

  // Remove duplicate addMiniApp call - already handled by FarcasterSDKInit in layout

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12 border-b-4 border-primary">
          <div className="max-w-5xl w-full text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-7xl md:text-9xl font-bold text-primary uppercase tracking-tighter text-balance">
                $BADTRADERS
              </h1>
              <div className="flex items-center justify-center gap-4 text-4xl md:text-6xl">
                <span>😂</span>
                <span>😭</span>
                <span>😂</span>
              </div>
            </div>

            <p className="text-2xl md:text-4xl font-bold uppercase tracking-tight text-balance">
              {"FOR TRADERS WHO CAN'T TRADE"}
            </p>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {
                "BULL MARKET? EVERYONE'S MAKING MONEY? NOT US. WE'RE THE FARCASTER USERS WHO SOMEHOW LOSE MONEY WHEN THE CHARTS GO UP."
              }
            </p>

            {/* My Status Card - shown prominently on main page */}
            <div className="max-w-md mx-auto pt-8">
              <MyStatus
                walletAddress={walletAddress}
                balance={userBalance}
                isEligible={isEligible}
                threshold={ELIGIBILITY_THRESHOLD}
                isLoadingBalance={isLoadingBalance}
                fid={userFid}
              />
            </div>

            <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground text-xl px-12 py-8 font-bold uppercase border-4 border-primary shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  HOW IT WORKS ❓
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground text-xl px-12 py-8 font-bold uppercase border-4 border-primary shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  VIEW LEADERBOARD 📊
                </Button>
              </Link>
            </div>
          </div>
          <p className="text-2xl md:text-4xl font-bold uppercase tracking-tight mt-4">
            FOR TRADERS WHO CAN'T TRADE
          </p>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mt-4">
            BULL MARKET? EVERYONE'S MAKING MONEY? NOT US. WE'RE THE FARCASTER USERS WHO SOMEHOW LOSE MONEY WHEN THE CHARTS GO UP.
          </p>

          <Button className="mt-8 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl px-12 py-8 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            WE'RE NGMI 😭
          </Button>
        </section>

        {/* Manifesto Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20 border-b-4 border-primary">
          <div className="max-w-4xl w-full space-y-12">
            <h2 className="text-5xl md:text-7xl font-bold text-primary uppercase text-center">THE MANIFESTO 😂</h2>

            <div className="grid gap-6">
              <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 uppercase">WHO WE ARE</h3>
                <p className="text-lg leading-relaxed">
                  WE'RE THE FARCASTER USERS WHO BUY HIGH AND SELL LOW. WE PANIC SELL AT THE BOTTOM. WE FOMO INTO TOPS. WE'RE THE LIQUIDITY FOR EVERYONE ELSE'S GAINS.
                </p>
              </Card>

              <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 uppercase">OUR TRACK RECORD 😭</h3>
                <ul className="text-lg space-y-3 leading-relaxed">
                  <li>• BOUGHT THE TOP OF EVERY MEMECOIN</li>
                  <li>• SOLD ETH AT $1800 (IT'S NOW $3000+)</li>
                  <li>• SOMEHOW LOST MONEY IN A BULL MARKET</li>
                  <li>• TRUSTED THAT ONE GUY IN THE TELEGRAM</li>
                </ul>
              </Card>

              <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 uppercase">WHY $BADTRADERS? 😂</h3>
                <p className="text-lg leading-relaxed">
                  IF YOU CAN'T BEAT THE MARKET, JOIN THE LOSERS. THIS IS THE COIN FOR EVERYONE WHO KNOWS THEY'RE TERRIBLE AT TRADING BUT DOES IT ANYWAY. AT LEAST WE'RE HONEST ABOUT IT.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Contract Section */}
        <section className="min-h-screen flex items-center justify-center px-4 py-20">
          <div className="max-w-3xl w-full space-y-6">
            <h2 className="text-5xl md:text-7xl font-bold text-primary uppercase text-center">CONTRACT ADDRESS</h2>
            <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
              <div className="space-y-4">
                <p className="text-lg text-center text-muted-foreground uppercase">READY TO LOSE MONEY WITH US? 😭</p>
                <div className="bg-secondary border-4 border-primary p-6">
                  <code className="text-sm md:text-base break-all text-foreground">{contractAddress}</code>
                </div>
                <Button
                  onClick={copyToClipboard}
                  className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl py-8 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  {copied ? `✓ COPIED (BAD DECISION)` : `COPY CONTRACT 😂`}
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}

