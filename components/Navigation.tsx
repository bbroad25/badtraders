"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Twitter, Github } from "lucide-react"
import { useFarcasterContext } from "@/lib/hooks/useFarcasterContext"
import WalletConnect from "@/components/WalletConnect"

export default function Navigation() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isInFarcaster, isLoading: isLoadingFarcaster } = useFarcasterContext()

  const navItems = [
    { href: "/", label: "HOME" },
    { href: "/how-it-works", label: "HOW IT WORKS" },
    { href: "/leaderboard", label: "LEADERBOARD" },
    { href: "/users", label: "ALL USERS" },
    { href: "/coming-next", label: "COMING NEXT" },
    { href: "/indexer", label: "INDEXER" },
  ]

  const socialLinks = [
    {
      href: "https://x.com/BadTraders_",
      label: "X (Twitter)",
      icon: Twitter,
      ariaLabel: "Follow us on X"
    },
    {
      href: "https://warpcast.com/badtraders",
      label: "Farcaster",
      icon: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"/>
        </svg>
      ),
      ariaLabel: "Follow us on Farcaster"
    },
    {
      href: "https://t.me/badtradersfc",
      label: "Telegram",
      icon: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.09-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          <path d="M9.78 13.16l-.65 3.05c-.04.2.14.32.27.21l3.05-2.3 5.5-1.69c.26-.08.26-.42 0-.5l-5.5-1.69-3.05-2.3c-.13-.11-.31.01-.27.21l.65 3.05 3.05 2.3z"/>
        </svg>
      ),
      ariaLabel: "Join us on Telegram"
    },
    {
      href: "https://github.com/bbroad25/badtraders",
      label: "GitHub",
      icon: Github,
      ariaLabel: "View on GitHub"
    },
  ]

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b-4 border-primary shadow-[0_4px_0px_0px_rgba(147,51,234,1)] overflow-x-hidden">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-6 lg:gap-8 min-w-0">
          <Link
            href="/"
            className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary uppercase tracking-tight hover:opacity-80 transition-opacity whitespace-nowrap flex-shrink-0"
            onClick={() => setIsMenuOpen(false)}
          >
            $BADTRADERS
          </Link>

          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 min-w-0 flex-1 justify-end ml-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href === "/" && pathname === "/")
              return (
                <Link key={item.href} href={item.href} className="flex-shrink-0">
                  <Button
                    variant={isActive ? "default" : "outline"}
                    className={`
                      text-xs xl:text-sm font-bold uppercase border-2 whitespace-nowrap px-2 xl:px-3 py-1.5
                      ${isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-secondary text-secondary-foreground border-primary hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      }
                      transition-all hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
                    `}
                  >
                    {item.label}
                  </Button>
                </Link>
              )
            })}
            {/* Wallet Connect - Desktop - Only show when NOT in Farcaster miniapp */}
            {!isLoadingFarcaster && !isInFarcaster && (
              <div className="hidden lg:flex items-center ml-3 xl:ml-4 flex-shrink-0">
                <WalletConnect />
              </div>
            )}
            {/* Social Icons - Desktop */}
            <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 ml-3 xl:ml-4 pl-3 xl:pl-4 border-l-2 border-primary flex-shrink-0">
              {socialLinks.map((social) => {
                const IconComponent = social.icon
                return (
                  <a
                    key={social.href}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.ariaLabel}
                    className="p-1.5 xl:p-2 text-primary hover:text-primary/80 hover:bg-accent rounded transition-colors flex-shrink-0"
                  >
                    <IconComponent className="w-4 h-4 xl:w-5 xl:h-5" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Hamburger Menu Button - Visible on mobile */}
          <button
            onClick={toggleMenu}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 space-y-1.5 focus:outline-none"
            aria-label="Toggle menu"
          >
            <span
              className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${
                isMenuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${
                isMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${
                isMenuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>

        {/* Mobile Menu - Slide down */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-2 py-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href === "/" && pathname === "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full"
                >
                  <Button
                    variant={isActive ? "default" : "outline"}
                    className={`
                      w-full text-base font-bold uppercase border-2
                      ${isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-secondary text-secondary-foreground border-primary hover:bg-accent hover:text-accent-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      }
                      transition-all hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
                    `}
                  >
                    {item.label}
                  </Button>
                </Link>
              )
            })}
            {/* Wallet Connect - Mobile - Only show when NOT in Farcaster miniapp */}
            {!isLoadingFarcaster && !isInFarcaster && (
              <div className="flex justify-center py-4 border-t-2 border-primary">
                <WalletConnect />
              </div>
            )}
            {/* Social Icons - Mobile */}
            <div className="flex items-center justify-center gap-4 pt-4 border-t-2 border-primary">
              {socialLinks.map((social) => {
                const IconComponent = social.icon
                return (
                  <a
                    key={social.href}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.ariaLabel}
                    className="p-2 text-primary hover:text-primary/80 hover:bg-accent rounded transition-colors"
                  >
                    <IconComponent className="w-6 h-6" />
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
