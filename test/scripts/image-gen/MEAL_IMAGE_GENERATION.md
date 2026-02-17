# Meal Image Generation with Stable Diffusion XL

Complete guide for generating meal images using local Stable Diffusion XL.

## Overview

This system generates professional overhead food photography for complete meals (collections of recipes). It uses:
- **Local Stable Diffusion XL** (free, no API costs)
- **Apple Silicon MPS** optimization for M-series chips
- **Vercel Blob** storage for hosting
- **TypeScript + Python** hybrid architecture

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  TypeScript Main Script                                 │
│  (generate-meal-images-sd.ts)                          │
│  - Queries database for meals without images            │
│  - Fetches meal courses/recipes                         │
│  - Builds descriptive prompts                           │
│  - Orchestrates generation flow                         │
│  - Uploads to Vercel Blob                               │
│  - Updates database records                             │
└──────────────┬──────────────────────────────────────────┘
               │
               │ spawns subprocess
               ▼
┌─────────────────────────────────────────────────────────┐
│  Python SD XL Generator                                 │
│  (meal_image_generator.py)                             │
│  - Loads Stable Diffusion XL model                      │
│  - Generates 1024x1024 images                           │
│  - Optimized for Apple Silicon MPS                      │
│  - Returns image path to TypeScript                     │
└─────────────────────────────────────────────────────────┘
```

## Installation

### 1. Python Dependencies

```bash
# Install Python packages (one-time setup)
pip3 install torch torchvision diffusers pillow transformers accelerate

# Verify installation
python3 -c "import torch; print(f'PyTorch: {torch.__version__}')"
python3 -c "import diffusers; print(f'Diffusers: {diffusers.__version__}')"
```

**Expected versions:**
- PyTorch: 2.1.0+
- Diffusers: 0.25.0+
- Pillow: 10.0.0+

### 2. Model Download

The first run will download Stable Diffusion XL (~7GB):
```bash
# First run downloads model (takes ~5-10 minutes)
# Model is cached at: ~/.cache/huggingface/
```

**Disk space required:**
- Model: ~7GB
- Temp images: ~5MB per image
- Total: ~8GB recommended free space

### 3. Environment Variables

```bash
# Required
export BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"

# Optional
export APPLY_CHANGES="true"  # Default: false (dry run)
export LIMIT="10"            # Default: 10 meals
```

## Usage

### Dry Run (Preview Only)

```bash
# Preview what would be generated (no database changes)
npm run tsx scripts/generate-meal-images-sd.ts

# Preview specific number
LIMIT=5 npm run tsx scripts/generate-meal-images-sd.ts
```

### Apply Changes (Production)

```bash
# Generate and save images for 10 meals
APPLY_CHANGES=true npm run tsx scripts/generate-meal-images-sd.ts

# Process specific number
APPLY_CHANGES=true LIMIT=20 npm run tsx scripts/generate-meal-images-sd.ts

# Process all meals without images
APPLY_CHANGES=true LIMIT=1000 npm run tsx scripts/generate-meal-images-sd.ts
```

## Performance

### Generation Time

| Hardware | Time per Image | Throughput |
|----------|---------------|------------|
| M4 Max   | 30-40s        | ~90/hour   |
| M3 Pro   | 40-50s        | ~70/hour   |
| M2       | 50-60s        | ~60/hour   |
| M1       | 60-80s        | ~50/hour   |

**Bottlenecks:**
- Model loading: ~10-15s (one-time at startup)
- Image generation: ~30-40s per image
- Upload to Blob: ~1-2s per image
- Database update: <1s per image

### Memory Usage

- **Model in memory**: ~6GB RAM
- **Peak generation**: ~8GB RAM
- **Recommended**: 16GB+ total RAM

### Batch Processing Estimates

| Meals | Estimated Time | Cost |
|-------|---------------|------|
| 10    | 5-7 minutes   | $0   |
| 50    | 25-35 minutes | $0   |
| 100   | 50-70 minutes | $0   |

Compare to DALL-E 3:
- 10 images: $0.40
- 100 images: $4.00

## Prompt Engineering

### Meal Prompt Template

```
Professional overhead food photography of a complete ${mealType}: ${mealName}.
Multiple elegant dishes arranged on ${styleDescription} featuring:
${coursesDescription}
Flat lay composition with warm natural lighting,
styled by a professional food stylist,
high-end food magazine quality,
appetizing presentation showing full meal composition.
NO text, NO watermarks, NO logos.
Ultra-realistic, editorial quality.
```

### Style Descriptions by Cuisine

| Cuisine | Style Description |
|---------|------------------|
| Italian | rustic Italian trattoria with checkered tablecloth |
| French | elegant French bistro with marble table |
| Asian | modern Asian restaurant with bamboo mat |
| Mexican | colorful Mexican cantina with terracotta dishes |
| American | classic American diner with bright lighting |
| Default | elegant dining table |

### Example Prompts

**Thanksgiving Dinner:**
```
Professional overhead food photography of a complete dinner: Thanksgiving Feast.
Multiple elegant dishes arranged on rustic dining table featuring:
main: Roasted Turkey, side: Mashed Potatoes, side: Green Bean Casserole,
dessert: Pumpkin Pie
Flat lay composition with warm natural lighting,
styled by a professional food stylist,
high-end food magazine quality,
appetizing presentation showing full meal composition.
NO text, NO watermarks, NO logos.
```

**Sunday Brunch:**
```
Professional overhead food photography of a complete brunch: Sunday Brunch.
Multiple elegant dishes arranged on elegant dining table featuring:
main: Eggs Benedict, side: Fresh Fruit Salad, bread: Croissants,
drink: Mimosas
Flat lay composition with warm natural lighting,
styled by a professional food stylist,
high-end food magazine quality,
appetizing presentation showing full meal composition.
NO text, NO watermarks, NO logos.
```

## Configuration

### SD XL Parameters

```python
# In meal_image_generator.py
model_id = "stabilityai/stable-diffusion-xl-base-1.0"
device = "mps"  # Apple Silicon Metal
dtype = torch.float32  # Avoid NaN issues on MPS
num_inference_steps = 30  # Quality vs speed tradeoff
guidance_scale = 7.5  # Prompt adherence (higher = stricter)
size = 1024x1024  # Square format for meals
```

**Parameter tuning:**
- `steps=20`: Faster (20s), lower quality
- `steps=30`: Balanced (30s), good quality ✅ (default)
- `steps=50`: Slower (50s), best quality

### TypeScript Configuration

```typescript
// In generate-meal-images-sd.ts
const APPLY_CHANGES = process.env.APPLY_CHANGES === 'true';
const LIMIT = parseInt(process.env.LIMIT || '10', 10);
const RATE_LIMIT_DELAY = 2000; // 2s between operations
const MAX_RETRIES = 2; // Retry failed generations
const RETRY_DELAY = 3000; // 3s retry delay
```

## Database Schema

### Meals Table

```typescript
{
  id: uuid
  user_id: text
  name: text
  meal_type: enum
  image_url: text  // ← Updated by this script
  // ... other fields
}
```

### Course Categories

- `appetizer` - Starters
- `soup` - Soups
- `salad` - Salads
- `main` - Main courses
- `side` - Side dishes
- `bread` - Bread/rolls
- `dessert` - Desserts
- `drink` - Beverages

## Troubleshooting

### Common Issues

**1. MPS Not Available**
```bash
Error: MPS not available
```
**Solution:** Run on Apple Silicon Mac (M1/M2/M3/M4) or use CPU fallback

**2. Out of Memory**
```bash
Error: RuntimeError: MPS out of memory
```
**Solution:**
- Close other applications
- Reduce batch size (use smaller LIMIT)
- Restart script between batches

**3. Python Packages Missing**
```bash
Error: No module named 'diffusers'
```
**Solution:**
```bash
pip3 install diffusers torch pillow transformers
```

**4. Model Download Fails**
```bash
Error: Connection timeout
```
**Solution:**
- Check internet connection
- Retry (model downloads resume)
- Use VPN if blocked

**5. Black/Corrupted Images**
```bash
Error: Generated image is black
```
**Solution:**
- Use `dtype=torch.float32` (already configured)
- Update PyTorch to latest version
- Check MPS compatibility

### Debug Mode

Enable verbose logging:
```bash
# TypeScript debug
DEBUG=* npm run tsx scripts/generate-meal-images-sd.ts

# Python debug
python3 scripts/image-gen/meal_image_generator.py \
  --prompt "test" \
  --output "tmp/test.png" \
  --steps 10
```

## Best Practices

### 1. Batch Processing

Process in small batches to avoid memory issues:
```bash
# Process 10 at a time
APPLY_CHANGES=true LIMIT=10 npm run tsx scripts/generate-meal-images-sd.ts

# Wait for completion, then run again
APPLY_CHANGES=true LIMIT=10 npm run tsx scripts/generate-meal-images-sd.ts
```

### 2. Quality Assurance

- **Dry run first**: Always preview with `APPLY_CHANGES=false`
- **Visual inspection**: Review generated images before batch processing
- **Regenerate poor quality**: Flag and regenerate unsatisfactory images

### 3. Resource Management

- **Close heavy apps**: Free up RAM before large batches
- **Monitor temperature**: Watch for thermal throttling on laptops
- **Use power adapter**: Don't run on battery (MPS needs full power)

### 4. Cost Optimization

- **Local first**: Use SD XL for bulk generation (free)
- **DALL-E for specific**: Use DALL-E 3 only for hero images or specific styles
- **Reuse prompts**: Consistent prompts = consistent style

## Maintenance

### Update Model

```bash
# Clear cached model
rm -rf ~/.cache/huggingface/hub/models--stabilityai--stable-diffusion-xl-base-1.0

# Next run will download latest version
```

### Clean Temp Files

```bash
# Remove temp images
rm -rf tmp/meal-images/*

# Temp files are auto-cleaned after upload
```

### Monitor Storage

```bash
# Check model cache size
du -sh ~/.cache/huggingface/

# Check temp directory
du -sh tmp/meal-images/
```

## Advanced Usage

### Custom Prompts

Override default prompt generation:
```typescript
// Modify buildMealPrompt() in generate-meal-images-sd.ts
// Add custom styling, camera angles, or mood
```

### Alternative Models

Use different SD XL models:
```python
# In meal_image_generator.py
model_id = "stabilityai/stable-diffusion-xl-refiner-1.0"  # Higher quality
model_id = "runwayml/stable-diffusion-v1-5"  # Faster, lower quality
```

### Image Post-Processing

Add filters or adjustments:
```python
# In meal_image_generator.py
from PIL import ImageEnhance

def enhance_image(image):
    enhancer = ImageEnhance.Contrast(image)
    return enhancer.enhance(1.2)  # +20% contrast
```

## Migration from DALL-E

To migrate existing DALL-E script to SD XL:

1. Replace OpenAI calls with SD XL subprocess
2. Adjust prompts (SD XL is more literal)
3. Update rate limiting (local = no limits)
4. Remove API cost calculations

## Support

**Issues:**
- Check [troubleshooting](#troubleshooting) section
- Review error logs in console output
- Test Python script independently

**Performance:**
- Monitor Activity Monitor for memory/CPU
- Check thermal throttling (Intel Power Gadget)
- Verify MPS availability: `python3 -c "import torch; print(torch.backends.mps.is_available())"`

**Quality:**
- Adjust `num_inference_steps` (higher = better)
- Tune `guidance_scale` (7.5-10.0 recommended)
- Refine prompts for specific styles

## Version History

- **v1.0.0** (2025-10-27): Initial release with SD XL support
  - TypeScript + Python hybrid architecture
  - Apple Silicon MPS optimization
  - Automatic cuisine-based styling
  - Vercel Blob integration
