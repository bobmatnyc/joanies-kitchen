#!/usr/bin/env bash
set -euo pipefail

# Local production deployment: build + start via PM2
# Usage: ./scripts/deploy-local.sh [--port 3005]

# ── Defaults ──────────────────────────────────────────────────────────────────
PORT=3002
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    --port=*)
      PORT="${1#*=}"
      shift
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--port PORT]"
      echo ""
      echo "Options:"
      echo "  --port PORT   Port to deploy on (default: 3002)"
      echo "  -h, --help    Show this help message"
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
if ! command -v pm2 &>/dev/null; then
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

if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm is not installed or not in PATH." >&2
  echo "Install it with: npm install -g pnpm" >&2
  exit 1
fi

# ── Resolve PM2 process name & ecosystem config ───────────────────────────────
case "$PORT" in
  3005)
    PM2_NAMES=("joanies-kitchen" "joanies-kitchen-3005" "recipe-prod")
    PM2_PROCESS="joanies-kitchen-3005"
    ECOSYSTEM_FILE="$PROJECT_DIR/ecosystem.config.js"
    PM2_ONLY="joanies-kitchen-3005"
    ;;
  3002)
    PM2_NAMES=("recipe-prod" "joanies-kitchen")
    PM2_PROCESS="recipe-prod"
    ECOSYSTEM_FILE="$PROJECT_DIR/ecosystem.config.js"
    PM2_ONLY="recipe-prod"
    ;;
  *)
    echo "ERROR: Unsupported port '$PORT'. Supported: 3002, 3005" >&2
    exit 1
    ;;
esac

HEALTH_URL="http://localhost:${PORT}/api/health"

echo "============================================================"
echo "  Joanie's Kitchen — Local Production Deploy"
echo "  Port    : $PORT"
echo "  Process : $PM2_PROCESS"
echo "  Config  : $ECOSYSTEM_FILE"
echo "============================================================"
echo ""

cd "$PROJECT_DIR"

# ── Step 1: Build ─────────────────────────────────────────────────────────────
echo "[1/4] Building application (prebuild + build)..."
pnpm prebuild
pnpm build
echo "      Build complete."
echo ""

# ── Step 2: Stop existing processes ──────────────────────────────────────────
echo "[2/4] Stopping existing PM2 processes..."
for name in "${PM2_NAMES[@]}"; do
  pm2 stop "$name" 2>/dev/null && echo "      Stopped: $name" || true
  pm2 delete "$name" 2>/dev/null && echo "      Deleted: $name" || true
done
echo ""

# ── Step 3: Start via PM2 ────────────────────────────────────────────────────
echo "[3/4] Starting PM2 process '$PM2_ONLY'..."
pm2 start "$ECOSYSTEM_FILE" --only "$PM2_ONLY"
echo ""

# ── Step 4: Health check with retry ──────────────────────────────────────────
echo "[4/4] Waiting for health check at $HEALTH_URL..."

MAX_ATTEMPTS=20
WAIT_SECONDS=3
ATTEMPT=0
SUCCESS=false

while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
  ATTEMPT=$(( ATTEMPT + 1 ))
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$HEALTH_URL" 2>/dev/null || echo "000")

  if [[ "$HTTP_STATUS" == "200" ]]; then
    SUCCESS=true
    break
  fi

  echo "      Attempt $ATTEMPT/$MAX_ATTEMPTS — HTTP $HTTP_STATUS (waiting ${WAIT_SECONDS}s)..."
  sleep "$WAIT_SECONDS"
done

echo ""
echo "============================================================"
if [[ "$SUCCESS" == "true" ]]; then
  echo "  DEPLOYMENT SUCCESSFUL"
  echo "  App is live at http://localhost:$PORT"
  echo "  Health check: $HEALTH_URL -> HTTP 200"
  echo ""
  pm2 list
else
  echo "  DEPLOYMENT FAILED"
  echo "  Health check did not return HTTP 200 after $MAX_ATTEMPTS attempts."
  echo ""
  echo "  PM2 status:"
  pm2 list
  echo ""
  echo "  Last 10 lines of logs:"
  pm2 logs "$PM2_PROCESS" --lines 10 --nostream 2>/dev/null || true
  echo "============================================================"
  exit 1
fi
echo "============================================================"
