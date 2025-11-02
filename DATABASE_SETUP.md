# Database Setup for Vercel

## Overview

This app uses PostgreSQL for production (Vercel) and SQLite for local development. The database connection is automatically configured based on your `DATABASE_URL` environment variable.

## Vercel Production Setup (PostgreSQL)

### Step 1: Create Vercel Postgres Database

1. **Go to your Vercel project dashboard**: https://vercel.com/dashboard
2. **Select your project** → Click on the **"Storage"** tab
3. **Click "Create Database"** → Select **"Postgres"**
4. **Vercel automatically:**
   - Creates a PostgreSQL database
   - Adds the `DATABASE_URL` environment variable to your project
   - Configures connection pooling for serverless functions
   - Sets up SSL connections

### Step 2: Run Database Migration

After creating the database, you need to run the migration to create tables:

1. **Go to Vercel Dashboard** → Your Project → **Storage** → **Postgres**
2. **Click the "Connect" tab** (or use the SQL Editor tab)
3. **Copy the contents of `migrations/001_create_tables.sql`**
4. **Paste and run** in the Vercel SQL Editor

Alternatively, use `psql` from your local machine:
```bash
# Get connection string from Vercel dashboard
# Then run:
psql $DATABASE_URL -f migrations/001_create_tables.sql
```

### Step 3: Verify Setup

The app will automatically:
- Detect PostgreSQL via the `DATABASE_URL` connection string
- Use proper parameter placeholders (`$1`, `$2`, etc.)
- Handle connection pooling for serverless functions

## Local Development Setup (SQLite)

For local development, the app uses SQLite automatically if `DATABASE_URL` points to a file path:

1. **Set up `.env.local`**:
   ```env
   DATABASE_URL=./data/badtraders.db
   ```

2. **Run the setup script**:
   ```bash
   npm run db:setup
   ```

This will:
- Create the SQLite database file
- Run the SQLite-specific migration (`migrations/001_create_tables.sqlite.sql`)
- Verify table creation

See `README_LOCAL_SETUP.md` for more details.

## Database Detection

The app automatically detects which database to use:

- **SQLite**: If `DATABASE_URL` starts with `./`, `/`, or ends with `.db`
- **PostgreSQL**: If `DATABASE_URL` is a PostgreSQL connection string (e.g., `postgresql://...`)

## Environment Variables

### Production (Vercel)
- `DATABASE_URL` - Automatically set by Vercel Postgres (includes SSL)

### Local Development
- `DATABASE_URL=./data/badtraders.db` - Points to SQLite file

## Migration Files

- `migrations/001_create_tables.sql` - PostgreSQL schema
- `migrations/001_create_tables.sqlite.sql` - SQLite schema (same structure, adapted syntax)

## Troubleshooting

**Connection Issues on Vercel:**
- Make sure `DATABASE_URL` is set in Vercel environment variables
- Check that the Postgres database is active (not paused)
- Verify SSL settings if connecting from external tools

**Migration Errors:**
- Make sure you're using the correct migration file (PostgreSQL vs SQLite)
- Check that tables don't already exist (use `IF NOT EXISTS` in migrations)

**Local Development:**
- Run `npm run db:setup` if database file doesn't exist
- Delete `./data/badtraders.db` and run setup again to reset

