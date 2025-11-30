"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAdminAccess } from "@/lib/hooks/useAdminAccess"
import { useFarcasterContext } from "@/lib/hooks/useFarcasterContext"
import { sdk } from "@farcaster/miniapp-sdk"
import { useEffect, useState } from "react"

interface LoserboardEntry {
  id: number
  fid: number
  username: string
  display_name: string
  address: string | null
  pfp_url: string | null
  added_at: string
  added_by_fid: number
}

export default function AdminPage() {
  const { isAdmin, currentFid, isLoading: isLoadingAdmin } = useAdminAccess()
  const { isLoading: isLoadingFarcaster } = useFarcasterContext()

  // Notification state
  const [notificationTitle, setNotificationTitle] = useState("")
  const [notificationBody, setNotificationBody] = useState("")
  const [notificationTarget, setNotificationTarget] = useState<"broadcast" | "specific">("broadcast")
  const [notificationTargetFid, setNotificationTargetFid] = useState("")
  const [isSendingNotification, setIsSendingNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Loserboard state
  const [loserboardUsernameOrFid, setLoserboardUsernameOrFid] = useState("")
  const [sendNotificationOnAdd, setSendNotificationOnAdd] = useState(true)
  const [composeCastOnAdd, setComposeCastOnAdd] = useState(true)
  const [isAddingLoser, setIsAddingLoser] = useState(false)
  const [loserboardEntries, setLoserboardEntries] = useState<LoserboardEntry[]>([])
  const [isLoadingEntries, setIsLoadingEntries] = useState(true)
  const [loserboardMessage, setLoserboardMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Eligibility cleanup state
  const [isRunningCleanup, setIsRunningCleanup] = useState(false)
  const [cleanupMessage, setCleanupMessage] = useState<{ type: "success" | "error"; text: string; details?: any } | null>(null)
  const [showCleanupDetails, setShowCleanupDetails] = useState(false)
  const [removeFromIndexing, setRemoveFromIndexing] = useState(true)

  // Voting period creation state
  const [votingEndDate, setVotingEndDate] = useState("")
  const [isCreatingVotingPeriod, setIsCreatingVotingPeriod] = useState(false)
  const [votingMessage, setVotingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Contest creation state
  const [contestTokenAddress, setContestTokenAddress] = useState("")
  const [contestTokenSymbol, setContestTokenSymbol] = useState("")
  const [contestStartDate, setContestStartDate] = useState("")
  const [contestEndDate, setContestEndDate] = useState("")
  const [isCreatingContest, setIsCreatingContest] = useState(false)
  const [contestMessage, setContestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Contest management state
  const [contests, setContests] = useState<any[]>([])
  const [isLoadingContests, setIsLoadingContests] = useState(false)
  const [isArchivingContest, setIsArchivingContest] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // PnL recalculation state
  const [recalcContestId, setRecalcContestId] = useState("")
  const [recalcRegistrationId, setRecalcRegistrationId] = useState("")
  const [isRecalculatingPnL, setIsRecalculatingPnL] = useState(false)
  const [recalcMessage, setRecalcMessage] = useState<{ type: "success" | "error"; text: string; details?: any } | null>(null)

  // Error tracking state
  const [miniappErrors, setMiniappErrors] = useState<Array<{
    timestamp: string;
    type: string;
    message: string;
    stack?: string;
    source?: string;
  }>>([])
  const [isLoadingErrors, setIsLoadingErrors] = useState(false)

  // Redirect if not admin
  useEffect(() => {
    if (!isLoadingAdmin && !isLoadingFarcaster && !isAdmin) {
      window.location.href = "/"
    }
  }, [isAdmin, isLoadingAdmin, isLoadingFarcaster])

  // Set up error tracking for miniapp errors
  useEffect(() => {
    if (!isAdmin) return

    const errors: Array<{
      timestamp: string;
      type: string;
      message: string;
      stack?: string;
      source?: string;
    }> = []

    // Track window errors
    const handleError = (event: ErrorEvent) => {
      errors.push({
        timestamp: new Date().toISOString(),
        type: 'Error',
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined
      })
      setMiniappErrors([...errors].slice(-50)) // Keep last 50 errors
    }

    // Track unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || event.reason?.toString() || 'Unhandled promise rejection'
      errors.push({
        timestamp: new Date().toISOString(),
        type: 'UnhandledRejection',
        message: errorMessage,
        stack: event.reason?.stack
      })
      setMiniappErrors([...errors].slice(-50))
    }

    // Intercept console.error
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      originalConsoleError.apply(console, args)
      const errorMessage = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')
      errors.push({
        timestamp: new Date().toISOString(),
        type: 'ConsoleError',
        message: errorMessage
      })
      setMiniappErrors([...errors].slice(-50))
    }

    // Track SDK errors by wrapping common SDK actions
    if (sdk?.actions) {
      // Track SDK action errors
      const trackSDKError = (error: any) => {
        errors.push({
          timestamp: new Date().toISOString(),
          type: 'SDKError',
          message: error?.message || error?.toString() || 'SDK error',
          stack: error?.stack
        })
        setMiniappErrors([...errors].slice(-50))
      }

      // Wrap common SDK actions to catch errors
      const wrapSDKAction = (actionName: string, originalAction: any) => {
        if (typeof originalAction === 'function') {
          return async (...args: any[]) => {
            try {
              return await originalAction(...args)
            } catch (error: any) {
              trackSDKError(error)
              throw error
            }
          }
        }
        return originalAction
      }

      // Wrap specific SDK actions that are commonly used
      const actionsToWrap = ['composeCast', 'addMiniApp', 'swapToken', 'openUrl']
      actionsToWrap.forEach(actionName => {
        if (sdk.actions && actionName in sdk.actions) {
          const original = (sdk.actions as any)[actionName]
          if (typeof original === 'function') {
            (sdk.actions as any)[actionName] = wrapSDKAction(actionName, original)
          }
        }
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Load recent errors from API if available
    const loadErrors = async () => {
      try {
        setIsLoadingErrors(true)
        const response = await fetch('/api/admin/errors')
        if (response.ok) {
          const data = await response.json()
          if (data.errors && Array.isArray(data.errors)) {
            setMiniappErrors(data.errors)
          }
        }
      } catch (error) {
        console.error('Failed to load errors:', error)
      } finally {
        setIsLoadingErrors(false)
      }
    }

    loadErrors()

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      console.error = originalConsoleError
    }
  }, [isAdmin])

  // Fetch current loserboard entries
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setIsLoadingEntries(true)
        const response = await fetch("/api/leaderboard")
        if (response.ok) {
          const data = await response.json()
          // The API returns LeaderboardEntry[], but we need to get full details
          // For now, we'll just show what we have
          setLoserboardEntries(data.map((entry: any) => ({
            id: 0, // Will be updated when we add delete endpoint
            fid: entry.fid,
            username: entry.username,
            display_name: entry.display_name,
            address: entry.address,
            pfp_url: entry.pfpUrl,
            added_at: new Date().toISOString(),
            added_by_fid: 0
          })))
        }
      } catch (error) {
        console.error("Error fetching loserboard entries:", error)
      } finally {
        setIsLoadingEntries(false)
      }
    }

    if (isAdmin) {
      fetchEntries()
    }
  }, [isAdmin])

  const handleSendNotification = async () => {
    console.log('🚀 handleSendNotification called')
    setNotificationMessage(null)

    if (!currentFid) {
      console.error('❌ No currentFid')
      setNotificationMessage({ type: "error", text: "Unable to get your FID. Please ensure you're logged in via Farcaster." })
      return
    }

    if (!notificationTitle.trim() || !notificationBody.trim()) {
      console.error('❌ Missing title or body:', { hasTitle: !!notificationTitle, hasBody: !!notificationBody })
      setNotificationMessage({ type: "error", text: "Please fill in both title and body" })
      return
    }

    if (notificationTarget === "specific" && !notificationTargetFid.trim()) {
      console.error('❌ Missing targetFid for specific target')
      setNotificationMessage({ type: "error", text: "Please enter a target FID" })
      return
    }

    setIsSendingNotification(true)
    try {
      const targetFid = notificationTarget === "specific" ? parseInt(notificationTargetFid.trim(), 10) : undefined

      console.log('📤 Sending notification request:', {
        url: `/api/admin/notifications/send?fid=${currentFid}`,
        method: 'POST',
        title: notificationTitle,
        body: notificationBody.substring(0, 50) + '...',
        targetFid,
        currentFid
      })

      const response = await fetch(
        `/api/admin/notifications/send?fid=${currentFid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: notificationTitle,
            body: notificationBody,
            targetFid: targetFid,
            url: window.location.origin
          })
        }
      )

      console.log('📥 Received response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      // Try to parse JSON, but handle non-JSON responses
      let data: any;
      const responseText = await response.text();
      console.log('📥 Response text:', responseText.substring(0, 500));
      try {
        data = JSON.parse(responseText);
        console.log('📥 Parsed response data:', data);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        // If response isn't JSON, show the raw text
        throw new Error(`Server error (${response.status}): ${responseText.substring(0, 200)}`);
      }

      if (response.ok) {
        setNotificationMessage({
          type: "success",
          text: `Notification sent successfully! ${data.message || ''}`
        })
        setNotificationTitle("")
        setNotificationBody("")
        setNotificationTargetFid("")
        setNotificationTarget("broadcast")
        // Clear message after 5 seconds
        setTimeout(() => setNotificationMessage(null), 5000)
      } else {
        // Show detailed error message
        const errorMsg = data.error || data.message || data.details || `HTTP ${response.status}: ${response.statusText}`;
        setNotificationMessage({ type: "error", text: `Failed to send notification: ${errorMsg}` })
        console.error("Notification API error:", {
          status: response.status,
          statusText: response.statusText,
          data
        });
      }
    } catch (error: any) {
      console.error("❌ Error sending notification:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        error: error
      })
      const errorMessage = error.message || error.toString() || "Failed to send notification";
      setNotificationMessage({ type: "error", text: `Error: ${errorMessage}` })
    } finally {
      setIsSendingNotification(false)
    }
  }

  const handleAddLoser = async () => {
    setLoserboardMessage(null)

    if (!currentFid) {
      setLoserboardMessage({ type: "error", text: "Unable to get your FID. Please ensure you're logged in via Farcaster." })
      return
    }

    if (!loserboardUsernameOrFid.trim()) {
      setLoserboardMessage({ type: "error", text: "Please enter a username or FID" })
      return
    }

    setIsAddingLoser(true)
    try {
      const response = await fetch(
        `/api/admin/loserboard/add?fid=${currentFid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usernameOrFid: loserboardUsernameOrFid.trim(),
            sendNotification: sendNotificationOnAdd,
            composeCast: composeCastOnAdd
          })
        }
      )

      const data = await response.json()

      if (response.ok) {
        // If composeCast was requested, do it client-side now
        if (composeCastOnAdd && data.entry) {
          try {
            const castText = `🏆 New loser added to the $BADTRADERS loserboard!\n\n@${data.entry.username} has been officially declared a loser. Check out the full loserboard!`;
            const appUrl = window.location.origin;

            const castResult = await sdk.actions.composeCast({
              text: castText,
              embeds: [`${appUrl}/leaderboard`]
            });

            if (castResult?.cast) {
              console.log('✅ Cast composed successfully');
            } else {
              console.log('Cast composition cancelled by user');
            }
          } catch (castError: any) {
            console.error('Error composing cast:', castError);
            // Don't fail the whole operation if cast fails
          }
        }

        setLoserboardMessage({ type: "success", text: "Loser added successfully!" })
        setLoserboardUsernameOrFid("")
        // Clear message after 5 seconds
        setTimeout(() => setLoserboardMessage(null), 5000)

        // Refresh entries
        const entriesResponse = await fetch("/api/leaderboard")
        if (entriesResponse.ok) {
          const entriesData = await entriesResponse.json()
          setLoserboardEntries(entriesData.map((entry: any) => ({
            id: 0,
            fid: entry.fid,
            username: entry.username,
            display_name: entry.display_name,
            address: entry.address,
            pfp_url: entry.pfpUrl,
            added_at: new Date().toISOString(),
            added_by_fid: 0
          })))
        }
      } else {
        setLoserboardMessage({ type: "error", text: `Failed to add loser: ${data.error || "Unknown error"}` })
      }
    } catch (error: any) {
      console.error("Error adding loser:", error)
      setLoserboardMessage({ type: "error", text: `Error: ${error.message || "Failed to add loser"}` })
    } finally {
      setIsAddingLoser(false)
    }
  }

  const handleRunCleanup = async () => {
    setCleanupMessage(null)

    if (!currentFid) {
      setCleanupMessage({ type: "error", text: "Unable to get your FID. Please ensure you're logged in via Farcaster." })
      return
    }

    setIsRunningCleanup(true)
    try {
      const response = await fetch(
        `/api/admin/cleanup-eligibility?fid=${currentFid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            removeFromIndexing
          })
        }
      )

      const data = await response.json()

      if (response.ok) {
        setCleanupMessage({
          type: "success",
          text: data.message || "Cleanup completed successfully!",
          details: data.result
        })
        setShowCleanupDetails(false) // Collapse details initially
        // Message stays visible until user closes it
      } else {
        setCleanupMessage({ type: "error", text: `Failed to run cleanup: ${data.error || "Unknown error"}` })
      }
    } catch (error: any) {
      console.error("Error running cleanup:", error)
      setCleanupMessage({ type: "error", text: `Error: ${error.message || "Failed to run cleanup"}` })
    } finally {
      setIsRunningCleanup(false)
    }
  }

  const handleCreateContest = async () => {
    setContestMessage(null)

    if (!currentFid) {
      setContestMessage({ type: "error", text: "Unable to get your FID. Please ensure you're logged in via Farcaster." })
      return
    }

    if (!contestTokenAddress || !contestStartDate || !contestEndDate) {
      setContestMessage({ type: "error", text: "Please fill in token address, start date, and end date" })
      return
    }

    setIsCreatingContest(true)
    try {
      const response = await fetch(
        `/api/admin/contests/create?fid=${currentFid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenAddress: contestTokenAddress,
            tokenSymbol: contestTokenSymbol || null,
            startDate: contestStartDate,
            endDate: contestEndDate
          })
        }
      )

      const data = await response.json()

      if (response.ok) {
        setContestMessage({ type: "success", text: data.message || "Contest created successfully!" })
        setContestTokenAddress("")
        setContestTokenSymbol("")
        setContestStartDate("")
        setContestEndDate("")
        setTimeout(() => setContestMessage(null), 5000)
        // Reload contests list
        loadContests()
      } else {
        setContestMessage({ type: "error", text: `Failed to create contest: ${data.error || "Unknown error"}` })
      }
    } catch (error: any) {
      console.error("Error creating contest:", error)
      setContestMessage({ type: "error", text: `Error: ${error.message || "Failed to create contest"}` })
    } finally {
      setIsCreatingContest(false)
    }
  }

  const loadContests = async () => {
    setIsLoadingContests(true)
    try {
      // Load both active and completed contests
      const [activeResponse, completedResponse] = await Promise.all([
        fetch('/api/contests/list?status=active'),
        fetch('/api/contests/list?status=completed')
      ])

      const activeData = await activeResponse.json()
      const completedData = await completedResponse.json()

      const allContests = [
        ...(activeData.success ? activeData.contests : []),
        ...(completedData.success ? completedData.contests : [])
      ]

      setContests(allContests)
    } catch (error: any) {
      console.error("Error loading contests:", error)
    } finally {
      setIsLoadingContests(false)
    }
  }

  const handleArchiveContest = async (contestId: number) => {
    setArchiveMessage(null)

    if (!currentFid) {
      setArchiveMessage({ type: "error", text: "Unable to get your FID. Please ensure you're logged in via Farcaster." })
      return
    }

    if (!confirm(`Are you sure you want to archive contest #${contestId}?`)) {
      return
    }

    setIsArchivingContest(true)
    try {
      const response = await fetch(
        `/api/admin/contests/archive?fid=${currentFid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contestId })
        }
      )

      const data = await response.json()

      if (response.ok) {
        setArchiveMessage({ type: "success", text: data.message || "Contest archived successfully!" })
        setTimeout(() => setArchiveMessage(null), 5000)
        // Reload contests list
        loadContests()
      } else {
        setArchiveMessage({ type: "error", text: `Failed to archive contest: ${data.error || "Unknown error"}` })
      }
    } catch (error: any) {
      console.error("Error archiving contest:", error)
      setArchiveMessage({ type: "error", text: `Error: ${error.message || "Failed to archive contest"}` })
    } finally {
      setIsArchivingContest(false)
    }
  }

  const handleRecalculatePnL = async () => {
    setRecalcMessage(null)

    if (!currentFid) {
      setRecalcMessage({ type: "error", text: "Unable to get your FID. Please ensure you're logged in via Farcaster." })
      return
    }

    if (!recalcContestId && !recalcRegistrationId) {
      setRecalcMessage({ type: "error", text: "Please provide either a Contest ID or Registration ID" })
      return
    }

    setIsRecalculatingPnL(true)
    try {
      const response = await fetch(
        `/api/admin/contests/recalculate-pnl?fid=${currentFid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contestId: recalcContestId ? parseInt(recalcContestId, 10) : undefined,
            registrationId: recalcRegistrationId ? parseInt(recalcRegistrationId, 10) : undefined
          })
        }
      )

      const data = await response.json()

      if (response.ok) {
        setRecalcMessage({
          type: "success",
          text: data.message || "PnL recalculated successfully!",
          details: data.results
        })
        setRecalcContestId("")
        setRecalcRegistrationId("")
        setTimeout(() => setRecalcMessage(null), 10000) // Keep visible longer since it has details
      } else {
        setRecalcMessage({ type: "error", text: `Failed to recalculate PnL: ${data.error || "Unknown error"}` })
      }
    } catch (error: any) {
      console.error("Error recalculating PnL:", error)
      setRecalcMessage({ type: "error", text: `Error: ${error.message || "Failed to recalculate PnL"}` })
    } finally {
      setIsRecalculatingPnL(false)
    }
  }

  // Load contests on mount
  useEffect(() => {
    if (isAdmin) {
      loadContests()
    }
  }, [isAdmin])

  const handleCreateVotingPeriod = async () => {
    setVotingMessage(null)

    if (!currentFid) {
      setVotingMessage({ type: "error", text: "Unable to get your FID. Please ensure you're logged in via Farcaster." })
      return
    }

    if (!votingEndDate) {
      setVotingMessage({ type: "error", text: "Please select an end date" })
      return
    }

    setIsCreatingVotingPeriod(true)
    try {
      // Create voting period with BadTraders token as the first option
      const response = await fetch(
        `/api/admin/votes/create-period?fid=${currentFid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endDate: votingEndDate,
            options: [
              {
                tokenAddress: "0x0774409cda69a47f272907fd5d0d80173167bb07", // BadTraders token
                tokenSymbol: "BADTRADERS",
                tokenName: "BadTraders Token",
                description: "The official BadTraders token - vote for your own token!"
              }
            ]
          })
        }
      )

      const data = await response.json()

      if (response.ok) {
        setVotingMessage({ type: "success", text: data.message || "Voting period created successfully!" })
        setVotingEndDate("")
        setTimeout(() => setVotingMessage(null), 5000)
      } else {
        setVotingMessage({ type: "error", text: `Failed to create voting period: ${data.error || "Unknown error"}` })
      }
    } catch (error: any) {
      console.error("Error creating voting period:", error)
      setVotingMessage({ type: "error", text: `Error: ${error.message || "Failed to create voting period"}` })
    } finally {
      setIsCreatingVotingPeriod(false)
    }
  }


  if (isLoadingAdmin || isLoadingFarcaster) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-10 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <p className="text-center">Loading...</p>
          </Card>
        </div>
      </div>
    )
  }


  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-10 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <p className="text-center text-red-500">Access denied. Admin only.</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-primary uppercase">Admin Panel</h1>

        {/* Notification Section */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Send Notification</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title (max 32 chars)</label>
              <Input
                type="text"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Notification title"
                maxLength={32}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Body (max 128 chars)</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={notificationBody}
                onChange={(e) => setNotificationBody(e.target.value)}
                placeholder="Notification body"
                maxLength={128}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Target</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={notificationTarget === "broadcast"}
                    onChange={() => setNotificationTarget("broadcast")}
                    className="mr-2"
                  />
                  Broadcast to all
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={notificationTarget === "specific"}
                    onChange={() => setNotificationTarget("specific")}
                    className="mr-2"
                  />
                  Specific FID
                </label>
              </div>
            </div>

            {notificationTarget === "specific" && (
              <div>
                <label className="block text-sm font-medium mb-2">Target FID</label>
                <Input
                  type="number"
                  value={notificationTargetFid}
                  onChange={(e) => setNotificationTargetFid(e.target.value)}
                  placeholder="Enter FID"
                />
              </div>
            )}

            <Button
              onClick={handleSendNotification}
              disabled={isSendingNotification}
              className="w-full"
            >
              {isSendingNotification ? "Sending..." : "Send Notification"}
            </Button>

            {notificationMessage && (
              <div
                className={`p-3 rounded-md ${
                  notificationMessage.type === "success"
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "bg-red-500/20 text-red-400 border border-red-500/50"
                }`}
              >
                <p className="text-sm font-medium">
                  {notificationMessage.type === "success" ? "✓ " : "✗ "}
                  {notificationMessage.text}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Loserboard Management Section */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Loserboard Management</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Username or FID <span className="text-xs text-muted-foreground">(username preferred)</span>
              </label>
              <Input
                type="text"
                value={loserboardUsernameOrFid}
                onChange={(e) => setLoserboardUsernameOrFid(e.target.value)}
                placeholder="Enter username (e.g., username or @username) or FID (e.g., 12345)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAddingLoser && loserboardUsernameOrFid.trim()) {
                    handleAddLoser()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Username lookup is preferred. You can use @username or just username. FID will be used as fallback.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={sendNotificationOnAdd}
                  onChange={(e) => setSendNotificationOnAdd(e.target.checked)}
                  className="mr-2"
                />
                Send notification when adding
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={composeCastOnAdd}
                  onChange={(e) => setComposeCastOnAdd(e.target.checked)}
                  className="mr-2"
                />
                Compose cast announcing loser
              </label>
            </div>

            <Button
              onClick={handleAddLoser}
              disabled={isAddingLoser}
              className="w-full"
            >
              {isAddingLoser ? "Adding..." : "Add to Loserboard"}
            </Button>

            {loserboardMessage && (
              <div
                className={`p-3 rounded-md ${
                  loserboardMessage.type === "success"
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "bg-red-500/20 text-red-400 border border-red-500/50"
                }`}
              >
                <p className="text-sm font-medium">
                  {loserboardMessage.type === "success" ? "✓ " : "✗ "}
                  {loserboardMessage.text}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Contest Management Section */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Create Contest</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create a new weekly contest. Users need 5M BadTraders tokens to enter.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Token Address *</label>
              <input
                type="text"
                value={contestTokenAddress}
                onChange={(e) => setContestTokenAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border-2 border-primary rounded bg-background font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Token Symbol (optional)</label>
              <input
                type="text"
                value={contestTokenSymbol}
                onChange={(e) => setContestTokenSymbol(e.target.value)}
                placeholder="BADTRADERS"
                className="w-full px-3 py-2 border-2 border-primary rounded bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Start Date *</label>
              <input
                type="datetime-local"
                value={contestStartDate}
                onChange={(e) => setContestStartDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-primary rounded bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Date *</label>
              <input
                type="datetime-local"
                value={contestEndDate}
                onChange={(e) => setContestEndDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-primary rounded bg-background"
              />
            </div>

            <Button
              onClick={handleCreateContest}
              disabled={isCreatingContest || !contestTokenAddress || !contestStartDate || !contestEndDate}
              className="w-full"
            >
              {isCreatingContest ? "Creating..." : "Create Contest"}
            </Button>

            {contestMessage && (
              <div
                className={`p-3 rounded-md ${
                  contestMessage.type === "success"
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "bg-red-500/20 text-red-400 border border-red-500/50"
                }`}
              >
                <p className="text-sm font-medium">
                  {contestMessage.type === "success" ? "✓ " : "✗ "}
                  {contestMessage.text}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Contest Management - List and Archive */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Manage Contests</h2>
          <p className="text-sm text-muted-foreground mb-4">
            View and archive existing contests.
          </p>

          <div className="space-y-4">
            <Button
              onClick={loadContests}
              disabled={isLoadingContests}
              variant="outline"
              className="w-full"
            >
              {isLoadingContests ? "Loading..." : "Refresh Contests"}
            </Button>

            {archiveMessage && (
              <div
                className={`p-3 rounded-md ${
                  archiveMessage.type === "success"
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "bg-red-500/20 text-red-400 border border-red-500/50"
                }`}
              >
                <p className="text-sm font-medium">
                  {archiveMessage.type === "success" ? "✓ " : "✗ "}
                  {archiveMessage.text}
                </p>
              </div>
            )}

            {isLoadingContests ? (
              <p className="text-center text-sm text-muted-foreground">Loading contests...</p>
            ) : contests.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">No contests found.</p>
            ) : (
              <div className="space-y-2">
                {contests.map((contest) => (
                  <div
                    key={contest.id}
                    className="flex items-center justify-between p-3 border-2 rounded-md"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold">Contest #{contest.id}</p>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            contest.status === 'active'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                              : contest.status === 'completed'
                              ? 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                          }`}
                        >
                          {contest.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {contest.tokenSymbol || contest.tokenAddress?.slice(0, 10) + '...'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(contest.startDate).toLocaleDateString()} - {new Date(contest.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    {contest.status === 'active' && (
                      <Button
                        onClick={() => handleArchiveContest(contest.id)}
                        disabled={isArchivingContest}
                        variant="destructive"
                        size="sm"
                      >
                        {isArchivingContest ? "Archiving..." : "Archive"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* PnL Recalculation Section */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Recalculate Contest PnL</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Manually recalculate PnL for contest registrations. Use Contest ID to recalculate all registrations for that contest, or Registration ID for a specific registration.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Contest ID (optional)</label>
              <Input
                type="number"
                value={recalcContestId}
                onChange={(e) => setRecalcContestId(e.target.value)}
                placeholder="Enter contest ID"
                className="font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Registration ID (optional)</label>
              <Input
                type="number"
                value={recalcRegistrationId}
                onChange={(e) => setRecalcRegistrationId(e.target.value)}
                placeholder="Enter registration ID"
                className="font-mono"
              />
            </div>

            <Button
              onClick={handleRecalculatePnL}
              disabled={isRecalculatingPnL || (!recalcContestId && !recalcRegistrationId)}
              className="w-full"
              variant="outline"
            >
              {isRecalculatingPnL ? "Recalculating..." : "Recalculate PnL"}
            </Button>

            {recalcMessage && (
              <div
                className={`p-4 rounded-md ${
                  recalcMessage.type === "success"
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "bg-red-500/20 text-red-400 border border-red-500/50"
                }`}
              >
                <p className="text-sm font-medium mb-2">
                  {recalcMessage.type === "success" ? "✓ " : "✗ "}
                  {recalcMessage.text}
                </p>
                {recalcMessage.details && (
                  <div className="text-xs space-y-1 mt-2">
                    <p><strong>Total:</strong> {recalcMessage.details.total}</p>
                    <p><strong>Successful:</strong> {recalcMessage.details.successful}</p>
                    <p><strong>Failed:</strong> {recalcMessage.details.failed}</p>
                    {recalcMessage.details.errors && recalcMessage.details.errors.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-current/20">
                        <p className="font-bold">Errors:</p>
                        {recalcMessage.details.errors.slice(0, 5).map((err: any, idx: number) => (
                          <p key={idx} className="text-red-300">
                            Registration {err.registrationId}: {err.error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Voting Period Management Section */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Create Voting Period</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create a new voting period for users to vote on the next contest token.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Voting End Date</label>
              <input
                type="datetime-local"
                value={votingEndDate}
                onChange={(e) => setVotingEndDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-primary rounded bg-background"
              />
            </div>

            <div className="bg-primary/10 border-2 border-primary p-4 rounded">
              <p className="text-sm font-bold text-primary uppercase mb-2">Default Option:</p>
              <p className="text-sm text-muted-foreground">
                BadTraders Token (0x0774...bb07) will be added automatically as the first voting option.
              </p>
            </div>

            <Button
              onClick={handleCreateVotingPeriod}
              disabled={isCreatingVotingPeriod || !votingEndDate}
              className="w-full"
            >
              {isCreatingVotingPeriod ? "Creating..." : "Create Voting Period"}
            </Button>

            {votingMessage && (
              <div
                className={`p-3 rounded-md ${
                  votingMessage.type === "success"
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "bg-red-500/20 text-red-400 border border-red-500/50"
                }`}
              >
                <p className="text-sm font-medium">
                  {votingMessage.type === "success" ? "✓ " : "✗ "}
                  {votingMessage.text}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Eligibility Cleanup Section */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Eligibility Cleanup</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Check all registered users' token balances and remove those who no longer hold the required amount.
          </p>

          <div className="space-y-4">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={removeFromIndexing}
                  onChange={(e) => setRemoveFromIndexing(e.target.checked)}
                  className="mr-2"
                />
                Remove ineligible users from indexing (opt_in_status = false)
              </label>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                If unchecked, only eligibility_status will be updated, but users will remain in indexing.
              </p>
            </div>

            <Button
              onClick={handleRunCleanup}
              disabled={isRunningCleanup}
              className="w-full"
              variant="destructive"
            >
              {isRunningCleanup ? "Running Cleanup..." : "Run Eligibility Cleanup"}
            </Button>

            {cleanupMessage && (
              <div
                className={`p-4 rounded-md relative ${
                  cleanupMessage.type === "success"
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : "bg-red-500/20 text-red-400 border border-red-500/50"
                }`}
              >
                <button
                  onClick={() => setCleanupMessage(null)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>
                <p className="text-sm font-medium mb-2 pr-6">
                  {cleanupMessage.type === "success" ? "✓ " : "✗ "}
                  {cleanupMessage.text}
                </p>
                {cleanupMessage.details && (
                  <div className="text-xs mt-2 space-y-2">
                    <div className="space-y-1">
                      <p><strong>Total checked:</strong> {cleanupMessage.details.totalChecked}</p>
                      <p><strong>Still eligible:</strong> {cleanupMessage.details.stillEligible}</p>
                      <p><strong>No longer eligible:</strong> {cleanupMessage.details.noLongerEligible}</p>
                      {removeFromIndexing && (
                        <p><strong>Removed from indexing:</strong> {cleanupMessage.details.removedFromIndexing}</p>
                      )}
                      {cleanupMessage.details.errors > 0 && (
                        <p className="text-yellow-400"><strong>Errors:</strong> {cleanupMessage.details.errors}</p>
                      )}
                    </div>

                    {cleanupMessage.details.details && cleanupMessage.details.details.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-current/20">
                        <button
                          onClick={() => setShowCleanupDetails(!showCleanupDetails)}
                          className="text-xs underline hover:no-underline mb-2"
                        >
                          {showCleanupDetails ? "▼ Hide" : "▶ Show"} detailed results ({cleanupMessage.details.details.length} users)
                        </button>
                        {showCleanupDetails && (
                          <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
                            {cleanupMessage.details.details.map((detail: any, index: number) => (
                              <div
                                key={index}
                                className={`p-2 rounded text-xs border ${
                                  detail.action === 'removed'
                                    ? 'bg-red-500/10 border-red-500/30'
                                    : detail.action === 'kept'
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : 'bg-yellow-500/10 border-yellow-500/30'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="font-bold">
                                      {detail.action === 'removed' ? '❌ Removed' : detail.action === 'kept' ? '✅ Kept' : '⚠️ Error'}:
                                      FID {detail.fid} {detail.username ? `(@${detail.username})` : ''}
                                    </p>
                                    <p className="text-muted-foreground mt-1">
                                      Wallet: <code className="text-xs">{detail.walletAddress}</code>
                                    </p>
                                    <p className="mt-1">
                                      Balance: <strong>{detail.currentBalance.toLocaleString()}</strong> /
                                      Threshold: <strong>{detail.threshold.toLocaleString()}</strong>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Miniapp Errors Section */}
        <Card className="p-6 border-2 border-red-500/50">
          <h2 className="text-2xl font-bold mb-4 text-red-400 uppercase">⚠️ Miniapp Errors</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Recent errors from the miniapp. Check here if the app is having trouble with anything.
          </p>

          {isLoadingErrors ? (
            <p className="text-center text-muted-foreground">Loading errors...</p>
          ) : miniappErrors.length === 0 ? (
            <div className="bg-green-500/10 border border-green-500/50 p-4 rounded text-center">
              <p className="text-green-400 font-medium">✅ No errors detected!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-muted-foreground">
                  Showing {miniappErrors.length} error{miniappErrors.length !== 1 ? 's' : ''}
                </p>
                <Button
                  onClick={() => setMiniappErrors([])}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Clear All
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {miniappErrors.slice().reverse().map((error, index) => (
                  <div
                    key={index}
                    className="bg-red-500/10 border border-red-500/30 p-3 rounded text-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-red-400 uppercase text-xs">
                            {error.type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(error.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-red-300 font-mono text-xs break-all">
                          {error.message}
                        </p>
                        {error.source && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Source: {error.source}
                          </p>
                        )}
                        {error.stack && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Show stack trace
                            </summary>
                            <pre className="mt-2 text-xs text-muted-foreground font-mono bg-black/20 p-2 rounded overflow-x-auto">
                              {error.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Current Loserboard Entries */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-primary uppercase">Current Loserboard Entries</h2>

          {isLoadingEntries ? (
            <p className="text-center">Loading...</p>
          ) : loserboardEntries.length === 0 ? (
            <p className="text-center text-muted-foreground">No entries yet. Add your first loser above!</p>
          ) : (
            <div className="space-y-2">
              {loserboardEntries.map((entry, index) => (
                <div
                  key={entry.fid || index}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center gap-3">
                    {entry.pfp_url && (
                      <img
                        src={entry.pfp_url}
                        alt={entry.username}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium">@{entry.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.display_name} (FID: {entry.fid})
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Rank #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

