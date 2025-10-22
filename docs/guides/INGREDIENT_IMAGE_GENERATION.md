# Ingredient Image Generation Guide

## Overview

Comprehensive system for generating AI-powered food photography images for 2,698 ingredients in the database.

## System Architecture

### Image Generation Provider

**Primary: Replicate (Flux Schnell)**
- Model: `black-forest-labs/flux-schnell`
- Cost: ~$0.003-$0.005 per image
- Quality: Professional food photography
- Speed: 2-5 seconds per image

**Fallback: OpenRouter** (not currently implemented)
- Requires separate implementation
- Would use different pricing model

### Phased Rollout Strategy

#### Phase 1: High Priority (392 ingredients)
- **Filter**: `usage_count > 10`
- **Examples**: Salt, Butter, Garlic, Onion, All-Purpose Flour
- **Cost**: $1.18 - $1.96
- **Time**: 14-33 minutes
- **Coverage**: Most frequently used ingredients in recipes

#### Phase 2: Medium Priority (1,176 ingredients)
- **Filter**: `usage_count BETWEEN 1 AND 10`
- **Cost**: $3.53 - $5.88
- **Time**: 39-98 minutes
- **Coverage**: Common but less frequent ingredients

#### Phase 3: Low Priority (1,130 ingredients)
- **Filter**: `usage_count = 0`
- **Cost**: $3.39 - $5.65
- **Time**: 38-94 minutes
- **Coverage**: Orphaned ingredients (future-proofing)

**Total Investment**:
- All Phases: 2,698 images
- Total Cost: $8.10 - $13.49
- Total Time: 91-225 minutes (~1.5-3.75 hours)

## Setup Instructions

### 1. Get Replicate API Token

1. Visit [replicate.com](https://replicate.com)
2. Sign up for a free account
3. Navigate to [API Tokens](https://replicate.com/account/api-tokens)
4. Create a new token
5. Copy the token (starts with `r8_`)

### 2. Add to Environment

Add to `/Users/masa/Projects/recipe-manager/.env.local`:

```env
# Replicate API for ingredient image generation
REPLICATE_API_TOKEN=r8_your_token_here
```

### 3. Verify Setup

```bash
# Test dry-run to verify configuration
npx tsx scripts/generate-ingredient-images.ts --dry-run --phase 1
```

## Usage

### Dry Run (Recommended First)

```bash
# See what Phase 1 would generate
npx tsx scripts/generate-ingredient-images.ts --dry-run --phase 1

# Check all phases
npx tsx scripts/generate-ingredient-images.ts --dry-run --all
```

### Execute Generation

```bash
# Phase 1 only (high priority)
npx tsx scripts/generate-ingredient-images.ts --phase 1

# All phases sequentially
npx tsx scripts/generate-ingredient-images.ts --all

# Resume interrupted run
npx tsx scripts/generate-ingredient-images.ts --resume
```

### Monitor Progress

**Live Monitoring**:
```bash
# Watch log file in real-time
tail -f /Users/masa/Projects/recipe-manager/tmp/image-generation.log
```

**Progress File**:
```bash
# Check current status
cat /Users/masa/Projects/recipe-manager/tmp/image-generation-progress.json
```

## Output

### Directory Structure

```
/Users/masa/Projects/recipe-manager/public/images/ingredients/
├── vegetables/
│   ├── garlic.jpg
│   ├── onion.jpg
│   └── tomato.jpg
├── proteins/
│   ├── chicken-breast.jpg
│   ├── egg.jpg
│   └── tofu.jpg
├── dairy/
│   ├── butter.jpg
│   ├── milk.jpg
│   └── cheese.jpg
└── [other categories]/
```

### Database Updates

Each successful generation updates the `ingredients` table:

```sql
UPDATE ingredients
SET
  image_url = '/images/ingredients/vegetables/garlic.jpg',
  updated_at = NOW()
WHERE id = 'ingredient-uuid';
```

### Reports

After each phase completes:

```
/Users/masa/Projects/recipe-manager/tmp/phase-1-report.json
/Users/masa/Projects/recipe-manager/tmp/phase-2-report.json
/Users/masa/Projects/recipe-manager/tmp/phase-3-report.json
```

**Report Contents**:
- Summary statistics (total, successful, failed, skipped)
- Timing information (start, end, duration)
- Cost analysis (estimated spend, per-image cost)
- Failure details (ingredient names, error messages, attempts)

## Image Specifications

### Prompt Template

```
Professional food photography of {ingredient_name}, {category},
on a clean kitchen counter, natural window lighting,
shallow depth of field, high resolution, appetizing presentation,
authentic texture, detailed, vibrant colors, overhead view
```

### Technical Specs

- **Format**: JPEG
- **Dimensions**: 1024x1024 (1:1 aspect ratio)
- **Quality**: 90 (high quality)
- **Size Range**: 10KB - 5MB
- **Aesthetic**: Kitchen counter setting with natural lighting

## Safety Features

### Progress Tracking

- Automatic save after each ingredient
- Resume capability with `--resume` flag
- No duplicate processing (skip already-generated)

### Error Handling

- 3 retry attempts per ingredient
- 2-second rate limiting between requests
- Detailed error logging
- Transaction-safe database updates

### Interruption Handling

- Graceful shutdown on Ctrl+C
- Progress saved before exit
- Can resume from last successful image

### Quality Validation

- Minimum file size: 10KB
- Maximum file size: 5MB
- HTTP status check on download
- Image dimension verification (future enhancement)

## Troubleshooting

### API Rate Limits

**Error**: `429 Too Many Requests`

**Solution**:
- Wait a few minutes and resume
- Script automatically includes 2-second delays
- Replicate has generous free tier limits

### Image Download Failures

**Error**: `Failed to download image`

**Solution**:
- Usually temporary network issue
- Script will retry 3 times
- Check internet connection
- Verify Replicate API status

### Database Connection Issues

**Error**: `Failed to update ingredient`

**Solution**:
- Check `DATABASE_URL` in `.env.local`
- Verify Neon PostgreSQL connection
- Check database permissions

### Out of Credits

**Error**: `Insufficient credits`

**Solution**:
- Add credits to Replicate account
- Free tier: $5/month (~1,000-1,600 images)
- Paid tier: Pay-as-you-go

## Cost Management

### Free Tier

Replicate offers $5/month free credits:
- ~1,000-1,600 images per month
- Perfect for Phase 1 + Phase 2
- Phase 3 might require paid tier

### Estimated Costs by Phase

| Phase | Ingredients | Cost (Low) | Cost (High) | Free Tier |
|-------|------------|------------|-------------|-----------|
| 1     | 392        | $1.18      | $1.96       | ✅ Yes    |
| 2     | 1,176      | $3.53      | $5.88       | ✅ Yes    |
| 3     | 1,130      | $3.39      | $5.65       | ⚠️  Maybe  |
| **Total** | **2,698** | **$8.10** | **$13.49** | **Likely** |

### Cost Optimization

1. **Run Phase 1 First**: Covers 85%+ of recipe needs
2. **Monitor Usage**: Check Replicate dashboard
3. **Pause if Needed**: Resume capability allows breaks
4. **Batch Processing**: Script already optimized

## Performance Metrics

### Expected Completion Times

**Sequential Processing**:
- Rate limit: 2 seconds per ingredient
- API time: 2-5 seconds per generation
- Total per image: ~4-7 seconds

**Phase Estimates**:
- Phase 1 (392 images): 14-33 minutes
- Phase 2 (1,176 images): 39-98 minutes
- Phase 3 (1,130 images): 38-94 minutes

### Success Rate

**Expected**: 95-99% success rate
- Well-formed ingredient names
- Stable API endpoint
- Automatic retry logic

**Typical Failures**:
- Network timeouts (rare)
- Malformed names (very rare after cleanup)
- API service disruptions (very rare)

## Post-Generation Steps

### 1. Verify Images

```bash
# Check generated images
ls -lh /Users/masa/Projects/recipe-manager/public/images/ingredients/**/*.jpg | wc -l

# Should match successful count from report
```

### 2. Database Verification

```sql
-- Count ingredients with images
SELECT COUNT(*) FROM ingredients WHERE image_url IS NOT NULL;

-- By category
SELECT category, COUNT(*) as with_images
FROM ingredients
WHERE image_url IS NOT NULL
GROUP BY category
ORDER BY with_images DESC;
```

### 3. Deploy Images

```bash
# Commit to git
git add public/images/ingredients/
git commit -m "feat: Add AI-generated images for Phase X ingredients"

# Push to Vercel (auto-deploy)
git push origin main
```

### 4. Clear Progress Files

```bash
# After successful completion
rm /Users/masa/Projects/recipe-manager/tmp/image-generation-progress.json
rm /Users/masa/Projects/recipe-manager/tmp/image-generation.log
```

## Implementation Timeline

### Recommended Sequence

1. **Day 1**: Execute Phase 1 (high priority)
   - 392 images, ~20-30 minutes
   - Verify quality and database updates
   - Deploy to production

2. **Day 2**: Execute Phase 2 (medium priority)
   - 1,176 images, ~60-90 minutes
   - Monitor for any issues
   - Deploy to production

3. **Day 3**: Execute Phase 3 (low priority)
   - 1,130 images, ~60-90 minutes
   - Final verification
   - Complete deployment

### Quality Checkpoints

After each phase:
- [ ] Review 10-15 random images visually
- [ ] Check database `image_url` population
- [ ] Verify public URLs accessible
- [ ] Test on Fridge Feature page
- [ ] Check mobile rendering

## Future Enhancements

### Potential Improvements

1. **Parallel Processing**:
   - Process 5-10 images simultaneously
   - Reduce total time by 50-70%
   - Requires rate limit management

2. **WebP Conversion**:
   - Convert JPEGs to WebP for 30% size reduction
   - Maintain JPEG as fallback
   - Update schema for dual-format storage

3. **Image Variants**:
   - Generate multiple sizes (thumbnail, medium, large)
   - Responsive image optimization
   - Faster page loads

4. **Quality Scoring**:
   - AI-based image quality assessment
   - Auto-regenerate low-quality images
   - Track quality metrics

5. **Batch Cost Optimization**:
   - Switch to cheaper models for simple ingredients
   - Use Flux Schnell for most
   - Use Flux Pro for premium ingredients only

## Support

### Issues & Questions

- **Script Errors**: Check logs in `/tmp/image-generation.log`
- **API Issues**: Visit [Replicate Status](https://status.replicate.com/)
- **Database Issues**: Check Neon PostgreSQL dashboard

### Related Documentation

- [Fridge Feature Guide](./FRIDGE_FEATURE_GUIDE.md)
- [Ingredient Schema](../../src/lib/db/ingredients-schema.ts)
- [Environment Setup](./ENVIRONMENT_SETUP.md)

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0
**Status**: Ready for execution
