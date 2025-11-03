# Local Development Setup

**Supabase for local dev - same as production.** No local database install needed.

## Quick Setup (Recommended)

Use the **same Supabase database** for local development. No PostgreSQL install, no complexity.

### Step 1: Get Your Supabase Connection String

1. Go to your Supabase project: https://supabase.com
2. Click on your project → **Settings** → **Database**
3. Scroll down to **"Connection string"** section
4. Copy the **URI** (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)
5. The password is shown in the same section (or you set it when creating the project)

### Step 2: Set Up Environment Variables

Create or edit `.env.local` in the `badtraders` directory:

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
NEYNAR_API_KEY=your_neynar_key_here
ALCHEMY_API_KEY=your_alchemy_key_here
```

**Important**: Replace `[YOUR-PASSWORD]` with your actual Supabase database password (shown in the connection string section).

### Step 3: Run the Migration (If Not Already Done)

The migration only needs to run once on your Supabase database. If you already ran it for production, skip this step.

**Option A: Using Supabase SQL Editor (Easiest)**
1. Go to https://supabase.com → Your Project
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Open `migrations/001_create_tables.sql` from your local machine
5. Copy all contents and paste into SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)

**Option B: Using psql (If You Have It)**
```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f migrations/001_create_tables.sql
```

### Step 4: Start Development Server

```bash
npm run dev
```

**That's it!** Your local dev now uses the same Supabase database as production. No installs, no configuration, same data everywhere.

## Why This Works

- **Supabase is PostgreSQL** - same SQL, same connection strings
- **No local install needed** - database lives on Supabase servers
- **Same database for dev and prod** - consistent behavior, no surprises
- **Data persists** - database is not affected by Vercel deployments

## Troubleshooting

**"Connection refused" or "could not connect"**
- Double-check your `DATABASE_URL` in `.env.local`
- Make sure you copied the FULL connection string from Supabase
- Verify the password is correct (it's shown in Supabase dashboard)
- Connection string should start with `postgresql://`

**"password authentication failed"**
- The password in your connection string might be URL-encoded
- Copy the connection string directly from Supabase dashboard
- Supabase shows the connection string with `[YOUR-PASSWORD]` placeholder - replace it with your actual password

**"relation does not exist" or "table does not exist"**
- You need to run the migration first (see Step 3)
- Tables are created in Supabase database, not locally
- Once created, they persist for all future dev sessions

**"DATABASE_URL not set"**
- Make sure `.env.local` exists in the `badtraders` directory (same level as `package.json`)
- Restart your dev server after changing `.env.local`
- Check that the file is not named `.env.local.txt` (Windows sometimes adds .txt)
