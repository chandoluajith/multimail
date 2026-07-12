# MailsTracker

Multi-account email usage tracker with AI service cooldown management.  
Built with **React + Vite** (frontend) and **Cloudflare Pages Functions + D1** (backend).

---

## Quick Start (Local Development)

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local environment file

```bash
cp .dev.vars.example .dev.vars
```

Then edit `.dev.vars` and fill in your **real** values:

| Variable               | How to get it                                            |
| ---------------------- | -------------------------------------------------------- |
| `JWT_SECRET`           | Run: `openssl rand -base64 48`                           |
| `ENCRYPT_SECRET`       | Run: `openssl rand -hex 32`                              |
| `GOOGLE_CLIENT_ID`     | Google Cloud Console → APIs → OAuth 2.0 Credentials      |
| `GOOGLE_CLIENT_SECRET` | Same as above                                            |
| `APP_URL`              | `http://localhost:5173` for local dev                    |

> **Important**: The app will return **503 Server Misconfiguration** if secrets are still set to the example placeholder values.

### 3. Initialize the local database

```bash
npm run db:init
```

### 4. Start the development servers

```bash
npm run dev:all
```

This starts two servers concurrently:
- **Vite** dev server on `http://localhost:5173` (frontend hot reload)
- **Wrangler** Pages dev server on `http://localhost:8788` (API + D1)

The frontend proxies API calls (`/api/*`) to the Wrangler worker automatically.

---

## Available Scripts

| Script           | Description                                      |
| ---------------- | ------------------------------------------------ |
| `npm run dev`    | Start Vite frontend only                         |
| `npm run dev:all`| Start both Vite + Wrangler concurrently          |
| `npm run build`  | TypeScript check + Vite production build         |
| `npm run db:init`| Seed the local D1 database from `schema.sql`     |
| `npm run lint`   | Run ESLint                                       |

---

## Production Deployment (Cloudflare Pages)

### 1. Set your real D1 database ID

In `wrangler.toml`, replace `local-dev-db` with your actual D1 database ID:

```bash
# Find your database ID:
npx wrangler d1 list
```

### 2. Sync the production schema

```bash
npx wrangler d1 execute mailstracker-db --remote --file=./schema.sql
```

### 3. Set secrets in Cloudflare

```bash
npx wrangler pages secret put JWT_SECRET
npx wrangler pages secret put ENCRYPT_SECRET
npx wrangler pages secret put GOOGLE_CLIENT_ID
npx wrangler pages secret put GOOGLE_CLIENT_SECRET
npx wrangler pages secret put APP_URL
```

### 4. Deploy

```bash
npm run build
npx wrangler pages deploy dist
```

---

## Project Structure

```
├── src/                  # React frontend (Vite)
│   ├── components/       # UI components
│   ├── services/api.ts   # API client
│   └── types.ts          # Shared TypeScript types
├── functions/            # Cloudflare Pages Functions (backend)
│   ├── api/              # API route handlers
│   ├── utils/            # Security, auth, crypto, logging
│   ├── types.ts          # Backend type definitions
│   └── _middleware.ts    # Global middleware (HTTPS, headers)
├── schema.sql            # D1 database schema
├── wrangler.toml         # Cloudflare configuration
└── .dev.vars.example     # Template for local secrets
```

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion
- **Backend**: Cloudflare Pages Functions (Workers runtime)
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Google OAuth 2.0, JWT sessions
- **Encryption**: AES-256-GCM (Web Crypto API)
