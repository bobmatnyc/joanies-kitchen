#!/usr/bin/env bash
set -euo pipefail

# Start clean dev server, clearing cache if needed
# Usage: ./scripts/dev-start.sh [--clean] [--pm2]

# ── Defaults ──────────────────────────────────────────────────────────────────
PORT=3002
CLEAN=false
USE_PM2=false
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean)
      CLEAN=true
      shift
      ;;
    --pm2)
      USE_PM2=true
      shift
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--clean] [--pm2]"
      echo ""
      echo "Options:"
      echo "  --clean   Remove .next cache and node_modules/.cache before starting"
      echo "  --pm2     Start via PM2 (ecosystem.config.js recipe-dev) instead of foreground"
      echo "  -h, --help  Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Run '$(basename "$0") --help' for usage." >&2
      exit 1
      ;;
  esac
done

# ── Dependency check ──────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm is not installed or not in PATH." >&2
  echo "Install it with: npm install -g pnpm" >&2
  exit 1
fi

if [[ "$USE_PM2" == "true" ]] && ! command -v pm2 &>/dev/null; then
  echo ""
  echo "ERROR: pm2 is not installed or not in PATH."
  echo ""
  echo "To install PM2 globally:"
  echo "  npm install -g pm2"
  echo "  # or"
  echo "  pnpm add -g pm2"
  echo ""
  exit 1
fi

cd "$PROJECT_DIR"

echo "============================================================"
echo "  Joanie's Kitchen — Dev Server Start"
echo "  Port  : $PORT"
echo "  Clean : $CLEAN"
echo "  PM2   : $USE_PM2"
echo "============================================================"
echo ""

# ── Step 1: Kill any existing process on the dev port ────────────────────────
echo "[1/3] Killing any existing process on port $PORT..."
PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)
if [[ -n "$PIDS" ]]; then
  echo "      Found PIDs: $PIDS — killing..."
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
  echo "      Done."
else
  echo "      No process found on port $PORT."
fi
echo ""

# ── Step 2: Optionally clear caches ──────────────────────────────────────────
if [[ "$CLEAN" == "true" ]]; then
  echo "[2/3] Clearing caches (--clean flag set)..."
  rm -rf .next
  rm -rf node_modules/.cache
  echo "      Removed .next and node_modules/.cache"
else
  echo "[2/3] Skipping cache clear (pass --clean to clear)."
fi
echo ""

# ── Step 3: Start dev server ──────────────────────────────────────────────────
if [[ "$USE_PM2" == "true" ]]; then
  echo "[3/3] Starting dev server via PM2 (recipe-dev)..."
  pm2 start ecosystem.config.js --only recipe-dev
  echo ""
  echo "      Streaming logs (Ctrl-C to detach, process keeps running):"
  pm2 logs recipe-dev
else
  echo "[3/3] Starting dev server in foreground (Ctrl-C to stop)..."
  echo ""
  pnpm dev
fi
