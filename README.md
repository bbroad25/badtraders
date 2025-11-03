# badtraders

*Automatically synced with your [v0.app](https://v0.app) deployment*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/bens-projects-ba9dc44f/v0-crypto-landing-page)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/epxB21ZlxmF)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/bens-projects-ba9dc44f/v0-crypto-landing-page](https://vercel.com/bens-projects-ba9dc44f/v0-crypto-landing-page)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/epxB21ZlxmF](https://v0.app/chat/epxB21ZlxmF)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Leaderboard Integration

The BadTraders leaderboard has been integrated into this Next.js application. The leaderboard tracks traders with the highest losses over the past week.

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
   *(Note: You can also use `pnpm install` if you prefer, but npm works fine)*

2. (Optional) Create a `.env.local` file in the `badtraders` directory with API keys for full functionality:
   - Copy `.env.example` to `.env.local`: `cp .env.example .env.local`
   - Fill in your API keys in `.env.local`

   See `.env.example` for all available options, or manually create `.env.local` with:
   ```
   # Core functionality (fill these for full features)
   ALCHEMY_API_KEY=your_alchemy_api_key_here
   NEYNAR_API_KEY=your_neynar_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional: For better PnL accuracy (the app tries all available services)
   ZERION_API_KEY=your_zerion_api_key_here      # Most accurate (tried first)
   MORALIS_API_KEY=your_moralis_api_key_here    # Free tier available (tried second)
   ZEROX_API_KEY=your_0x_api_key_here           # Public endpoints available (tried third)
   ```

   **How PnL Calculation Works**: The app automatically tries services in this order:
   1. **Zerion** (if `ZERION_API_KEY` provided) - Most accurate PnL
   2. **Moralis** (if `MORALIS_API_KEY` provided) - Good free tier
   3. **0x** (works without key, but better with `ZEROX_API_KEY`) - Swap history
   4. Falls back gracefully if none work

   **The app uses whatever keys you provide** - more keys = better accuracy and functionality!

   **Important**:
   - The app works with **any combination** of keys you provide
   - Missing keys = graceful degradation (empty leaderboard, no profiles, no NFT generation)
   - More keys = better functionality and accuracy
   - See `.env.example` for complete list with descriptions

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Visit the leaderboard at: `http://localhost:3000/leaderboard`

### Features

- **Leaderboard**: Displays traders ranked by their weekly losses
- **Wallet Status**: Connect your wallet to check eligibility (simulation mode)
- **NFT My Losses**: Turn your trading losses into an NFT for $1 using Gemini's Imagen API

### API Routes

- `GET /api/leaderboard` - Fetches the current leaderboard data
- `POST /api/meme` - Mints an NFT of your losses for $1

### Database Setup

**IMPORTANT: The app requires a Supabase database to work.** Without it, user registration and data storage will fail.

**Supabase** - Same database for dev and production. No local install needed.

#### For Production Deployment (Required for Vercel)

**You MUST set up Supabase database before deployment will work:**

1. Go to your Vercel project dashboard: https://vercel.com
2. Click on your project → Click **"Storage"** tab in the left sidebar
3. Click **"Create Database"** → Select **"Supabase"** (or browse marketplace)
4. Follow the prompts to connect/create Supabase account
5. Wait for it to create (takes ~30 seconds)
6. `DATABASE_URL` is automatically set as environment variable (or add it manually from Supabase dashboard)
7. **Run the migration** to create tables:
   - Go to Supabase dashboard → Your Project → **SQL Editor**
   - Copy contents of `migrations/001_create_tables.sql` from your local machine
   - Paste into SQL Editor and click **"Run"**
8. **That's it!** Your production app now has a working database

**See `DATABASE_SETUP.md` for detailed step-by-step instructions.**

#### For Local Development

**Use the same Supabase database for local dev** (easiest - no install needed):

1. Copy the `DATABASE_URL` connection string from Supabase (Settings → Database → Connection string)
2. Put it in `.env.local`: `DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
3. Run `npm run dev` - uses the same database as production

**See `README_LOCAL_SETUP.md` for detailed local setup instructions.**

Same Supabase database, same code, same behavior everywhere.

### Notes

- The leaderboard data is cached for 1 hour to improve performance
- Wallet connection uses Farcaster SDK for authentication
- Supabase database - same in dev and production, no local install needed

### Farcaster Mini App Configuration

If you're configuring this as a Farcaster Mini App (e.g., on Base Build):

1. **Account Association**: The manifest at `/.well-known/farcaster.json` needs to be SIGNED using Base Build's Preview tool:
   - Go to [Base Build](https://base.dev) and sign in
   - Navigate to Preview → Account Association
   - Enter your deployed Mini App URL
   - Sign the manifest with your wallet

2. **Manifest Location**: The manifest is available at:
   - Static file: `/public/.well-known/farcaster.json` (served at `/.well-known/farcaster.json`)
   - API route: `/.well-known/farcaster` (also serves the same JSON)

3. **Required Fields**: The manifest includes:
   - `accountAssociation`: Links your Mini App to an Ethereum address
   - `baseBuilder`: Base Build specific configuration
   - `frame`: Farcaster Frame fallback configuration
