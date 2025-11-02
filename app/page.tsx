"use client"

import React from "react"

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-8">
      <h1 className="text-6xl font-extrabold tracking-tight uppercase mb-4">
        $BADTRADERS
      </h1>
      <p className="text-lg text-gray-400 text-center max-w-xl">
        A leaderboard of crypto’s worst-performing traders. Don’t be that guy.
      </p>

      <div className="mt-12 text-center border-t border-gray-800 pt-8">
        <h2 className="text-xl font-semibold mb-2 text-purple-400">Coming Soon</h2>
        <p className="text-sm text-gray-500">
          The Hall of Fame for bad decisions in DeFi.
        </p>
      </div>
    </main>
  )
}
