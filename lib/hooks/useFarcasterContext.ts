"use client"

import { useState, useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

/**
 * Hook to detect if the app is running inside Farcaster miniapp vs standalone website
 * @returns boolean - true if in Farcaster miniapp, false if standalone website
 */
export function useFarcasterContext() {
  const [isInFarcaster, setIsInFarcaster] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkContext = async () => {
      try {
        // sdk.context is a Promise that resolves to context or null
        const context = await sdk.context
        // If context exists and has client property, we're in Farcaster
        const inFarcaster = context !== null && context !== undefined
        setIsInFarcaster(inFarcaster)
      } catch (error) {
        // If sdk.context fails or throws, we're not in Farcaster
        console.log('[useFarcasterContext] Not in Farcaster miniapp:', error)
        setIsInFarcaster(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkContext()
  }, [])

  return { isInFarcaster: isInFarcaster ?? false, isLoading }
}

