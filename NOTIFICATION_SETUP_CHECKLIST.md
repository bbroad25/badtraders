# Notification Setup Checklist

## ✅ What We Just Fixed

1. **All manifest files now have correct webhook URL:**
   - ✅ `app/api/farcaster-manifest/route.ts` - Uses Neynar webhook URL
   - ✅ `app/.well-known/farcaster.json/route.ts` - Now includes webhook URL
   - ✅ `app/.well-known/farcaster/route.ts` - Now includes webhook URL
   - ✅ `public/.well-known/farcaster.json` - Updated (though this is a fallback)

## 🔍 Critical Checks Before Testing

### 1. Environment Variable
**MUST BE SET IN VERCEL:**
- [ ] `NEYNAR_CLIENT_ID` is set in Vercel environment variables
- [ ] Value matches your Neynar dashboard: `b1c28e38-6ade-462b-975c-f043602abea9`
- [ ] Applied to Production, Preview, and Development environments

**To verify:**
```bash
# Check in Vercel dashboard or via CLI
vercel env ls
```

### 2. Neynar Dashboard Configuration
**MUST BE CONFIGURED:**
- [ ] Webhook forwarding is set up in Neynar dashboard
- [ ] Target URL: `https://badtraders.xyz/api/webhooks/farcaster`
- [ ] Webhook name: `BadTraders` (or whatever you named it)

**To verify:**
1. Go to [dev.neynar.com/app](https://dev.neynar.com/app)
2. Click on your app
3. Check "Webhooks" section
4. Verify target URL is set correctly

### 3. Manifest Verification
**TEST THESE URLs AFTER DEPLOYMENT:**
- [ ] `https://badtraders.xyz/.well-known/farcaster.json` - Should show Neynar webhook URL
- [ ] `https://badtraders.xyz/api/farcaster-manifest` - Should show Neynar webhook URL

**Expected webhook URL format:**
```json
{
  "miniapp": {
    "webhookUrl": "https://api.neynar.com/f/app/b1c28e38-6ade-462b-975c-f043602abea9/event"
  }
}
```

### 4. Clear Farcaster Cache
**REQUIRED STEP:**
- [ ] Open Warpcast
- [ ] Go to Settings > Developer Tools > Domains
- [ ] Enter: `https://badtraders.xyz`
- [ ] Click "Check domain status" to force refresh
- [ ] Wait a few minutes for cache to clear

### 5. Test in Farcaster
**AFTER CLEARING CACHE:**
- [ ] Open your miniapp in Farcaster/Warpcast
- [ ] Open the hamburger menu (three dots)
- [ ] Look for "Turn on notifications" option
- [ ] If it appears, enable notifications
- [ ] Check Vercel function logs to see if webhook events are received

## 🐛 If Notifications Menu Still Doesn't Appear

### Debug Steps:

1. **Verify manifest is being served correctly:**
   ```bash
   curl https://badtraders.xyz/.well-known/farcaster.json | jq .miniapp.webhookUrl
   ```
   Should return: `"https://api.neynar.com/f/app/{your_client_id}/event"`

2. **Check if webhook URL is accessible:**
   - The Neynar webhook URL should be publicly accessible
   - Farcaster clients need to be able to reach it

3. **Verify Neynar Client ID format:**
   - Should be a UUID: `b1c28e38-6ade-462b-975c-f043602abea9`
   - No extra spaces or characters
   - Matches exactly what's in Neynar dashboard

4. **Check Vercel deployment:**
   - Ensure latest code is deployed
   - Check Vercel function logs for errors
   - Verify environment variables are set in production

5. **Wait for cache expiration:**
   - Farcaster clients cache manifests for up to 24 hours
   - Even after clearing cache, it may take time
   - Try removing and re-adding the miniapp

6. **Test with different Farcaster client:**
   - Try Warpcast if using another client
   - Try another user account
   - Some clients may have different caching behavior

## 📝 Important Notes

### Why Notifications Menu Might Not Appear:

1. **Manifest cache** - Farcaster clients aggressively cache manifests
2. **Webhook URL not accessible** - Farcaster must be able to reach the webhook URL
3. **Missing webhookUrl in manifest** - We just fixed this, but verify it's deployed
4. **Environment variable not set** - `NEYNAR_CLIENT_ID` must be set in Vercel
5. **Neynar webhook not configured** - Target URL must be set in Neynar dashboard

### Current Implementation Status:

✅ **Manifest files** - All updated with correct webhook URL
✅ **Webhook endpoint** - `/api/webhooks/farcaster` exists and handles events
✅ **Token storage** - Database table exists and stores tokens
✅ **Notification sending** - Service sends notifications via Farcaster API

⚠️ **Pending:**
- Environment variable verification
- Neynar dashboard webhook configuration
- Manifest cache clearing
- Testing in Farcaster client

## 🚀 Next Steps

1. **Deploy to Vercel** (if not already deployed)
2. **Verify environment variable** is set
3. **Verify Neynar webhook** is configured
4. **Clear Farcaster cache** in Warpcast
5. **Test notifications menu** appears
6. **Enable notifications** and check webhook logs

## 📚 References

- [Neynar Notification Setup](https://docs.neynar.com/docs/send-notifications-to-mini-app-users)
- [Farcaster Mini App Notifications](https://miniapps.farcaster.xyz/docs/guides/notifications)
- [Neynar Developer Portal](https://dev.neynar.com/app)

