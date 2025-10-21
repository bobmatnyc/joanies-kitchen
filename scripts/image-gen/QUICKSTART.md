# Image Generation Quick Start

**5-minute guide to generating recipe images on your M4 Max**

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

---

**Your M4 Max specs make this incredibly fast. Enjoy!** 🚀
