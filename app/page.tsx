"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { sdk } from "@farcaster/miniapp-sdk" // ✅ import SDK

// ----------
//  COMPONENT
// ----------
export default function BadTradersLanding() {
  const [copied, setCopied] = useState(false)
  const contractAddress = "0x0774409Cda69A47f272907fd5D0d80173167BB07"

  // ✅ Initialize the Farcaster Mini App SDK once
  useEffect(() => {
    const initFarcasterSDK = async () => {
      try {
        await sdk.actions.ready()
        console.log("✅ Farcaster Mini App SDK ready")
      } catch (error) {
        console.error("❌ Error initializing Farcaster SDK:", error)
      }
    }

    initFarcasterSDK()
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
              {"FOR TRADERS WHO CAN'T TRADE"}
            </p>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {
                "BULL MARKET? EVERYONE'S MAKING MONEY? NOT US. WE'RE THE FARCASTER USERS WHO SOMEHOW LOSE MONEY WHEN THE CHARTS GO UP."
              }
            </p>

            <div className="pt-8">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xl px-12 py-8 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                {"WE'RE NGMI 😭"}
              </Button>
            </div>
          </div>
        </section>

        {/* Manifesto Section */}
        <section className="min-h-screen flex items-center justify-center px-4 py-20 border-b-4 border-primary">
          <div className="max-w-4xl w-full space-y-12">
            <h2 className="text-5xl md:text-7xl font-bold text-primary uppercase text-center text-balance">
              {"THE MANIFESTO 😂"}
            </h2>

            <div className="grid gap-6">
              <Card className="bg-card border-4 border-primary p-8 shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 uppercase">{"WHO WE ARE"}</h3>
                <p className="text-lg leading-relaxed">
                  {
                    "WE'RE THE FARCASTER USERS WHO BUY HIGH AND SELL LOW. WE PANIC SELL AT THE BOTTOM. W
