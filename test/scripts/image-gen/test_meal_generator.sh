#!/bin/bash
#
# Test script for meal_image_generator.py
# Generates a single test image to verify SD XL is working
#

set -e

echo "======================================================================"
echo "Meal Image Generator - Test Script"
echo "======================================================================"
echo ""

# Test configuration
TEST_PROMPT="Professional overhead food photography of a complete dinner: Thanksgiving Feast. Multiple elegant dishes arranged on rustic dining table featuring: main: Roasted Turkey, side: Mashed Potatoes, side: Green Bean Casserole, dessert: Pumpkin Pie. Flat lay composition with warm natural lighting, styled by a professional food stylist, high-end food magazine quality, appetizing presentation showing full meal composition. NO text, NO watermarks, NO logos."
OUTPUT_DIR="tmp/meal-images-test"
OUTPUT_FILE="${OUTPUT_DIR}/thanksgiving-test.png"

# Create output directory
mkdir -p "${OUTPUT_DIR}"

echo "Test Configuration:"
echo "  Prompt: ${TEST_PROMPT:0:100}..."
echo "  Output: ${OUTPUT_FILE}"
echo ""

# Check Python dependencies
echo "Checking Python dependencies..."
python3 -c "import torch; print(f'✓ PyTorch: {torch.__version__}')" || {
  echo "✗ PyTorch not found. Install with: pip3 install torch"
  exit 1
}

python3 -c "import diffusers; print(f'✓ Diffusers: {diffusers.__version__}')" || {
  echo "✗ Diffusers not found. Install with: pip3 install diffusers"
  exit 1
}

python3 -c "from PIL import Image; print('✓ Pillow installed')" || {
  echo "✗ Pillow not found. Install with: pip3 install pillow"
  exit 1
}

echo ""

# Run generator
echo "Running meal image generator..."
python3 scripts/image-gen/meal_image_generator.py \
  --prompt "${TEST_PROMPT}" \
  --output "${OUTPUT_FILE}" \
  --steps 20

echo ""
echo "======================================================================"
echo "Test Complete!"
echo "======================================================================"
echo ""
echo "View generated image:"
echo "  open ${OUTPUT_FILE}"
echo ""
