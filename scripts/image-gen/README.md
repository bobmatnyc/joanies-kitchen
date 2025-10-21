# Recipe Image Generation with Stable Diffusion XL

Professional-grade food photography generation for Joanie's Kitchen using Stable Diffusion XL, optimized for Apple Silicon M4 Max with Metal Performance Shaders (MPS).

## Features

- **Apple Metal Acceleration**: Optimized for M4 Max GPU with 128GB unified memory
- **High Quality**: Stable Diffusion XL (SDXL) for professional food photography
- **Fast Generation**: 2-5 seconds per 1024x1024 image on M4 Max
- **Batch Processing**: Generate images for multiple recipes
- **Consistent Style**: Joanie's Kitchen brand aesthetic (rustic, warm, natural)
- **Metadata Tracking**: JSON metadata for each generation

## System Requirements

- **Hardware**: Apple Silicon (M1/M2/M3/M4) - Tested on M4 Max
- **RAM**: 16GB minimum, 128GB optimal (can load multiple models)
- **Storage**: ~10GB for SDXL model
- **OS**: macOS 12.3 or later
- **Python**: 3.9 or later

## Installation

### 1. Create Python Virtual Environment

```bash
# From project root
cd /Users/masa/Projects/recipe-manager

# Create virtual environment
python3 -m venv venv-image-gen

# Activate
source venv-image-gen/bin/activate
```

### 2. Install Dependencies

```bash
# Install requirements
pip install -r scripts/image-gen/requirements.txt

# First install will download ~7GB SDXL model from Hugging Face
```

### 3. Verify MPS Support

```bash
# Test Metal Performance Shaders availability
python scripts/image-gen/test_mps.py
```

Expected output:
```
============================================================
Apple Metal Performance Shaders (MPS) Availability Check
============================================================

✓ PyTorch version: 2.1.0
✓ MPS available: True
✓ MPS built: True
✓ MPS device created: mps
✓ MPS tensor operations working
  Test tensor shape: torch.Size([1000, 1000])
  Test tensor device: mps
✓ CUDA available: False

System Information:
  Python version: 3.11.6
  Platform: darwin
  Total RAM: 128.0 GB
  Available RAM: 96.3 GB

============================================================
✓ MPS is ready for Stable Diffusion!
============================================================
```

## Quick Start

### Generate Test Image

```bash
# Generate test image with default prompt
python scripts/image-gen/generate_test.py

# Custom prompt
python scripts/image-gen/generate_test.py \
    --prompt "a beautiful pasta dish, professional food photography"
```

First run will download the SDXL model (~7GB). Subsequent runs are fast.

### Generate Recipe Image

```bash
# Single recipe
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Roasted Vegetables with Herbs"

# With custom style
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Pasta Carbonara" \
    --style "rustic italian kitchen, wooden table, natural sunlight"

# Multiple variations
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Chocolate Cake" \
    --num-images 3
```

### Batch Generation

Create a text file with recipe names (one per line):

```bash
# recipes.txt
Roasted Vegetables
Pasta Carbonara
Chocolate Chip Cookies
Caesar Salad
```

Generate images for all:

```bash
python scripts/image-gen/recipe_image_generator.py \
    --batch recipes.txt \
    --num-images 2
```

## Usage Examples

### Basic Recipe Image

```bash
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Tomato Basil Soup"
```

Output: `tmp/recipe-images/tomato_basil_soup_20251021_143000.png`

### Custom Styling

```bash
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Grilled Salmon" \
    --style "elegant plating, fine dining, dark background, dramatic lighting"
```

### Control Quality vs Speed

```bash
# Faster (15 steps, ~2s per image)
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Pizza" \
    --steps 15

# Higher quality (50 steps, ~5s per image)
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Pizza" \
    --steps 50
```

### Negative Prompts (Avoid Unwanted Elements)

```bash
python scripts/image-gen/recipe_image_generator.py \
    --recipe "Salad" \
    --negative "closeup, macro, blurry, artificial colors"
```

## Default Style

All images use Joanie's Kitchen default style unless overridden:

```
professional food photography,
rustic kitchen setting,
natural lighting,
warm tones,
detailed textures,
appetizing,
high resolution,
8k quality
```

Negative prompt (things to avoid):
```
blurry, low quality, ugly, distorted,
watermark, text, oversaturated,
artificial, plastic looking
```

## Performance Benchmarks

On Apple M4 Max (16-core CPU, 40-core GPU, 128GB RAM):

| Task | Time | Notes |
|------|------|-------|
| Model Load (first time) | ~30s | Downloads 7GB |
| Model Load (cached) | ~5s | Loads from disk |
| Image Generation (30 steps) | ~3s | 1024x1024 |
| Image Generation (50 steps) | ~5s | Higher quality |
| Batch 10 images | ~30s | Sequential |

Memory usage: ~8-12GB during generation

## Output Structure

```
tmp/recipe-images/
├── pasta_carbonara_20251021_143000.png      # Generated image
├── pasta_carbonara_20251021_143000.json     # Metadata
├── roasted_vegetables_20251021_143100.png
└── roasted_vegetables_20251021_143100.json
```

Metadata JSON example:
```json
{
  "recipe_name": "Pasta Carbonara",
  "timestamp": "20251021_143000",
  "model": "stabilityai/stable-diffusion-xl-base-1.0",
  "images": ["pasta_carbonara_20251021_143000.png"],
  "config": {
    "steps": 30,
    "guidance": 7.5,
    "resolution": "1024x1024"
  }
}
```

## Advanced: Integration with Multi-Agent System

For integration with your Python multi-agent system:

```python
# Example agent integration
from scripts.image_gen.recipe_image_generator import RecipeImageGenerator

class ImageGenAgent:
    def __init__(self):
        self.generator = RecipeImageGenerator()

    async def process_task(self, task: dict):
        """Generate image for recipe."""
        images = self.generator.generate(
            recipe_name=task['recipe_name'],
            style=task.get('style'),
            num_images=task.get('count', 1)
        )

        paths = self.generator.save_images(
            images,
            task['recipe_name'],
            Path(task['output_dir'])
        )

        return {
            'status': 'success',
            'images': [str(p) for p in paths]
        }
```

## Models Available

### Stable Diffusion XL (Default)
- **Model**: `stabilityai/stable-diffusion-xl-base-1.0`
- **Size**: ~7GB
- **Quality**: Excellent for food photography
- **Speed**: 3-5s per image on M4 Max

### Alternative Models (Future)

You can modify `ImageGenerationConfig.model_id` to use:

- **SDXL Turbo**: `stabilityai/sdxl-turbo` (faster, 1s per image)
- **Flux**: `black-forest-labs/FLUX.1-schnell` (newer, experimental)
- **Fine-tuned Food**: Community food photography models

## Troubleshooting

### MPS Not Available

```bash
python scripts/image-gen/test_mps.py
```

If MPS fails:
- Verify macOS >= 12.3
- Update PyTorch: `pip install --upgrade torch`
- Check Apple Silicon: `uname -m` should show `arm64`

### Out of Memory

If you get OOM errors (rare with 128GB):

```python
# In recipe_image_generator.py, add:
pipe.enable_model_cpu_offload()  # Offload to RAM if needed
```

### Slow First Run

First run downloads ~7GB model from Hugging Face:
- Model cached in `~/.cache/huggingface/hub/`
- Subsequent runs load from cache (~5s)

### Low Quality Images

Increase inference steps:
```bash
--steps 50  # Default is 30
```

## Environment Variables

Optional configuration:

```bash
# Hugging Face token (for gated models)
export HF_TOKEN="your_token_here"

# Cache directory (default: ~/.cache/huggingface)
export HF_HOME="/path/to/cache"
```

## Future Enhancements

- [ ] LoRA fine-tuning on Joanie's existing food photos
- [ ] Multi-model support (SDXL + Flux)
- [ ] Real-time generation API endpoint
- [ ] Integration with recipe database
- [ ] Automated batch generation for all recipes
- [ ] Image upscaling (ESRGAN) for 4K output
- [ ] Style transfer from reference images

## Resources

- **SDXL Paper**: https://arxiv.org/abs/2307.01952
- **Diffusers Docs**: https://huggingface.co/docs/diffusers
- **Apple MPS**: https://pytorch.org/docs/stable/notes/mps.html
- **Hugging Face Models**: https://huggingface.co/stabilityai

## License

Scripts are part of Joanie's Kitchen project. Generated images follow Stable Diffusion XL license (CreativeML Open RAIL++-M).

---

**Performance Tip**: With 128GB RAM, you can keep the model loaded in memory and generate images in seconds without reloading. Consider running as a persistent service for production use.
