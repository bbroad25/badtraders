# Farcaster Mini App SDK Issues & Future Plans

## Current Problems

### 1. Notifications Menu Not Appearing
**Issue**: The "Turn on notifications" option is not showing up in the Farcaster miniapp hamburger menu, despite:
- ✅ Webhook URL configured in manifest (`https://api.neynar.com/f/app/{NEYNAR_CLIENT_ID}/event`)
- ✅ `NEYNAR_CLIENT_ID` set in environment variables
- ✅ Neynar API key configured
- ✅ Notifications API endpoint working (returns "sent successfully")
- ✅ Webhook endpoint created at `/api/webhooks/farcaster`

**Symptoms**:
- Users cannot enable notifications because the menu option doesn't exist
- Notifications are sent successfully via Neynar API but users don't receive them (because they haven't enabled notifications)
- The pumpkin-carving-nft app (same codebase structure) shows notifications menu correctly

**References**:
- [Neynar Mini App Documentation](https://docs.neynar.com/docs/create-farcaster-miniapp-in-60s)
- Working example: `pumpkin-carving-nft` app uses same webhook URL format

### 2. "Add Mini App" Button Not Appearing
**Issue**: Users visiting the website don't see an option to add the miniapp to their Farcaster client.

**Expected Behavior**:
- Users should be able to add the miniapp directly from the website
- This typically requires client-side SDK calls or specific UI elements

**Current State**:
- No visible "Add Mini App" button or prompt on the homepage
- Users must manually add the miniapp via Farcaster client

### 3. SDK Initialization Uncertainties
**Questions**:
- Is `sdk.actions.ready()` being called correctly?
- Are there additional SDK methods needed for notifications to work?
- Does the manifest need to be refreshed/re-validated by Farcaster?
- Is there a client-side component missing that triggers the notifications menu?

**Current Implementation**:
- `FarcasterReady` component calls `sdk.actions.ready()` on mount
- Manifest is served at `/.well-known/farcaster.json` and `/api/farcaster-manifest`

## Future Plan: Homepage Mini App Promotion

### Location
Add buttons near the existing "WE'RE NGMI 😭" button (line 277-279 in `app/page.tsx`)

### Proposed UI Elements

#### Option 1: Two Separate Buttons
```
[WE'RE NGMI 😭]  [➕ ADD MINI APP]  [🔔 TURN ON NOTIFICATIONS]
```

#### Option 2: Combined Section
A new section below the WNGMI button with:
- "Help us out!" heading
- "Add the mini app" button
- "Turn on notifications" button
- Brief explanation text

### Implementation Details

#### "Add Mini App" Button
- **Action**: Call `sdk.actions.addMiniApp()` or similar SDK method
- **Visibility**: Show only when NOT in Farcaster miniapp (check `userFid === null`)
- **Styling**: Match existing button style (purple, bold, uppercase, shadow)

#### "Turn on Notifications" Button
- **Action**:
  - If in Farcaster: Open notifications settings or call SDK method
  - If on website: Show instructions to add miniapp first
- **Visibility**:
  - Show in Farcaster miniapp if notifications not enabled
  - Show on website with instructions
- **Styling**: Match existing button style

### Code Location
- File: `badtraders/app/page.tsx`
- Section: Hero section, near line 277-279 (WNGMI button)
- Component: Add new buttons in the same flex container or create new section

## Investigation Needed

### Recommended: Side Agent Investigation

We should create a dedicated investigation task to:

1. **Compare with Working Example**
   - Deep dive into `pumpkin-carving-nft` implementation
   - Identify exact differences in SDK usage
   - Check for any client-side initialization we're missing

2. **SDK Documentation Review**
   - Review [Farcaster Mini App SDK docs](https://docs.neynar.com/docs/create-farcaster-miniapp-in-60s)
   - Check for required client-side calls
   - Verify manifest format requirements

3. **Neynar Integration Check**
   - Verify Neynar app configuration in dashboard
   - Check if webhook URL needs to be registered separately
   - Verify `NEYNAR_CLIENT_ID` format and usage

4. **Manifest Validation**
   - Test manifest endpoint directly: `https://badtraders.xyz/.well-known/farcaster.json`
   - Verify webhook URL is present and correct
   - Check if Farcaster caches manifests (may need time to refresh)

5. **Client-Side SDK Calls**
   - Research if `sdk.actions.enableNotifications()` or similar exists
   - Check if notifications menu requires specific SDK initialization
   - Verify if `sdk.actions.ready()` is sufficient

### Questions to Answer

1. **Why does the notifications menu appear in pumpkin app but not Bad Traders?**
   - Same webhook URL format
   - Same Neynar setup
   - What's different?

2. **Is there a client-side SDK call we're missing?**
   - Do we need to call something to "register" notifications?
   - Is there a permissions request we need to trigger?

3. **Does Farcaster cache manifests?**
   - How long does it take for manifest changes to propagate?
   - Do we need to re-submit the miniapp to Farcaster?

4. **Are there environment-specific requirements?**
   - Does the webhook URL need to be publicly accessible before Farcaster shows the menu?
   - Are there CORS or security headers required?

## Next Steps

1. ✅ Document issues (this file)
2. ⏳ Create investigation task for side agent
3. ⏳ Implement homepage buttons (after investigation or in parallel)
4. ⏳ Test notifications flow end-to-end
5. ⏳ Verify manifest is being served correctly in production

## Resources

- [Neynar Mini App Creation Guide](https://docs.neynar.com/docs/create-farcaster-miniapp-in-60s)
- [Farcaster Mini App SDK](https://github.com/farcasterxyz/miniapps)
- Working reference: `pumpkin-carving-nft` repository
- Current manifest: `badtraders/app/api/farcaster-manifest/route.ts`
- Static manifest: `badtraders/public/.well-known/farcaster.json`

## Notes

- The manifest route correctly uses `NEYNAR_CLIENT_ID` from environment variables
- Static manifest file has hardcoded webhook URL (may need updating for consistency)
- Webhook endpoint exists but may not be receiving events (because users can't enable notifications)
- Notifications API works but can't deliver because users haven't enabled them

