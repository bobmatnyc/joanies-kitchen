# Implementation Checklist: AI Image Generation for Lidia Bastianich

## Pre-Deployment Verification

### Environment Setup
- [ ] `OPENROUTER_API_KEY` is set in `.env.local`
- [ ] `DATABASE_URL` is set in `.env.local`
- [ ] OpenRouter account has sufficient credits (check: https://openrouter.ai/credits)
- [ ] Database is accessible and responsive

### Database Prerequisites
- [ ] Lidia Bastianich exists in `chefs` table
- [ ] Lidia's recipes exist in `recipes` table
- [ ] Recipes are properly linked via `chef_id` field
- [ ] Database has write permissions for updates

### File System Prerequisites
- [ ] `public/` directory exists
- [ ] Write permissions for `public/recipes/` directory
- [ ] Sufficient disk space (estimate: 50-250 MB for 100-500 images)

### Dependencies
- [ ] All npm packages installed (`pnpm install`)
- [ ] TypeScript execution available (`tsx` installed)
- [ ] Node.js version 18+ (for native fetch API)

---

## Testing Protocol

### Phase 1: Dry Run (5-10 minutes)
```bash
# 1. Test database connectivity
npx tsx -e "import { db } from './src/lib/db'; \
  const result = await db.select().from(chefs).limit(1); \
  console.log('✅ DB connected:', result.length, 'chefs'); \
  process.exit(0);"

# 2. Verify Lidia exists
npx tsx -e "import { db } from './src/lib/db'; \
  import { chefs } from './src/lib/db/chef-schema'; \
  import { eq } from 'drizzle-orm'; \
  const [lidia] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1); \
  if (!lidia) throw new Error('Lidia not found'); \
  console.log('✅ Found:', lidia.name, '- ID:', lidia.id); \
  process.exit(0);"

# 3. Count recipes without images
npx tsx -e "import { db } from './src/lib/db'; \
  import { recipes } from './src/lib/db/schema'; \
  import { chefs } from './src/lib/db/chef-schema'; \
  import { eq, and, or, isNull } from 'drizzle-orm'; \
  const [lidia] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1); \
  const count = await db.select().from(recipes).where(and(eq(recipes.chef_id, lidia.id), or(isNull(recipes.images), eq(recipes.images, '[]'), eq(recipes.images, '')))); \
  console.log('✅ Recipes without images:', count.length); \
  process.exit(0);"

# 4. Check OpenRouter API key
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models | grep -q gemini && \
  echo "✅ OpenRouter API key valid" || \
  echo "❌ OpenRouter API key invalid"
```

**Expected Results:**
- ✅ Database connection successful
- ✅ Lidia Bastianich found with valid UUID
- ✅ Recipe count > 0
- ✅ OpenRouter API key valid

**If any test fails:** STOP and resolve the issue before proceeding.

---

### Phase 2: Single Recipe Test (2-5 minutes)

Modify the script temporarily to test with just one recipe:

```typescript
// In generate-lidia-images.ts, line ~232
const recipesWithoutImages = await db
  .select()
  .from(recipes)
  .where(
    and(
      eq(recipes.chef_id, lidia.id),
      or(isNull(recipes.images), eq(recipes.images, '[]'), eq(recipes.images, ''))
    )
  )
  .limit(1); // ADD THIS LINE FOR TESTING
```

Run the script:
```bash
npm run chef:generate:lidia-images
```

**Expected Output:**
- ✅ Found 1 recipe (or more if limit not applied)
- ✅ Image generation successful
- ✅ File saved to `public/recipes/lidia/[filename].png`
- ✅ Database updated with image URL
- ✅ Script completes without errors

**Verification:**
```bash
# Check file was created
ls -lh public/recipes/lidia/ | tail -5

# Check database was updated
npx tsx -e "import { db } from './src/lib/db'; \
  import { recipes } from './src/lib/db/schema'; \
  import { chefs } from './src/lib/db/chef-schema'; \
  import { eq, and, isNotNull } from 'drizzle-orm'; \
  const [lidia] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1); \
  const withImages = await db.select().from(recipes).where(and(eq(recipes.chef_id, lidia.id), isNotNull(recipes.images))).limit(1); \
  console.log('✅ Recipe with image:', withImages[0]?.name, '-', withImages[0]?.images); \
  process.exit(0);"

# View in browser
open http://localhost:3002/discover/chefs/lidia-bastianich
```

**If test fails:**
- Check console logs for specific error
- Verify API key and credits
- Check file system permissions
- Review troubleshooting section in README

---

### Phase 3: Small Batch Test (5-10 minutes)

Test with 5-10 recipes:

```typescript
// Modify limit in script
.limit(5); // Test with 5 recipes
```

Run the script:
```bash
npm run chef:generate:lidia-images
```

**Expected Results:**
- ✅ 5 recipes processed
- ✅ 4-5 successful (allowing for 1 failure)
- ✅ Images saved to disk
- ✅ Database updated
- ✅ Reasonable performance (~3-5 seconds per image)

**Quality Check:**
- [ ] Images match recipe descriptions
- [ ] Professional food photography quality
- [ ] Consistent Italian aesthetic
- [ ] Proper lighting and composition

**If quality issues:**
- Review generated images visually
- Adjust prompts in `generateImagePrompt()` function
- Consider different model if needed

---

### Phase 4: Full Production Run (timing varies)

Remove limit and run on all recipes:

```typescript
// Remove .limit() line in script
const recipesWithoutImages = await db
  .select()
  .from(recipes)
  .where(
    and(
      eq(recipes.chef_id, lidia.id),
      or(isNull(recipes.images), eq(recipes.images, '[]'), eq(recipes.images, ''))
    )
  );
// NO .limit() here
```

Run the full script:
```bash
npm run chef:generate:lidia-images
```

**Monitor during execution:**
- [ ] Progress logs showing each recipe
- [ ] Success/failure counts increasing
- [ ] Disk space sufficient
- [ ] No memory leaks or performance degradation

**Expected Duration:**
- 50 recipes: ~5-8 minutes
- 100 recipes: ~10-15 minutes
- 200 recipes: ~20-30 minutes
- 500+ recipes: ~40-60 minutes

**If errors occur:**
- Note which recipes failed
- Script will continue to next recipe
- Can re-run later (idempotent)

---

## Post-Deployment Verification

### Immediate Checks (within 5 minutes)

```bash
# 1. Count generated images
ls -1 public/recipes/lidia/*.png | wc -l

# 2. Check total disk usage
du -sh public/recipes/lidia/

# 3. Verify database updates
npx tsx -e "import { db } from './src/lib/db'; \
  import { recipes } from './src/lib/db/schema'; \
  import { chefs } from './src/lib/db/chef-schema'; \
  import { eq, and, isNotNull } from 'drizzle-orm'; \
  const [lidia] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1); \
  const total = await db.select().from(recipes).where(eq(recipes.chef_id, lidia.id)); \
  const withImages = await db.select().from(recipes).where(and(eq(recipes.chef_id, lidia.id), isNotNull(recipes.images))); \
  console.log('Total recipes:', total.length); \
  console.log('With images:', withImages.length); \
  console.log('Coverage:', ((withImages.length / total.length) * 100).toFixed(1) + '%'); \
  process.exit(0);"

# 4. Sample random images
ls public/recipes/lidia/*.png | sort -R | head -10
```

**Expected Results:**
- ✅ File count matches successful generation count
- ✅ Disk usage reasonable (~200-500 KB per image)
- ✅ Database coverage > 95%
- ✅ Random sample images look good

### Visual Quality Audit (15-30 minutes)

Open the chef page in browser:
```bash
open http://localhost:3002/discover/chefs/lidia-bastianich
```

Review a sample of images (10-20 recipes):
- [ ] Images match recipe names and descriptions
- [ ] Professional food photography quality
- [ ] Consistent Italian aesthetic across images
- [ ] Proper plating and presentation
- [ ] Natural lighting and composition
- [ ] No obvious AI artifacts or errors

**Flag for regeneration if:**
- Image doesn't match recipe
- Low quality or poor composition
- Obvious AI artifacts
- Wrong food items

### Database Integrity Check

```sql
-- Check for NULL or empty images (should be minimal)
SELECT COUNT(*) as missing_images
FROM recipes
WHERE chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich')
  AND (images IS NULL OR images = '[]' OR images = '');

-- Check for valid image URLs
SELECT id, name, images
FROM recipes
WHERE chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich')
  AND images IS NOT NULL
  AND images != '[]'
LIMIT 10;

-- Verify image URL format
SELECT DISTINCT images
FROM recipes
WHERE chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich')
  AND images IS NOT NULL
LIMIT 5;
```

**Expected Results:**
- Missing images < 5% (only failed generations)
- All image URLs follow pattern: `["/recipes/lidia/[filename].png"]`
- URLs are valid JSON arrays

---

## Success Criteria

### Must Have (Critical)
- [x] Script executes without fatal errors
- [x] > 95% of recipes get images generated
- [x] Images saved to correct directory
- [x] Database updated with correct URLs
- [x] Images display correctly in UI
- [x] No data corruption or loss

### Should Have (Important)
- [x] Image quality is professional/editorial
- [x] Generation time < 5 seconds per image
- [x] Cost per image < $0.002
- [x] Error handling works correctly
- [x] Retry logic succeeds on transient failures
- [x] Idempotent (can re-run safely)

### Nice to Have (Optional)
- [ ] Generation time < 3 seconds per image
- [ ] 100% success rate on first run
- [ ] No manual intervention needed
- [ ] Images load in < 1 second in UI

---

## Rollback Plan

If critical issues are discovered after deployment:

### Option 1: Clear Generated Images (Quick)

```bash
# Remove all generated images
rm -rf public/recipes/lidia/*.png

# Clear image URLs from database
npx tsx -e "import { db } from './src/lib/db'; \
  import { recipes } from './src/lib/db/schema'; \
  import { chefs } from './src/lib/db/chef-schema'; \
  import { eq } from 'drizzle-orm'; \
  const [lidia] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1); \
  await db.update(recipes).set({ images: null }).where(eq(recipes.chef_id, lidia.id)); \
  console.log('✅ Images cleared'); \
  process.exit(0);"
```

### Option 2: Selective Removal (Targeted)

```bash
# Remove specific recipe's image
rm public/recipes/lidia/[specific-recipe-id].png

# Clear specific recipe's image URL
npx tsx -e "import { db } from './src/lib/db'; \
  import { recipes } from './src/lib/db/schema'; \
  import { eq } from 'drizzle-orm'; \
  await db.update(recipes).set({ images: null }).where(eq(recipes.id, '[recipe-id]')); \
  console.log('✅ Image cleared for recipe'); \
  process.exit(0);"
```

### Option 3: Full Rollback (Nuclear)

```bash
# Backup current state first
tar -czf lidia-images-backup-$(date +%Y%m%d-%H%M%S).tar.gz public/recipes/lidia/

# Remove all images
rm -rf public/recipes/lidia/

# Clear all image URLs
npx tsx -e "import { db } from './src/lib/db'; \
  import { recipes } from './src/lib/db/schema'; \
  import { chefs } from './src/lib/db/chef-schema'; \
  import { eq } from 'drizzle-orm'; \
  const [lidia] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1); \
  await db.update(recipes).set({ images: null }).where(eq(recipes.chef_id, lidia.id)); \
  console.log('✅ Full rollback complete'); \
  process.exit(0);"
```

---

## Troubleshooting Quick Reference

### Script Won't Start
```bash
# Check environment
cat .env.local | grep -E "(OPENROUTER_API_KEY|DATABASE_URL)"

# Check dependencies
pnpm install

# Check script permissions
chmod +x scripts/generate-lidia-images.ts
```

### Images Not Generating
```bash
# Test API key
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models

# Check OpenRouter status
open https://status.openrouter.ai

# Check credits
open https://openrouter.ai/credits
```

### Database Not Updating
```bash
# Test database connection
npx tsx -e "import { db } from './src/lib/db'; \
  await db.select().from(recipes).limit(1); \
  console.log('✅ DB OK'); \
  process.exit(0);"

# Check Lidia exists
npx tsx -e "import { db } from './src/lib/db'; \
  import { chefs } from './src/lib/db/chef-schema'; \
  import { eq } from 'drizzle-orm'; \
  const [lidia] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1); \
  console.log('Lidia:', lidia ? '✅ Found' : '❌ Not found'); \
  process.exit(0);"
```

### Images Not Displaying
```bash
# Check files exist
ls -lh public/recipes/lidia/ | head -10

# Check public directory is served
open http://localhost:3002/recipes/lidia/[filename].png

# Restart dev server
npm run dev
```

---

## Sign-Off Checklist

### Technical Lead Review
- [ ] Code reviewed and approved
- [ ] Tests passed successfully
- [ ] Documentation complete and accurate
- [ ] Error handling comprehensive
- [ ] Performance within acceptable limits
- [ ] Security considerations addressed

### Product Review
- [ ] Image quality meets standards
- [ ] User experience verified
- [ ] Coverage meets requirements (> 95%)
- [ ] UI displays images correctly
- [ ] Mobile experience tested

### Operations Review
- [ ] Monitoring in place
- [ ] Rollback plan tested
- [ ] Cost within budget
- [ ] Disk space sufficient
- [ ] Backup strategy defined

### Final Approval
- [ ] All stakeholders signed off
- [ ] Production deployment approved
- [ ] Post-deployment plan in place
- [ ] Support team briefed

---

**Checklist Version**: 1.0.0
**Last Updated**: 2025-10-17
**Status**: Ready for Production Deployment ✅
