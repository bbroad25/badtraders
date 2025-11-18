"use client"

import { useEffect, useRef } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export default function FarcasterReady() {
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Only call once per component lifecycle
    if (hasInitialized.current) {
      return
    }

    const initializeMiniApp = async () => {
      if (hasInitialized.current) {
        return
      }

      try {
        // Step 1: Call ready() to hide splash screen
        console.log('[BadTraders] 🚀 Calling ready()...');
        await sdk.actions.ready();
        console.log('[BadTraders] ✅ ready() succeeded');
        hasInitialized.current = true;

        // Step 2: Prompt user to add miniapp (if not already added)
        // This is the standard flow - good apps do this automatically
        if (sdk.actions.addMiniApp) {
          console.log('[BadTraders] Prompting user to add miniapp...');
          try {
            await sdk.actions.addMiniApp();
            console.log('[BadTraders] ✅ addMiniApp() completed');
          } catch (error: any) {
            // User might have already added it, or cancelled - that's ok
            if (error?.message?.includes('already') || error?.message?.includes('cancelled')) {
              console.log('[BadTraders] Miniapp already added or user cancelled');
            } else {
              console.warn('[BadTraders] addMiniApp() error (non-fatal):', error);
            }
          }
        }

        // Step 3: Prompt user to sign in with Farcaster
        if (sdk.actions.signin) {
          console.log('[BadTraders] Prompting user to sign in with Farcaster...');
          try {
            await sdk.actions.signin();
            console.log('[BadTraders] ✅ signin() completed - user authenticated');
          } catch (error: any) {
            // User might have cancelled - that's ok, they can sign in later
            if (error?.message?.includes('cancelled') || error?.message?.includes('rejected')) {
              console.log('[BadTraders] User cancelled signin - they can sign in later');
            } else {
              console.warn('[BadTraders] signin() error (non-fatal):', error);
            }
          }
        }

        // Step 4: Prompt user to connect wallet (if available)
        if (sdk.actions.connectWallet) {
          console.log('[BadTraders] Prompting user to connect wallet...');
          try {
            await sdk.actions.connectWallet();
            console.log('[BadTraders] ✅ connectWallet() completed - wallet connected');
          } catch (error: any) {
            // User might have cancelled - that's ok, they can connect later
            if (error?.message?.includes('cancelled') || error?.message?.includes('rejected')) {
              console.log('[BadTraders] User cancelled wallet connection - they can connect later');
            } else {
              console.warn('[BadTraders] connectWallet() error (non-fatal):', error);
            }
          }
        }
      } catch (error) {
        console.error('[BadTraders] ❌ Error during miniapp initialization:', error);
        // Don't retry automatically - let it fail gracefully
      }
    };

    initializeMiniApp();
  }, []); // Empty deps - only run once on mount

  return null;
}

