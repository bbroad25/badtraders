"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const ELIGIBILITY_THRESHOLD = 1_000_000

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      {/* Floating emojis */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[5%] text-6xl opacity-20 emoji-float-1">😂</div>
        <div className="absolute top-[20%] right-[10%] text-5xl opacity-15 emoji-float-2">😭</div>
        <div className="absolute top-[40%] left-[15%] text-7xl opacity-10 emoji-float-3">😂</div>
        <div className="absolute top-[60%] right-[20%] text-6xl opacity-20 emoji-float-1">😭</div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-primary uppercase tracking-tighter mb-6">
            HOW IT WORKS 😂
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            The Consolation Prize Competition for Bad Traders
          </p>
        </section>

        {/* Eligibility Section */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">🎯</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">ELIGIBILITY</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed">
              <p>
                To participate in the <span className="font-bold text-primary">$BADTRADERS</span> competition, you must hold at least{" "}
                <span className="font-bold text-primary">{ELIGIBILITY_THRESHOLD.toLocaleString()} $BADTRADERS tokens</span>.
              </p>
              <p>
                This isn't about being rich—it's about being committed to your terrible trading decisions. 😭
              </p>
            </div>
          </Card>
        </section>

        {/* Competition Rules Section */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">📊</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">THE COMPETITION</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-xl md:text-2xl font-bold uppercase text-primary">STEP 1: SIGN UP</h3>
                <p className="text-lg leading-relaxed">
                  Once you're eligible (holding {ELIGIBILITY_THRESHOLD.toLocaleString()}+ tokens), sign up in the app.
                  This connects your wallet and Farcaster account so we can track your trading performance.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl md:text-2xl font-bold uppercase text-primary">STEP 2: WE TRACK YOUR TRADES</h3>
                <p className="text-lg leading-relaxed">
                  We monitor all eligible participants and track who's the <span className="font-bold">worst trader</span>.
                  That's right—we're rewarding the person who loses the most money.
                  Finally, your terrible trading skills might pay off! 😂
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl md:text-2xl font-bold uppercase text-primary">STEP 3: WIN THE CONSOLATION PRIZE</h3>
                <p className="text-lg leading-relaxed">
                  The worst trader of the day gets a <span className="font-bold text-primary">percentage of that day's trading fees</span>
                  from the $BADTRADERS token. Think of it as a consolation prize for being so bad at trading that you somehow
                  lost money when everyone else was making it.
                </p>
                <p className="text-lg leading-relaxed italic text-muted-foreground">
                  It's like a participation trophy, but for traders who participated in losing money. 😭
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Prize Details Section */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">💰</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">THE PRIZE</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed">
              <p>
                The daily winner receives a <span className="font-bold text-primary">percentage of all trading fees</span>
                collected from $BADTRADERS token transactions that day.
              </p>
              <p>
                The more people trade, the bigger your consolation prize gets—assuming you're terrible enough to win.
                It's the only competition where being bad at something is actually a good thing. 😂
              </p>
              <p className="font-bold text-primary text-xl mt-4">
                Daily winner = Worst trader = Most consolation prize money
              </p>
            </div>
          </Card>
        </section>

        {/* How to Participate Section */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">🚀</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">HOW TO PARTICIPATE</h2>
            </div>
            <ol className="space-y-4 text-lg leading-relaxed list-decimal list-inside">
              <li>
                <span className="font-bold">Hold {ELIGIBILITY_THRESHOLD.toLocaleString()}+ $BADTRADERS tokens</span> in your wallet
              </li>
              <li>
                <span className="font-bold">Sign up in the app</span> to connect your wallet and Farcaster account
              </li>
              <li>
                <span className="font-bold">Trade badly</span> (or just trade normally—if you're here, you're probably already bad at it 😭)
              </li>
              <li>
                <span className="font-bold">Check the leaderboard</span> to see if you're losing worse than everyone else
              </li>
              <li>
                <span className="font-bold">Win the consolation prize</span> if you're the worst trader of the day
              </li>
            </ol>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="text-center space-y-6">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold uppercase">READY TO LOSE MONEY WITH US? 😭</h2>
            <p className="text-lg text-muted-foreground">
              Check your eligibility and sign up in the app to start competing for the consolation prize!
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl px-12 py-8 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                CHECK STATUS 😂
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button
                size="lg"
                variant="outline"
                className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground text-xl px-12 py-8 font-bold uppercase border-4 border-primary shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                VIEW LEADERBOARD 📊
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

