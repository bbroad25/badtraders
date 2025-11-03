"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function ComingNextPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      {/* Floating emojis */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[5%] text-6xl opacity-20 emoji-float-1">🔥</div>
        <div className="absolute top-[20%] right-[10%] text-5xl opacity-15 emoji-float-2">🎨</div>
        <div className="absolute top-[40%] left-[15%] text-7xl opacity-10 emoji-float-3">📊</div>
        <div className="absolute top-[60%] right-[20%] text-6xl opacity-20 emoji-float-1">🗳️</div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-primary uppercase tracking-tighter mb-6">
            COMING NEXT 🔥
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Exciting features on the horizon for Bad Traders
          </p>
        </section>

        {/* Historical Bad Weeks Section */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">📅</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">Historical Bad Weeks</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed">
              <p>
                We're building a feature that lets you relive the worst trading weeks in history.
                Dive into past market chaos and see how bad traders navigated (or didn't navigate)
                through some of the most volatile periods.
              </p>
              <p>
                <span className="font-bold text-primary">Vote on weeks</span> to replay, choose
                which tokens to assess, and compete against historical data to see if you can
                trade worse than the legends who came before you. 😂
              </p>
            </div>
          </Card>
        </section>

        {/* Voting System Section */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">🗳️</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">Community Voting</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed">
              <p>
                The community will have the power to decide which historical weeks to feature.
                Vote on your favorite (or worst) trading periods to see them recreated in the competition.
              </p>
              <p>
                You'll also be able to vote on which tokens to assess during these historical replays,
                making each competition unique and community-driven.
              </p>
            </div>
          </Card>
        </section>

        {/* Historical Drawing Section */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">🎨</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">Historical Drawing</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed">
              <p>
                Experience the bad trades of the past through visual storytelling. We'll create
                historical drawings and visualizations that capture the chaos, the panic, and the
                pure comedy of legendary bad trading weeks.
              </p>
              <p>
                Each historical week will have its own unique visual representation, making the
                competition not just about numbers, but about reliving the stories that made
                us all bad traders. 😭
              </p>
            </div>
          </Card>
        </section>

        {/* Buy NFTs with Burn to Mint Section */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-5xl">🔥</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">Buy NFTs with Burn to Mint</h2>
            </div>
            <div className="space-y-6">
              <div className="relative w-full max-w-md mx-auto aspect-square mb-6">
                <Image
                  src="/badtraders.png"
                  alt="Bad Traders NFT"
                  fill
                  className="object-contain rounded-lg"
                  priority
                />
              </div>
              <div className="space-y-4 text-lg leading-relaxed">
                <p>
                  Coming soon: Own exclusive Bad Traders NFTs through our unique burn-to-mint mechanism.
                  Burn your $BADTRADERS tokens to create one-of-a-kind NFT collectibles that celebrate
                  your terrible trading skills.
                </p>
                <p>
                  Each NFT will be unique, featuring our iconic Bad Traders mascot and commemorating
                  your commitment to being the worst trader in the game. The more you burn, the rarer
                  your NFT becomes.
                </p>
                <p className="font-bold text-primary">
                  Join the chaos and turn your bad trades into digital art! 🎨
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Coming Soon Note */}
        <section className="text-center">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <p className="text-lg md:text-xl text-muted-foreground">
              These features are currently in development. Stay tuned for updates! 🚀
            </p>
          </Card>
        </section>
      </div>
    </div>
  )
}

