# Image Generation Commands - Quick Reference

## 🚀 Quick Start (3 Commands)

```bash
# 1. Setup (one-time, ~5 minutes)
make image-setup

# 2. Test (verify it works)
make image-test

# 3. Generate your first recipe image
make image-generate RECIPE="Roasted Vegetables"
```

## 📋 Common Commands

### Using Make (Recommended)

```bash
# Setup
make image-setup              # One-time setup
make image-test-mps          # Test MPS availability
make image-test              # Generate test image
make image-docs              # View quick start guide

# Generate Images
make image-generate RECIPE="Pasta Carbonara"
make image-batch             # Use default recipes.txt
make image-batch FILE=my-recipes.txt
```

### Direct Python Commands

```bash
# Activate environment first
source venv-image-gen/bin/activate

# Test MPS
python scripts/image-gen/test_mps.py

# Generate test image
python scripts/image-gen/generate_test.py

# Single recipe
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Grilled Salmon"

# Custom style
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Pizza Margherita" \
    --style "wood-fired oven, rustic italian"

# Multiple variations
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Chocolate Cake" \
    --num-images 3

# Batch processing
python scripts/image-gen/recipe_image_generator.py \
    --batch scripts/image-gen/examples/recipes.txt

# Custom quality
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Salad" \
    --steps 50  # Higher quality (slower)
```

## 🎨 Style Presets

### Joanie's Kitchen Default
```bash
# Automatically applied:
# professional food photography,
# rustic kitchen setting,
# natural lighting, warm tones
```

### Custom Styles

```bash
# Elegant/Fine Dining
--style "fine dining, marble table, dramatic lighting, elegant plating"

# Rustic/Homey
--style "wooden cutting board, farmhouse kitchen, cozy atmosphere"

# Italian Style
--style "italian restaurant, checkered tablecloth, wine bottle in background"

# Modern/Minimalist
--style "white background, minimalist plating, clean composition"

# Outdoor/BBQ
--style "outdoor grill, summer barbecue, picnic table setting"
```

## 📊 Quality vs Speed

```bash
# Fast Draft (15 steps, ~2s)
--steps 15

# Balanced (30 steps, ~3s) [DEFAULT]
--steps 30

# High Quality (50 steps, ~5s)
--steps 50
```

## 📂 Output Locations

```bash
# Test images
tmp/image-gen-tests/test_TIMESTAMP.png

# Recipe images
tmp/recipe-images/RECIPE_NAME_TIMESTAMP.png
tmp/recipe-images/RECIPE_NAME_TIMESTAMP.json  # Metadata

# Custom output
--output-dir /path/to/output
```

## 🔧 Advanced Options

```bash
# Negative prompt (avoid unwanted elements)
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Salad" \
    --negative "closeup, macro, blurry, oversaturated"

# Custom resolution (default 1024x1024)
# Edit recipe_image_generator.py:
# ImageGenerationConfig(
#     height=1024,
#     width=768   # Portrait orientation
# )

# Generate multiple images
--num-images 5  # Generate 5 variations

# Batch with custom count
python scripts/image-gen/recipe_image_generator.py \
    --batch recipes.txt \
    --num-images 2  # 2 per recipe
```

## 📝 Creating Batch Files

```bash
# Create recipes.txt (one recipe per line)
cat > my-recipes.txt <<EOF
Pasta Carbonara
Grilled Salmon
Caesar Salad
Chocolate Cake
EOF

# Generate all
make image-batch FILE=my-recipes.txt
```

## 🐛 Troubleshooting

```bash
# Test MPS
make image-test-mps

# Or directly:
source venv-image-gen/bin/activate
python scripts/image-gen/test_mps.py

# Check Python environment
which python
python --version

# Reinstall dependencies
pip install -r scripts/image-gen/requirements.txt --force-reinstall

# Clear cache
rm -rf ~/.cache/huggingface/hub/
```

## 📈 Performance Tips

```bash
# For batch work: Keep model loaded
# Generate multiple images in one run instead of separate runs

# Good (2 minutes for 20 images)
python scripts/image-gen/recipe_image_generator.py \
    --batch recipes.txt

# Bad (20 minutes - reloads model each time)
for recipe in $(cat recipes.txt); do
    python scripts/image-gen/recipe_image_generator.py --recipe "$recipe"
done
```

## 🎯 Real-World Examples

### Example 1: Top 10 Recipes
```bash
# Create list
cat > top-10-recipes.txt <<EOF
Roasted Vegetables
Pasta Carbonara
Grilled Salmon
Caesar Salad
Tomato Soup
Chocolate Cake
Pizza Margherita
Chicken Stir Fry
Greek Salad
Tiramisu
EOF

# Generate 2 variations each
source venv-image-gen/bin/activate
python scripts/image-gen/recipe_image_generator.py \
    --batch top-10-recipes.txt \
    --num-images 2

# Result: 20 images in ~1 minute
```

### Example 2: Custom Style Collection
```bash
# Italian collection
for recipe in "Pasta Carbonara" "Pizza Margherita" "Risotto"; do
    python scripts/image-gen/recipe_image_generator.py \
        --recipe "$recipe" \
        --style "italian restaurant, rustic wooden table, wine"
done
```

### Example 3: High-Quality Finals
```bash
# Generate final images for launch
python scripts/image-gen/recipe_image_generator.py \
    --batch featured-recipes.txt \
    --num-images 3 \
    --steps 50
```

## 🔗 Integration Examples

### Copy to Public Directory
```bash
# After generation, copy to Next.js public folder
cp tmp/recipe-images/*.png public/images/recipes/

# Or during generation:
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Pasta" \
    --output-dir public/images/recipes
```

### Database Update Script
```bash
#!/bin/bash
# update-recipe-images.sh

source venv-image-gen/bin/activate

# Generate image
OUTPUT=$(python scripts/image-gen/recipe_image_generator.py \
    --recipe "$1" \
    --output-dir public/images/recipes)

# Extract image path
IMAGE_PATH=$(echo "$OUTPUT" | grep "Saved:" | cut -d' ' -f2)

# Update database (pseudo-code)
# psql -c "UPDATE recipes SET image_url='$IMAGE_PATH' WHERE name='$1'"

echo "Image generated: $IMAGE_PATH"
```

## 📚 Documentation

```bash
# Quick reference (this file)
cat scripts/image-gen/COMMANDS.md

# Quick start guide
cat scripts/image-gen/QUICKSTART.md

# Full documentation
cat scripts/image-gen/README.md

# Implementation summary
cat tmp/IMAGE_GEN_IMPLEMENTATION.md

# Help
make help  # See all make targets
```

## ⚡ One-Liners

```bash
# Setup everything
make image-setup && make image-test

# Generate 3 test images
for i in 1 2 3; do make image-test; done

# Quick recipe image
make image-generate RECIPE="Pasta"

# Batch default recipes
make image-batch

# View all outputs
open tmp/recipe-images/

# Check disk usage
du -sh ~/.cache/huggingface/  # Model cache
du -sh tmp/recipe-images/     # Generated images
```

---

**Tip**: Bookmark this file for quick reference!

**Your M4 Max can generate ~20 images per minute. Use it!** 🚀
