"use client"

import { useState, useEffect } from 'react'
import { useFarcasterContext } from './useFarcasterContext'

/**
 * Hook to check if the current user is an admin
 * @returns { isAdmin: boolean, currentFid: number | null, isLoading: boolean }
 */
export function useAdminAccess() {
  const { userFid, isLoading: isLoadingFarcaster } = useFarcasterContext()
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      // Wait for Farcaster context to load
      if (isLoadingFarcaster) {
        return
      }

      // If no FID, user is not admin
      if (!userFid) {
        setIsAdmin(false)
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/admin/check?fid=${userFid}`)
        if (!response.ok) {
          console.error('[useAdminAccess] Failed to check admin status:', response.status)
          setIsAdmin(false)
          setIsLoading(false)
          return
        }

        const data = await response.json()
        setIsAdmin(data.isAdmin || false)
      } catch (error) {
        console.error('[useAdminAccess] Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdmin()
  }, [userFid, isLoadingFarcaster])

  return { isAdmin, currentFid: userFid, isLoading: isLoading || isLoadingFarcaster }
}

