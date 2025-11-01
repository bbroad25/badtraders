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
    images: ["/og-image.jpg"],
  },
  other: {
    "fc:miniapp": JSON.stringify({
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <Script src="https://unpkg.com/@farcaster/frame-sdk@0.1.1/dist/frame-sdk.umd.js" strategy="beforeInteractive" />
      </head>
      <body className={`${spaceMono.variable} font-mono antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
