# Database Setup for Vercel Production - Supabase

**REQUIRED FOR DEPLOYMENT:** Your app needs a Supabase database to work. Without it, user registration and all database operations will fail.

Supabase database for production. One-time setup via Vercel marketplace, then never touch it again.

## Step-by-Step: Create Supabase Database via Vercel Marketplace

### Step 1: Go to Your Vercel Project

1. Go to https://vercel.com
2. Sign in to your account
3. Click on your project (badtraders)

### Step 2: Create the Database via Marketplace

1. In your project dashboard, look at the left sidebar
2. Click on **"Storage"** (it's in the left menu, usually below "Settings")
3. You'll see a page with database options
4. Click **"Create Database"** or **"Browse Marketplace"** (if available)
5. Look for **"Supabase"** in the marketplace
6. Click on **"Supabase"** → Click **"Create"** or **"Add Integration"**
7. Follow the prompts (may ask you to connect Supabase account or create one)
8. Wait for it to finish creating (might take 30 seconds)

**Alternative:** If Supabase doesn't appear in Vercel marketplace, create it directly on Supabase:
1. Go to https://supabase.com
2. Create a project
3. Get the connection string from Settings → Database → Connection string
4. Add it as `DATABASE_URL` environment variable in Vercel

### Step 3: Get Your Connection String

1. **If created via Vercel:** The `DATABASE_URL` is automatically set as an environment variable
2. **If created on Supabase directly:**
   - Go to Supabase dashboard → Your Project → Settings → Database
   - Under "Connection string", copy the URI (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)
   - In Vercel: Project Settings → Environment Variables → Add `DATABASE_URL` with this value

### Step 4: Run the Migration

**👉 See `DATABASE_MIGRATION_SETUP.md` for the easiest step-by-step guide with copy-paste SQL!**

Quick version:
1. Go to https://supabase.com → Your Project → SQL Editor
2. Copy the SQL from `DATABASE_MIGRATION_SETUP.md` (or `migrations/001_create_tables_simple.sql`)
3. Paste and click "Run"
4. Done! ✅

For detailed instructions, see: **`DATABASE_MIGRATION_SETUP.md`**

### Step 5: Verify It Works

After running the migration:
1. Your app should automatically connect to the database
2. The `DATABASE_URL` environment variable is set in Vercel
3. Your production deployments will use this database
4. Data persists across all deployments (database is hosted by Supabase, not Vercel)

## Using Same Database for Local Dev

The easiest way - use the SAME database for local development:

1. Copy the `DATABASE_URL` connection string from Supabase (Settings → Database → Connection string)
2. Put it in your `.env.local` file:
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   NEYNAR_API_KEY=your_neynar_key_here
   ALCHEMY_API_KEY=your_alchemy_key_here
   ```
3. Run `npm run dev` - it uses the same database as production

**That's it!** No local database install needed. Same database, same code, same behavior everywhere.

## What You Get

- One database for production (managed by Supabase)
- Automatic `DATABASE_URL` environment variable (if created via Vercel marketplace)
- Data persists across deployments (database lives on Supabase servers)
- Same connection string works for local dev and production
- Never need to touch the dashboard again after initial setup

## Troubleshooting

**"Storage" tab not visible**
- Make sure you're on the project page (not the dashboard home)
- You might need to scroll down or check if there's a menu toggle

**"Create Database" or Supabase option doesn't appear**
- Create Supabase project directly at https://supabase.com
- Copy connection string and add as `DATABASE_URL` in Vercel environment variables

**Connection errors after setup**
- Make sure the migration ran successfully (check Supabase SQL Editor for errors)
- Verify `DATABASE_URL` is set in Vercel: Project Settings → Environment Variables
- Check that the connection string includes your password: `postgresql://postgres:[PASSWORD]@...`

**Migration fails**
- Make sure you copied the ENTIRE migration file (all lines)
- Check for syntax errors in the SQL Editor
- Tables might already exist - that's fine, `CREATE TABLE IF NOT EXISTS` handles it

**Local dev not connecting**
- Double-check `.env.local` has the correct `DATABASE_URL`
- Make sure you copied the full connection string from Supabase
- Connection string should start with `postgresql://`
