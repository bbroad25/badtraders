"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { USDC_ADDRESS, WETH_ADDRESS } from "@/lib/utils/constants"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, ExternalLink, Plus, RefreshCw, Terminal, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000'

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
  token_symbol?: string
  tx_hash: string
  block_number: number
  timestamp: string
  side: 'BUY' | 'SELL'
  token_amount: string
  price_usd: string
  usd_value: string
  parsed_source: string
  base_token_amount?: string
  base_token_address?: string
}

interface Position {
  wallet_address: string
  token_address: string
  token_symbol?: string
  remaining_amount: string
  cost_basis_usd: string
  realized_pnl_usd: string
  unrealized_pnl_usd?: string
  current_price_usd?: string
  total_pnl_usd?: string
  updated_at: string
}

interface IndexerStats {
  wallets: number
  trades: number
  positions: number
  volume: {
    total: number
    buy: number
    sell: number
  }
  traders: number
  tokens: number
  pnl: {
    realized: number
    positions: number
  }
  recent: {
    trades_24h: number
  }
}

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  timestamp: string
}

interface IndexerStatus {
  isRunning: boolean
  progress: number
  currentWallet: string | null
  activeWorkers: string[]
  currentBlock?: number | null
  lastSyncedBlock?: number | null
  blocksBehind?: number | null
  workerDetails?: Record<string, {
    walletAddress: string
    progress: number
    currentTask: string
    blocksProcessed?: number
    blocksTotal?: number
    transfersFound?: number
    swapsProcessed?: number
    transactionsProcessed?: number
    transactionsTotal?: number
    estimatedRemainingSeconds?: number
    elapsedSeconds?: number
    startTime: string
    lastUpdate: string
  }>
  walletsTotal: number
  walletsProcessed: number
  tokensTotal: number
  tokensProcessed: number
  tradesFound: number
  errors: string[]
  startTime: string | null
  endTime: string | null
  lastUpdate: string | null
  elapsedSeconds?: number
  estimatedRemainingSeconds?: number
}

type SortField = 'timestamp' | 'usd_value' | 'token_amount' | 'price_usd'
type SortOrder = 'ASC' | 'DESC'
type FilterSide = 'ALL' | 'BUY' | 'SELL'
type TabType = 'overview' | 'trades' | 'top-traders' | 'holders' | 'positions' | 'logs' | 'tokens'

interface Token {
  token_address: string
  symbol: string
  decimals: number
  trade_count: number | string
  created_at: string
  updated_at: string
}

type MainTabType = 'contest-data' | 'indexer-analytics'

export default function StatsPage() {
  // Check if admin mode is enabled via environment variable
  const isAdminMode = process.env.NEXT_PUBLIC_ENABLE_ADMIN_MODE === 'true'

  // Main tab: Contest Data or Indexer Analytics
  const [mainTab, setMainTab] = useState<MainTabType>('contest-data')

  // Indexer Analytics state (existing)
  const [stats, setStats] = useState<IndexerStats | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [topTraders, setTopTraders] = useState<any[]>([])
  const [holders, setHolders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [indexerStatus, setIndexerStatus] = useState<IndexerStatus | null>(null)
  const [displayFilter, setDisplayFilter] = useState<'registered' | 'full'>('registered') // Only affects UI display
  const [syncType, setSyncType] = useState<'incremental' | 'full'>('incremental') // Affects sync operation
  const [selectedToken, setSelectedToken] = useState<string>('') // Selected token for sync
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false) // Password prompt for sync
  const [syncStatusMinimized, setSyncStatusMinimized] = useState(false) // Minimize sync status card

  // Trade table sorting/filtering
  const [tradeSortField, setTradeSortField] = useState<SortField>('timestamp')
  const [tradeSortOrder, setTradeSortOrder] = useState<SortOrder>('DESC')
  const [tradeFilterSide, setTradeFilterSide] = useState<FilterSide>('ALL')
  const [tradePage, setTradePage] = useState(0)
  const [tradeTotal, setTradeTotal] = useState(0)

  // Track consecutive failures for exponential backoff (persist across renders)
  const statusFailureCount = useRef(0)
  const logsFailureCount = useRef(0)
  const lastStatusError = useRef<string | null>(null)
  const lastLogsError = useRef<string | null>(null)

  const fetchStats = async () => {
    try {
      console.log('[fetchStats] Fetching stats...')
      const response = await fetch('/api/indexer/stats')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch stats' }))
        console.error('[fetchStats] API error:', response.status, errorData)
        throw new Error(errorData.error || 'Failed to fetch stats')
      }
      const data = await response.json()
      console.log('[fetchStats] Received stats:', data.stats)
      setStats(data.stats || null)
    } catch (err: any) {
      console.error('[fetchStats] Error fetching stats:', err)
      // Set stats to empty object so page still renders
      const emptyStats = {
        wallets: 0,
        trades: 0,
        positions: 0,
        volume: { total: 0, buy: 0, sell: 0 },
        traders: 0,
        tokens: 0,
        pnl: { realized: 0, positions: 0 },
        recent: { trades_24h: 0 }
      }
      console.warn('[fetchStats] Setting empty stats due to error')
      setStats(emptyStats)
    }
  }

  const fetchWallets = async () => {
    try {
      const params = new URLSearchParams()
      if (displayFilter === 'registered') {
        params.append('wallet_filter', 'registered')
      }
      const response = await fetch(`/api/indexer/wallets?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch wallets')
      const data = await response.json()
      setWallets(data.wallets || [])
    } catch (err) {
      console.error('Error fetching wallets:', err)
    }
  }

  const fetchTrades = async () => {
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: String(tradePage * 50),
        sort_by: tradeSortField,
        sort_order: tradeSortOrder,
        ...(tradeFilterSide !== 'ALL' && { side: tradeFilterSide })
      })
      if (displayFilter === 'registered') {
        params.append('wallet_filter', 'registered')
      }
      // NOTE: Not filtering by token_address - fetch ALL trades from Supabase
      const response = await fetch(`/api/indexer/trades?${params}`)
      if (!response.ok) {
        let errorMessage = 'Failed to fetch trades'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          // Response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      const data = await response.json()
      setTrades(data.trades || [])
      setTradeTotal(data.pagination?.total || 0)

      // Log for debugging
      if (data.trades && data.trades.length === 0) {
        console.log('[fetchTrades] No trades found in database. Total in DB:', data.pagination?.total || 0)
      } else {
        console.log(`[fetchTrades] Loaded ${data.trades?.length || 0} trades (total: ${data.pagination?.total || 0})`)
      }
    } catch (err: any) {
      console.error('Error fetching trades:', err)
      setTrades([])
      setTradeTotal(0)
    }
  }

  const MAIN_TOKEN_ADDRESS = '0x0774409cda69a47f272907fd5d0d80173167bb07'

  const fetchTokens = async () => {
    try {
      const response = await fetch('/api/indexer/tokens')
      if (!response.ok) throw new Error('Failed to fetch tokens')
      const data = await response.json()
      setTokens(data.tokens || [])

      // Auto-add main token if it doesn't exist
      const hasMainToken = data.tokens?.some((t: Token) =>
        t.token_address.toLowerCase() === MAIN_TOKEN_ADDRESS.toLowerCase()
      )
      if (!hasMainToken) {
        // Silently add it in the background
        fetch('/api/indexer/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_address: MAIN_TOKEN_ADDRESS })
        }).then(() => {
          // Refresh tokens list after adding
          setTimeout(() => fetchTokens(), 1000)
        }).catch(() => {
          // Silent fail - user can add manually if needed
        })
      }
    } catch (err) {
      console.error('Error fetching tokens:', err)
    }
  }

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/indexer/positions?include_unrealized=true')
      if (!response.ok) throw new Error('Failed to fetch positions')
      const data = await response.json()
      setPositions(data.positions || [])
    } catch (err) {
      console.error('Error fetching positions:', err)
    }
  }

  const fetchTopTraders = async () => {
    try {
      const params = new URLSearchParams({
        limit: '100',
        offset: '0',
        ...(displayFilter === 'registered' && { wallet_filter: 'registered' })
      })
      // Use selected token or first available token
      const tokenToUse = selectedToken || (tokens.length > 0 ? tokens[0].token_address : null)
      if (tokenToUse) {
        params.append('token_address', tokenToUse)
      }
      // If no token available, fetch without token filter (will return empty or all traders)
      const response = await fetch(`/api/indexer/top-traders?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch top traders')
      const data = await response.json()
      setTopTraders(data.traders || [])
    } catch (err) {
      console.error('Error fetching top traders:', err)
      setTopTraders([]) // Set empty array on error
    }
  }

  const fetchHolders = async () => {
    try {
      // Only fetch if we have a token selected or tokens available
      const tokenToUse = selectedToken || (tokens.length > 0 ? tokens[0].token_address : null)
      if (!tokenToUse) {
        setHolders([])
        return
      }

      const params = new URLSearchParams({
        token_address: tokenToUse,
        limit: '100',
        offset: '0',
        ...(displayFilter === 'registered' && { wallet_filter: 'registered' })
      })
      const response = await fetch(`/api/indexer/holders?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        // Don't throw - just log and set empty array (holders are optional)
        console.warn('Failed to fetch holders:', errorData.error || 'Unknown error')
        setHolders([])
        return
      }
      const data = await response.json()
      setHolders(data.holders || [])
    } catch (err) {
      // Silently handle errors - holders are optional and may not exist yet
      console.warn('Error fetching holders:', err)
      setHolders([])
    }
  }

  const fetchLogs = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch('/api/indexer/logs?limit=500', {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) throw new Error('Failed to fetch logs')
      const data = await response.json()
      setLogs(data.logs || [])

      // Reset failure count on success
      logsFailureCount.current = 0
      lastLogsError.current = null
    } catch (err: any) {
      logsFailureCount.current++
      const errorMsg = err.name === 'AbortError' ? 'Request timeout' : (err.message || 'Failed to fetch logs')

      // Only log error if it's different from last error or first failure
      if (errorMsg !== lastLogsError.current || logsFailureCount.current === 1) {
        console.error(`Error fetching logs (attempt ${logsFailureCount.current}):`, errorMsg)
        lastLogsError.current = errorMsg
      }

      // Exponential backoff: skip next N polls (max 10 polls = 20 seconds)
      const skipPolls = Math.min(logsFailureCount.current, 10)
      if (skipPolls > 1) {
        // Silently skip this poll
        return
      }
    }
  }

  const fetchStatus = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch('/api/indexer/status', {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) throw new Error('Failed to fetch status')
      const data = await response.json()
      setIndexerStatus(data.status)

      // Reset failure count on success
      statusFailureCount.current = 0
      lastStatusError.current = null
    } catch (err: any) {
      statusFailureCount.current++
      const errorMsg = err.name === 'AbortError' ? 'Request timeout' : (err.message || 'Failed to fetch status')

      // Only log error if it's different from last error or first failure
      if (errorMsg !== lastStatusError.current || statusFailureCount.current === 1) {
        console.error(`Error fetching status (attempt ${statusFailureCount.current}):`, errorMsg)
        lastStatusError.current = errorMsg
      }

      // Exponential backoff: skip next N polls (max 10 polls = 20 seconds)
      const skipPolls = Math.min(statusFailureCount.current, 10)
      if (skipPolls > 1) {
        // Silently skip this poll
        return
      }
    }
  }

  const fetchAll = async () => {
    console.log('[fetchAll] Starting...')
    setIsLoading(true)
    setError(null)
    try {
      // Fetch tokens first (needed for holders and top traders)
      console.log('[fetchAll] Fetching tokens...')
      await fetchTokens()

      // Don't wait for state - fetch tokens directly via API to avoid race condition
      const tokensResponse = await fetch('/api/indexer/tokens')
      const tokensData = await tokensResponse.json().catch(() => ({ tokens: [] }))
      const availableTokens = tokensData.tokens || []
      console.log(`[fetchAll] Found ${availableTokens.length} tokens`)

      // Update tokens state
      setTokens(availableTokens)

      // CRITICAL: Read current displayFilter value to avoid closure issues
      // Use a function to get current state value
      const currentFilter = displayFilter

      // Fetch everything else in parallel - pass filter explicitly
      // Use Promise.allSettled to ensure all requests complete even if some fail
      console.log('[fetchAll] Fetching all data in parallel with filter:', currentFilter)
      const results = await Promise.allSettled([
        fetchStats(),
        fetchWalletsWithFilter(currentFilter),
        fetchTradesWithFilter(currentFilter),
        fetchPositions(),
        fetchTopTradersWithTokens(availableTokens, currentFilter),
        fetchHoldersWithTokens(availableTokens, currentFilter)
      ])

      // Log any failures but don't block rendering
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const names = ['stats', 'wallets', 'trades', 'positions', 'topTraders', 'holders']
          console.warn(`[fetchAll] ${names[index]} fetch failed:`, result.reason)
        }
      })

      console.log('[fetchAll] Complete!')
    } catch (err: any) {
      console.error('[fetchAll] Error:', err)
      // Don't show error for holders fetch failures (they're optional)
      if (!err.message?.includes('Failed to fetch holders')) {
        setError(err.message || 'Failed to load data')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Wrapper functions that accept filter parameter to avoid state closure issues
  const fetchWalletsWithFilter = async (filter: 'registered' | 'full') => {
    try {
      const params = new URLSearchParams()
      if (filter === 'registered') {
        params.append('wallet_filter', 'registered')
      }
      const response = await fetch(`/api/indexer/wallets?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch wallets')
      const data = await response.json()
      setWallets(data.wallets || [])
    } catch (err) {
      console.error('Error fetching wallets:', err)
    }
  }

  const fetchTradesWithFilter = async (filter: 'registered' | 'full') => {
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: String(tradePage * 50),
        sort_by: tradeSortField,
        sort_order: tradeSortOrder,
        ...(tradeFilterSide !== 'ALL' && { side: tradeFilterSide })
      })
      if (filter === 'registered') {
        params.append('wallet_filter', 'registered')
      }
      // NOTE: Not filtering by token_address - fetch ALL trades from Supabase
      const response = await fetch(`/api/indexer/trades?${params}`)
      if (!response.ok) {
        let errorMessage = 'Failed to fetch trades'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          // Response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      const data = await response.json()
      setTrades(data.trades || [])
      setTradeTotal(data.pagination?.total || 0)

      // Log for debugging
      if (data.trades && data.trades.length === 0) {
        console.log('[fetchTrades] No trades found in database. Total in DB:', data.pagination?.total || 0)
      } else {
        console.log(`[fetchTrades] Loaded ${data.trades?.length || 0} trades (total: ${data.pagination?.total || 0})`)
      }
    } catch (err: any) {
      console.error('Error fetching trades:', err)
      setTrades([])
      setTradeTotal(0)
    }
  }

  // Helper functions that accept tokens and filter directly to avoid state race conditions
  const fetchTopTradersWithTokens = async (availableTokens: Token[], filter: 'registered' | 'full') => {
    try {
      const params = new URLSearchParams({
        limit: '100',
        offset: '0',
        ...(filter === 'registered' && { wallet_filter: 'registered' })
      })
      // Use selected token or first available token
      const tokenToUse = selectedToken || (availableTokens.length > 0 ? availableTokens[0].token_address : null)
      if (tokenToUse) {
        params.append('token_address', tokenToUse)
      }
      const response = await fetch(`/api/indexer/top-traders?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch top traders')
      const data = await response.json()
      setTopTraders(data.traders || [])
    } catch (err) {
      console.error('Error fetching top traders:', err)
      setTopTraders([])
    }
  }

  const fetchHoldersWithTokens = async (availableTokens: Token[], filter: 'registered' | 'full') => {
    try {
      // Only fetch if we have a token selected or tokens available
      const tokenToUse = selectedToken || (availableTokens.length > 0 ? availableTokens[0].token_address : null)
      if (!tokenToUse) {
        setHolders([])
        return
      }

      const params = new URLSearchParams({
        token_address: tokenToUse,
        limit: '100',
        offset: '0',
        ...(filter === 'registered' && { wallet_filter: 'registered' })
      })
      const response = await fetch(`/api/indexer/holders?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.warn('Failed to fetch holders:', errorData.error || 'Unknown error')
        setHolders([])
        return
      }
      const data = await response.json()
      setHolders(data.holders || [])
    } catch (err) {
      console.warn('Error fetching holders:', err)
      setHolders([])
    }
  }

  // Removed handleProcessSwaps - unified into sync
  // Removed handleDiscoverHolders - unified into sync

  const handleTokenSync = async (tokenAddress: string, tokenSyncType: 'incremental' | 'full' = 'incremental', password?: string) => {
    try {
      setIsSyncing(true)
      setError(null)

      const response = await fetch('/api/indexer/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncType: tokenSyncType,
          tokenAddress, // Per-token sync
          ...(password && { password })
        })
      })

      const data = await response.json()

      if (response.ok) {
        setShowPasswordPrompt(false)
        setError(null)
        fetchStatus()
        fetchLogs()
        const pollInterval = setInterval(async () => {
          await fetchStatus()
          await fetchLogs()
          const statusData = await fetch('/api/indexer/status').then(r => r.json()).catch(() => ({ status: { isRunning: false } }))
          if (!statusData.status?.isRunning) {
            clearInterval(pollInterval)
            setIsSyncing(false)
            setTimeout(() => fetchAll(), 2000)
          }
        }, 2000)
      } else {
        if (data.requiresPassword) {
          setShowPasswordPrompt(true)
          setError('Invalid password')
        } else {
          setShowPasswordPrompt(false)
          setError(data.error || 'Token sync failed')
        }
        setIsSyncing(false)
      }
    } catch (err: any) {
      console.error('Error syncing token:', err)
      setShowPasswordPrompt(false)
      setError(err.message || 'Token sync failed')
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    // On mount: fetch all data immediately - don't wait for anything
    const loadData = async () => {
      console.log('[Page Load] Fetching all data...')
      await fetchAll()
      if (isAdminMode) {
        await fetchStatus()
        await fetchLogs()
      }
    }
    loadData()

    // Poll logs and status continuously if admin mode is enabled
    if (isAdminMode) {
      const interval = setInterval(async () => {
        await fetchStatus()
        await fetchLogs()
      }, 2000) // Poll every 2 seconds

      // Cleanup interval on unmount
      return () => clearInterval(interval)
    }
  }, [isAdminMode]) // Only run on mount

  // Auto-refresh data when sync completes (only in admin mode)
  useEffect(() => {
    if (isAdminMode && indexerStatus && !indexerStatus.isRunning && !isSyncing) {
      // Sync completed, refresh all data automatically
      console.log('[Sync Complete] Auto-refreshing data...')
      setTimeout(() => fetchAll(), 1000) // Small delay to ensure DB is updated
    }
  }, [isAdminMode, indexerStatus?.isRunning, isSyncing])

  useEffect(() => {
    if (activeTab === 'trades') {
      fetchTrades()
    }
  }, [tradeSortField, tradeSortOrder, tradeFilterSide, tradePage])

  const handleManualSync = async (password?: string) => {
    try {
      setIsSyncing(true)
      setError(null)

      const response = await fetch('/api/indexer/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncType: syncType, // 'incremental' or 'full' - always syncs all wallets
          ...(password && { password })
        })
      })

      const data = await response.json()

      if (response.ok) {
        setShowPasswordPrompt(false)
        setError(null)
        // Start polling for status and logs
        fetchStatus()
        fetchLogs()
        // Keep polling until sync completes
        const pollInterval = setInterval(async () => {
          await fetchStatus()
          await fetchLogs()
          const statusData = await fetch('/api/indexer/status').then(r => r.json()).catch(() => ({ status: { isRunning: false } }))
          if (!statusData.status?.isRunning) {
            clearInterval(pollInterval)
            setIsSyncing(false)
            setTimeout(() => fetchAll(), 2000)
          }
        }, 2000)
      } else {
        if (data.requiresPassword) {
          setShowPasswordPrompt(true)
          setError('Invalid password')
        } else {
          setShowPasswordPrompt(false)
          setError(data.error || 'Sync failed')
        }
        setIsSyncing(false)
      }
    } catch (err: any) {
      console.error('Error syncing:', err)
      setShowPasswordPrompt(false)
      setError(err.message || 'Sync failed')
      setIsSyncing(false)
    }
  }

  const formatNumber = (num: number | string, decimals: number = 2) => {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(n)) return '0.00'
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price
    if (num === 0 || !isFinite(num) || isNaN(num)) return '$0.00'
    if (num < 0.0001) {
      const str = num.toFixed(20)
      const match = str.match(/^0\.(0+)([1-9]\d*)/)
      if (match) {
        const zeros = match[1].length
        const digits = match[2].slice(0, 6)
        const subscriptMap: Record<string, string> = {
          '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
          '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        }
        const zeroCount = zeros.toString().split('').map(d => subscriptMap[d] || d).join('')
        return `$0.0${zeroCount}${digits}`
      }
    }
    if (num >= 1) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
    if (num >= 0.01) return `$${num.toFixed(4)}`
    return `$${num.toFixed(6)}`
  }

  const getBaseTokenSymbol = (address?: string | null): string => {
    if (!address) return 'WETH'
    const addrLower = address.toLowerCase()
    if (addrLower === NATIVE_ETH_ADDRESS || addrLower === WETH_ADDRESS.toLowerCase()) return 'ETH'
    if (addrLower === WETH_ADDRESS.toLowerCase()) return 'WETH'
    if (addrLower === USDC_ADDRESS.toLowerCase()) return 'USDC'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatBaseTokenAmount = (amount: string | null | undefined, decimals: number = 18): string => {
    if (!amount) return '0.00'
    try {
      const bigIntAmount = BigInt(amount)
      const divisor = BigInt(10 ** decimals)
      const whole = bigIntAmount / divisor
      const fraction = bigIntAmount % divisor
      const fractionStr = fraction.toString().padStart(decimals, '0')
      const num = parseFloat(`${whole}.${fractionStr}`)
      if (num < 0.0001 && num > 0) {
        return num.toFixed(12).replace(/\.?0+$/, '')
      }
      return num.toFixed(6).replace(/\.?0+$/, '')
    } catch {
      return '0.00'
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getBaseScanUrl = (hash: string) => {
    return `https://basescan.org/tx/${hash}`
  }

  const getBaseScanAddressUrl = (address: string) => {
    return `https://basescan.org/address/${address}`
  }

  const handleSort = (field: SortField) => {
    if (tradeSortField === field) {
      setTradeSortOrder(tradeSortOrder === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setTradeSortField(field)
      setTradeSortOrder('DESC')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (tradeSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />
    }
    return tradeSortOrder === 'ASC'
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
                 <div className="mb-8">
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-primary uppercase mb-2">
                Stats
              </h1>
              <p className="text-sm sm:text-lg text-muted-foreground">
                Contest data and indexer analytics
              </p>
            </div>
                         {mainTab === 'indexer-analytics' && (
               <div className="flex flex-wrap gap-2">
               {/* Wallet Filter Toggle: Registered vs Full (UI Display Only) */}
               <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 bg-card border-2 border-primary rounded">
                 <span className={`text-xs sm:text-sm font-bold uppercase transition-colors ${displayFilter === 'registered' ? 'text-primary' : 'text-muted-foreground'}`}>
                   Registered
                 </span>
                 <button
                   onClick={() => {
                     setDisplayFilter(displayFilter === 'registered' ? 'full' : 'registered')
                     fetchAll() // Refresh data with new filter
                   }}
                   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                     displayFilter === 'full' ? 'bg-primary' : 'bg-muted'
                   }`}
                   role="switch"
                   aria-checked={displayFilter === 'full'}
                   aria-label="Toggle wallet filter"
                 >
                   <span
                     className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                       displayFilter === 'full' ? 'translate-x-6' : 'translate-x-1'
                     }`}
                   />
                 </button>
                 <span className={`text-xs sm:text-sm font-bold uppercase transition-colors ${displayFilter === 'full' ? 'text-primary' : 'text-muted-foreground'}`}>
                   Full
                 </span>
               </div>

               {/* Sync Type Toggle: Incremental vs Full - Admin Only */}
               {isAdminMode && (
                 <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 bg-card border-2 border-primary rounded">
                   <span className={`text-xs sm:text-sm font-bold uppercase transition-colors ${syncType === 'incremental' ? 'text-primary' : 'text-muted-foreground'}`}>
                     Incremental
                   </span>
                   <button
                     onClick={() => setSyncType(syncType === 'incremental' ? 'full' : 'incremental')}
                     className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                       syncType === 'full' ? 'bg-primary' : 'bg-muted'
                     }`}
                     role="switch"
                     aria-checked={syncType === 'full'}
                     aria-label="Toggle sync type"
                   >
                     <span
                       className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                         syncType === 'full' ? 'translate-x-6' : 'translate-x-1'
                       }`}
                     />
                   </button>
                   <span className={`text-xs sm:text-sm font-bold uppercase transition-colors ${syncType === 'full' ? 'text-primary' : 'text-muted-foreground'}`}>
                     Full Sync
                   </span>
                 </div>
               )}

               {/* Token Selector - Admin Only */}
               {isAdminMode && tokens.length > 0 && (
                 <select
                   value={selectedToken || ''}
                   onChange={(e) => setSelectedToken(e.target.value)}
                   disabled={isSyncing}
                   className="px-2 sm:px-3 py-2 bg-background border-2 border-primary rounded font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto min-w-[150px] sm:min-w-[200px]"
                 >
                   <option value="">-- Select Token --</option>
                   {tokens.map((token) => (
                     <option key={token.token_address} value={token.token_address}>
                       {token.symbol} ({token.token_address.slice(0, 6)}...{token.token_address.slice(-4)})
                     </option>
                   ))}
                 </select>
               )}
               {/* Sync Button - Admin Only */}
               {isAdminMode && (
                 <Button
                   onClick={() => {
                     // Check if password is required BEFORE making request
                     // Show password modal first, then sync will happen after password is entered
                     setShowPasswordPrompt(true)
                   }}
                   disabled={isSyncing}
                   className="px-3 sm:px-4 py-2"
                 >
                   <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                   Sync
                 </Button>
               )}
               <Button
                 onClick={fetchAll}
                 disabled={isLoading}
                 variant="outline"
                 className="font-bold uppercase text-xs sm:text-sm"
               >
                 <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                 <span className="hidden sm:inline">Refresh</span>
                 <span className="sm:hidden">Ref</span>
               </Button>
             </div>
                         )}
          </div>
        </div>

          {mainTab === 'indexer-analytics' && error && (
            <Card className="bg-destructive/10 border-destructive border-2 p-4 mb-4">
              <p className="text-destructive font-bold">{error}</p>
            </Card>
          )}

          {/* Password Prompt Modal - Admin Only */}
          {mainTab === 'indexer-analytics' && isAdminMode && showPasswordPrompt && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <Card className="bg-card border-2 border-primary p-6 max-w-md w-full">
                <h3 className="text-xl font-bold uppercase mb-4">Sync Password Required</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const formData = new FormData(e.currentTarget)
                    const password = formData.get('password') as string

                    // Close modal immediately - handlers will reopen if password is wrong
                    setShowPasswordPrompt(false)
                    setError(null)

                    try {
                      if (selectedToken) {
                        await handleTokenSync(selectedToken, syncType, password)
                      } else {
                        await handleManualSync(password)
                      }
                    } catch (error: any) {
                      console.error('Password form submission error:', error)
                      setError(error.message || 'Failed to submit password')
                      // Reopen modal if there's an error
                      setShowPasswordPrompt(true)
                    }
                  }}
                  className="space-y-4"
                >
                  <Input
                    type="password"
                    name="password"
                    placeholder="Enter sync password"
                    required
                    className="font-mono"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordPrompt(false)
                        setError(null)
                      }}
                      className="font-bold uppercase"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="default" className="font-bold uppercase">
                      Submit
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* Sync Status Panel - Admin Only */}
          {mainTab === 'indexer-analytics' && isAdminMode && indexerStatus && (
            <Card className={`bg-card border-2 mb-4 ${indexerStatus.isRunning ? 'border-primary' : 'border-primary/50'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg uppercase">Sync Status</CardTitle>
                  <div className="flex items-center gap-3">
                    {indexerStatus.isRunning ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-bold text-green-500">Running</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                        <span className="text-sm font-bold text-muted-foreground">Done</span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSyncStatusMinimized(!syncStatusMinimized)}
                      className="h-6 w-6 p-0"
                      title={syncStatusMinimized ? 'Expand' : 'Minimize'}
                    >
                      {syncStatusMinimized ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {!syncStatusMinimized && (
              <CardContent>
                <div className="space-y-4">
                  {/* Block Status Warning */}
                  {indexerStatus.currentBlock !== null && indexerStatus.currentBlock !== undefined && indexerStatus.lastSyncedBlock !== null && indexerStatus.lastSyncedBlock !== undefined && indexerStatus.blocksBehind !== null && indexerStatus.blocksBehind !== undefined && indexerStatus.blocksBehind > 100 && (
                    <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500 font-bold">⚠️ Sync Needed</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        <div>Current Block: {indexerStatus.currentBlock.toLocaleString()}</div>
                        <div>Last Synced: {indexerStatus.lastSyncedBlock.toLocaleString()}</div>
                        <div className="font-bold text-yellow-500">
                          {indexerStatus.blocksBehind.toLocaleString()} blocks behind ({Math.round(indexerStatus.blocksBehind / 30)} minutes behind)
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Block Info (always show) */}
                  {indexerStatus.currentBlock !== null && indexerStatus.currentBlock !== undefined && indexerStatus.lastSyncedBlock !== null && indexerStatus.lastSyncedBlock !== undefined && (
                    <div className="bg-secondary/50 border border-primary/30 rounded p-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Current Block:</span>
                          <span className="font-mono font-bold ml-2">{indexerStatus.currentBlock.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Synced:</span>
                          <span className="font-mono font-bold ml-2">{indexerStatus.lastSyncedBlock.toLocaleString()}</span>
                        </div>
                        {indexerStatus.blocksBehind !== null && indexerStatus.blocksBehind !== undefined && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Blocks Behind:</span>
                            <span className={`font-bold ml-2 ${indexerStatus.blocksBehind > 100 ? 'text-yellow-500' : 'text-green-500'}`}>
                              {indexerStatus.blocksBehind.toLocaleString()} ({Math.round(indexerStatus.blocksBehind / 30)} min)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar - Only show when running */}
                  {indexerStatus.isRunning && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Overall Progress</span>
                        <span className="font-bold text-lg">{indexerStatus.progress}%</span>
                      </div>
                      <div className="w-full bg-secondary h-3 border border-primary rounded">
                        <div
                          className="bg-primary h-full transition-all duration-300 rounded"
                          style={{ width: `${indexerStatus.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          {indexerStatus.walletsProcessed} / {indexerStatus.walletsTotal} wallets processed
                        </span>
                        <span className="text-muted-foreground">
                          {indexerStatus.tradesFound} trades found
                        </span>
                      </div>
                      {/* Overall Time Info */}
                      {(indexerStatus.elapsedSeconds !== undefined || indexerStatus.estimatedRemainingSeconds !== undefined) && (
                        <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-primary/30 pt-2">
                          {indexerStatus.elapsedSeconds !== undefined && indexerStatus.elapsedSeconds > 0 && (
                            <span>Time: {Math.floor(indexerStatus.elapsedSeconds / 60)}m {Math.round(indexerStatus.elapsedSeconds % 60)}s</span>
                          )}
                          {indexerStatus.estimatedRemainingSeconds !== undefined && indexerStatus.estimatedRemainingSeconds > 0 && (
                            <span className="text-primary">ETA: {Math.floor(indexerStatus.estimatedRemainingSeconds / 60)}m {Math.round(indexerStatus.estimatedRemainingSeconds % 60)}s</span>
                          )}
                        </div>
                      )}
                      {/* Token Sync Progress */}
                      {indexerStatus.tokensTotal > 0 && (
                        <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-primary/30 pt-2 mt-2">
                          <span>
                            Phase 1: {indexerStatus.tokensProcessed} / {indexerStatus.tokensTotal} tokens synced
                          </span>
                          {indexerStatus.tokensTotal > 0 && (
                            <span>
                              {Math.round((indexerStatus.tokensProcessed / indexerStatus.tokensTotal) * 100)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completion Status */}
                  {!indexerStatus.isRunning && indexerStatus.endTime && (
                    <div className="bg-green-500/20 border border-green-500/50 rounded p-3">
                      <div className="text-sm">
                        <span className="text-green-500 font-bold">✓ Sync Completed</span>
                        <div className="text-muted-foreground mt-1">
                          Finished at {new Date(indexerStatus.endTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Workers */}
                  {indexerStatus.isRunning && indexerStatus.activeWorkers && indexerStatus.activeWorkers.length > 0 && (
                    <div className="space-y-2 border-t border-primary pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold uppercase">Active Workers ({indexerStatus.activeWorkers.length})</span>
                        <span className="text-xs text-muted-foreground">Processing in parallel</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {indexerStatus.activeWorkers.map((wallet, idx) => {
                          const workerDetail = indexerStatus.workerDetails?.[wallet.toLowerCase()];

                          return (
                            <div
                              key={idx}
                              className="bg-secondary/50 border border-primary/30 rounded p-2 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                                  <span className="font-mono text-xs whitespace-nowrap" title={wallet}>
                                    {wallet.startsWith('0x') && wallet.length === 42 ? formatAddress(wallet) : wallet}
                                  </span>
                                </div>
                                <span className="text-xs font-bold flex-shrink-0">
                                  {workerDetail?.progress || 0}%
                                </span>
                              </div>

                              {/* Compact Progress Bar */}
                              <div className="w-full bg-secondary h-1.5 border border-primary/20 rounded overflow-hidden">
                                <div
                                  className="bg-primary h-full transition-all duration-300"
                                  style={{ width: `${workerDetail?.progress || 0}%` }}
                                />
                              </div>

                              {/* Compact Task Info */}
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <div className="truncate" title={workerDetail?.currentTask || 'Processing...'}>
                                  {workerDetail?.currentTask || 'Processing...'}
                                </div>
                                <div className="flex gap-3 text-xs flex-wrap">
                                  {workerDetail?.blocksProcessed !== undefined && workerDetail?.blocksTotal !== undefined && (
                                    <span>Blocks: {workerDetail.blocksProcessed.toLocaleString()}/{workerDetail.blocksTotal.toLocaleString()}</span>
                                  )}
                                  {workerDetail?.transfersFound !== undefined && (
                                    <span>Transfers: {workerDetail.transfersFound.toLocaleString()}</span>
                                  )}
                                  {workerDetail?.transactionsProcessed !== undefined && (
                                    <span>
                                      Txs: {workerDetail.transactionsProcessed.toLocaleString()}
                                      {workerDetail?.transactionsTotal !== undefined && `/${workerDetail.transactionsTotal.toLocaleString()}`}
                                    </span>
                                  )}
                                  {workerDetail?.swapsProcessed !== undefined && (
                                    <span>Swaps: {workerDetail.swapsProcessed.toLocaleString()}</span>
                                  )}
                                  {workerDetail?.elapsedSeconds !== undefined && workerDetail.elapsedSeconds > 0 && (
                                    <span>Time: {Math.floor(workerDetail.elapsedSeconds / 60)}m {Math.round(workerDetail.elapsedSeconds % 60)}s</span>
                                  )}
                                  {workerDetail?.estimatedRemainingSeconds !== undefined && workerDetail.estimatedRemainingSeconds > 0 && (
                                    <span className="text-primary">
                                      ETA: {Math.floor(workerDetail.estimatedRemainingSeconds / 60)}m {Math.round(workerDetail.estimatedRemainingSeconds % 60)}s
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Current Wallet (if no workers) */}
                  {indexerStatus.isRunning && (!indexerStatus.activeWorkers || indexerStatus.activeWorkers.length === 0) && indexerStatus.currentWallet && (
                    <div className="border-t border-primary pt-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Processing: </span>
                        <span className="font-mono">{formatAddress(indexerStatus.currentWallet)}</span>
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {indexerStatus.errors.length > 0 && (
                    <div className="border-t border-primary pt-3">
                      <div className="text-sm text-destructive font-bold">
                        {indexerStatus.errors.length} error(s) occurred
                      </div>
                      <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                        {indexerStatus.errors.slice(-5).map((error, idx) => (
                          <div key={idx} className="text-xs text-destructive/80 font-mono bg-destructive/10 p-1 rounded">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              )}
            </Card>
          )}

        </div>

        {/* Main Tabs: Contest Data vs Indexer Analytics */}
        <div className="mb-6">
          <div className="flex gap-2 border-b-2 border-primary pb-2">
            <Button
              onClick={() => setMainTab('contest-data')}
              variant={mainTab === 'contest-data' ? 'default' : 'ghost'}
              className={`font-bold uppercase rounded-none border-b-2 border-transparent ${
                mainTab === 'contest-data'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-secondary/50'
              }`}
            >
              Contest Data
            </Button>
            <Button
              onClick={() => setMainTab('indexer-analytics')}
              variant={mainTab === 'indexer-analytics' ? 'default' : 'ghost'}
              className={`font-bold uppercase rounded-none border-b-2 border-transparent ${
                mainTab === 'indexer-analytics'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-secondary/50'
              }`}
            >
              Indexer Analytics
            </Button>
          </div>
        </div>

        {/* Contest Data Tab */}
        {mainTab === 'contest-data' && (
          <ContestDataTab />
        )}

        {/* Indexer Analytics Tab */}
        {mainTab === 'indexer-analytics' && (
          <>
        {/* Stats Cards */}
        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Card className="bg-card border-2 border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase">Total Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.trades.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">{stats.recent.trades_24h} in last 24h</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-2 border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase">Total Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${formatNumber(stats.volume.total, 0)}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-green-500">Buy: ${formatNumber(stats.volume.buy, 0)}</span>
                  <span className="text-red-500">Sell: ${formatNumber(stats.volume.sell, 0)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-2 border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase">Realized PnL</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${stats.pnl.realized >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ${formatNumber(stats.pnl.realized, 2)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{stats.pnl.positions} positions</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground uppercase">Loading stats...</p>
          </div>
        )}

        {/* Tabs - Improved scrollable design */}
        <div className="mb-6">
          <div className="flex gap-2 border-b-2 border-primary pb-2 overflow-x-auto scrollbar-hide">
            {(['overview', 'trades', 'top-traders', 'holders', 'positions', 'tokens', ...(isAdminMode ? ['logs'] : [])] as TabType[]).map((tab) => (
              <Button
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  // Auto-fetch data when switching tabs
                  if (tab === 'logs') fetchLogs()
                  if (tab === 'top-traders') fetchTopTraders()
                  if (tab === 'holders') fetchHolders()
                  if (tab === 'trades') fetchTrades()
                }}
                variant={activeTab === tab ? 'default' : 'ghost'}
                className={`font-bold uppercase rounded-none border-b-2 border-transparent whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-secondary/50'
                }`}
              >
                {tab === 'logs' && <Terminal className="w-4 h-4 mr-2" />}
                {tab === 'trades' && <TrendingUp className="w-4 h-4 mr-2" />}
                {tab === 'holders' && <Plus className="w-4 h-4 mr-2" />}
                {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-xl text-muted-foreground uppercase">Loading...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-card border-2 border-primary">
                    <CardHeader>
                      <CardTitle className="text-xl uppercase">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Active Positions</span>
                          <span className="font-bold text-lg">{stats.positions}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Unique Traders</span>
                          <span className="font-bold text-lg">{stats.traders}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tokens Tracked</span>
                          <span className="font-bold text-lg">{stats.tokens}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Trades (24h)</span>
                          <span className="font-bold text-lg">{stats.recent.trades_24h}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-2 border-primary">
                    <CardHeader>
                      <CardTitle className="text-xl uppercase">Volume Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Buy Volume</span>
                            <span className="text-sm font-bold">
                              {stats.volume.total > 0
                                ? `${((stats.volume.buy / stats.volume.total) * 100).toFixed(1)}%`
                                : '0%'}
                            </span>
                          </div>
                          <div className="w-full bg-secondary h-2 border border-primary">
                            <div
                              className="bg-green-500 h-full"
                              style={{ width: stats.volume.total > 0 ? `${(stats.volume.buy / stats.volume.total) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Sell Volume</span>
                            <span className="text-sm font-bold">
                              {stats.volume.total > 0
                                ? `${((stats.volume.sell / stats.volume.total) * 100).toFixed(1)}%`
                                : '0%'}
                            </span>
                          </div>
                          <div className="w-full bg-secondary h-2 border border-primary">
                            <div
                              className="bg-red-500 h-full"
                              style={{ width: stats.volume.total > 0 ? `${(stats.volume.sell / stats.volume.total) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Trades Tab */}
            {activeTab === 'trades' && (
              <Card className="bg-card border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-xl uppercase mb-4">Recent Trades</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={tradeFilterSide === 'ALL' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTradeFilterSide('ALL')}
                      className="font-bold uppercase"
                    >
                      All
                    </Button>
                    <Button
                      variant={tradeFilterSide === 'BUY' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTradeFilterSide('BUY')}
                      className="font-bold uppercase"
                    >
                      Sell {/* FLIPPED: Filter button shows "Sell" but filters for BUY */}
                    </Button>
                    <Button
                      variant={tradeFilterSide === 'SELL' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTradeFilterSide('SELL')}
                      className="font-bold uppercase"
                    >
                      Buy {/* FLIPPED: Filter button shows "Buy" but filters for SELL */}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {trades.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No trades found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-primary">
                            <th className="text-left p-3 text-sm font-bold uppercase cursor-pointer hover:text-primary" onClick={() => handleSort('timestamp')}>
                              Time <SortIcon field="timestamp" />
                            </th>
                            <th className="text-left p-3 text-sm font-bold uppercase">Wallet</th>
                            <th className="text-left p-3 text-sm font-bold uppercase">Type</th>
                            <th className="text-right p-3 text-sm font-bold uppercase cursor-pointer hover:text-primary" onClick={() => handleSort('token_amount')}>
                              Amount <SortIcon field="token_amount" />
                            </th>
                            <th className="text-right p-3 text-sm font-bold uppercase cursor-pointer hover:text-primary" onClick={() => handleSort('price_usd')}>
                              Price <SortIcon field="price_usd" />
                            </th>
                            <th className="text-right p-3 text-sm font-bold uppercase cursor-pointer hover:text-primary" onClick={() => handleSort('usd_value')}>
                              Value <SortIcon field="usd_value" />
                            </th>
                            <th className="text-right p-3 text-sm font-bold uppercase">
                              Base Token
                            </th>
                            <th className="text-left p-3 text-sm font-bold uppercase">TX</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trades.map((trade) => (
                            <tr key={trade.id} className="border-b border-primary/20 hover:bg-secondary/50">
                              <td className="p-3 text-sm text-muted-foreground">
                                {formatRelativeTime(trade.timestamp)}
                              </td>
                              <td className="p-3">
                                <a
                                  href={getBaseScanAddressUrl(trade.wallet_address)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-sm hover:text-primary flex items-center gap-1"
                                >
                                  {formatAddress(trade.wallet_address)}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold text-xs ${
                                  trade.side === 'SELL' // FLIPPED: Display SELL as green (uptrend), BUY as red (downtrend)
                                    ? 'bg-green-500/20 text-green-500'
                                    : 'bg-red-500/20 text-red-500'
                                }`}>
                                  {trade.side === 'SELL' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {trade.side === 'BUY' ? 'SELL' : 'BUY'} {/* FLIPPED LABELS */}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono text-sm">
                                {formatNumber(parseFloat(trade.token_amount) / 1e18)} {trade.token_symbol || 'TOK'}
                              </td>
                              <td className="p-3 text-right font-mono text-sm">
                                {formatPrice(trade.price_usd)}
                              </td>
                              <td className="p-3 text-right font-bold">
                                ${formatNumber(trade.usd_value)}
                              </td>
                              <td className={`px-4 py-3 text-right font-mono text-xs`}>
                                <div className="flex flex-col items-end">
                                  {trade.base_token_amount ? (
                                    <>
                                      {(() => {
                                        const baseTokenValue = parseFloat(formatBaseTokenAmount(trade.base_token_amount, 18))
                                        return baseTokenValue < 0.0001 && baseTokenValue > 0 ?
                                          `0.0${String(baseTokenValue.toFixed(12)).match(/0+(\d)/)?.[1] || '0'}` :
                                         baseTokenValue > 0 ? baseTokenValue.toFixed(6) : '0.00'
                                      })()}
                                      <span className="text-[10px] text-muted-foreground mt-0.5">{getBaseTokenSymbol(trade.base_token_address)}</span>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <a
                                  href={getBaseScanUrl(trade.tx_hash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs hover:text-primary flex items-center gap-1"
                                >
                                  {formatHash(trade.tx_hash)}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {tradeTotal > 50 && (
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-primary">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTradePage(Math.max(0, tradePage - 1))}
                            disabled={tradePage === 0}
                            className="font-bold uppercase"
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {tradePage + 1} of {Math.ceil(tradeTotal / 50)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTradePage(tradePage + 1)}
                            disabled={(tradePage + 1) * 50 >= tradeTotal}
                            className="font-bold uppercase"
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Positions Tab */}
            {activeTab === 'positions' && (
              <Card className="bg-card border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-xl uppercase">Active Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  {positions.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No active positions found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {positions.map((position, idx) => {
                        const realizedPnL = parseFloat(position.realized_pnl_usd || '0')
                        const unrealizedPnL = parseFloat(position.unrealized_pnl_usd || '0')
                        const totalPnL = realizedPnL + unrealizedPnL
                        const remainingAmount = parseFloat(position.remaining_amount) / 1e18
                        const costBasis = parseFloat(position.cost_basis_usd)

                        return (
                          <Card key={idx} className="bg-secondary border-2 border-primary">
                            <CardHeader className="pb-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-sm uppercase text-muted-foreground">
                                    {position.token_symbol || 'TOKEN'}
                                  </CardTitle>
                                  <p className="font-mono text-xs text-muted-foreground mt-1">
                                    {formatAddress(position.wallet_address)}
                                  </p>
                                </div>
                                <a
                                  href={getBaseScanAddressUrl(position.wallet_address)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-accent"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Balance</span>
                                <span className="font-bold">{formatNumber(remainingAmount)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Cost Basis</span>
                                <span className="font-bold">${formatNumber(costBasis)}</span>
                              </div>
                              {position.current_price_usd && (
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Current Price</span>
                                  <span className="font-bold">${formatNumber(position.current_price_usd)}</span>
                                </div>
                              )}
                              <div className="border-t border-primary pt-3 space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Realized PnL</span>
                                  <span className={`font-bold ${realizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    ${formatNumber(realizedPnL)}
                                  </span>
                                </div>
                                {position.unrealized_pnl_usd && (
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Unrealized PnL</span>
                                    <span className={`font-bold ${unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      ${formatNumber(unrealizedPnL)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between pt-2 border-t border-primary">
                                  <span className="text-sm font-bold uppercase">Total PnL</span>
                                  <span className={`font-bold text-lg ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    ${formatNumber(totalPnL)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Holders Tab */}
            {activeTab === 'holders' && (
              <Card className="bg-card border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-xl uppercase">Token Holders</CardTitle>
                  {tokens.length > 0 && (
                    <div className="mt-4">
                      <label className="text-sm font-bold uppercase mb-2 block">Select Token</label>
                      <select
                        value={selectedToken || (tokens.length > 0 ? tokens[0].token_address : '')}
                        onChange={(e) => {
                          setSelectedToken(e.target.value)
                          // Fetch holders for the selected token
                          const tokenToUse = e.target.value || (tokens.length > 0 ? tokens[0].token_address : null)
                          if (tokenToUse) {
                            const params = new URLSearchParams({
                              token_address: tokenToUse,
                              limit: '100',
                              offset: '0',
                              ...(displayFilter === 'registered' && { wallet_filter: 'registered' })
                            })
                            fetch(`/api/indexer/holders?${params.toString()}`)
                              .then(res => res.json())
                              .then(data => setHolders(data.holders || []))
                              .catch(err => {
                                console.error('Error fetching holders:', err)
                                setHolders([])
                              })
                          }
                        }}
                        className="px-3 py-2 bg-background border-2 border-primary rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto min-w-[200px]"
                      >
                        {tokens.map((token) => (
                          <option key={token.token_address} value={token.token_address}>
                            {token.symbol} ({token.token_address.slice(0, 6)}...{token.token_address.slice(-4)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {tokens.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No tokens available. Please add a token first.</p>
                    </div>
                  ) : holders.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        No holders found for this token
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-primary">
                            <th className="text-left p-3 text-sm font-bold uppercase">Rank</th>
                            <th className="text-left p-3 text-sm font-bold uppercase">Wallet</th>
                            <th className="text-right p-3 text-sm font-bold uppercase">Amount</th>
                            <th className="text-right p-3 text-sm font-bold uppercase">Percentage</th>
                            <th className="text-right p-3 text-sm font-bold uppercase">Value (USD)</th>
                            <th className="text-right p-3 text-sm font-bold uppercase">Txn Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holders.map((holder: any) => (
                            <tr key={holder.wallet_address} className="border-b border-primary/20 hover:bg-secondary/50">
                              <td className="p-3 font-bold">#{holder.rank}</td>
                              <td className="p-3">
                                <a
                                  href={getBaseScanAddressUrl(holder.wallet_address)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-sm hover:text-primary flex items-center gap-1"
                                >
                                  {formatAddress(holder.wallet_address)}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                              <td className="p-3 text-right font-mono text-sm">
                                {formatNumber(parseFloat(holder.amount) / 1e18)}
                              </td>
                              <td className="p-3 text-right text-sm">
                                {holder.percentage > 0 ? `${formatNumber(holder.percentage, 4)}%` : 'N/A'}
                              </td>
                              <td className="p-3 text-right font-bold">
                                ${formatNumber(holder.value_usd || 0)}
                              </td>
                              <td className="p-3 text-right text-sm">
                                {holder.txn_count || 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tokens Tab */}
            {activeTab === 'tokens' && (
              <Card className="bg-card border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-xl uppercase">Tracked Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Add Token Form - Admin Only */}
                  {isAdminMode && (
                    <div className="mb-6 p-4 bg-secondary/50 border border-primary rounded">
                      <h3 className="text-lg font-bold uppercase mb-4">Add New Token</h3>
                      <TokenForm onSuccess={fetchTokens} />
                    </div>
                  )}

                  {/* Token List */}
                  {tokens.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No tokens tracked yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tokens.map((token) => (
                        <TokenRow key={token.token_address} token={token} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Logs Tab - Admin Only */}
            {isAdminMode && activeTab === 'logs' && (
              <Card className="bg-card border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-xl uppercase flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Indexer Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-black text-green-400 font-mono text-xs p-4 rounded border-2 border-primary max-h-[600px] overflow-y-auto">
                    {logs.length === 0 ? (
                      <div className="text-muted-foreground">No logs available</div>
                    ) : (
                      logs.map((log, idx) => {
                        const timestamp = new Date(log.timestamp).toLocaleTimeString()
                        const colorClass =
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warn' ? 'text-yellow-400' :
                          log.level === 'success' ? 'text-green-400' :
                          'text-gray-300'

                        return (
                          <div key={idx} className={`${colorClass} mb-1`}>
                            <span className="text-gray-500">[{timestamp}]</span>
                            <span className="ml-2 uppercase">{log.level}:</span>
                            <span className="ml-2">{log.message}</span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          </>
          </>
        )}

        <div className="mt-8 text-center">
          <Link href="/">
            <Button className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-bold uppercase">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// Contest Data Tab Component
function ContestDataTab() {
  const [registrations, setRegistrations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRegistration, setExpandedRegistration] = useState<number | null>(null)

  useEffect(() => {
    fetchContestData()
  }, [])

  const fetchContestData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/stats/contest-data')
      if (!response.ok) {
        throw new Error('Failed to fetch contest data')
      }
      const data = await response.json()
      setRegistrations(data.registrations || [])
    } catch (err: any) {
      console.error('Error fetching contest data:', err)
      setError(err.message || 'Failed to load contest data')
    } finally {
      setIsLoading(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatNumber = (num: number | string, decimals: number = 2) => {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(n)) return '0.00'
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-xl text-muted-foreground uppercase">Loading contest data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive border-2 p-6">
        <p className="text-destructive font-bold">Error: {error}</p>
        <Button onClick={fetchContestData} className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-2 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase">Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{registrations.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-2 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase">Indexed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">
              {registrations.filter((r: any) => r.indexed_at).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-2 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-500">
              {registrations.filter((r: any) => !r.indexed_at).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-2 border-primary p-4">
        <p className="text-sm text-muted-foreground">
          <strong>How it works:</strong> This data comes from the user-generated indexing system (not BitQuery).
          When users register for contests, they sign a message and we index their wallet using Alchemy API.
          The service is <code className="bg-background px-1 rounded">userIndexerService.ts</code> which uses
          Alchemy's <code className="bg-background px-1 rounded">eth_getLogs</code> to fetch swap events.
        </p>
      </Card>

      {/* Registrations List */}
      <Card className="bg-card border-2 border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl uppercase">Contest Registrations</CardTitle>
            <Button onClick={fetchContestData} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No contest registrations found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {registrations.map((reg: any) => (
                <div
                  key={reg.id}
                  className="border-2 border-primary rounded p-4 bg-secondary/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">
                          Registration #{reg.id}
                        </h3>
                        {reg.indexed_at ? (
                          <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs font-bold rounded">
                            ✓ Indexed
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs font-bold rounded">
                            ⏳ Pending
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Wallet:</span>
                          <p className="font-mono">{formatAddress(reg.wallet_address)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">FID:</span>
                          <p>{reg.fid || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Token:</span>
                          <p className="font-mono text-xs">{formatAddress(reg.token_address)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Trades:</span>
                          <p className="font-bold">{reg.tradeCount || 0}</p>
                        </div>
                      </div>
                      {reg.current_pnl !== null && (
                        <div className="mt-2">
                          <span className="text-muted-foreground">Current PnL (DB):</span>
                          <span className={`ml-2 font-bold text-lg ${
                            parseFloat(reg.current_pnl || '0') >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            ${formatNumber(reg.current_pnl)}
                          </span>
                        </div>
                      )}
                      {reg.calculatedPnL && (
                        <div className="mt-2 p-2 bg-background/50 rounded border border-primary/30">
                          <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Calculated PnL:</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Position:</span>
                              <p className="font-mono">{formatNumber(reg.calculatedPnL.position, 6)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Cost Basis:</span>
                              <p className="font-mono">${formatNumber(reg.calculatedPnL.costBasis)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Avg Cost:</span>
                              <p className="font-mono">${formatNumber(reg.calculatedPnL.avgCostPerToken)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Realized PnL:</span>
                              <p className={`font-bold ${
                                reg.calculatedPnL.realizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                ${formatNumber(reg.calculatedPnL.realizedPnL)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedRegistration(
                        expandedRegistration === reg.id ? null : reg.id
                      )}
                    >
                      {expandedRegistration === reg.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Expanded Details */}
                  {expandedRegistration === reg.id && (
                    <div className="mt-4 pt-4 border-t border-primary">
                      <div className="space-y-4">
                        {/* Contest Info */}
                        <div>
                          <h4 className="font-bold uppercase text-sm mb-2">Contest Info</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Contest ID:</span>
                              <p>{reg.contest_id}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Token Symbol:</span>
                              <p>{reg.token_symbol || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Start:</span>
                              <p className="text-xs">{formatDate(reg.start_date)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">End:</span>
                              <p className="text-xs">{formatDate(reg.end_date)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Registration Info */}
                        <div>
                          <h4 className="font-bold uppercase text-sm mb-2">Registration Info</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <p className="text-xs">{formatDate(reg.created_at)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Indexed:</span>
                              <p className="text-xs">{reg.indexed_at ? formatDate(reg.indexed_at) : 'Not indexed'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">PnL Calculated:</span>
                              <p className="text-xs">{reg.pnl_calculated_at ? formatDate(reg.pnl_calculated_at) : 'Not calculated'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Status:</span>
                              <p>{reg.contest_status}</p>
                            </div>
                          </div>
                        </div>

                        {/* Trades Table */}
                        {reg.trades && reg.trades.length > 0 && (
                          <div>
                            <h4 className="font-bold uppercase text-sm mb-2">Trades ({reg.trades.length})</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-primary">
                                    <th className="text-left p-2">TX Hash</th>
                                    <th className="text-left p-2">Time</th>
                                    <th className="text-left p-2">Type</th>
                                    <th className="text-right p-2">Amount In</th>
                                    <th className="text-right p-2">Amount Out</th>
                                    <th className="text-right p-2">Price USD</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {reg.trades.map((trade: any, idx: number) => (
                                    <tr key={trade.id} className="border-b border-primary/20">
                                      <td className="p-2 font-mono">
                                        <a
                                          href={`https://basescan.org/tx/${trade.tx_hash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline"
                                        >
                                          {trade.tx_hash.slice(0, 10)}...
                                          <ExternalLink className="w-3 h-3 inline ml-1" />
                                        </a>
                                      </td>
                                      <td className="p-2">{formatDate(trade.timestamp)}</td>
                                      <td className="p-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                          trade.trade_type === 'buy'
                                            ? 'bg-green-500/20 text-green-500'
                                            : 'bg-red-500/20 text-red-500'
                                        }`}>
                                          {trade.trade_type.toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        {formatNumber(parseFloat(trade.amount_in || '0'), 6)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        {formatNumber(parseFloat(trade.amount_out || '0'), 6)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        ${formatNumber(trade.price_usd || '0')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Trade Calculations (if available) */}
                        {reg.tradeCalculations && reg.tradeCalculations.length > 0 && (
                          <div>
                            <h4 className="font-bold uppercase text-sm mb-2">PnL Calculations (Step by Step)</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-primary">
                                    <th className="text-left p-2">TX</th>
                                    <th className="text-left p-2">Type</th>
                                    <th className="text-right p-2">Before Position</th>
                                    <th className="text-right p-2">Before Cost Basis</th>
                                    <th className="text-right p-2">Trade Amount</th>
                                    <th className="text-right p-2">Trade Cost/Value</th>
                                    <th className="text-right p-2">After Position</th>
                                    <th className="text-right p-2">After Cost Basis</th>
                                    <th className="text-right p-2">Avg Cost</th>
                                    <th className="text-right p-2">Realized PnL</th>
                                    <th className="text-left p-2">Note</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {reg.tradeCalculations.map((calc: any, idx: number) => (
                                    <tr key={idx} className="border-b border-primary/20">
                                      <td className="p-2 font-mono text-xs">
                                        {calc.tx_hash.slice(0, 8)}...
                                      </td>
                                      <td className="p-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                          calc.trade_type === 'buy'
                                            ? 'bg-green-500/20 text-green-500'
                                            : 'bg-red-500/20 text-red-500'
                                        }`}>
                                          {calc.trade_type.toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        {formatNumber(calc.calculation.beforePosition || 0, 6)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        ${formatNumber(calc.calculation.beforeCostBasis || 0)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        {formatNumber(calc.calculation.tradeAmount || 0, 6)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        ${formatNumber(calc.calculation.tradeCost || calc.calculation.tradeValue || 0)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        {formatNumber(calc.calculation.afterPosition || 0, 6)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        ${formatNumber(calc.calculation.afterCostBasis || 0)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        ${formatNumber(calc.calculation.avgCostPerToken || 0)}
                                      </td>
                                      <td className={`p-2 text-right font-mono font-bold ${
                                        (calc.calculation.tradePnL || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                      }`}>
                                        ${formatNumber(calc.calculation.tradePnL || calc.calculation.realizedPnL || 0)}
                                      </td>
                                      <td className="p-2 text-xs text-muted-foreground">
                                        {calc.calculation.note}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Token Form Component
function TokenForm({ onSuccess }: { onSuccess: () => void }) {
  const [tokenAddress, setTokenAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/indexer/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token_address: tokenAddress
          // Symbol and decimals will be auto-fetched from the contract
        })
      })

      const data = await response.json()

      if (response.ok) {
        setTokenAddress('')
        setSuccess(`Token ${data.token.symbol} added successfully!`)
        onSuccess()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || data.message || 'Failed to add token')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add token')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive p-2 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 p-2 rounded text-sm">
          {success}
        </div>
      )}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-bold uppercase mb-2">Contract Address</label>
          <Input
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="0x0774409cda69a47f272907fd5d0d80173167bb07"
            required
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Symbol and decimals will be automatically fetched from the contract
          </p>
        </div>
        <Button type="submit" disabled={isSubmitting} className="font-bold uppercase">
          <Plus className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Fetching...' : 'Add Token'}
        </Button>
      </div>
    </form>
  )
}

// Token Row Component
function TokenRow({ token }: { token: Token }) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="flex items-center justify-between p-4 bg-secondary/50 border border-primary rounded">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-bold text-lg uppercase">{token.symbol}</div>
            <div className="text-sm text-muted-foreground font-mono">{formatAddress(token.token_address)}</div>
          </div>
          <div className="text-sm text-muted-foreground">
            Decimals: {token.decimals}
          </div>
          <div className="text-sm text-muted-foreground">
            Trades: {typeof token.trade_count === 'string' ? parseInt(token.trade_count) : token.trade_count}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Link href={`https://basescan.org/token/${token.token_address}`} target="_blank">
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            View
          </Button>
        </Link>
      </div>
    </div>
  )
}
