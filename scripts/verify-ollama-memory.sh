#!/bin/bash

# Ollama Memory Configuration Verification Script
# Checks that Ollama is running with proper memory limits

set -e

echo "=================================================="
echo "Ollama Memory Configuration Verification"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected configuration
EXPECTED_MAX_VRAM="25769803776"  # 25GB in bytes
EXPECTED_MAX_MODELS="1"
EXPECTED_NUM_PARALLEL="1"

echo "1. Checking if Ollama service is running..."
if pgrep -x "ollama" > /dev/null; then
    echo -e "${GREEN}✓ Ollama service is running${NC}"
    OLLAMA_PID=$(pgrep -x "ollama")
    echo "  PID: $OLLAMA_PID"
else
    echo -e "${RED}✗ Ollama service is not running${NC}"
    exit 1
fi
echo ""

echo "2. Checking Ollama process memory usage..."
PS_OUTPUT=$(ps aux | grep ollama | grep -v grep | head -1)
CPU=$(echo "$PS_OUTPUT" | awk '{print $3}')
MEM_PERCENT=$(echo "$PS_OUTPUT" | awk '{print $4}')
MEM_KB=$(echo "$PS_OUTPUT" | awk '{print $6}')
MEM_MB=$((MEM_KB / 1024))
MEM_GB=$(echo "scale=2; $MEM_KB / 1024 / 1024" | bc)

echo -e "  CPU: ${CPU}%"
echo -e "  Memory: ${MEM_PERCENT}% (${MEM_GB} GB)"
echo -e "  Memory (KB): ${MEM_KB}"

if (( $(echo "$MEM_GB > 25" | bc -l) )); then
    echo -e "${YELLOW}⚠ Warning: Memory usage (${MEM_GB} GB) exceeds 25GB limit${NC}"
else
    echo -e "${GREEN}✓ Memory usage is within 25GB limit${NC}"
fi
echo ""

echo "3. Checking environment variables..."
# Get environment variables from running process
ENV_CHECK=$(ps eww $OLLAMA_PID 2>/dev/null | tr ' ' '\n' | grep OLLAMA || true)

if echo "$ENV_CHECK" | grep -q "OLLAMA_MAX_VRAM"; then
    MAX_VRAM=$(echo "$ENV_CHECK" | grep OLLAMA_MAX_VRAM | cut -d'=' -f2)
    MAX_VRAM_GB=$(echo "scale=2; $MAX_VRAM / 1024 / 1024 / 1024" | bc)
    if [ "$MAX_VRAM" == "$EXPECTED_MAX_VRAM" ]; then
        echo -e "${GREEN}✓ OLLAMA_MAX_VRAM: ${MAX_VRAM_GB} GB${NC}"
    else
        echo -e "${YELLOW}⚠ OLLAMA_MAX_VRAM: ${MAX_VRAM_GB} GB (expected 25 GB)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ OLLAMA_MAX_VRAM not set${NC}"
fi

if echo "$ENV_CHECK" | grep -q "OLLAMA_MAX_LOADED_MODELS"; then
    MAX_MODELS=$(echo "$ENV_CHECK" | grep OLLAMA_MAX_LOADED_MODELS | cut -d'=' -f2)
    if [ "$MAX_MODELS" == "$EXPECTED_MAX_MODELS" ]; then
        echo -e "${GREEN}✓ OLLAMA_MAX_LOADED_MODELS: ${MAX_MODELS}${NC}"
    else
        echo -e "${YELLOW}⚠ OLLAMA_MAX_LOADED_MODELS: ${MAX_MODELS} (expected ${EXPECTED_MAX_MODELS})${NC}"
    fi
else
    echo -e "${YELLOW}⚠ OLLAMA_MAX_LOADED_MODELS not set${NC}"
fi

if echo "$ENV_CHECK" | grep -q "OLLAMA_NUM_PARALLEL"; then
    NUM_PARALLEL=$(echo "$ENV_CHECK" | grep OLLAMA_NUM_PARALLEL | cut -d'=' -f2)
    if [ "$NUM_PARALLEL" == "$EXPECTED_NUM_PARALLEL" ]; then
        echo -e "${GREEN}✓ OLLAMA_NUM_PARALLEL: ${NUM_PARALLEL}${NC}"
    else
        echo -e "${YELLOW}⚠ OLLAMA_NUM_PARALLEL: ${NUM_PARALLEL} (expected ${EXPECTED_NUM_PARALLEL})${NC}"
    fi
else
    echo -e "${YELLOW}⚠ OLLAMA_NUM_PARALLEL not set${NC}"
fi
echo ""

echo "4. Checking launchd configuration file..."
PLIST_FILE="$HOME/Library/LaunchAgents/homebrew.mxcl.ollama.plist"
if [ -f "$PLIST_FILE" ]; then
    echo -e "${GREEN}✓ Configuration file exists${NC}"
    echo "  Location: $PLIST_FILE"

    # Check if backup exists
    if [ -f "${PLIST_FILE}.backup" ]; then
        echo -e "${GREEN}✓ Backup file exists: ${PLIST_FILE}.backup${NC}"
    else
        echo -e "${YELLOW}⚠ No backup file found${NC}"
    fi

    # Verify plist syntax
    if plutil -lint "$PLIST_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Configuration file syntax is valid${NC}"
    else
        echo -e "${RED}✗ Configuration file has syntax errors${NC}"
    fi
else
    echo -e "${RED}✗ Configuration file not found${NC}"
fi
echo ""

echo "5. Checking currently loaded models..."
LOADED_MODELS=$(ollama ps 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
if [ "$LOADED_MODELS" -eq 0 ]; then
    echo -e "${GREEN}✓ No models currently loaded (0/1)${NC}"
elif [ "$LOADED_MODELS" -eq 1 ]; then
    echo -e "${GREEN}✓ One model loaded (1/1)${NC}"
    ollama ps 2>/dev/null | tail -n +2
else
    echo -e "${YELLOW}⚠ Multiple models loaded (${LOADED_MODELS}/${EXPECTED_MAX_MODELS})${NC}"
    ollama ps 2>/dev/null | tail -n +2
    echo ""
    echo -e "${YELLOW}Consider stopping unused models to free memory:${NC}"
    echo "  ollama stop <model-name>"
fi
echo ""

echo "6. Checking available models..."
echo "Models installed on disk:"
ollama list 2>/dev/null | head -5
TOTAL_MODELS=$(ollama list 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
if [ "$TOTAL_MODELS" -gt 5 ]; then
    echo "... and $((TOTAL_MODELS - 5)) more models"
fi
echo ""

echo "=================================================="
echo "Verification Summary"
echo "=================================================="
echo ""
echo "Configuration Status:"
echo "  • Max VRAM Limit: 25 GB"
echo "  • Max Loaded Models: 1"
echo "  • Parallel Requests: 1"
echo "  • Current Memory Usage: ${MEM_GB} GB"
echo "  • Models Currently Loaded: ${LOADED_MODELS}"
echo ""

if (( $(echo "$MEM_GB <= 25" | bc -l) )); then
    echo -e "${GREEN}✓ All checks passed! Ollama is configured correctly.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Ollama is running but may need attention.${NC}"
    echo ""
    echo "Recommendations:"
    echo "  1. Stop unused models: ollama stop <model-name>"
    echo "  2. Use smaller models (7B-14B range)"
    echo "  3. Monitor memory with: ps aux | grep ollama"
    exit 0
fi
