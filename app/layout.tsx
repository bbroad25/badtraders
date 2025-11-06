import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import FarcasterSDKInit from "@/components/FarcasterSDKInit"
import Navigation from "@/components/Navigation"
import "./globals.css"

// Use local font fallback instead of Google Fonts to avoid network spam
// Space Mono is already defined in globals.css as a fallback

export const metadata: Metadata = {
  title: "$BADTRADERS - For Traders Who Can't Trade",
  description: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
  generator: "v0.app",
  openGraph: {
    title: "$BADTRADERS - For Traders Who Can't Trade",
    description: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
    images: ["https://badtraders.xyz/og-image.jpg"],
  },
  other: {
    // Farcaster Mini App metadata
    "fc:frame": "vNext",
    "fc:miniapp": JSON.stringify({
      version: "1",
      title: "$BADTRADERS Leaderboard",
      description: "Track the biggest weekly losses. The $BadTrader competition leaderboard.",
      imageUrl: "https://badtraders.xyz/badtraders.png",
      splashImageUrl: "https://badtraders.xyz/badtraders.png",
      button: {
        title: "Open Leaderboard",
        action: { type: "launch" },
      },
      homeUrl: "https://badtraders.xyz",
      postUrl: "https://badtraders.xyz/api/frame",
    }),
    // Farcaster frame fallback
    "fc:frame:image": "https://badtraders.xyz/og-image.jpg",
    "fc:frame:button:1": "Open Leaderboard",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target": "https://badtraders.xyz/leaderboard",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Fallback meta tags for crawlers */}
        <meta property="fc:frame" content="vNext" />
        <meta
          property="fc:miniapp"
          content={JSON.stringify({
            version: "1",
            title: "$BADTRADERS Leaderboard",
            description: "Track the biggest weekly losses. The $BadTrader competition leaderboard.",
            imageUrl: "https://badtraders.xyz/badtraders.png",
            splashImageUrl: "https://badtraders.xyz/badtraders.png",
            button: {
              title: "Open Leaderboard",
              action: { type: "launch" },
            },
            homeUrl: "https://badtraders.xyz",
            postUrl: "https://badtraders.xyz/api/frame",
          })}
        />
      </head>
      <body className="font-mono antialiased">
        <FarcasterSDKInit />
        <Navigation />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
