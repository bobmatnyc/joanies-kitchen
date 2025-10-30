# FLUX.1 Meal Image Generation - Migration Summary

## Overview

Successfully migrated meal image generation from Stable Diffusion XL to FLUX.1-schnell for faster, higher-quality image generation.

## Changes Made

### 1. Updated TypeScript Meal Generator
**File**: `scripts/generate-meal-images-from-recipes.ts`

#### Key Changes:
- **Model**: SD XL → FLUX.1-schnell
- **Steps**: 30 → 4 (FLUX.1 optimized)
- **Backend**: Uses `~/ai-models/scripts/flux` wrapper
- **Authentication**: Added HF token validation

#### New Functions Added:
```typescript
checkHuggingFaceAuth(): void
  - Checks for HF_TOKEN environment variable
  - Checks for ~/.cache/huggingface/token file
  - Provides clear error messages with instructions

generateImage(prompt: string, outputPath: string): Promise<void>
  - Uses FLUX.1-schnell via ~/ai-models/scripts/flux
  - Parameters: --width 1024 --height 1024 --steps 4
  - Optimized for Apple Silicon (MPS backend)
```

### 2. Updated Documentation
- Help text now mentions FLUX.1-schnell
- Added authentication requirements
- Updated usage instructions

## Performance Improvements

| Metric | SD XL | FLUX.1-schnell | Improvement |
|--------|-------|----------------|-------------|
| Steps | 30 | 4 | 7.5x fewer |
| Expected Time | ~57s | 15-30s | ~2-3x faster |
| Quality | Good | State-of-the-art | Better |
| Model Size | ~7GB | ~16GB | Larger but better |

## Architecture

```
TypeScript Meal Generator
    ↓
~/ai-models/scripts/flux (wrapper)
    ↓
~/ai-models/scripts/flux_generate.py
    ↓
FLUX.1-schnell model (Hugging Face)
    ↓
MPS backend (Apple Silicon GPU)
    ↓
Generated PNG image
    ↓
Vercel Blob Storage
    ↓
Database Update
```

## Requirements

### 1. Hugging Face Authentication
FLUX.1 models require HF authentication. You must:

1. **Create HF Account**: https://huggingface.co/join
2. **Accept License**: https://huggingface.co/black-forest-labs/FLUX.1-schnell
3. **Generate Token**: https://huggingface.co/settings/tokens
4. **Authenticate** (choose one method):
   - Run: `~/ai-models/scripts/setup_hf_auth.sh`
   - Run: `source ~/ai-models/venv/bin/activate && huggingface-cli login`
   - Set: `export HF_TOKEN=hf_your_token_here`

### 2. FLUX.1 Infrastructure
Already installed at `~/ai-models/`:
- ✅ FLUX wrapper: `~/ai-models/scripts/flux`
- ✅ Generation script: `~/ai-models/scripts/flux_generate.py`
- ✅ Virtual environment: `~/ai-models/venv/`
- ✅ Auth setup script: `~/ai-models/scripts/setup_hf_auth.sh`

## Usage

### Generate Image for Specific Meal
```bash
npx tsx scripts/generate-meal-images-from-recipes.ts --meal-slug joanies-sunday-lunch
```

### Generate Images for All Meals Without Images
```bash
npx tsx scripts/generate-meal-images-from-recipes.ts --all
```

### Help
```bash
npx tsx scripts/generate-meal-images-from-recipes.ts --help
```

## Expected Output

```
🔍 Looking for meal: joanies-sunday-lunch

✅ HF_TOKEN environment variable found

================================================================================
📋 Processing: Joanie's Sunday Lunch
   Recipes: Roast Chicken, Mashed Potatoes, Green Beans
================================================================================

💭 Prompt:
Professional overhead food photography of a complete British Sunday meal...

🎨 Starting FLUX.1 image generation...
   Model: FLUX.1-schnell (4 steps, optimized for speed)

Loading FLUX.1 model: black-forest-labs/FLUX.1-schnell
Using device: mps
Model loaded in 3.45 seconds

Generating image:
  Prompt: Professional overhead food photography...
  Size: 1024x1024
  Steps: 4
  Guidance: 0.0

Image generated in 18.32 seconds
Saved to: /Users/masa/Projects/joanies-kitchen/tmp/meal-images/joanies-sunday-lunch-1730123456.png

✅ Image generation completed

📤 Uploading to Vercel Blob...
✅ Uploaded: https://abc123xyz.public.blob.vercel-storage.com/meals/meal-id-hash.png

✅ Updated meal with image URL
🗑️  Cleaned up temp file

✅ Completed: Joanie's Sunday Lunch
   Image URL: https://abc123xyz.public.blob.vercel-storage.com/meals/meal-id-hash.png
```

## First Run Notes

### Model Download
On first run, FLUX.1-schnell model will be downloaded:
- Size: ~16GB
- Location: `~/ai-models/models/`
- Time: Depends on internet speed
- Subsequent runs: Use cached model (no download)

### Model Loading
- First load: ~3-5 seconds
- Memory usage: ~18GB RAM
- GPU: Apple Silicon MPS
- Falls back to CPU if MPS unavailable

## Troubleshooting

### Error: "Not logged in"
**Solution**: Complete HF authentication steps above

### Error: "FLUX wrapper not found"
**Check**:
```bash
ls -la ~/ai-models/scripts/flux
ls -la ~/ai-models/scripts/flux_generate.py
```
**Solution**: Ensure FLUX.1 infrastructure is installed at `~/ai-models/`

### Error: "Model loading failed"
**Causes**:
- FLUX.1-schnell license not accepted
- No internet connection for first download
- Insufficient disk space (~16GB needed)

**Solutions**:
1. Accept license: https://huggingface.co/black-forest-labs/FLUX.1-schnell
2. Check internet connection
3. Free up disk space: `df -h ~/ai-models/models/`

### Error: "MPS not available"
**Info**: FLUX will automatically fall back to CPU
**Impact**: Generation will be slower (~60-90s instead of 15-30s)
**Solution**: This is expected on non-Apple Silicon machines

### Slow Generation
**Expected times**:
- First run: 3-5s (model load) + 15-30s (generation) = 18-35s total
- Subsequent runs: 15-30s (model cached in memory)
- CPU fallback: 60-90s

**If much slower**:
- Check CPU/GPU usage
- Check available RAM (~18GB needed)
- Check background processes

## Code Quality

### Changes Summary
- **Net LOC Impact**: +47 lines (authentication check + FLUX integration)
- **Functions Added**: 1 (checkHuggingFaceAuth)
- **Functions Modified**: 2 (generateImage, main)
- **Dependencies Added**: 1 (os module)
- **Tests Required**: Manual testing with real meal data

### Testing Checklist
- [ ] Authentication check works (with and without HF_TOKEN)
- [ ] FLUX wrapper is found and executable
- [ ] Image generation completes successfully
- [ ] Generation time is 15-30 seconds
- [ ] Image quality is better than SD XL
- [ ] Upload to Vercel Blob succeeds
- [ ] Database update succeeds
- [ ] Temp file cleanup works

## Comparison: SD XL vs FLUX.1

### SD XL (Previous)
- Model: stabilityai/stable-diffusion-xl-base-1.0
- Steps: 30
- Time: ~57 seconds
- Quality: Good
- Script: scripts/image-gen/meal_image_generator.py
- Backend: Local venv

### FLUX.1-schnell (Current)
- Model: black-forest-labs/FLUX.1-schnell
- Steps: 4
- Time: 15-30 seconds
- Quality: State-of-the-art
- Script: ~/ai-models/scripts/flux
- Backend: Shared ~/ai-models/ infrastructure

### Why FLUX.1?
1. **Faster**: 2-3x speed improvement
2. **Better Quality**: State-of-the-art text-to-image model
3. **Optimized**: Designed for 4-step generation
4. **Efficient**: Better use of Apple Silicon
5. **Maintained**: Uses shared AI models infrastructure

## Next Steps

### Immediate
1. Complete HF authentication (see Requirements section)
2. Test generation with: `npx tsx scripts/generate-meal-images-from-recipes.ts --meal-slug joanies-sunday-lunch`
3. Verify image quality and upload

### Future Enhancements
1. Batch processing for multiple meals
2. Custom prompt templates per cuisine
3. Style variations (overhead, close-up, plated)
4. Image caching to avoid regeneration
5. A/B testing: FLUX.1-schnell vs FLUX.1-dev

## Files Modified

- `scripts/generate-meal-images-from-recipes.ts` (primary changes)
- `FLUX_MIGRATION_SUMMARY.md` (this file)

## Files Referenced

- `~/ai-models/scripts/flux` (FLUX wrapper)
- `~/ai-models/scripts/flux_generate.py` (generation script)
- `~/ai-models/scripts/setup_hf_auth.sh` (auth helper)

## Success Criteria

✅ TypeScript meal generator updated to use FLUX.1
✅ Authentication check implemented
✅ FLUX wrapper integration complete
✅ Error handling and user guidance added
✅ Documentation complete

⏳ Pending user authentication
⏳ Pending test generation
⏳ Pending performance comparison

---

**Created**: 2025-10-28
**Author**: Claude Code (Engineer Agent)
**Migration**: SD XL → FLUX.1-schnell
**Status**: Implementation complete, awaiting authentication
