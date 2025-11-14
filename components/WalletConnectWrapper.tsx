"use client"

import { useFarcasterContext } from '@/lib/hooks/useFarcasterContext'
import dynamic from 'next/dynamic'

// Dynamic import at module level (required by Next.js)
// But the component will return null in Farcaster, preventing mount
const WalletConnectLazy = dynamic(
  () => import('@/components/WalletConnect'),
  { ssr: false }
)

// This component will NEVER mount WalletConnect in Farcaster
// It checks context first and returns null, preventing the lazy component from loading
export default function WalletConnectWrapper() {
  const { isInFarcaster, isLoading } = useFarcasterContext()
  
  // Return null immediately if in Farcaster - this prevents the lazy component from mounting
  // Even though the module is bundled, the component code won't execute
  if (isLoading || isInFarcaster) {
    return null
  }
  
  return <WalletConnectLazy />
}

