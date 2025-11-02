import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "$BADTRADERS",
  description: "A leaderboard of crypto’s worst-performing traders. Don’t be that guy.",
  openGraph: {
    title: "$BADTRADERS",
    description: "A leaderboard of crypto’s worst-performing traders. Don’t be that guy.",
    url: "https://your-site-url.com",
    siteName: "$BADTRADERS",
    images: [
      {
        url: "https://your-site-url.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "$BADTRADERS Open Graph Image",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$BADTRADERS",
    description: "A leaderboard of crypto’s worst-performing traders. Don’t be that guy.",
    images: ["https://your-site-url.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
