"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function Navigation() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems = [
    { href: "/", label: "HOME" },
    { href: "/how-it-works", label: "HOW IT WORKS" },
    { href: "/leaderboard", label: "LEADERBOARD" },
    { href: "/users", label: "ALL USERS" },
  ]

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b-4 border-primary shadow-[0_4px_0px_0px_rgba(147,51,234,1)]">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl md:text-3xl font-bold text-primary uppercase tracking-tight hover:opacity-80 transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          >
            $BADTRADERS
          </Link>

          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 md:gap-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href === "/" && pathname === "/")
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "outline"}
                    className={`
                      text-sm md:text-base font-bold uppercase border-2
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
          </div>
        </div>
      </div>
    </nav>
  )
}
