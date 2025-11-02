# Local Testing Setup (Super Simple!)

## Quick Start

1. **Make sure `.env.local` has:**
   ```
   DATABASE_URL=./data/badtraders.db
   NEYNAR_API_KEY=your_key_here
   ALCHEMY_API_KEY=your_key_here
   ```

2. **Run the database setup:**
   ```bash
   npm run db:setup
   ```
   This creates the SQLite database file and all tables.

3. **Start dev server:**
   ```bash
   npm run dev
   ```

That's it! The database is just a file at `data/badtraders.db`. Delete it to start fresh.

## Production (Vercel - PostgreSQL)

For production, use PostgreSQL. The code automatically detects:
- **SQLite**: If `DATABASE_URL` is a file path (like `./data/badtraders.db`)
- **PostgreSQL**: If `DATABASE_URL` is a connection string (like `postgresql://...`)

### Setup on Vercel:

1. **Go to Vercel Dashboard → Your Project → Storage**
2. **Click "Create Database" → "Postgres"**
3. **Vercel automatically adds `DATABASE_URL` environment variable**
4. **Run the PostgreSQL migration** in Vercel's SQL editor or via CLI:
   ```bash
   psql $DATABASE_URL -f migrations/001_create_tables.sql
   ```

Same code works for both automatically!
