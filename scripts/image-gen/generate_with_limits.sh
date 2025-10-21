#!/bin/bash
# Wrapper script to run image generation with memory limits
# Usage: ./scripts/image-gen/generate_with_limits.sh [python_script] [args...]

set -e

# Memory limit: 25GB (in bytes)
MEMORY_LIMIT=$((25 * 1024 * 1024 * 1024))

# Set environment variables
export HF_HOME=/Users/masa/AI/models/huggingface
export PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0  # Prevent MPS memory caching

# Activate virtual environment
source venv-image-gen/bin/activate

# Run with ulimit memory restriction
# Note: ulimit -v sets virtual memory limit
ulimit -v $((MEMORY_LIMIT / 1024))  # Convert to KB for ulimit

# Run the Python script with all arguments
python "$@"
