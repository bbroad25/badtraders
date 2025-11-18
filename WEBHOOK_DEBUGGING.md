# Webhook Debugging Guide

## Current Status ✅
- ✅ Manifest webhook URL is correct: `https://api.neynar.com/f/app/b1c28e38-6ade-462b-975c-f043602abea9/event`
- ✅ Webhook endpoint is accessible: `https://badtraders.xyz/api/webhooks/farcaster`
- ✅ Environment variables are set correctly
- ❌ **No webhook events being received** (no POST requests in Vercel logs)

## Why No Events Are Coming Through

### Most Likely Reasons:

1. **Users Haven't Enabled Notifications Yet**
   - The webhook only receives events when users:
     - Add the miniapp (`miniapp_added` event)
     - Enable notifications (`notifications_enabled` event)
   - **Check:** Does the notifications menu appear in Farcaster miniapp hamburger menu?

2. **Farcaster Manifest Cache**
   - Farcaster clients cache manifests aggressively
   - Even after clearing cache, it can take time
   - **Solution:**
     - Remove and re-add the miniapp
     - Wait 24 hours for cache to expire
     - Try a different Farcaster client

3. **Neynar Webhook Forwarding Not Working**
   - Even though configured, Neynar might not be forwarding events
   - **Check Neynar Dashboard:**
     - Go to [dev.neynar.com/app](https://dev.neynar.com/app)
     - Check webhook status/health
     - Look for any error messages
     - Verify webhook is "Active" or "Enabled"

4. **Event Format Mismatch**
   - Neynar might be forwarding events in a different format
   - Your endpoint expects Farcaster signature format
   - **Check:** Look at Neynar webhook logs (if available)

## Debugging Steps

### Step 1: Verify Users Can Enable Notifications
1. Open miniapp in Farcaster/Warpcast
2. Open hamburger menu (three dots)
3. **Does "Turn on notifications" appear?**
   - ✅ YES → User needs to click it
   - ❌ NO → Manifest cache issue or webhook URL not recognized

### Step 2: Check Neynar Webhook Status
1. Go to Neynar dashboard
2. Check webhook configuration
3. Look for:
   - Webhook status (Active/Inactive)
   - Recent webhook deliveries
   - Error logs
   - Test webhook button (if available)

### Step 3: Test Webhook Manually
Try sending a test event from Neynar dashboard (if available) to see if your endpoint receives it.

### Step 4: Check Vercel Logs
Monitor Vercel function logs in real-time:
- Go to Vercel dashboard → Your project → Logs
- Filter for `/api/webhooks/farcaster`
- Watch for POST requests when users enable notifications

### Step 5: Verify Event Flow
The flow should be:
1. User enables notifications in Farcaster
2. Farcaster sends event to: `https://api.neynar.com/f/app/{CLIENT_ID}/event`
3. Neynar receives event
4. Neynar forwards event to: `https://badtraders.xyz/api/webhooks/farcaster`
5. Your endpoint stores token in database

**If step 4 isn't happening, Neynar isn't forwarding events.**

## Alternative: Use Neynar's Managed Notifications

If webhook forwarding isn't working, consider switching to Neynar's managed notifications:

1. **Remove webhook forwarding** from Neynar dashboard
2. **Use Neynar's API** to send notifications: `POST /v2/farcaster/frame/notifications`
3. **Neynar manages tokens** automatically
4. **No need for your webhook endpoint** to store tokens

This is the recommended approach per Neynar docs and might be more reliable.

## Next Steps

1. **Check if notifications menu appears** in Farcaster
2. **Have a test user enable notifications** and watch Vercel logs
3. **Check Neynar dashboard** for webhook delivery status
4. **Consider switching to Neynar's managed notifications** if forwarding isn't reliable

