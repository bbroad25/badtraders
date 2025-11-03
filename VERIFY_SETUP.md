# Quick Setup Verification

## ✅ Step 1: Database Tables Created

Go to Supabase SQL Editor and run:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'daily_payouts', 'trading_metrics', 'leaderboard_cache');
```

**Expected:** Should show 4 rows (one for each table)

## ✅ Step 2: Local Connection String

Check `.env.local` has:
```
DATABASE_URL=postgresql://postgres.vklututsjxpsfqrocwve:BnVWiuF4tiopZfXc@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**Note:** Uses `aws-1-us-east-1.pooler.supabase.com` (NOT `db.vklututsjxpsfqrocwve.supabase.co`)

## ✅ Step 3: Vercel Environment Variable

1. Go to https://vercel.com → Your Project → Settings → Environment Variables
2. Make sure `DATABASE_URL` is set to:
   ```
   postgresql://postgres.vklututsjxpsfqrocwve:BnVWiuF4tiopZfXc@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```
3. Make sure it's enabled for **Production**, **Preview**, and **Development** environments
4. **Redeploy** after adding/changing it

## ✅ Step 4: Test It

**Local test:**
```bash
npm run dev
```

Try registering a user - should work if tables exist and connection string is correct.

**Production test:**
After setting DATABASE_URL in Vercel and redeploying, try the register endpoint on production.

---

## Common Issues

**"getaddrinfo ENOTFOUND" error**
- ❌ Wrong connection string using `db.vklututsjxpsfqrocwve.supabase.co`
- ✅ Use `aws-1-us-east-1.pooler.supabase.com` instead

**"relation users does not exist"**
- Migration not run yet
- Run the SQL from `DATABASE_MIGRATION_SETUP.md`

**"DATABASE_URL environment variable is not set"**
- Not set in Vercel environment variables
- Or not redeployed after adding it

