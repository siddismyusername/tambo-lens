#!/usr/bin/env bash
#
# deploy.sh — Deploy Tambo Lens to Vercel from the apps/ subdirectory
#
# Usage:
#   ./scripts/deploy.sh              # Preview deployment
#   ./scripts/deploy.sh --prod       # Production deployment
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$PROJECT_ROOT/apps"

# Check vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo "❌ Vercel CLI not found. Install with: npm i -g vercel"
  exit 1
fi

echo "📂 Deploying from: $APP_DIR"

# Pass all script arguments (e.g. --prod) to vercel
cd "$APP_DIR"
DEPLOY_URL=$(vercel "$@" 2>&1 | tee /dev/tty | grep -oP 'https://[^\s]+\.vercel\.app' | tail -1)

# Auto-initialize the database after deployment
if [ -n "$DEPLOY_URL" ]; then
  echo ""
  echo "🔧 Initializing database at $DEPLOY_URL ..."
  INIT_RESPONSE=$(curl -s -X POST "$DEPLOY_URL/api/init")
  if echo "$INIT_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Database initialized successfully"
  else
    echo "⚠️  Init response: $INIT_RESPONSE"
    echo "   You may need to run manually: curl -X POST $DEPLOY_URL/api/init"
  fi
else
  echo ""
  echo "⚠️  Could not detect deployment URL. Run manually after deploy:"
  echo "   curl -X POST https://tambo-lens.vercel.app/api/init"
fi
