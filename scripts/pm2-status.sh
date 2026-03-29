#!/usr/bin/env bash
# Show all running Joanie's Kitchen PM2 processes and their health
# Usage: ./scripts/pm2-status.sh
# Compatible with bash 3.x (macOS default)

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

# ── Helper: get port for a known process name ─────────────────────────────────
get_port_for_process() {
  case "$1" in
    recipe-dev)          echo "3002" ;;
    recipe-prod)         echo "3002" ;;
    joanies-kitchen)     echo "3005" ;;
    joanies-kitchen-3005) echo "3005" ;;
    *)                   echo "" ;;
  esac
}

# ── Helper: get PM2 process status via jlist ──────────────────────────────────
get_pm2_status() {
  local name="$1"
  pm2 jlist 2>/dev/null | \
    node -e "
      let d='';
      process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        try {
          const list = JSON.parse(d);
          const p = list.find(p => p.name === '${name}');
          process.stdout.write(p ? p.pm2_env.status : 'not-found');
        } catch(e) { process.stdout.write('error'); }
      });
    " 2>/dev/null || echo "unknown"
}

echo "============================================================"
echo "  Joanie's Kitchen — PM2 Process Status"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# ── PM2 process list ──────────────────────────────────────────────────────────
echo "PM2 Processes:"
echo "--------------------------------------------------------------"
pm2 list
echo ""

# ── Health checks for app processes (those with HTTP ports) ──────────────────
APP_PROCESSES="recipe-dev recipe-prod joanies-kitchen joanies-kitchen-3005"

echo "Health Checks:"
echo "--------------------------------------------------------------"

ANY_ONLINE=false

for PROCESS_NAME in $APP_PROCESSES; do
  STATUS="$(get_pm2_status "$PROCESS_NAME")"

  if [ "$STATUS" = "online" ]; then
    ANY_ONLINE=true
    PORT="$(get_port_for_process "$PROCESS_NAME")"
    HEALTH_URL="http://localhost:${PORT}/api/health"

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      --connect-timeout 3 --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
      echo "  [HEALTHY]   $PROCESS_NAME  ->  $HEALTH_URL  (HTTP $HTTP_STATUS)"
    else
      echo "  [UNHEALTHY] $PROCESS_NAME  ->  $HEALTH_URL  (HTTP $HTTP_STATUS)"
    fi
  fi
done

if [ "$ANY_ONLINE" = "false" ]; then
  echo "  No Joanie's Kitchen app processes are currently online."
fi

echo ""

# ── Last 5 log lines per running process ──────────────────────────────────────
ALL_PROCESSES="recipe-dev recipe-prod joanies-kitchen joanies-kitchen-3005 recipe-scraper recipe-daily-scraper"

echo "Recent Logs (last 5 lines per active process):"
echo "--------------------------------------------------------------"

for PROCESS_NAME in $ALL_PROCESSES; do
  STATUS="$(get_pm2_status "$PROCESS_NAME")"

  if [ "$STATUS" = "online" ] || [ "$STATUS" = "stopping" ] || [ "$STATUS" = "errored" ]; then
    echo ""
    echo "  [$PROCESS_NAME] (status: $STATUS):"
    pm2 logs "$PROCESS_NAME" --lines 5 --nostream 2>/dev/null \
      | sed 's/^/    /' \
      || echo "    (no logs available)"
  fi
done

echo ""
echo "============================================================"
echo "  Commands:"
echo "    pm2 monit                          — interactive monitor"
echo "    pm2 logs <name>                    — live log stream"
echo "    make pm2-stop-all                  — stop all processes"
echo "    make deploy-local                  — redeploy (port 3002)"
echo "    make deploy-local-3005             — redeploy (port 3005)"
echo "============================================================"
