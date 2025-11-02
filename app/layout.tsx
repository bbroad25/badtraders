import "./globals.css"

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
      <body>{children}</body>
    </html>
  )
}
