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

// ---- METADATA ----
export const metadata: Metadata = {
  title: "$BADTRADERS - For Traders Who Can't Trade",
  description: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
  generator: "v0.app",
  openGraph: {
    title: "$BADTRADERS - For Traders Who Can't Trade",
    description: "The official meme coin for Farcaster's worst traders. Bull market? Not for us.",
    url: "https://badtraders.vercel.app",
    siteName: "$BADTRADERS",
    images: [
      {
        url: "https://badtraders.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "$BADTRADERS OG Image",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "1",
      imageUrl: "https://badtraders.vercel.app/og-image.jpg",
      button: {
        title: "Open $BADTRADERS",
        action: {
          type: "launch_miniapp",
          url: "https://badtraders.vercel.app",
        },
      },
    }),
  },
}

// ---- ROOT LAYOUT ----
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Farcaster Frame SDK */}
        <Script
          src="https://unpkg.com/@farcaster/frame-sdk@0.1.1/dist/frame-sdk.umd.js"
          strategy="beforeInteractive"
        />
        <meta name="theme-color" content="#7e3ff2" />
      </head>
      <body
        className={`${spaceMono.variable} font-mono bg-black text-white antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}
