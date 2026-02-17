#!/bin/bash
################################################################################
# Embedding Generation Monitor - Post-Launch Priority 1B
#
# PURPOSE: Monitor local embedding generation progress for 4,644 recipes
#
# FEATURES:
# - Real-time progress tracking
# - Error count and rate monitoring
# - Estimated completion time
# - Performance metrics (recipes/minute)
# - Database verification
#
# USAGE:
#   ./scripts/post-launch/monitor-embeddings.sh
#
# DEPENDENCIES:
#   - scripts/generate_embeddings_local.py (already exists)
#   - PostgreSQL client (psql)
#
# TIMELINE: 8-10 hours for full run (overnight recommended)
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROGRESS_FILE="tmp/embedding-generation-progress.log"
ERROR_LOG="tmp/embedding-generation-errors.log"
SCRIPT_PATH="scripts/generate_embeddings_local.py"

# Ensure tmp directory exists
mkdir -p tmp

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EMBEDDING GENERATION MONITOR${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if embedding script exists
if [ ! -f "$SCRIPT_PATH" ]; then
    echo -e "${RED}ERROR: Embedding script not found at $SCRIPT_PATH${NC}"
    exit 1
fi

# Check if Python environment is ready
if ! python -c "import sentence_transformers" 2>/dev/null; then
    echo -e "${YELLOW}WARNING: sentence-transformers not installed${NC}"
    echo "Install with: pip install sentence-transformers"
    exit 1
fi

# Function to get database stats
get_db_stats() {
    psql $DATABASE_URL -t -c "
        SELECT
            COUNT(*) as total_recipes,
            COUNT(embedding) as recipes_with_embeddings,
            ROUND(COUNT(embedding) * 100.0 / COUNT(*), 2) as percentage
        FROM recipes
        WHERE embedding IS NOT NULL OR embedding IS NULL;
    " 2>/dev/null || echo "N/A"
}

# Function to display progress
show_progress() {
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}EMBEDDING GENERATION - LIVE MONITOR${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    # Database stats
    echo -e "${GREEN}Database Status:${NC}"
    if [ -n "$DATABASE_URL" ]; then
        db_stats=$(get_db_stats)
        echo "$db_stats"
    else
        echo "DATABASE_URL not set - cannot query database"
    fi
    echo ""

    # Progress file stats
    if [ -f "$PROGRESS_FILE" ]; then
        echo -e "${GREEN}Progress Log (last 20 lines):${NC}"
        tail -n 20 "$PROGRESS_FILE" | while IFS= read -r line; do
            if [[ $line == *"ERROR"* ]]; then
                echo -e "${RED}$line${NC}"
            elif [[ $line == *"SUCCESS"* ]] || [[ $line == *"COMPLETE"* ]]; then
                echo -e "${GREEN}$line${NC}"
            elif [[ $line == *"WARNING"* ]]; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        done
        echo ""

        # Calculate progress metrics
        total=$(grep -c "Processing recipe" "$PROGRESS_FILE" 2>/dev/null || echo 0)
        errors=$(grep -c "ERROR" "$PROGRESS_FILE" 2>/dev/null || echo 0)

        if [ $total -gt 0 ]; then
            echo -e "${GREEN}Progress Metrics:${NC}"
            echo "  Processed: $total recipes"
            echo "  Errors: $errors"
            error_rate=$(awk "BEGIN {printf \"%.2f\", ($errors / $total) * 100}")
            echo "  Error rate: ${error_rate}%"

            # Calculate rate (recipes per minute)
            if [ -f "$PROGRESS_FILE" ]; then
                start_time=$(head -n 1 "$PROGRESS_FILE" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}' || date +"%Y-%m-%d %H:%M:%S")
                current_time=$(date +"%Y-%m-%d %H:%M:%S")

                # Calculate duration in minutes
                start_epoch=$(date -j -f "%Y-%m-%d %H:%M:%S" "$start_time" +%s 2>/dev/null || date +%s)
                current_epoch=$(date +%s)
                duration_min=$(( (current_epoch - start_epoch) / 60 ))

                if [ $duration_min -gt 0 ]; then
                    rate=$(awk "BEGIN {printf \"%.2f\", $total / $duration_min}")
                    echo "  Rate: ${rate} recipes/minute"

                    # Estimate completion
                    remaining=$(( 4644 - total ))
                    if [ $(echo "$rate > 0" | bc -l) -eq 1 ]; then
                        eta_min=$(awk "BEGIN {printf \"%.0f\", $remaining / $rate}")
                        eta_hours=$(( eta_min / 60 ))
                        eta_min_remainder=$(( eta_min % 60 ))
                        echo "  ETA: ${eta_hours}h ${eta_min_remainder}m"
                    fi
                fi
            fi
        fi
    else
        echo -e "${YELLOW}No progress file found yet...${NC}"
        echo "Waiting for embedding generation to start..."
    fi
    echo ""

    # Error log
    if [ -f "$ERROR_LOG" ]; then
        error_count=$(wc -l < "$ERROR_LOG")
        if [ $error_count -gt 0 ]; then
            echo -e "${RED}Recent Errors ($error_count total):${NC}"
            tail -n 5 "$ERROR_LOG"
            echo ""
        fi
    fi

    echo -e "${BLUE}========================================${NC}"
    echo -e "Press Ctrl+C to stop monitoring"
    echo -e "Refresh every 10 seconds..."
    echo ""
}

# Main monitoring loop
main() {
    echo "Starting monitoring..."
    echo "Monitoring files:"
    echo "  - Progress: $PROGRESS_FILE"
    echo "  - Errors: $ERROR_LOG"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""
    sleep 2

    while true; do
        show_progress
        sleep 10
    done
}

# Trap Ctrl+C
trap 'echo -e "\n${GREEN}Monitoring stopped${NC}"; exit 0' INT

# Run monitor
main
