# Quick Start: Ingredient Image Generation

**Get professional AI-generated images for 2,698 ingredients in 3 simple steps**

---

## Step 1: Get Your Replicate API Token (2 minutes)

1. Visit: **https://replicate.com/account/api-tokens**
2. Sign up (free, no credit card required for 50 images/month)
3. Click "Create Token"
4. Copy the token (starts with `r8_`)

---

## Step 2: Add Token to .env.local (1 minute)

Open `/Users/masa/Projects/recipe-manager/.env.local` and add:

```env
# Replicate API for AI Image Generation
REPLICATE_API_TOKEN=r8_paste_your_token_here
```

---

## Step 3: Generate Images

### Option A: Test First (Recommended)

See what will be generated without spending credits:

```bash
npx tsx scripts/generate-ingredient-images.ts --phase 1 --dry-run
```

Expected output:
```
📊 Phase 1 Statistics:
   Total ingredients: 392
   Estimated cost: $1.18 - $1.96
   Estimated time: 14-33 minutes

✅ DRY RUN - No images will be generated
```

### Option B: Start Generating Phase 1

Generate images for 392 most-used ingredients:

```bash
npx tsx scripts/generate-ingredient-images.ts --phase 1
```

What happens:
- ⏱️  Takes ~15 minutes
- 💰 Costs ~$1.18-$1.96 (or uses 100% of free tier)
- 📸 Generates 392 professional food photos
- 💾 Saves to `public/images/ingredients/`
- 🗄️  Updates database with image URLs

---

## Monitoring Progress

### Watch logs in real-time:
```bash
tail -f tmp/image-generation.log
```

### Check progress file:
```bash
cat tmp/image-generation-progress.json
```

### View final report (after completion):
```bash
cat tmp/phase-1-report.json
```

---

## If Interrupted

Resume from where it left off:

```bash
npx tsx scripts/generate-ingredient-images.ts --resume
```

---

## All Phases Overview

| Phase | Ingredients | Cost | Time | Recommendation |
|-------|-------------|------|------|----------------|
| **1** | **392** | **$1.18-$1.96** | **~15 min** | **✅ START HERE** |
| 2 | 1,176 | $3.53-$5.88 | ~40 min | Run after Phase 1 |
| 3 | 1,130 | $3.39-$5.65 | ~38 min | Optional (orphaned) |
| **All** | **2,698** | **$8.10-$13.49** | **~93 min** | Full coverage |

---

## Free Tier Strategy

**50 free images/month** - maximize value:

**Month 1** (Free):
```bash
npx tsx scripts/generate-ingredient-images.ts --phase 1
# Uses 100% of free tier for most valuable ingredients
```

**Month 2** (Paid: ~$3.50):
```bash
npx tsx scripts/generate-ingredient-images.ts --phase 2
```

**Month 3** (Optional: ~$3.40):
```bash
npx tsx scripts/generate-ingredient-images.ts --phase 3
```

---

## Troubleshooting

### Error: "No AI image generation API key found"

**Fix**: Add `REPLICATE_API_TOKEN` to `.env.local`

### Error: "REPLICATE_API_TOKEN not found"

**Fix**: Make sure the token starts with `r8_` and is copied correctly

### Images not showing in app

**Fix**: Restart Next.js dev server:
```bash
pnpm dev
```

---

## What You Get

Each ingredient gets a professional food photography image with:

✅ Clean kitchen counter setting
✅ Natural window lighting
✅ Shallow depth of field
✅ High resolution (1024x1024)
✅ Appetizing presentation
✅ Authentic texture and colors
✅ Overhead view

**Example prompts:**
- "Professional food photography of cherry tomatoes, vegetables, on a clean kitchen counter, natural window lighting..."
- "Professional food photography of chicken breast, proteins, on a clean kitchen counter, natural window lighting..."

---

## Need Help?

See full documentation: `docs/guides/IMAGE_GENERATION_SETUP.md`

Or check the script: `scripts/generate-ingredient-images.ts`

---

**Quick Commands Cheat Sheet:**

```bash
# See help
npx tsx scripts/generate-ingredient-images.ts

# Dry run (no cost)
npx tsx scripts/generate-ingredient-images.ts --phase 1 --dry-run

# Generate Phase 1 (most valuable)
npx tsx scripts/generate-ingredient-images.ts --phase 1

# Resume after interruption
npx tsx scripts/generate-ingredient-images.ts --resume

# Generate all phases
npx tsx scripts/generate-ingredient-images.ts --all

# Monitor progress
tail -f tmp/image-generation.log
cat tmp/image-generation-progress.json
```

---

**Ready to start?** Run the dry-run first to see what will be generated!

```bash
npx tsx scripts/generate-ingredient-images.ts --phase 1 --dry-run
```
