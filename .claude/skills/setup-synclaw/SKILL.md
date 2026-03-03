---
name: setup-synclaw
description: Install and run SyncClaw from scratch. Use when the user says "setup", "install", "deploy synclaw", "init synclaw", or needs to get SyncClaw running. Clones the repo, installs deps, initializes DB, builds for production, and starts the server.
---

# SyncClaw Setup

Clone, build, and run SyncClaw in production mode. Execute all steps autonomously — only ask the user when input is required.

## 1. Clone the repo

Skip if already inside a synclaw repo (check for `package.json` with name `syncclaw-v2`).

```bash
git clone https://github.com/lxcong/synclaw.git
cd synclaw
```

## 2. Install dependencies

Require Node.js v22+. Check with `node -v` first. If missing, abort with instructions to install Node.

```bash
npm install
```

## 3. Configure environment

If `.env.local` does not exist, create it. Read `~/.openclaw/openclaw.json` and extract `.gateway.auth.token` for the token value:

```bash
GATEWAY_TOKEN=$(node -e "try{console.log(require(require('os').homedir()+'/.openclaw/openclaw.json').gateway.auth.token)}catch{console.log('')}")
```

Then write `.env.local`:

```
DATABASE_URL="file:./dev.db"
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_GATEWAY_TOKEN=<value from above>
```

If `~/.openclaw/openclaw.json` doesn't exist, leave `OPENCLAW_GATEWAY_TOKEN` empty.

## 4. Initialize database

```bash
npx prisma db push
npx prisma generate
```

## 5. Build and start (production)

```bash
npm run build
npm start -- -H 0.0.0.0 -p 3000
```

This runs Next.js in production mode (optimized, no HMR overhead). The app is at `http://localhost:3000`.

To run in the background, use:

```bash
nohup npm start -- -H 0.0.0.0 -p 3000 > synclaw.log 2>&1 &
```

## Notes

- SQLite DB file lives at `./dev.db` — no external database needed.
- For development instead of production, use `npx next dev --turbopack -H 0.0.0.0`.
