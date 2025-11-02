"use client"

import { useEffect } from "react"
import { sdk } from "@farcaster/miniapp-sdk"

/**
 * Initializes the Farcaster Mini App SDK for all pages
 * This component should be included in the root layout
 * Following: https://miniapps.farcaster.xyz/docs/getting-started#making-your-app-display
 */
export default function FarcasterSDKInit() {
  useEffect(() => {
    const initFarcasterSDK = async () => {
      try {
        // Call ready() to hide splash screen and display content
        // This must be called after the app is fully loaded
        await sdk.actions.ready()
        console.log("[BadTraders] Farcaster Mini App SDK ready")
      } catch (error) {
        // Only log errors if we're actually in a Farcaster environment
        // In regular browser, this will fail silently which is fine
        if (typeof window !== "undefined") {
          // Check if we're in a Farcaster client
          const isFarcasterClient = navigator.userAgent.includes('Farcaster') ||
                                    window.location.hostname.includes('farcaster')

          if (isFarcasterClient) {
            console.error("[BadTraders] Error initializing Farcaster SDK:", error)
          }
        }
      }
    }

    // Call ready() after component mounts and app is loaded
    initFarcasterSDK()
  }, [])

  return null // This component doesn't render anything
}
