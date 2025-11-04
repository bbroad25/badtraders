# Indexer Scripts

This directory contains standalone scripts for the indexer service.

## Standalone Indexer (`indexer.ts`)

The standalone indexer can run independently of the Next.js app, allowing you to:
- Run it on a separate service (Railway, Render, Fly.io, etc.) without time limits
- Run it locally for development
- Avoid Vercel's serverless function timeouts (10s Hobby, 60s Pro)

### Local Usage

```bash
# Run once and exit
npm run indexer

# Run continuously (watch mode) - syncs every 12 hours
npm run indexer:watch
```

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (Supabase)
- `ALCHEMY_API_KEY` - Alchemy API key for Base network

Optional:
- `INDEXER_SYNC_INTERVAL` - Sync interval in milliseconds (default: 12 hours)
- `INDEXER_CONTINUOUS` - Set to `true` for continuous mode (default: false)

### Deployment Options

#### Railway

1. Create a new Railway project
2. Add environment variables (`DATABASE_URL`, `ALCHEMY_API_KEY`)
3. Set start command: `npm run indexer:watch`
4. Railway will keep the process running

#### Render

1. Create a new Background Worker
2. Add environment variables
3. Build command: `npm install`
4. Start command: `npm run indexer:watch`

#### Fly.io

1. Create a `fly.toml` configuration
2. Set start command: `npm run indexer:watch`
3. Deploy with `fly deploy`

#### Local Server/VPS

```bash
# Install PM2 for process management
npm install -g pm2

# Run with PM2
pm2 start npm --name "indexer" -- run indexer:watch

# Or use systemd/supervisord
```

### Vercel Cron (Optional)

The Vercel cron endpoint (`/api/cron/indexer`) is kept for:
- Manual triggers via API
- Backup if standalone service is down
- Development/testing

**Note:** Vercel cron has strict time limits (10s Hobby, 60s Pro), so it will timeout on large syncs. The standalone script is recommended for production.

### Disabling Vercel Cron

If you're running the standalone indexer, you can disable the Vercel cron:

1. Remove or comment out the cron job in `vercel.json`
2. Or keep it for manual triggers but don't schedule it

