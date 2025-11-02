"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function BadTradersLanding() {
  const [copied, setCopied] = useState(false)
  const contractAddress = "0x0774409Cda69A47f272907fd5D0d80173167BB07"

  // --- Initialize Farcaster SDK with retries ---
  useEffect(() => {
    const initFarcasterSDK = async () => {
      if (typeof window === "undefined") return;

      const timeout = setTimeout(() => {
        console.warn("[MiniApp] SDK load timeout – continuing without frame.sdk");
      }, 5000);

      try {
        let attempts = 0;
        while (!window.frame?.sdk && attempts < 50) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        if (window.frame?.sdk) {
          console.log("[MiniApp] frame.sdk found – initializing ready()");
          await window.frame.sdk.actions.ready();
          console.log("[MiniApp] Farcaster Frame SDK ready");

          const context = await window.frame.sdk.context;
          console.log("[MiniApp] SDK context:", context);
        } else {
          console.warn("[MiniApp] frame.sdk not available after waiting");
        }
      } catch (err) {
        console.error("[MiniApp] Error during sdk.actions.ready():", err);
      } finally {
        clearTimeout(timeout);
      }
    };

    initFarcasterSDK();
  }, []);

  // --- Clipboard Copy ---
  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Floating emojis */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[5%] text-6xl opacity-20">😂</div>
        <div className="absolute top-[20%] right-[10%] text-5xl opacity-15">😭</div>
        <div className="absolute top-[40%] left-[15%] text-7xl opacity-10">😂</div>
        <div className="absolute top-[60%] right-[20%] text-6xl opacity-20">😭</div>
        <div className="absolute top-[80%] left-[25%] text-5xl opacity-15">😂</div>
        <div className="absolute top-[30%] right-[5%] text-8xl opacity-10">😭</div>
        <div className="absolute top-[70%] right-[40%] text-6xl opacity-15">😂</div>
        <div className="absolute top-[15%] left-[40%] text-5xl opacity-20">😭</div>
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 border-b-4 border-primary">
          <div className="max-w-5xl w-full text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-7xl md:text-9xl font-bold text-primary uppercase tracking-tighter text-balance">
                $BADTRADERS
              </h1>
              <div className="flex items-center justify-center gap-4 text-4xl md:text-6xl">
                <span>😂</span>
                <span>😭</span>
                <span>😂</span>
              </div>
            </div>

            <p className="text-2xl md:text-4xl font-bold uppercase tracking-tight text-balance">
              FOR TRADERS WHO CAN'T TRADE
            </p>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              BULL MARKET? EVERYONE'S MAKING MONEY? NOT US. WE'RE THE FARCASTER USERS WHO SOMEHOW LOSE MONEY WHEN THE CHARTS GO UP.
            </p>

            <div className="pt-8">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl px-12 py-8 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                WE'RE NGMI 😭
              </Button>
            </div>
          </div>
        </section>

        {/* Manifesto Section */}
        <section className="min-h-screen flex items-center justify-center px-4 py-20 border-b-4 border-primary">
          <div className="max-w-4xl w-full space-y-12">
            <h2 className="text-5xl md:text-7xl font-bold text-primary uppercase text-center text-balance">
              THE MANIFESTO 😂
            </h2>

            <div className="grid gap-6">
              <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 uppercase">WHO WE ARE</h3>
                <p className="text-lg leading-relaxed">
                  WE'RE THE FARCASTER USERS WHO BUY HIGH AND SELL LOW. WE PANIC SELL AT THE BOTTOM. WE FOMO INTO TOPS. WE'RE THE LIQUIDITY FOR EVERYONE ELSE'S GAINS.
                </p>
              </Card>

              <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 uppercase">OUR TRACK RECORD 😭</h3>
                <ul className="text-lg space-y-3 leading-relaxed">
                  <li>• BOUGHT THE TOP OF EVERY MEMECOIN</li>
                  <li>• SOLD ETH AT $1800 (IT'S NOW $3000+)</li>
                  <li>• SOMEHOW LOST MONEY IN A BULL MARKET</li>
                  <li>• TRUSTED THAT ONE GUY IN THE TELEGRAM</li>
                </ul>
              </Card>

              <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 uppercase">WHY $BADTRADERS? 😂</h3>
                <p className="text-lg leading-relaxed">
                  IF YOU CAN'T BEAT THE MARKET, JOIN THE LOSERS. THIS IS THE COIN FOR EVERYONE WHO KNOWS THEY'RE TERRIBLE AT TRADING BUT DOES IT ANYWAY. AT LEAST WE'RE HONEST ABOUT IT.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Contract Section */}
        <section className="min-h-screen flex items-center justify-center px-4 py-20">
          <div className="max-w-3xl w-full space-y-12">
            <h2 className="text-5xl md:text-7xl font-bold text-primary uppercase text-center text-balance">
              CONTRACT ADDRESS
            </h2>

            <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
              <div className="space-y-6">
                <p className="text-lg text-center text-muted-foreground uppercase">
                  READY TO LOSE MONEY WITH US? 😭
                </p>

                <div className="bg-secondary border-4 border-primary p-6">
                  <code className="text-sm md:text-base break-all text-foreground">{contractAddress}</code>
                </div>

                <Button
                  onClick={copyToClipboard}
                  className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl py-8 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  {copied ? "✓ COPIED (BAD DECISION)" : "COPY CONTRACT 😂"}
                </Button>

                <p className="text-sm text-center text-muted-foreground uppercase pt-4">
                  DISCLAIMER: THIS IS A MEME COIN. YOU WILL PROBABLY LOSE MONEY. BUT YOU WERE GOING TO ANYWAY.
                </p>
              </div>
            </Card>

            <div className="text-center space-y-4 pt-8">
              <p className="text-3xl">😂😭😂😭😂</p>
              <p className="text-xl font-bold uppercase text-primary">WELCOME TO THE CLUB</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
