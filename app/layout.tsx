import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "$BADTRADERS",
  description: "A leaderboard of crypto’s worst-performing traders. Don’t be that guy.",
  openGraph: {
    title: "$BADTRADERS",
    description: "A leaderboard of crypto’s worst-performing traders. Don’t be that guy.",
    images: ["https://badtraders.vercel.app/og-image.png"],
  },
  other: {
    // Farcaster Mini App meta tag
    "fc:miniapp": JSON.stringify({
      version: "1",
      title: "Bad Traders",
      description: "A leaderboard of crypto’s worst-performing traders. Don’t be that guy.",
      imageUrl: "https://badtraders.vercel.app/og-image.png",
      button: {
        title: "Open App",
        action: { type: "launch" },
      },
    }),
    "fc:frame": "vNext",
    "fc:frame:image": "https://badtraders.vercel.app/og-image.png",
    "fc:frame:button:1": "Open App",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target": "https://badtraders.vercel.app",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
