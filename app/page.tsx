"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import sdk from "@farcaster/frame-sdk"

export default function BadTradersLanding() {
  const [copied, setCopied] = useState(false)
  const contractAddress = "0x0774409Cda69A47f272907fd5D0d80173167BB07"

  // --- Initialize Farcaster SDK ---
  useEffect(() => {
    const initFarcasterSDK = async () => {
      if (typeof window === "undefined") return

      try {
        await sdk.actions.ready()
        console.log("[MiniApp] Farcaster Frame SDK ready")
        const context = await sdk.context
        console.log("[MiniApp] SDK context:", context)
      } catch (err) {
        console.error("[MiniApp] Error during sdk.actions.ready():", err)
      }
    }

    initFarcasterSDK()
  }, [])

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
            <div className="space-y-4
