#!/usr/bin/env bash
set -euo pipefail

# SyncClaw setup script
# Usage: bash setup.sh [--dir <path>] [--gateway-url <url>] [--gateway-token <token>]

DIR="."
GATEWAY_URL="ws://localhost:18789"
GATEWAY_TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --gateway-url) GATEWAY_URL="$2"; shift 2 ;;
    --gateway-token) GATEWAY_TOKEN="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "==> Cloning SyncClaw..."
if [ -d "$DIR/synclaw" ]; then
  echo "    Directory $DIR/synclaw already exists, skipping clone"
  cd "$DIR/synclaw"
else
  git clone https://github.com/lxcong/synclaw.git "$DIR/synclaw"
  cd "$DIR/synclaw"
fi

echo "==> Installing dependencies..."
npm install

echo "==> Configuring environment..."
cat > .env <<EOF
DATABASE_URL="file:./dev.db"
OPENCLAW_GATEWAY_URL=$GATEWAY_URL
OPENCLAW_GATEWAY_TOKEN=$GATEWAY_TOKEN
EOF

echo "==> Setting up database..."
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

echo "==> Building for production..."
npm run build

echo "==> Installing CLI globally..."
npm install -g synclaw

echo ""
echo "✓ SyncClaw is ready!"
echo ""
echo "Start the server:"
echo "  cd $(pwd) && synclaw start"
echo ""
echo "Other commands:"
echo "  synclaw status    — check server status"
echo "  synclaw logs -f   — follow logs"
echo "  synclaw stop      — stop the server"
echo "  synclaw restart   — restart the server"
