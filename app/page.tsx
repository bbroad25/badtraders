"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function BadTradersLanding() {
  const [copied, setCopied] = useState(false)

  const contractAddress = "0x0774409Cda69A47f272907fd5D0d80173167BB07"

  // Optional: run code if mini app SDK exists
  useEffect(() => {
    if (typeof window !== "undefined" && window.frame?.sdk) {
      window.frame.sdk.actions.ready()
        .then(() => console.log("[MiniApp] SDK ready!"))
        .catch(console.error)
    }
  }, [])

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
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 border-b-4 border-primary">
          <h1 className="text-7xl md:text-9xl font-bold text-primary uppercase tracking-tighter">$BADTRADERS</h1>
          <div className="flex items-center justify-center gap-4 text-4xl md:text-6xl">
            <span>😂</span>
            <span>😭</span>
            <span>😂</span>
          </div>
          <p className="text-2xl md:text-4xl font-bold uppercase tracking-tight mt-4">
            FOR TRADERS WHO CAN'T TRADE
          </p>
          <Button className="mt-8 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl px-12 py-8 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            WE'RE NGMI 😭
          </Button>
        </section>

        {/* Contract */}
        <section className="min-h-screen flex items-center justify-center px-4 py-20">
          <div className="max-w-3xl w-full space-y-6">
            <h2 className="text-5xl md:text-7xl font-bold text-primary uppercase text-center">CONTRACT ADDRESS</h2>
            <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
              <div className="space-y-4">
                <p className="text-lg text-center text-muted-foreground uppercase">READY TO LOSE MONEY WITH US? 😭</p>
                <div className="bg-secondary border-4 border-primary p-6">
                  <code className="text-sm md:text-base break-all text-foreground">{contractAddress}</code>
                </div>
                <Button
                  onClick={copyToClipboard}
                  className="w-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl py-8 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  {copied ? `✓ COPIED (BAD DECISION)` : `COPY CONTRACT 😂`}
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
