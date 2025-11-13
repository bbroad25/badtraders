"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { sdk } from '@farcaster/miniapp-sdk'
import MyStatus from '@/components/leaderboard/MyStatus'
import { useFarcasterContext } from '@/lib/hooks/useFarcasterContext'

const FARCASTER_ELIGIBILITY_THRESHOLD = 1_000_000; // 1M for Farcaster miniapp users
const WEBSITE_ELIGIBILITY_THRESHOLD = 2_000_000; // 2M for website users

export default function BadTradersLanding() {
  const { isInFarcaster } = useFarcasterContext()
  const [copied, setCopied] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [userFid, setUserFid] = useState<number | null>(null)
  const [userBalance, setUserBalance] = useState<number>(0)
  const [isEligible, setIsEligible] = useState<boolean>(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false)
  const [eligibilityThreshold, setEligibilityThreshold] = useState<number>(WEBSITE_ELIGIBILITY_THRESHOLD)
  const [isAddingMiniApp, setIsAddingMiniApp] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<{ hasNotifications: boolean; tokenCount: number } | null>(null)
  const [isCheckingNotifications, setIsCheckingNotifications] = useState(false)
  const contractAddress = "0x0774409Cda69A47f272907fd5D0d80173167BB07"

  // Track initialization to prevent multiple calls
  const hasInitialized = useRef(false)
  const providerRef = useRef<any>(null)
  const walletAddressRef = useRef<string | null>(null)

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
            const threshold = userFid ? FARCASTER_ELIGIBILITY_THRESHOLD : WEBSITE_ELIGIBILITY_THRESHOLD
            setEligibilityThreshold(threshold)
            setIsEligible(balanceFormatted >= threshold)
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
      const threshold = data.threshold || (userFid ? FARCASTER_ELIGIBILITY_THRESHOLD : WEBSITE_ELIGIBILITY_THRESHOLD)
      setUserBalance(balance)
      setEligibilityThreshold(threshold)
      // Calculate eligibility client-side (just balance >= threshold)
      setIsEligible(balance >= threshold)
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

  // Check notification status when FID is available
  useEffect(() => {
    if (userFid && isInFarcaster) {
      const checkStatus = async () => {
        try {
          setIsCheckingNotifications(true)
          const response = await fetch(`/api/notifications/check?fid=${userFid}`)
          const data = await response.json()
          
          if (data.success) {
            setNotificationStatus({
              hasNotifications: data.hasNotifications,
              tokenCount: data.tokenCount
            })
          }
        } catch (error) {
          console.error('Error checking notification status:', error)
        } finally {
          setIsCheckingNotifications(false)
        }
      }
      checkStatus()
    }
  }, [userFid, isInFarcaster])

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

          // In Farcaster, skip wallet provider calls to avoid triggering wallet popups
          // Just use the API with FID - it can get the address from Neynar if needed
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

  // Listen for wallet account changes ONLY (website users only - NOT in Farcaster)
  // NO automatic connection attempts - only listen for changes when user manually connects
  useEffect(() => {
    // Don't run if in Farcaster miniapp - wallet is handled by Farcaster SDK
    if (userFid !== null) return // If we have FID, we're in Farcaster, skip this

    if (typeof window === 'undefined' || !window.ethereum) return

    // ONLY listen for account changes - NO automatic checks, NO connect listeners
    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length > 0) {
        const address = accounts[0]
        walletAddressRef.current = address
        setWalletAddress(address)
        await loadTokenBalance(null, address)
      } else {
        walletAddressRef.current = null
        setWalletAddress(null)
        setUserBalance(0)
        setIsEligible(false)
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
    }
  }, [loadTokenBalance, userFid]) // Add userFid to deps - if we have FID, skip wallet checks

  const handleConnectWallet = useCallback(async () => {
    try {
      // Don't do anything if in Farcaster - wallet is handled by Farcaster SDK
      const context = await sdk.context
      if (context?.user?.fid) {
        const fid = context.user.fid
        setUserFid(fid)
        await loadTokenBalance(fid, null)
        return // In Farcaster, don't try to connect external wallet
      }

      // Website users only - connect via window.ethereum
      if (typeof window === 'undefined' || !window.ethereum) {
        alert('Please install a wallet extension like MetaMask')
        return
      }

      // ONLY call eth_requestAccounts when user explicitly clicks button
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts && accounts[0]) {
        const address = accounts[0]
        walletAddressRef.current = address
        setWalletAddress(address)
        await loadTokenBalance(null, address)
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err)
      if (err.code !== 4001) { // User rejected
        alert('Failed to connect wallet. Please try again.')
      }
    }
  }, [loadTokenBalance])

  // Remove duplicate addMiniApp call - already handled by FarcasterSDKInit in layout

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddMiniApp = async () => {
    if (!isInFarcaster) {
      // Not in Farcaster - show message
      alert('This feature is only available in the Farcaster app. Open this page in Farcaster to add the miniapp and enable notifications.')
      return
    }

    try {
      setIsAddingMiniApp(true)
      const result = await sdk.actions.addMiniApp()
      if (result) {
        console.log('✅ Mini app added successfully')
        // Wait a moment for webhook to process, then check status
        setTimeout(() => {
          checkNotificationStatus()
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error adding mini app:', error)
      alert('Failed to add mini app. Please try again.')
    } finally {
      setIsAddingMiniApp(false)
    }
  }

  const checkNotificationStatus = async () => {
    if (!userFid) return

    try {
      setIsCheckingNotifications(true)
      const response = await fetch(`/api/notifications/check?fid=${userFid}`)
      const data = await response.json()
      
      if (data.success) {
        setNotificationStatus({
          hasNotifications: data.hasNotifications,
          tokenCount: data.tokenCount
        })
      }
    } catch (error) {
      console.error('Error checking notification status:', error)
    } finally {
      setIsCheckingNotifications(false)
    }
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

            {/* Notification & Mini App Buttons - Only in Farcaster - AT THE TOP */}
            {isInFarcaster && (
              <Card className="p-4 md:p-6 mb-6 border-4 border-primary bg-primary/5 max-w-md mx-auto">
                <h3 className="text-lg md:text-xl font-bold mb-2 text-primary uppercase text-center">
                  🔔 Enable Notifications
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground mb-4 text-center">
                  Get notified about contest updates, leaderboard changes, and more. We promise not to abuse them! 🙏
                </p>
                
                {/* Notification Status */}
                {notificationStatus !== null && (
                  <div className={`mb-4 p-2 rounded border-2 text-center text-xs ${
                    notificationStatus.hasNotifications
                      ? 'bg-green-500/20 border-green-500/50 text-green-400'
                      : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                  }`}>
                    {notificationStatus.hasNotifications ? (
                      <p>✅ Notifications enabled ({notificationStatus.tokenCount} token{notificationStatus.tokenCount !== 1 ? 's' : ''} stored)</p>
                    ) : (
                      <p>⚠️ No notification tokens found. Add the mini app to enable.</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddMiniApp}
                    disabled={isAddingMiniApp}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-sm md:text-base font-bold uppercase border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {isAddingMiniApp ? 'Adding...' : '➕ Add Mini App'}
                  </Button>
                  <Button
                    onClick={checkNotificationStatus}
                    disabled={isCheckingNotifications || !userFid}
                    variant="outline"
                    className="text-xs md:text-sm font-bold uppercase border-2 border-primary"
                  >
                    {isCheckingNotifications ? '...' : '🔄 Check'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Adding the mini app enables notifications automatically
                </p>
              </Card>
            )}

            {/* My Status Card - shown prominently on main page */}
            <div className="max-w-md mx-auto pt-4 md:pt-8">
              <MyStatus
                walletAddress={walletAddress}
                balance={userBalance}
                isEligible={isEligible}
                threshold={eligibilityThreshold}
                isLoadingBalance={isLoadingBalance}
                fid={userFid}
              />
            </div>

            <div className="pt-4 md:pt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground text-lg md:text-xl px-8 md:px-12 py-6 md:py-8 font-bold uppercase border-4 border-primary shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  HOW IT WORKS ❓
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground text-lg md:text-xl px-8 md:px-12 py-6 md:py-8 font-bold uppercase border-4 border-primary shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  VIEW LEADERBOARD 📊
                </Button>
              </Link>
            </div>
          </div>
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

