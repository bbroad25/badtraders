# Local Development Setup

PostgreSQL for local dev - same as production. No install needed if you use Vercel Postgres.

## Option 1: Use Vercel Postgres (Easiest - No Install)

Use the same database as production. No PostgreSQL install needed.

1. **Set up Vercel Postgres first** (see `DATABASE_SETUP.md` for dashboard steps)
2. **Copy the connection string** from Vercel dashboard (Storage → Postgres → Connect tab)
3. **Put it in `.env.local`**:
   ```
   DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
   NEYNAR_API_KEY=your_neynar_key_here
   ALCHEMY_API_KEY=your_alchemy_key_here
   ```
4. **Run migration once** (if not already done):
   ```bash
   psql "postgresql://username:password@host:port/database?sslmode=require" -f migrations/001_create_tables.sql
   ```
5. **Start dev**: `npm run dev`

**That's it!** Same database as production, no local install needed.

---

## Option 2: Install PostgreSQL Locally

Only if you want a separate local database.

### 1. Install PostgreSQL

1. Go to https://www.postgresql.org/download/
2. Download PostgreSQL for your operating system (Windows, macOS, or Linux)
3. Run the installer
4. During installation:
   - Remember the password you set for the `postgres` user (you'll need this)
   - Default port is 5432 (that's fine)
   - Install everything (default options are good)

### 2. Create the Database

After PostgreSQL is installed:

1. Open your terminal/command prompt
2. Run this command:
   ```bash
   createdb badtraders
   ```

   If that doesn't work, you might need to add PostgreSQL to your PATH. Try:
   ```bash
   psql -U postgres
   ```
   Then inside psql:
   ```sql
   CREATE DATABASE badtraders;
   \q
   ```

### 3. Set Up Environment Variables

Create or edit `.env.local` in the `badtraders` directory:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/badtraders
NEYNAR_API_KEY=your_neynar_key_here
ALCHEMY_API_KEY=your_alchemy_key_here
```

**Important**: Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

### 4. Run the Migration

This creates all the tables in your database:

```bash
psql $DATABASE_URL -f migrations/001_create_tables.sql
```

On Windows PowerShell, you might need:
```powershell
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/badtraders"
psql $env:DATABASE_URL -f migrations/001_create_tables.sql
```

### 5. Start Development Server

```bash
npm run dev
```

That's it! Your local database is ready and works exactly like production.

## Troubleshooting

**"createdb: command not found"**
- PostgreSQL might not be in your PATH
- Try using `psql` directly: `psql -U postgres -c "CREATE DATABASE badtraders;"`

**"connection refused" or "could not connect"**
- Make sure PostgreSQL is running
- On Windows: Check Services, find "postgresql" and make sure it's running
- On macOS: `brew services start postgresql` (if installed via Homebrew)
- On Linux: `sudo systemctl start postgresql`

**"password authentication failed"**
- Double-check the password in your `DATABASE_URL`
- Try connecting with psql to test: `psql -U postgres -d badtraders`

**"psql: command not found"** (using Vercel Postgres)
- You need psql CLI tool to run migrations
- Quick install options:
  - Windows: `winget install PostgreSQL.PostgreSQL` or `choco install postgresql`
  - macOS: `brew install postgresql`
  - Linux: `sudo apt install postgresql-client` or `sudo yum install postgresql`
- Or use Vercel's SQL Editor instead (see `DATABASE_SETUP.md`)
