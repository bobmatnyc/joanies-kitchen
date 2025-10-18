#!/bin/bash
# Dev Server Monitoring and Auto-Restart Script
# Monitors Next.js dev server health and auto-restarts on crashes

set -e

PROJECT_DIR="/Users/masa/Projects/recipe-manager"
LOG_DIR="$PROJECT_DIR/tmp/logs"
DEV_LOG="$LOG_DIR/dev-server.log"
ERROR_LOG="$LOG_DIR/dev-server-errors.log"
PID_FILE="$PROJECT_DIR/tmp/dev-server.pid"
MAX_RESTARTS=5
RESTART_COUNT=0
PORT=3002

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEV_LOG"
}

error_log() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$ERROR_LOG"
}

warn_log() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$DEV_LOG"
}

# Function to kill existing Next.js processes on the port
kill_existing_server() {
    log "Checking for existing servers on port $PORT..."

    # Kill any process using the port
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

    # Also kill any stale Next.js processes for this project
    pkill -f "next dev.*3002" 2>/dev/null || true

    sleep 2
    log "Existing servers stopped"
}

# Function to clean Next.js cache
clean_cache() {
    log "Cleaning Next.js cache..."
    rm -rf "$PROJECT_DIR/.next"
    rm -rf "$PROJECT_DIR/node_modules/.cache"
    log "Cache cleaned"
}

# Function to start the dev server
start_server() {
    log "Starting development server..."

    cd "$PROJECT_DIR"

    # Start with pnpm dev in background
    pnpm dev > "$DEV_LOG" 2>&1 &

    # Save the PID
    echo $! > "$PID_FILE"

    log "Dev server started with PID $(cat $PID_FILE)"
    log "Server logs: tail -f $DEV_LOG"
}

# Function to check server health
check_health() {
    # Check if process is running
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            # Check if server is responding
            if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT > /dev/null 2>&1; then
                return 0
            fi
        fi
    fi
    return 1
}

# Function to handle server restart
restart_server() {
    RESTART_COUNT=$((RESTART_COUNT + 1))

    if [ $RESTART_COUNT -gt $MAX_RESTARTS ]; then
        error_log "Max restart attempts ($MAX_RESTARTS) reached. Manual intervention required."
        exit 1
    fi

    warn_log "Server crashed. Restarting... (Attempt $RESTART_COUNT/$MAX_RESTARTS)"

    # Clean up
    kill_existing_server
    clean_cache

    # Wait before restart
    sleep 5

    # Restart
    start_server
}

# Main monitoring loop
monitor_server() {
    log "Starting server monitoring..."

    while true; do
        sleep 10

        if ! check_health; then
            error_log "Server health check failed"
            restart_server
        fi
    done
}

# Trap to handle script termination
cleanup() {
    log "Shutting down..."
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        kill "$PID" 2>/dev/null || true
        rm -f "$PID_FILE"
    fi
    log "Shutdown complete"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Main execution
main() {
    log "=== Dev Server Monitor Started ==="
    log "Project: $PROJECT_DIR"
    log "Port: $PORT"
    log "Max restarts: $MAX_RESTARTS"

    # Initial cleanup and start
    kill_existing_server
    clean_cache
    start_server

    # Wait for server to start
    sleep 5

    # Start monitoring
    monitor_server
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    main
fi
