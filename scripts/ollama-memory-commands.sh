#!/bin/bash

# Ollama Memory Management - Quick Reference Commands
# This file contains helpful commands for managing Ollama memory usage

# ============================================================
# SERVICE MANAGEMENT
# ============================================================

# Restart Ollama service
restart_ollama() {
    echo "Restarting Ollama service..."
    launchctl unload ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
    sleep 2
    launchctl load ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
    echo "Ollama restarted!"
}

# Check service status
check_ollama() {
    echo "Checking Ollama status..."
    if pgrep -x "ollama" > /dev/null; then
        echo "✓ Ollama is running"
        ps aux | grep ollama | grep -v grep | head -1
    else
        echo "✗ Ollama is not running"
    fi
}

# ============================================================
# MEMORY MONITORING
# ============================================================

# Check current memory usage
check_memory() {
    echo "Current Ollama memory usage:"
    ps aux | grep ollama | grep -v grep | awk '{
        mem_kb = $6
        mem_mb = mem_kb / 1024
        mem_gb = mem_kb / 1024 / 1024
        printf "  CPU: %s%%\n  Memory: %s%% (%.2f GB)\n  RSS: %s KB (%.0f MB)\n",
               $3, $4, mem_gb, mem_kb, mem_mb
    }'
}

# Watch memory usage in real-time
watch_memory() {
    echo "Watching Ollama memory usage (Ctrl+C to stop)..."
    while true; do
        clear
        echo "=== Ollama Memory Monitor (refreshes every 2s) ==="
        echo ""
        date
        echo ""
        ps aux | grep ollama | grep -v grep | awk '{
            mem_kb = $6
            mem_gb = mem_kb / 1024 / 1024
            printf "CPU: %s%%  |  Memory: %s%% (%.2f GB)  |  PID: %s\n",
                   $3, $4, mem_gb, $2
        }'
        echo ""
        echo "Currently loaded models:"
        ollama ps 2>/dev/null || echo "  None"
        sleep 2
    done
}

# ============================================================
# MODEL MANAGEMENT
# ============================================================

# List all installed models
list_models() {
    echo "Installed models:"
    ollama list
}

# List currently loaded models
list_loaded() {
    echo "Currently loaded models:"
    ollama ps
}

# Stop all loaded models
stop_all() {
    echo "Stopping all loaded models..."
    ollama ps 2>/dev/null | tail -n +2 | awk '{print $1}' | while read -r model; do
        if [ -n "$model" ]; then
            echo "  Stopping $model..."
            ollama stop "$model"
        fi
    done
    echo "All models stopped!"
}

# Stop a specific model
stop_model() {
    if [ -z "$1" ]; then
        echo "Usage: stop_model <model-name>"
        echo "Example: stop_model deepseek-v3.1"
        return 1
    fi
    echo "Stopping model: $1"
    ollama stop "$1"
}

# ============================================================
# CONFIGURATION MANAGEMENT
# ============================================================

# Show current configuration
show_config() {
    echo "Current Ollama configuration:"
    echo ""
    if pgrep -x "ollama" > /dev/null; then
        OLLAMA_PID=$(pgrep -x "ollama")
        ps eww "$OLLAMA_PID" 2>/dev/null | tr ' ' '\n' | grep OLLAMA | while read -r line; do
            echo "  $line"
        done
    else
        echo "  ✗ Ollama is not running"
    fi
}

# Backup configuration
backup_config() {
    PLIST="$HOME/Library/LaunchAgents/homebrew.mxcl.ollama.plist"
    BACKUP="$PLIST.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$PLIST" "$BACKUP"
    echo "Configuration backed up to: $BACKUP"
}

# Restore configuration from backup
restore_config() {
    PLIST="$HOME/Library/LaunchAgents/homebrew.mxcl.ollama.plist"
    BACKUP="$PLIST.backup"

    if [ -f "$BACKUP" ]; then
        echo "Restoring configuration from backup..."
        cp "$BACKUP" "$PLIST"
        echo "Configuration restored!"
        echo "Restart Ollama to apply changes: restart_ollama"
    else
        echo "✗ No backup file found at: $BACKUP"
    fi
}

# ============================================================
# TESTING & VERIFICATION
# ============================================================

# Run full verification
verify() {
    if [ -f "/Users/masa/Projects/recipe-manager/scripts/verify-ollama-memory.sh" ]; then
        bash /Users/masa/Projects/recipe-manager/scripts/verify-ollama-memory.sh
    else
        echo "✗ Verification script not found"
    fi
}

# Test with a small model
test_small() {
    echo "Testing Ollama with a small model (mistral:latest)..."
    echo "Memory before:"
    check_memory
    echo ""
    echo "Running test prompt..."
    ollama run mistral:latest "Say hello in 5 words" --verbose
    echo ""
    echo "Memory after:"
    check_memory
}

# ============================================================
# HELP
# ============================================================

show_help() {
    cat << EOF
Ollama Memory Management - Quick Reference

SERVICE MANAGEMENT:
  restart_ollama       Restart Ollama service
  check_ollama         Check if Ollama is running

MEMORY MONITORING:
  check_memory         Show current memory usage
  watch_memory         Monitor memory usage in real-time

MODEL MANAGEMENT:
  list_models          List all installed models
  list_loaded          List currently loaded models
  stop_all             Stop all loaded models
  stop_model <name>    Stop a specific model

CONFIGURATION:
  show_config          Show current environment variables
  backup_config        Backup configuration file
  restore_config       Restore from backup

TESTING:
  verify               Run full verification script
  test_small           Test with a small model

USAGE:
  Source this file to use the functions:
    source scripts/ollama-memory-commands.sh

  Then call any function:
    check_memory
    watch_memory
    stop_all
    verify

EXAMPLES:
  # Check memory usage
  check_memory

  # Stop all models to free memory
  stop_all

  # Watch memory usage while testing
  watch_memory

  # Run full verification
  verify

MEMORY LIMITS (Current Configuration):
  • Max VRAM: 25 GB
  • Max Loaded Models: 1
  • Parallel Requests: 1

For detailed documentation, see:
  docs/guides/OLLAMA_MEMORY_CONFIGURATION.md
EOF
}

# ============================================================
# AUTO-EXECUTE
# ============================================================

# If script is executed (not sourced), show help
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    show_help
fi
