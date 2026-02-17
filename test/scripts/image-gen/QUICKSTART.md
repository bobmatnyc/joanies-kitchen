# Image Generation Quick Start

**5-minute guide to generating recipe and meal images on your M4 Max**

## Step 1: Setup (One-time, ~5 minutes)

```bash
# From project root
cd /Users/masa/Projects/recipe-manager

# Run setup script
./scripts/image-gen/setup.sh
```

This will:
- ✓ Create Python virtual environment
- ✓ Install dependencies (PyTorch, Diffusers, etc.)
- ✓ Test Metal Performance Shaders (MPS)

## Step 2: Generate Your First Image (~30s first time, ~3s after)

```bash
# Activate environment
source venv-image-gen/bin/activate

# Generate test image (downloads 7GB model first time)
python scripts/image-gen/generate_test.py
```

Output: `tmp/image-gen-tests/test_TIMESTAMP.png`

## Step 3: Generate Recipe Images

### Single Recipe

```bash
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Roasted Vegetables"
```

### Custom Style

```bash
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Pasta Carbonara" \
    --style "rustic italian kitchen, wooden table"
```

### Multiple Variations

```bash
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Chocolate Cake" \
    --num-images 3
```

### Batch Generation

```bash
python scripts/image-gen/recipe_image_generator.py \
    --batch scripts/image-gen/examples/recipes.txt
```

## Common Options

| Option | Description | Example |
|--------|-------------|---------|
| `--recipe` | Recipe name | `"Grilled Salmon"` |
| `--style` | Custom style | `"elegant plating"` |
| `--num-images` | Number of images | `3` |
| `--steps` | Quality (15-50) | `30` (default) |
| `--output-dir` | Save location | `tmp/recipe-images` |
| `--batch` | Batch file | `recipes.txt` |

## Performance (M4 Max)

- **First run**: ~30s (downloads 7GB model)
- **Subsequent runs**: 2-5s per image
- **Memory usage**: ~8-12GB
- **Resolution**: 1024x1024 pixels

## Troubleshooting

### MPS Not Available?

```bash
python scripts/image-gen/test_mps.py
```

Ensure:
- macOS >= 12.3
- Apple Silicon (arm64)
- PyTorch >= 2.0

### Slow Generation?

Reduce steps for faster generation:
```bash
--steps 15  # ~2s per image (good quality)
--steps 30  # ~3s per image (default)
--steps 50  # ~5s per image (best quality)
```

### Out of Memory?

(Unlikely with 128GB RAM, but if it happens):
```bash
# Edit recipe_image_generator.py
# Add: pipe.enable_model_cpu_offload()
```

## Next Steps

- Read full documentation: `scripts/image-gen/README.md`
- Customize prompts for Joanie's Kitchen style
- Integrate with recipe database
- Set up automated batch processing

## File Locations

```
scripts/image-gen/
├── setup.sh                      # Setup script
├── test_mps.py                   # Test MPS
├── generate_test.py              # Test generation
├── recipe_image_generator.py     # Main generator
├── requirements.txt              # Dependencies
├── README.md                     # Full docs
├── QUICKSTART.md                 # This file
└── examples/
    └── recipes.txt               # Example batch file

tmp/
├── image-gen-tests/              # Test outputs
└── recipe-images/                # Recipe outputs

venv-image-gen/                   # Python environment
~/.cache/huggingface/hub/         # Downloaded models
```

## Tips

1. **Keep model loaded**: For batch work, generate multiple images in one run
2. **Style consistency**: Use same style settings for recipe collection
3. **Quality vs Speed**: Start with 15 steps for drafts, 50 for finals
4. **128GB advantage**: Can load multiple models simultaneously

## Example Workflow

```bash
# Morning: Generate 20 recipe images
source venv-image-gen/bin/activate

python scripts/image-gen/recipe_image_generator.py \
    --batch scripts/image-gen/examples/recipes.txt \
    --num-images 2 \
    --steps 30

# Total time: ~2 minutes (20 recipes × 2 images × 3s)
# Output: 40 professional food photos
```

## NEW: Meal Image Generation

Generate overhead photography for complete meals (collections of recipes):

### Quick Test

```bash
# Test meal image generator
bash scripts/image-gen/test_meal_generator.sh
```

### Generate Meal Images (TypeScript + Python)

```bash
# Dry run (preview only)
npm run tsx scripts/generate-meal-images-sd.ts

# Generate and save to database
APPLY_CHANGES=true npm run tsx scripts/generate-meal-images-sd.ts

# Process specific number
APPLY_CHANGES=true LIMIT=20 npm run tsx scripts/generate-meal-images-sd.ts
```

### How Meal Generation Works

1. **Queries Database**: Finds meals without images
2. **Fetches Courses**: Gets all recipes in the meal (appetizer, main, sides, dessert)
3. **Builds Prompt**: Creates overhead flat-lay photography description
4. **Generates**: Calls Python SD XL (30-40s per image)
5. **Uploads**: Stores on Vercel Blob CDN
6. **Updates**: Saves image_url to meals table

### Performance Comparison

| Feature | Recipe Images | Meal Images |
|---------|--------------|-------------|
| **Time** | 2-5s | 30-40s |
| **Script** | Python only | TypeScript + Python |
| **Quality** | 1024x1024 | 1024x1024 |
| **Style** | Single dish | Multiple dishes overhead |
| **Database** | Optional | Integrated |

### Meal Image Documentation

- **Quick Start**: This file
- **Full Guide**: `scripts/image-gen/MEAL_IMAGE_GENERATION.md`
- **Test Script**: `scripts/image-gen/test_meal_generator.sh`

---

**Your M4 Max specs make this incredibly fast. Enjoy!** 🚀
