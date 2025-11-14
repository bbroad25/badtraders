"use client"

import { useEffect, useRef } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export default function FarcasterReady() {
  const hasCalledReady = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only call once per component lifecycle
    if (hasCalledReady.current) {
      return
    }

    const callReady = async () => {
      if (hasCalledReady.current) {
        return
      }

      try {
        console.log('[BadTraders] 🚀 FarcasterReady component: Calling ready()');
        await sdk.actions.ready();
        console.log('[BadTraders] ✅ FarcasterReady: ready() succeeded');
        hasCalledReady.current = true;
      } catch (error) {
        console.error('[BadTraders] ❌ FarcasterReady: ready() failed:', error);
        // Don't retry automatically - let it fail gracefully
      }
    };

    callReady();

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty deps - only run once on mount

  return null;
}

