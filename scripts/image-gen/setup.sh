#!/bin/bash
# Setup script for image generation environment
# For Apple Silicon M4 Max with Metal Performance Shaders

set -e  # Exit on error

echo "============================================================"
echo "Image Generation Setup - Joanie's Kitchen"
echo "============================================================"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "✗ This script is designed for macOS (Apple Silicon)"
    exit 1
fi

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo "✗ This script requires Apple Silicon (arm64)"
    echo "  Current architecture: $ARCH"
    exit 1
fi

echo "✓ Running on Apple Silicon ($ARCH)"
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "✗ Python 3 not found"
    echo "  Install with: brew install python@3.11"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Python version: $PYTHON_VERSION"

# Check if we're in project root
if [[ ! -d "scripts/image-gen" ]]; then
    echo "✗ Must run from project root"
    echo "  cd /Users/masa/Projects/recipe-manager"
    exit 1
fi

echo "✓ Project root detected"
echo ""

# Create virtual environment
VENV_DIR="venv-image-gen"

if [[ -d "$VENV_DIR" ]]; then
    echo "⚠ Virtual environment already exists: $VENV_DIR"
    read -p "  Delete and recreate? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  Removing old environment..."
        rm -rf "$VENV_DIR"
    else
        echo "  Using existing environment"
    fi
fi

if [[ ! -d "$VENV_DIR" ]]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "✓ Virtual environment created: $VENV_DIR"
fi

echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"
echo "✓ Virtual environment activated"
echo ""

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip setuptools wheel --quiet
echo "✓ pip upgraded"
echo ""

# Install requirements
echo "Installing dependencies (this may take a few minutes)..."
echo "  - PyTorch with MPS support"
echo "  - Diffusers (Stable Diffusion)"
echo "  - Transformers (model handling)"
echo "  - Accelerate (optimizations)"
echo "  - PIL (image processing)"
echo ""

pip install -r scripts/image-gen/requirements.txt

echo ""
echo "✓ Dependencies installed"
echo ""

# Test MPS availability
echo "Testing Metal Performance Shaders (MPS)..."
echo ""
python scripts/image-gen/test_mps.py

if [[ $? -ne 0 ]]; then
    echo ""
    echo "✗ MPS test failed"
    exit 1
fi

echo ""
echo "============================================================"
echo "✓ Setup Complete!"
echo "============================================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Activate environment (in new terminal):"
echo "     source venv-image-gen/bin/activate"
echo ""
echo "  2. Generate test image:"
echo "     python scripts/image-gen/generate_test.py"
echo ""
echo "  3. Generate recipe image:"
echo "     python scripts/image-gen/recipe_image_generator.py \\"
echo "       --recipe \"Roasted Vegetables\""
echo ""
echo "  4. Read documentation:"
echo "     cat scripts/image-gen/README.md"
echo ""
echo "Model info:"
echo "  - First run will download ~7GB SDXL model"
echo "  - Cached in: ~/.cache/huggingface/hub/"
echo "  - Generation time: 2-5s per image (M4 Max)"
echo ""
