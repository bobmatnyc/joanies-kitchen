# Quick Start: Generate AI Images for Lidia's Recipes

## TL;DR

Generate professional food photography for all Lidia Bastianich recipes in 3 steps:

```bash
# 1. Verify environment is configured
cat .env.local | grep -E "(OPENROUTER_API_KEY|DATABASE_URL)"

# 2. Run the generator
npm run chef:generate:lidia-images

# 3. View results
open http://localhost:3002/discover/chefs/lidia-bastianich
```

---

## Prerequisites Checklist

- [ ] `OPENROUTER_API_KEY` is set in `.env.local`
- [ ] `DATABASE_URL` is set in `.env.local`
- [ ] Lidia Bastianich exists in database (run `npx tsx scripts/import-chefs.ts` if not)
- [ ] Recipes are linked to Lidia via `chef_id`
- [ ] OpenRouter account has credits (check at https://openrouter.ai/credits)

---

## Basic Usage

### Option 1: Using npm script (recommended)

```bash
npm run chef:generate:lidia-images
```

### Option 2: Direct execution

```bash
npx tsx scripts/generate-lidia-images.ts
```

---

## What To Expect

### Runtime
- **Small batch** (1-50 recipes): 1-3 minutes
- **Medium batch** (50-200 recipes): 5-15 minutes
- **Large batch** (200+ recipes): 15-60 minutes

### Output
```
🖼️  AI IMAGE GENERATION FOR LIDIA BASTIANICH RECIPES

✅ Found: Lidia Bastianich
📊 Found 125 recipes without images
🎨 Generating images...

[1/125] Risotto alla Milanese
   🎉 Successfully generated and saved image!

...

✅ Successful: 120
❌ Failed:     5
📝 Total:      125
```

### Results
- **Images**: Saved to `public/recipes/lidia/`
- **Database**: Updated with image URLs in `recipes.images` field
- **Format**: PNG, 1:1 aspect ratio, ~200-500 KB each

---

## Common Issues & Quick Fixes

### ❌ "Chef not found"
```bash
# Fix: Import chefs first
npx tsx scripts/import-chefs.ts
```

### ❌ "API key invalid"
```bash
# Fix: Check your API key
cat .env.local | grep OPENROUTER_API_KEY
# Get a new key at: https://openrouter.ai/keys
```

### ❌ "Rate limit exceeded"
```bash
# Fix: Wait 5 minutes and retry
# The script will skip already-processed recipes
npm run chef:generate:lidia-images
```

### ❌ "All recipes already have images"
```bash
# This is normal! Script is idempotent.
# To regenerate, clear images in database first:

# SQL to clear images for specific recipes:
# UPDATE recipes SET images = NULL
# WHERE chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich');
```

---

## Cost & Performance

### Estimated Costs
- **Per image**: ~$0.001-0.002 (negligible)
- **100 images**: ~$0.10-0.20
- **500 images**: ~$0.50-1.00

### Performance
- **Generation speed**: ~3-5 seconds per image
- **Retry logic**: 3 attempts with 2-second delays
- **Rate limiting**: 1-second delay between recipes

---

## Verification Steps

### 1. Check database
```sql
SELECT
  COUNT(*) as total_recipes,
  COUNT(images) FILTER (WHERE images != '[]' AND images IS NOT NULL) as with_images
FROM recipes
WHERE chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich');
```

### 2. View generated files
```bash
ls -lh public/recipes/lidia/ | head -20
```

### 3. Check in browser
Visit: http://localhost:3002/discover/chefs/lidia-bastianich

---

## Advanced Options

### Test with specific recipes

Edit `scripts/generate-lidia-images.ts` and modify the query:

```typescript
// Add limit for testing
const recipesWithoutImages = await db
  .select()
  .from(recipes)
  .where(...)
  .limit(5); // Test with just 5 recipes
```

### Change image aspect ratio

Edit constants at top of script:

```typescript
const ASPECT_RATIO = '16:9'; // Try: '1:1', '3:2', '16:9'
```

### Customize prompts

Modify the `generateImagePrompt()` function for different styles.

---

## Support

For detailed documentation, see:
- **Full Guide**: `scripts/README-GENERATE-LIDIA-IMAGES.md`
- **Project Docs**: `CLAUDE.md`
- **OpenRouter Docs**: https://openrouter.ai/docs

---

**Quick Start Guide** | Last Updated: 2025-10-17 | v1.0.0
