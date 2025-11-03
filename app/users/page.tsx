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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/users')
        const data = await response.json()

        if (response.ok && data.success) {
          setUsers(data.users || [])
        } else {
          setError(data.error || 'Failed to load users')
        }
      } catch (err) {
        console.error('Error fetching users:', err)
        setError('Failed to load users')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-bold text-primary uppercase mb-4">
            ALL USERS
          </h1>
          <p className="text-lg text-muted-foreground">
            Complete list of all registered users in the database
          </p>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-2">
              Total: {users.length} users
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground uppercase">Loading users...</p>
          </div>
        ) : error ? (
          <Card className="bg-card border-4 border-destructive p-8 text-center">
            <p className="text-xl font-bold text-destructive uppercase">{error}</p>
          </Card>
        ) : users.length === 0 ? (
          <Card className="bg-card border-4 border-primary p-8 text-center">
            <p className="text-xl font-bold uppercase">No users found</p>
            <p className="text-muted-foreground mt-2">No one has registered yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <Card
                key={user.id}
                className="bg-card border-4 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase mb-1">FID</p>
                    <p className="text-lg font-bold font-mono">{user.fid}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase mb-1">Username</p>
                    <p className="text-lg font-bold">{user.username || 'N/A'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase mb-1">Wallet</p>
                    <p className="text-sm font-mono break-all">{user.wallet_address}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase mb-1">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {user.eligibility_status && (
                        <span className="text-xs font-bold uppercase bg-green-600 text-white px-2 py-1 border-2 border-green-700">
                          Eligible
                        </span>
                      )}
                      {user.opt_in_status && (
                        <span className="text-xs font-bold uppercase bg-primary text-primary-foreground px-2 py-1 border-2 border-primary">
                          Registered
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase mb-1">Registered</p>
                    <p className="text-sm">{formatDate(user.registered_at)}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase mb-1">Last Active</p>
                    <p className="text-sm">{formatDate(user.last_active_at)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
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

