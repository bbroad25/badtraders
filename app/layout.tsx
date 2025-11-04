import type React from "react"
import type { Metadata } from "next"
import { Space_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Navigation from "@/components/Navigation"
import FarcasterReady from "@/components/FarcasterReady"
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
  other: {},
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="fc:miniapp" content={JSON.stringify({
          version: "1",
          imageUrl: "https://badtraders.xyz/badtraders.png",
          button: {
            title: "Bad Traders",
            action: {
              type: "launch_miniapp",
              name: "Bad Traders",
              splashImageUrl: "https://badtraders.xyz/badtraders.png",
              splashBackgroundColor: "#8A63D2"
            }
          }
        })} />
      </head>
      <body className={`${spaceMono.variable} font-mono antialiased`}>
        <FarcasterReady />
        <Navigation />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
