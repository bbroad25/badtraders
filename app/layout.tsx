import type React from "react"
import type { Metadata } from "next"
import { Space_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
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
    images: ["https://badtraders.vercel.app/og-image.jpg"],
  },
  other: {
    // Farcaster Mini App metadata
    "fc:frame": "vNext",
    "fc:miniapp": JSON.stringify({
      version: "1",
      title: "$BADTRADERS",
      description: "For traders who can't trade. The official meme coin for Farcaster’s worst traders.",
      imageUrl: "https://badtraders.vercel.app/og-image.jpg",
      button: {
        title: "Open $BADTRADERS",
        action: { type: "launch" },
      },
    }),
    // Optional Farcaster frame fallback
    "fc:frame:image": "https://badtraders.vercel.app/og-image.jpg",
    "fc:frame:button:1": "Open $BADTRADERS",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target": "https://badtraders.vercel.app",
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
        <Script
          src="https://unpkg.com/@farcaster/frame-sdk@0.1.1/dist/frame-sdk.umd.js"
          strategy="beforeInteractive"
        />
        {/* Fallback meta tags for crawlers */}
        <meta property="fc:frame" content="vNext" />
        <meta
          property="fc:miniapp"
          content={JSON.stringify({
            version: "1",
            title: "$BADTRADERS",
            description: "For traders who can't trade. The official meme coin for Farcaster’s worst traders.",
            imageUrl: "https://badtraders.vercel.app/og-image.jpg",
            button: {
              title: "Open $BADTRADERS",
              action: { type: "launch" },
            },
          })}
        />
      </head>
      <body className={`${spaceMono.variable} font-mono antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
