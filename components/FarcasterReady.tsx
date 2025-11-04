"use client"

import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export default function FarcasterReady() {
  useEffect(() => {
    const callReady = async () => {
      try {
        console.log('[BadTraders] 🚀 FarcasterReady component: Calling ready()');
        await sdk.actions.ready();
        console.log('[BadTraders] ✅ FarcasterReady: ready() succeeded');
      } catch (error) {
        console.error('[BadTraders] ❌ FarcasterReady: ready() failed:', error);
        // Retry immediately
        try {
          await sdk.actions.ready();
          console.log('[BadTraders] ✅ FarcasterReady: ready() retry succeeded');
        } catch (retryError) {
          console.error('[BadTraders] ❌ FarcasterReady: ready() retry failed:', retryError);
        }
      }
    };
    
    callReady();
    const timer = setTimeout(callReady, 500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}

