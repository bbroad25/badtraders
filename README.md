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

For production (Vercel), you'll need to set up a PostgreSQL database:

1. **Create Vercel Postgres**: Go to your Vercel project → Storage → Create Database → Postgres
2. **Run migrations**: Use the SQL editor in Vercel or run `migrations/001_create_tables.sql`
3. **Environment variable**: `DATABASE_URL` is automatically set by Vercel Postgres

For local development, see `README_LOCAL_SETUP.md`. For detailed Vercel setup, see `DATABASE_SETUP.md`.

### Notes

- The leaderboard data is cached for 1 hour to improve performance
- Wallet connection uses Farcaster SDK for authentication
- Database is automatically configured (PostgreSQL for production, SQLite for local)

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
