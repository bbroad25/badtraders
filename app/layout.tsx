import type React from "react"
import type { Metadata } from "next"
import { Space_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import FarcasterSDKInit from "@/components/FarcasterSDKInit"
import Navigation from "@/components/Navigation"
import "./globals.css"

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
})

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
      name: "Bad Traders",
      iconUrl: "https://badtraders.xyz/icon.jpg",
      homeUrl: "https://badtraders.xyz",
      splashImageUrl: "https://badtraders.xyz/badtraders.png",
      splashBackgroundColor: "#8A63D2",
      imageUrl: "https://badtraders.xyz/og-image.jpg",
      tagline: "We trade bad but we fun good",
      description: "Track the biggest weekly losses. The $BadTrader competition leaderboard.",
      button: {
        title: "Open Leaderboard",
        action: { type: "launch" },
      },
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
      <body className={`${spaceMono.variable} font-mono antialiased`}>
        <FarcasterSDKInit />
        <Navigation />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
