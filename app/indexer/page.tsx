"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Wallet {
  id: number
  wallet_address: string
  last_synced_block: number | null
  created_at: string
  updated_at: string
}

interface Trade {
  id: number
  wallet_address: string
  token_address: string
  tx_hash: string
  block_number: number
  timestamp: string
  side: 'BUY' | 'SELL'
  token_amount: string
  price_usd: string
  usd_value: string
  parsed_source: string
}

interface Position {
  wallet_address: string
  token_address: string
  remaining_amount: string
  cost_basis_usd: string
  realized_pnl_usd: string
  updated_at: string
}

interface IndexerStats {
  total_wallets: number
  total_trades: number
  total_positions: number
  last_sync_times: Array<{ wallet_address: string; last_synced_block: number | null; updated_at: string }>
}

export default function IndexerPage() {
  const [stats, setStats] = useState<IndexerStats | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'stats' | 'wallets' | 'trades' | 'positions'>('stats')

  const fetchStats = async () => {
    try {
      setIsLoading(true)
      // We'll need to create API endpoints for this
      // For now, we'll fetch from multiple endpoints
      const [walletsRes, tradesRes, positionsRes] = await Promise.all([
        fetch('/api/indexer/wallets').catch(() => ({ ok: false } as Response)),
        fetch('/api/indexer/trades?limit=10').catch(() => ({ ok: false } as Response)),
        fetch('/api/indexer/positions').catch(() => ({ ok: false } as Response))
      ])

      const walletsData = walletsRes.ok && 'json' in walletsRes ? await walletsRes.json() : { wallets: [] }
      const tradesData = tradesRes.ok && 'json' in tradesRes ? await tradesRes.json() : { trades: [] }
      const positionsData = positionsRes.ok && 'json' in positionsRes ? await positionsRes.json() : { positions: [] }

      setWallets(walletsData.wallets || [])
      setTrades(tradesData.trades || [])
      setPositions(positionsData.positions || [])

      setStats({
        total_wallets: walletsData.wallets?.length || 0,
        total_trades: tradesData.trades?.length || 0,
        total_positions: positionsData.positions?.length || 0,
        last_sync_times: walletsData.wallets?.slice(0, 5).map((w: Wallet) => ({
          wallet_address: w.wallet_address,
          last_synced_block: w.last_synced_block,
          updated_at: w.updated_at
        })) || []
      })
    } catch (err) {
      console.error('Error fetching indexer stats:', err)
      setError('Failed to load indexer data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleManualSync = async () => {
    try {
      setIsSyncing(true)
      setError(null)

      const response = await fetch('/api/indexer/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mode: 'full' })
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Sync completed! Duration: ${data.duration}`)
        // Refresh stats after sync
        setTimeout(() => fetchStats(), 2000)
      } else {
        setError(data.error || 'Sync failed')
      }
    } catch (err: any) {
      console.error('Error syncing:', err)
      setError(err.message || 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-bold text-primary uppercase mb-4">
            INDEXER STATUS
          </h1>
          <p className="text-lg text-muted-foreground">
            Monitor and manage the PnL indexer
          </p>
        </div>

        {/* Manual Sync Button */}
        <div className="mb-6 flex justify-center gap-4">
          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-lg py-4 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            {isSyncing ? 'Syncing...' : 'Manual Sync'}
          </Button>
          <Button
            onClick={fetchStats}
            disabled={isLoading}
            variant="outline"
            className="text-lg py-4 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {error && (
          <Card className="bg-card border-4 border-destructive p-4 mb-6 text-center">
            <p className="text-xl font-bold text-destructive uppercase">{error}</p>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 justify-center">
          {(['stats', 'wallets', 'trades', 'positions'] as const).map((tab) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              variant={activeTab === tab ? 'default' : 'outline'}
              className="font-bold uppercase"
            >
              {tab}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground uppercase">Loading indexer data...</p>
          </div>
        ) : (
          <>
            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
              <div className="space-y-4">
                <Card className="bg-card border-4 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
                  <h2 className="text-2xl font-bold uppercase mb-4">Overview</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground uppercase mb-1">Total Wallets</p>
                      <p className="text-3xl font-bold">{stats.total_wallets}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground uppercase mb-1">Total Trades</p>
                      <p className="text-3xl font-bold">{stats.total_trades}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground uppercase mb-1">Active Positions</p>
                      <p className="text-3xl font-bold">{stats.total_positions}</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-card border-4 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
                  <h2 className="text-2xl font-bold uppercase mb-4">Recent Sync Status</h2>
                  {stats.last_sync_times.length === 0 ? (
                    <p className="text-muted-foreground">No wallets synced yet</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.last_sync_times.map((sync, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b">
                          <span className="font-mono text-sm">{truncateAddress(sync.wallet_address)}</span>
                          <span className="text-sm">
                            Block: {sync.last_synced_block || 'Not synced'} | {formatDate(sync.updated_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Wallets Tab */}
            {activeTab === 'wallets' && (
              <div className="space-y-4">
                {wallets.length === 0 ? (
                  <Card className="bg-card border-4 border-primary p-8 text-center">
                    <p className="text-xl font-bold uppercase">No wallets found</p>
                  </Card>
                ) : (
                  wallets.map((wallet) => (
                    <Card
                      key={wallet.id}
                      className="bg-card border-4 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Wallet</p>
                          <p className="text-sm font-mono break-all">{wallet.wallet_address}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Last Synced Block</p>
                          <p className="text-lg font-bold font-mono">{wallet.last_synced_block || 'Not synced'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Updated</p>
                          <p className="text-sm">{formatDate(wallet.updated_at)}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Trades Tab */}
            {activeTab === 'trades' && (
              <div className="space-y-4">
                {trades.length === 0 ? (
                  <Card className="bg-card border-4 border-primary p-8 text-center">
                    <p className="text-xl font-bold uppercase">No trades found</p>
                  </Card>
                ) : (
                  trades.map((trade) => (
                    <Card
                      key={trade.id}
                      className="bg-card border-4 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Wallet</p>
                          <p className="text-sm font-mono">{truncateAddress(trade.wallet_address)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Side</p>
                          <p className={`text-lg font-bold ${trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.side}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Amount</p>
                          <p className="text-lg font-bold">{parseFloat(trade.token_amount) / 1e18} tokens</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">USD Value</p>
                          <p className="text-lg font-bold">${parseFloat(trade.usd_value).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">TX Hash</p>
                          <p className="text-xs font-mono">{truncateHash(trade.tx_hash)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Block</p>
                          <p className="text-sm font-mono">{trade.block_number}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Time</p>
                          <p className="text-sm">{formatDate(trade.timestamp)}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Positions Tab */}
            {activeTab === 'positions' && (
              <div className="space-y-4">
                {positions.length === 0 ? (
                  <Card className="bg-card border-4 border-primary p-8 text-center">
                    <p className="text-xl font-bold uppercase">No positions found</p>
                  </Card>
                ) : (
                  positions.map((position, idx) => (
                    <Card
                      key={idx}
                      className="bg-card border-4 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Wallet</p>
                          <p className="text-sm font-mono">{truncateAddress(position.wallet_address)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Remaining Amount</p>
                          <p className="text-lg font-bold">{parseFloat(position.remaining_amount) / 1e18} tokens</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Cost Basis</p>
                          <p className="text-lg font-bold">${parseFloat(position.cost_basis_usd).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase mb-1">Realized PnL</p>
                          <p className={`text-lg font-bold ${parseFloat(position.realized_pnl_usd) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${parseFloat(position.realized_pnl_usd).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-8 text-center">
          <Link href="/">
            <Button className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-lg py-4 font-bold uppercase border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

