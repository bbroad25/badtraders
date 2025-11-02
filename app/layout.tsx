"use client"

import { ReactNode, useEffect } from "react"
import sdk from "@farcaster/frame-sdk"

interface LayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: LayoutProps) {
  useEffect(() => {
    // Ensure we only run in the browser
    if (typeof window === "undefined") return

    const waitForFrameSDK = async () => {
      let attempts = 0
      while (!window.frame?.sdk && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }
      if (window.frame?.sdk) {
        try {
          await window.frame.sdk.actions.ready()
          console.log("Farcaster Frame SDK ready (layout)!")
        } catch (err) {
          console.error("Error calling ready() in layout:", err)
        }
      } else {
        console.warn("Farcaster Frame SDK not available after 5s (layout)")
      }
    }

    waitForFrameSDK()
  }, [])

  return (
    <html lang="en">
      <head>
        <title>Bad Traders</title>
      </head>
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
