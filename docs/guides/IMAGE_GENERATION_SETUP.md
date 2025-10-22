# Image Generation Setup Guide

**Zero-Waste Cooking Intelligence Platform**

This guide covers setting up AI image generation for ingredient images using Replicate's Flux Schnell model.

---

## Overview

The image generation system creates professional food photography for ingredients using:
- **Provider**: Replicate API
- **Model**: Flux Schnell (black-forest-labs/flux-schnell)
- **Cost**: ~$0.003 per image
- **Free Tier**: 50 free generations per month
- **Speed**: 1-4 seconds per image
- **License**: Apache 2.0 (commercial use allowed)

---

## Quick Start

### 1. Get Your Replicate API Token

1. Visit **https://replicate.com/account/api-tokens**
2. Sign up or log in
3. Click "Create Token"
4. Copy the token (starts with `r8_`)

### 2. Add to Environment Variables

Add to your `.env.local` file:

```env
# Replicate API for AI Image Generation
REPLICATE_API_TOKEN=r8_your_actual_token_here
```

### 3. Test the Setup

Run a dry-run to verify configuration:

```bash
npx tsx scripts/generate-ingredient-images.ts --dry-run
```

If successful, you'll see:
```
📊 Phase 1 Statistics:
   Total ingredients: 392
   Estimated cost: $1.18 - $1.96
   Estimated time: 13-15 minutes
```

---

## Running Image Generation

### Dry Run (Recommended First)

Check what will be generated without actually generating:

```bash
npx tsx scripts/generate-ingredient-images.ts --dry-run
```

### Phase 1: High Priority (Recommended)

Generate images for most-used ingredients (usage > 10):

```bash
npx tsx scripts/generate-ingredient-images.ts --phase 1
```

- **Ingredients**: ~392
- **Cost**: $1.18 - $1.96
- **Time**: 13-15 minutes

### Phase 2: Medium Priority

Generate images for moderately-used ingredients (usage 1-10):

```bash
npx tsx scripts/generate-ingredient-images.ts --phase 2
```

- **Ingredients**: ~1,176
- **Cost**: $3.53 - $5.88
- **Time**: 39-45 minutes

### Phase 3: Low Priority

Generate images for unused ingredients (usage = 0):

```bash
npx tsx scripts/generate-ingredient-images.ts --phase 3
```

- **Ingredients**: ~1,130
- **Cost**: $3.39 - $5.65
- **Time**: 38-43 minutes

### All Phases

Run all phases sequentially:

```bash
npx tsx scripts/generate-ingredient-images.ts --all
```

- **Total Ingredients**: ~2,698
- **Total Cost**: $8.10 - $13.49
- **Total Time**: ~90-103 minutes

### Resume After Interruption

If generation is interrupted, resume from saved progress:

```bash
npx tsx scripts/generate-ingredient-images.ts --resume
```

---

## Image Generation Details

### Prompt Template

Each ingredient is generated with this professional prompt:

```
Professional food photography of {ingredient_name}, {category},
on a clean kitchen counter, natural window lighting, shallow depth of field,
high resolution, appetizing presentation, authentic texture, detailed,
vibrant colors, overhead view
```

### Image Specifications

- **Format**: JPG
- **Aspect Ratio**: 1:1 (square)
- **Quality**: 90/100
- **Minimum Size**: 10KB
- **Maximum Size**: 5MB
- **Resolution**: High resolution (model default: 1024x1024)

### Storage Structure

Images are saved to:

```
public/images/ingredients/{category}/{ingredient-slug}.jpg
```

Example:
```
public/images/ingredients/vegetable/cherry-tomatoes.jpg
public/images/ingredients/protein/chicken-breast.jpg
public/images/ingredients/dairy/mozzarella-cheese.jpg
```

---

## Progress Tracking

### Progress File

Generation progress is saved to:
```
tmp/image-generation-progress.json
```

Contains:
- Phase number
- Total/processed/successful/failed counts
- Processed ingredient IDs
- Failed ingredients with error details
- Timestamps

### Log File

Detailed logs are written to:
```
tmp/image-generation.log
```

### Phase Reports

After completion, a report is generated:
```
tmp/phase-{N}-report.json
```

Example report structure:
```json
{
  "phase": 1,
  "phaseName": "High Priority",
  "summary": {
    "total": 392,
    "processed": 392,
    "successful": 390,
    "failed": 2,
    "skipped": 0,
    "successRate": "99.5%"
  },
  "timing": {
    "startedAt": "2025-10-22T10:30:00.000Z",
    "completedAt": "2025-10-22T10:45:00.000Z",
    "durationMinutes": 15
  },
  "cost": {
    "estimated": "$1.56",
    "perImage": "$0.003-$0.005",
    "provider": "Replicate (Flux Schnell)"
  },
  "failures": [
    {
      "id": "ingredient-id",
      "name": "problematic-ingredient",
      "error": "Image download failed",
      "attempts": 3
    }
  ]
}
```

---

## Error Handling

### Retry Logic

- **Max Retries**: 3 attempts per ingredient
- **Retry Delay**: 2 seconds between attempts
- **Rate Limiting**: 2 seconds between ingredients

### Common Errors

#### 1. API Token Not Found

```
❌ Error: No AI image generation API key found
   Set REPLICATE_API_TOKEN (recommended) or OPENROUTER_API_KEY in .env.local
```

**Fix**: Add `REPLICATE_API_TOKEN` to `.env.local`

#### 2. API Rate Limit

```
❌ Replicate API error: 429 - Too Many Requests
```

**Fix**: Wait a few minutes and use `--resume` to continue

#### 3. Image Download Failed

```
❌ Failed to download image: Not Found
```

**Fix**: Script will automatically retry. If persists after 3 attempts, ingredient is marked as failed.

#### 4. Image Too Small

```
❌ Image too small: 5.2KB
```

**Fix**: Script validates minimum size (10KB) and will retry with potentially different generation.

---

## Cost Optimization

### Free Tier Strategy

Replicate offers **50 free generations per month**. To maximize free tier:

1. Run Phase 1 first (most valuable ingredients)
2. Split remaining phases across multiple months
3. Use `--dry-run` to verify counts before generating

### Estimated Costs

| Phase | Ingredients | Cost Range | Recommendation |
|-------|-------------|------------|----------------|
| 1 | 392 | $1.18 - $1.96 | **Start here** |
| 2 | 1,176 | $3.53 - $5.88 | Run after Phase 1 |
| 3 | 1,130 | $3.39 - $5.65 | Optional (orphaned ingredients) |
| **All** | **2,698** | **$8.10 - $13.49** | **Full coverage** |

### Budget-Friendly Approach

**Month 1** (Free tier):
```bash
npx tsx scripts/generate-ingredient-images.ts --phase 1
# 392 images, uses 100% of free tier
```

**Month 2** (Paid: ~$3.50):
```bash
npx tsx scripts/generate-ingredient-images.ts --phase 2
# 1,176 images, ~$3.50
```

**Month 3** (Optional: ~$3.40):
```bash
npx tsx scripts/generate-ingredient-images.ts --phase 3
# 1,130 images, ~$3.40
```

---

## Alternative Providers (Not Implemented)

The script is designed to use Replicate exclusively. Other providers are possible but require code changes:

### Stability AI (Not Implemented)

- **Model**: Stable Diffusion XL
- **Cost**: ~$0.01 per image
- **Endpoint**: `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`

### OpenAI DALL-E 3 (Not Implemented)

- **Model**: DALL-E 3
- **Cost**: ~$0.04 per standard quality
- **Endpoint**: `https://api.openai.com/v1/images/generations`

### Why Replicate?

- ✅ **Cheapest**: $0.003 vs $0.01 (Stability) vs $0.04 (OpenAI)
- ✅ **Fastest**: 1-4 seconds (Flux Schnell optimized for speed)
- ✅ **Free Tier**: 50 images/month
- ✅ **High Quality**: Professional food photography results
- ✅ **Apache 2.0 License**: Commercial use allowed

---

## Database Schema

Generated images update the `ingredients` table:

```sql
-- ingredients table
CREATE TABLE ingredients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  image_url TEXT, -- Updated by generation script
  is_suitable_for_image BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Updated Fields**:
- `image_url`: Relative path like `/images/ingredients/vegetable/tomato.jpg`
- `updated_at`: Timestamp of image generation

---

## Monitoring & Validation

### Check Generation Status

```bash
# View progress file
cat tmp/image-generation-progress.json

# View detailed logs
tail -f tmp/image-generation.log

# View phase report
cat tmp/phase-1-report.json
```

### Verify Database Updates

```sql
-- Count ingredients with images
SELECT COUNT(*) FROM ingredients WHERE image_url IS NOT NULL;

-- Check by category
SELECT category, COUNT(*) as with_images
FROM ingredients
WHERE image_url IS NOT NULL
GROUP BY category
ORDER BY with_images DESC;

-- Find failed ingredients (if any)
SELECT name, category, usage_count
FROM ingredients
WHERE image_url IS NULL
  AND is_suitable_for_image = TRUE
  AND usage_count > 10;
```

### Verify Image Files

```bash
# Count generated images
find public/images/ingredients -name "*.jpg" | wc -l

# Check file sizes
find public/images/ingredients -name "*.jpg" -exec ls -lh {} \; | awk '{print $5, $9}'

# Find images by category
ls -lh public/images/ingredients/vegetable/
ls -lh public/images/ingredients/protein/
ls -lh public/images/ingredients/dairy/
```

---

## Troubleshooting

### Script Won't Start

**Check environment variables:**
```bash
grep REPLICATE .env.local
```

**Should output:**
```
REPLICATE_API_TOKEN=r8_...
```

### Generation Fails Immediately

**Test API token:**
```bash
curl -X POST https://api.replicate.com/v1/predictions \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
    "input": {"prompt": "test"}
  }'
```

**Expected**: JSON response with `id` and `status`

**If error**: Token is invalid or expired

### Resume Doesn't Work

**Check progress file exists:**
```bash
ls -l tmp/image-generation-progress.json
```

**If missing**: Cannot resume, start fresh with `--phase N`

### Images Not Showing in App

**Check file permissions:**
```bash
chmod -R 755 public/images/ingredients
```

**Check database URLs match files:**
```sql
SELECT image_url FROM ingredients WHERE image_url IS NOT NULL LIMIT 10;
```

**Should match files in:**
```bash
ls public/images/ingredients/*/*.jpg
```

---

## Best Practices

### Before Starting

1. ✅ Run `--dry-run` first to estimate costs
2. ✅ Verify `REPLICATE_API_TOKEN` is set
3. ✅ Ensure sufficient disk space (~500MB for all images)
4. ✅ Check database connection is stable
5. ✅ Review free tier limits on Replicate dashboard

### During Generation

1. ✅ Monitor logs in real-time: `tail -f tmp/image-generation.log`
2. ✅ Don't interrupt unless necessary (use Ctrl+C if needed)
3. ✅ If interrupted, use `--resume` to continue
4. ✅ Check progress file periodically: `cat tmp/image-generation-progress.json`

### After Generation

1. ✅ Review phase report for failures
2. ✅ Verify database updates with SQL queries
3. ✅ Check generated images visually
4. ✅ Test images display correctly in app
5. ✅ Archive or delete temporary files if no longer needed

---

## Support & Resources

### Documentation Links

- **Replicate API**: https://replicate.com/docs/reference/http
- **Flux Schnell**: https://replicate.com/black-forest-labs/flux-schnell
- **Replicate Account**: https://replicate.com/account
- **Replicate Pricing**: https://replicate.com/pricing

### Project Links

- **Script**: `scripts/generate-ingredient-images.ts`
- **Database Schema**: `src/lib/db/ingredients-schema.ts`
- **Progress Tracking**: `tmp/image-generation-progress.json`
- **Logs**: `tmp/image-generation.log`

---

**Last Updated**: 2025-10-22
**Script Version**: 1.0.0
**Maintained By**: Recipe Manager Team
