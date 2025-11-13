"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

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

        {/* NFTs with Burn to Mint Section - NOW LIVE */}
        <section className="mb-12">
          <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-5xl">🔥</span>
              <h2 className="text-3xl md:text-4xl font-bold uppercase">NFTs with Burn to Mint - NOW LIVE!</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-4 text-lg leading-relaxed">
                <p>
                  <span className="font-bold text-primary">✅ LIVE NOW:</span> Own exclusive Bad Traders NFTs through our unique burn-to-mint mechanism.
                  Burn your $BADTRADERS tokens to create one-of-a-kind NFT collectibles that celebrate
                  your terrible trading skills.
                </p>

                <div className="bg-primary/10 border-4 border-primary p-6 rounded-lg space-y-4">
                  <h3 className="text-xl md:text-2xl font-bold uppercase text-primary">V1 & V2 BURN TO EARN NFTS</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <span className="font-bold">V1:</span> Burn <span className="font-bold text-primary">10M tokens</span> to mint. Limited to <span className="font-bold">100 NFTs</span>.
                    </li>
                    <li>
                      <span className="font-bold">V2:</span> Burn <span className="font-bold text-primary">25M tokens</span> to mint. Limited to <span className="font-bold">900 NFTs</span>.
                    </li>
                    <li>
                      Each NFT is numbered and includes your mint number in its metadata.
                    </li>
                    <li>
                      Uses <span className="font-bold">ERC-7401</span> composability - can be attached to parent NFTs.
                    </li>
                  </ul>
                </div>

                <div className="bg-primary/10 border-4 border-primary p-6 rounded-lg space-y-4">
                  <h3 className="text-xl md:text-2xl font-bold uppercase text-primary">BADTRADERS BAG (PARENT NFT)</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <span className="font-bold">Free to mint</span> if you hold <span className="font-bold text-primary">5M+ tokens</span>.
                    </li>
                    <li>
                      <span className="font-bold">Unlimited supply</span> - no cap.
                    </li>
                    <li>
                      Can hold V1 and V2 NFTs as children using <span className="font-bold">ERC-7401</span>.
                    </li>
                    <li>
                      <span className="font-bold">Auto-revocation:</span> If your balance drops below 5M, keepers will automatically revoke your Bag NFT.
                    </li>
                    <li>
                      The Bag's metadata updates dynamically to show which children are attached.
                    </li>
                  </ul>
                </div>

                <p className="font-bold text-primary text-xl">
                  Visit the <Link href="/mint" className="underline hover:text-primary/80">Mint page</Link> to get started! 🎨
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

