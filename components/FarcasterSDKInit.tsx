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
        console.log("[BadTraders] 🔄 Attempting to call sdk.actions.ready()...")

        // Call ready() to hide splash screen and display content
        // This must be called after the app is fully loaded
        await sdk.actions.ready()
        console.log("[BadTraders] ✅ Farcaster SDK ready() called successfully")

        // Get the context to check if we're in Farcaster
        const context = sdk.context
        console.log("[BadTraders] 📱 Farcaster context:", context)

        // Try to trigger the add mini app modal if not added
        // This enables the hamburger menu buttons (Add App, Notifications, Remove App)
        try {
          await sdk.actions.addMiniApp()
          console.log("[BadTraders] ✅ Add mini app modal triggered")
        } catch (addError: any) {
          // User might have already added the app or it's not available - this is normal
          // Don't treat this as an error, just log it for debugging
          console.log("[BadTraders] ℹ️ Add mini app status:", addError?.message || 'Already added or not available')
        }
      } catch (error: any) {
        console.error("[BadTraders] ❌ SDK ready() error:", error)
        // Try calling it again as a fallback (matching pumpkin project pattern)
        try {
          console.log("[BadTraders] 🔄 Retrying sdk.actions.ready()...")
          await sdk.actions.ready()
          console.log("[BadTraders] ✅ SDK ready() succeeded on retry")

          // Try addMiniApp after retry succeeds
          try {
            await sdk.actions.addMiniApp()
            console.log("[BadTraders] ✅ Add mini app modal triggered after retry")
          } catch (addError: any) {
            console.log("[BadTraders] ℹ️ Add mini app status after retry:", addError?.message || 'Already added or not available')
          }
        } catch (retryError) {
          console.error("[BadTraders] ❌ Retry also failed:", retryError)
        }
      }
    }

    // Call immediately and also after a short delay (matching pumpkin project pattern)
    initFarcasterSDK()
    const timer = setTimeout(initFarcasterSDK, 500)
    return () => clearTimeout(timer)
  }, [])

  return null // This component doesn't render anything
}
