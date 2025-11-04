"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ethers } from 'ethers'
import { useFarcasterContext } from '@/lib/hooks/useFarcasterContext'

interface WalletConnectProps {
  onConnect?: (address: string) => void
}

export default function WalletConnect({ onConnect }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const { isInFarcaster, isLoading } = useFarcasterContext()

  // Check if wallet is already connected - ONLY if NOT in Farcaster
  useEffect(() => {
    // Don't do anything if we're in Farcaster or still loading
    if (isLoading || isInFarcaster) {
      return
    }

    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const accounts = await provider.listAccounts()
          if (accounts.length > 0) {
            setAddress(accounts[0].address)
            if (onConnect) {
              onConnect(accounts[0].address)
            }
          }
        } catch (error) {
          console.log('No existing wallet connection')
        }
      }
    }

    checkConnection()

    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
          if (onConnect) {
            onConnect(accounts[0])
          }
        } else {
          setAddress(null)
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [onConnect, isInFarcaster, isLoading])

  const handleConnect = async () => {
    // Don't allow wallet connect if in Farcaster
    if (isInFarcaster) {
      return
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install a wallet extension like MetaMask')
      return
    }

    setIsConnecting(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setAddress(address)
      if (onConnect) {
        onConnect(address)
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      if (error.code !== 4001) { // User rejected
        alert('Failed to connect wallet. Please try again.')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  // Don't render anything if in Farcaster or still loading
  if (isLoading || isInFarcaster) {
    return null
  }

  const handleDisconnect = () => {
    setAddress(null)
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!address) {
    return (
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="text-sm md:text-base font-bold uppercase border-2 bg-secondary text-secondary-foreground border-primary hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-mono text-foreground hidden md:inline">
        {formatAddress(address)}
      </span>
      <Button
        onClick={handleDisconnect}
        variant="outline"
        className="text-sm md:text-base font-bold uppercase border-2 border-primary hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
      >
        Disconnect
      </Button>
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}

