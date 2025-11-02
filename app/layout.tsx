import "./globals.css"
import Script from "next/script"

export const metadata = {
  title: "$BADTRADERS",
  description: "The official meme coin for Farcaster’s worst traders.",
}

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
      </head>
      <body>{children}</body>
    </html>
  )
}
