"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface User {
  id: number
  fid: number
  username: string | null
  wallet_address: string
  eligibility_status: boolean
  opt_in_status: boolean
  registered_at: string | null
  last_active_at: string | null
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false) // Filter: only show active registered users by default

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/users${showAll ? '?showAll=true' : ''}`)
        const data = await response.json()

        if (response.ok && data.success) {
          setUsers(data.users || [])
        } else {
          const errorMsg = data.error || 'Failed to load users'
          const hintMsg = data.hint ? `\n\n${data.hint}` : ''
          setError(`${errorMsg}${hintMsg}`)
        }
      } catch (err) {
        console.error('Error fetching users:', err)
        setError('Failed to load users')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [showAll])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-20 md:pt-24 pb-8 md:pb-12 px-3 md:px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-7xl font-bold text-primary uppercase mb-2 md:mb-4">
            REGISTERED USERS
          </h1>
          <p className="text-sm md:text-lg text-muted-foreground">
            {showAll ? 'All users in the database' : 'Active registered users (opted in)'}
          </p>
          <div className="flex items-center justify-center gap-2 md:gap-4 mt-2 md:mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="w-3 h-3 md:w-4 md:h-4"
              />
              <span className="text-xs md:text-sm text-muted-foreground">Show all users (including removed)</span>
            </label>
          </div>
          {!isLoading && (
            <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2">
              {showAll ? `Total: ${users.length} users (all)` : `Active: ${users.length} users`}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-6 md:py-12">
            <p className="text-xs md:text-xl text-muted-foreground uppercase">Loading users...</p>
          </div>
        ) : error ? (
          <Card className="bg-card border-2 md:border-4 border-destructive p-4 md:p-8 text-center">
            <p className="text-sm md:text-xl font-bold text-destructive uppercase">{error}</p>
          </Card>
        ) : users.length === 0 ? (
          <Card className="bg-card border-2 md:border-4 border-primary p-4 md:p-8 text-center">
            <p className="text-sm md:text-xl font-bold uppercase">No users found</p>
            <p className="text-xs md:text-base text-muted-foreground mt-2">No one has registered yet.</p>
          </Card>
        ) : (
          <>
            {/* Mobile: Card Layout */}
            <div className="md:hidden space-y-3">
              {users.map((user) => (
                <Card key={user.id} className="bg-card border-2 border-primary p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">FID: {user.fid}</span>
                        {user.username && (
                          <span className="text-xs font-semibold">@{user.username}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {user.eligibility_status && (
                          <span className="text-[10px] font-bold uppercase bg-green-600 text-white px-1.5 py-0.5 rounded">
                            Eligible
                          </span>
                        )}
                        {user.opt_in_status && (
                          <span className="text-[10px] font-bold uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground break-all">
                      {truncateAddress(user.wallet_address)}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t border-primary/20">
                      <span>Reg: {formatDate(user.registered_at)}</span>
                      <span>Active: {formatDate(user.last_active_at)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-4 border-primary bg-card">
                    <th className="text-left p-3 text-xs font-bold uppercase">FID</th>
                    <th className="text-left p-3 text-xs font-bold uppercase">Username</th>
                    <th className="text-left p-3 text-xs font-bold uppercase">Wallet Address</th>
                    <th className="text-left p-3 text-xs font-bold uppercase">Eligibility</th>
                    <th className="text-left p-3 text-xs font-bold uppercase">Status</th>
                    <th className="text-left p-3 text-xs font-bold uppercase">Registered</th>
                    <th className="text-left p-3 text-xs font-bold uppercase">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b-2 border-primary/20 hover:bg-secondary/50 transition-colors"
                    >
                      <td className="p-3 font-mono text-sm font-bold">{user.fid}</td>
                      <td className="p-3 text-sm">{user.username || 'N/A'}</td>
                      <td className="p-3 font-mono text-xs break-all">{truncateAddress(user.wallet_address)}</td>
                      <td className="p-3">
                        {user.eligibility_status ? (
                          <span className="text-[10px] font-bold uppercase bg-green-600 text-white px-2 py-1 rounded">
                            Eligible
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not Eligible</span>
                        )}
                      </td>
                      <td className="p-3">
                        {user.opt_in_status ? (
                          <span className="text-[10px] font-bold uppercase bg-primary text-primary-foreground px-2 py-1 rounded">
                            Registered
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not Registered</span>
                        )}
                      </td>
                      <td className="p-3 text-xs">{formatDate(user.registered_at)}</td>
                      <td className="p-3 text-xs">{formatDate(user.last_active_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-4 md:mt-8 text-center">
          <Link href="/">
            <Button className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-sm md:text-lg py-2 md:py-4 px-4 md:px-6 font-bold uppercase border-2 md:border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

