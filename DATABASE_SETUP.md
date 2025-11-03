# Database Setup for Vercel Production

**REQUIRED FOR DEPLOYMENT:** Your app needs a PostgreSQL database to work. Without it, user registration and all database operations will fail.

PostgreSQL database for production. One-time setup in Vercel dashboard, then never touch it again.

## Step-by-Step: Create Vercel Postgres Database

### Step 1: Go to Your Vercel Project

1. Go to https://vercel.com
2. Sign in to your account
3. Click on your project (badtraders)

### Step 2: Create the Database

1. In your project dashboard, look at the left sidebar
2. Click on **"Storage"** (it's in the left menu, usually below "Settings")
3. You'll see a page that says something like "No databases yet"
4. Click the big button that says **"Create Database"** (usually blue/primary button)
5. A dialog or page will appear asking what type of database
6. Select **"Postgres"** (it might say "PostgreSQL" or just "Postgres")
7. Click **"Create"** or **"Continue"** (whatever button appears)
8. Wait for it to finish creating (might take 30 seconds)

### Step 3: Get Your Connection String

1. After the database is created, you'll be on the database page
2. Look for tabs: **"Connect"**, **"Settings"**, or **"Overview"**
3. Click on **"Connect"** or **"Settings"**
4. You should see a connection string that looks like:
   ```
   postgresql://username:password@host:port/database?sslmode=require
   ```
5. **This connection string is automatically saved as `DATABASE_URL` in your Vercel project** - you don't need to copy it manually for production
6. However, if you want to use the SAME database for local dev, copy this connection string

### Step 4: Run the Migration

You need to create the tables in your database. You have two options:

**Option A: Using Vercel's SQL Editor (Easiest)**
1. In the Vercel database page, look for **"SQL Editor"** tab
2. Click it
3. Open the file `migrations/001_create_tables.sql` on your local machine
4. Copy ALL the contents (Ctrl+A, Ctrl+C)
5. Paste into the SQL Editor in Vercel
6. Click **"Run"** or **"Execute"** button
7. You should see "Success" or no errors

**Option B: Using psql from Your Computer**
1. Copy the connection string from Vercel (Step 3, step 6)
2. In your terminal, run:
   ```bash
   psql "YOUR_CONNECTION_STRING" -f migrations/001_create_tables.sql
   ```
   Replace `YOUR_CONNECTION_STRING` with the actual connection string from Vercel

### Step 5: Verify It Works

After running the migration:
1. Your app should automatically connect to the database
2. The `DATABASE_URL` environment variable is already set by Vercel
3. Your production deployments will use this database
4. Data persists across all deployments

## Using Same Database for Local Dev (Optional)

If you want to use the SAME database for local development:

1. Copy the connection string from Vercel (Step 3, step 6)
2. Put it in your `.env.local` file:
   ```
   DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
   ```
3. Now your local dev uses the same database as production

**Note**: This means local and production share the same data. If you prefer separate databases, install PostgreSQL locally (see `README_LOCAL_SETUP.md`) and use that for dev.

## What You Get

- One database for production (managed by Vercel)
- Automatic `DATABASE_URL` environment variable
- Data persists across deployments
- Never need to touch the dashboard again after initial setup

## Troubleshooting

**"Storage" tab not visible**
- Make sure you're on the project page (not the dashboard home)
- You might need to scroll down or check if there's a menu toggle

**"Create Database" button doesn't work**
- Make sure your Vercel account has billing enabled (free tier works)
- Try refreshing the page

**Connection errors after setup**
- Make sure the migration ran successfully (check SQL Editor for errors)
- Verify `DATABASE_URL` is set in Vercel: Project Settings → Environment Variables
- The connection string should be there automatically

**Migration fails**
- Make sure you copied the ENTIRE migration file (all lines)
- Check for syntax errors in the SQL Editor
- Tables might already exist - that's fine, `CREATE TABLE IF NOT EXISTS` handles it
