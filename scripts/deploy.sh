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
vercel "$@"
