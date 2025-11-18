# Neynar Webhook Setup Guide

Based on [Neynar's notification documentation](https://docs.neynar.com/docs/send-notifications-to-mini-app-users)

## Overview

When using Neynar's webhook proxy, the flow works like this:
1. Farcaster clients send events to Neynar's webhook URL: `https://api.neynar.com/f/app/{CLIENT_ID}/event`
2. Neynar receives and processes the events
3. Your webhook endpoint receives events (if configured) OR you use Neynar's API to manage notifications

## Step-by-Step Setup

### Step 1: Get Your Neynar Client ID

1. Go to [dev.neynar.com/app](https://dev.neynar.com/app)
2. Click on your app
3. Find your **Client ID** (format: UUID like `b1c28e38-6ade-462b-975c-f043602abea9`)
4. Copy the webhook URL shown: `https://api.neynar.com/f/app/{your_client_id}/event`

### Step 2: Set Environment Variable

Set `NEYNAR_CLIENT_ID` in your Vercel environment variables:

**In Vercel Dashboard:**
1. Go to your project settings
2. Navigate to Environment Variables
3. Add: `NEYNAR_CLIENT_ID` = `b1c28e38-6ade-462b-975c-f043602abea9` (your actual client ID)

**Or via Vercel CLI:**
```bash
vercel env add NEYNAR_CLIENT_ID
# Enter your client ID when prompted
```

### Step 3: Verify Manifest is Updated

✅ **Already Done!** Your manifest at `badtraders/app/api/farcaster-manifest/route.ts` is configured to use:
```typescript
webhookUrl: `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
```

### Step 4: Configure Webhook Endpoint in Neynar Dashboard (If Required)

**Important:** The Neynar documentation doesn't explicitly mention configuring a forwarding URL, but you have two options:

#### Option A: Use Neynar's Managed Notifications (Recommended)
- Neynar automatically manages notification tokens
- Use Neynar's API to send notifications: `POST /v2/farcaster/notification`
- No need for your own webhook endpoint to store tokens
- Benefits: Automatic token management, analytics, no batching needed

#### Option B: Keep Your Own Webhook Endpoint
- Your endpoint at `/api/webhooks/farcaster` will receive events
- You store tokens in your database (current setup)
- You send notifications directly to Farcaster API (current setup)
- **Note:** You may need to configure your webhook URL in Neynar dashboard to forward events

**To check if forwarding is needed:**
1. Go to [dev.neynar.com/app](https://dev.neynar.com/app)
2. Click on your app
3. Look for "Webhook Settings" or "Event Forwarding" section
4. If present, set it to: `https://badtraders.xyz/api/webhooks/farcaster`

### Step 5: Deploy and Test

1. **Deploy to Vercel** (make sure `NEYNAR_CLIENT_ID` is set)
2. **Clear Farcaster manifest cache:**
   - In Warpcast: Settings > Developer Tools > Domains
   - Enter: `https://badtraders.xyz`
   - Click "Check domain status" to force refresh
3. **Test the manifest:**
   - Visit: `https://badtraders.xyz/.well-known/farcaster.json`
   - Verify `webhookUrl` shows: `https://api.neynar.com/f/app/{your_client_id}/event`
4. **Test notifications:**
   - Add the miniapp in Farcaster
   - Check if "Turn on notifications" menu appears
   - Enable notifications
   - Check your webhook endpoint logs to see if events are received

## Current Implementation Status

✅ **Manifest configured** - Points to Neynar's webhook proxy
✅ **Webhook endpoint exists** - `/api/webhooks/farcaster` handles events
✅ **Token storage** - Stores tokens in `notification_tokens` table
✅ **Notification sending** - Uses direct Farcaster API

## Next Steps

1. **Set `NEYNAR_CLIENT_ID` in Vercel** (if not already set)
2. **Deploy the updated manifest**
3. **Check Neynar dashboard** for webhook forwarding configuration
4. **Test in Warpcast** after clearing manifest cache
5. **Monitor webhook logs** to see if events are being received

## Troubleshooting

### Notifications menu still not appearing?
- Verify `NEYNAR_CLIENT_ID` is set correctly in Vercel
- Check manifest URL returns correct webhook URL
- Clear Farcaster manifest cache in Warpcast
- Wait a few minutes for cache to expire (can take up to 24 hours)

### Webhook events not received?
- Check if Neynar dashboard has webhook forwarding configured
- Verify your endpoint is publicly accessible: `https://badtraders.xyz/api/webhooks/farcaster`
- Check Vercel function logs for errors
- Verify `NEYNAR_API_KEY` is set (needed for `verifyAppKeyWithNeynar`)

### Events received but tokens not stored?
- Check database connection in serverless function
- Verify `notification_tokens` table exists (migration 017)
- Check Vercel function logs for database errors

## References

- [Neynar Notification Setup Guide](https://docs.neynar.com/docs/send-notifications-to-mini-app-users)
- [Neynar Developer Portal](https://dev.neynar.com/app)
- [Farcaster Mini App Notifications](https://miniapps.farcaster.xyz/docs/guides/notifications)

