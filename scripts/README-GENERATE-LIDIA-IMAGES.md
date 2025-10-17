# AI Image Generation for Lidia Bastianich Recipes

## Overview

This script generates professional food photography images for all of Lidia Bastianich's recipes using OpenRouter's Gemini 2.5 Flash Image Preview AI model. It's designed to be idempotent, efficient, and production-ready.

## Features

- ✅ **Automatic Chef Detection**: Finds Lidia Bastianich's chef_id from the database
- ✅ **Smart Filtering**: Only processes recipes without images
- ✅ **AI-Powered Generation**: Uses Google's Gemini 2.5 Flash Image Preview model
- ✅ **Professional Prompts**: Generates editorial-quality food photography prompts
- ✅ **Idempotent**: Skips recipes that already have images
- ✅ **Error Recovery**: Automatic retry logic with exponential backoff
- ✅ **Progress Tracking**: Detailed logging of each step
- ✅ **File Management**: Organizes images in public/recipes/lidia/
- ✅ **Database Updates**: Automatically updates recipe records with image URLs

## Prerequisites

### Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-...  # Your OpenRouter API key
DATABASE_URL=postgresql://...     # Neon PostgreSQL connection string

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3002  # App URL for OpenRouter referrer
```

### Database Requirements

1. **Chef Record**: Lidia Bastianich must exist in the `chefs` table with slug `lidia-bastianich`
2. **Recipe Records**: Recipes must be linked to Lidia via `chef_id` field

If Lidia's chef record doesn't exist, run:
```bash
npx tsx scripts/import-chefs.ts
```

### Dependencies

All dependencies are already installed in the project:
- `openai` - OpenRouter API client (compatible)
- `drizzle-orm` - Database ORM
- `tsx` - TypeScript execution

## Usage

### Basic Usage

```bash
# Generate images for all Lidia's recipes without images
npx tsx scripts/generate-lidia-images.ts
```

### What Happens

1. **Chef Lookup**: Finds Lidia Bastianich in the database
2. **Recipe Query**: Identifies all recipes without images
3. **Image Generation**: For each recipe:
   - Generates a professional food photography prompt
   - Calls OpenRouter API to generate image
   - Saves image to `public/recipes/lidia/`
   - Updates database with image URL
4. **Summary**: Displays success/failure statistics

### Expected Output

```
══════════════════════════════════════════════════════════════════════
🖼️  AI IMAGE GENERATION FOR LIDIA BASTIANICH RECIPES
══════════════════════════════════════════════════════════════════════

🔍 Step 1: Finding Lidia Bastianich in database...

✅ Found: Lidia Bastianich
   Chef ID: 550e8400-e29b-41d4-a716-446655440000
   Slug: lidia-bastianich
   Recipe Count: 125

🔍 Step 2: Finding recipes without images...

📊 Found 125 recipes without images

🎨 Step 3: Generating images...

[1/125]
══════════════════════════════════════════════════════════════════════
📖 Recipe: Risotto alla Milanese
   ID: 7c9e6679-7425-40de-944b-e07fc1f90ae7
   Cuisine: Italian
   Description: Classic Italian risotto with saffron...
──────────────────────────────────────────────────────────────────────
   📝 Prompt: Professional food photography of Risotto alla Milanese...
   🎨 Generating image (attempt 1/3)...
   💾 Saved image: public/recipes/lidia/risotto-alla-milanese-7c9e6679.png
   ✅ Updated recipe with image URL
   🎉 Successfully generated and saved image!

[2/125]
...

══════════════════════════════════════════════════════════════════════
📊 SUMMARY
══════════════════════════════════════════════════════════════════════
✅ Successful: 120
❌ Failed:     5
⏭️  Skipped:    0
📝 Total:      125
══════════════════════════════════════════════════════════════════════

🎉 Image generation completed!

📁 Images saved to: public/recipes/lidia/
🗄️  Database updated with image URLs

💡 Next steps:
   1. Verify images at: http://localhost:3002/discover/chefs/lidia-bastianich
   2. Check image quality and regenerate if needed
   3. Consider flagging low-quality images for manual review

✅ Script completed successfully!
```

## Image Generation Details

### Model Information

- **Model**: `google/gemini-2.5-flash-image-preview`
- **Provider**: OpenRouter → Google
- **Cost**: ~$0.30 per million tokens
- **Aspect Ratio**: 1:1 (square, optimal for recipe cards)
- **Format**: PNG (high quality)
- **Resolution**: Model default (typically 1024x1024)

### Prompt Engineering

The script generates prompts with the following structure:

```
Professional food photography of [Recipe Name], [Cuisine] cuisine.
[Recipe Description (first 200 chars)].
The dish is beautifully plated on a rustic ceramic dish with natural
lighting from the side, showcasing the textures and colors of the
ingredients. High-quality restaurant-style presentation, warm and
inviting atmosphere, shallow depth of field, appetizing composition.
Style: editorial food photography, authentic Italian home cooking aesthetic.
```

This prompt structure ensures:
- Professional, editorial-quality images
- Consistent Italian aesthetic
- Warm, inviting composition
- Authentic home cooking feel

### File Naming Convention

Images are saved with sanitized names:
```
[recipe-name-sanitized]-[recipe-id-first-8-chars].png
```

Example:
```
risotto-alla-milanese-7c9e6679.png
braised-short-ribs-in-barolo-2f3a1b4c.png
```

### Database Updates

The script updates the `recipes` table:
```sql
UPDATE recipes
SET images = '["recipes/lidia/recipe-name-id.png"]',
    updated_at = NOW()
WHERE id = 'recipe-id';
```

## Error Handling

### Automatic Retries

- **Max Retries**: 3 attempts per image
- **Retry Delay**: 2 seconds between attempts
- **Failure Handling**: Logs error and continues to next recipe

### Rate Limiting

- **Inter-request Delay**: 1 second between recipes
- **Purpose**: Prevent API rate limit issues
- **Adjustable**: Modify `RETRY_DELAY_MS` in script

### Common Errors and Solutions

#### 1. Chef Not Found

**Error**:
```
❌ Error: Lidia Bastianich not found in chefs table
```

**Solution**:
```bash
npx tsx scripts/import-chefs.ts
```

#### 2. Invalid API Key

**Error**:
```
❌ Error generating image: Invalid API key
```

**Solution**:
- Verify `OPENROUTER_API_KEY` is set in `.env.local`
- Check key is valid at https://openrouter.ai/keys
- Ensure key has sufficient credits

#### 3. API Rate Limit

**Error**:
```
❌ Error generating image: Rate limit exceeded
```

**Solution**:
- Wait 5-10 minutes and retry
- Reduce batch size by running script multiple times
- Check OpenRouter dashboard for quota limits

#### 4. Network/Timeout Errors

**Error**:
```
❌ Error generating image: Request timeout
```

**Solution**:
- Check internet connectivity
- Verify OpenRouter API status: https://status.openrouter.ai
- Retry failed recipes (script will skip already-processed ones)

#### 5. File System Errors

**Error**:
```
❌ Error saving image: EACCES: permission denied
```

**Solution**:
- Ensure write permissions for `public/recipes/` directory
- Check disk space availability
- Verify directory path is correct

## Configuration Options

### Modifiable Constants

Edit these at the top of `generate-lidia-images.ts`:

```typescript
// Model selection
const IMAGE_GENERATION_MODEL = 'google/gemini-2.5-flash-image-preview';

// Output directory (relative to project root)
const OUTPUT_DIR = 'public/recipes/lidia';

// Image aspect ratio (1:1, 16:9, 3:2, etc.)
const ASPECT_RATIO = '1:1';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
```

### Supported Aspect Ratios

OpenRouter's Gemini model supports 11 aspect ratios:
- `1:1` - Square (default, best for cards)
- `16:9` - Widescreen
- `3:2` - Traditional photo
- `2:3` - Portrait
- And 7 more...

## Performance Considerations

### Time Estimates

- **Per Image**: ~3-5 seconds (including generation, save, DB update)
- **100 Recipes**: ~5-8 minutes
- **500 Recipes**: ~25-40 minutes

### Cost Estimates

Based on OpenRouter pricing (~$0.30 per million tokens):
- **Per Image**: ~$0.001-0.002 (negligible)
- **100 Images**: ~$0.10-0.20
- **500 Images**: ~$0.50-1.00

### Resource Usage

- **Network**: ~1-2 MB per image transfer
- **Disk**: ~200-500 KB per saved PNG
- **Memory**: ~100 MB peak during execution
- **CPU**: Minimal (I/O bound)

## Advanced Usage

### Batch Processing Specific Recipes

To generate images for specific recipe IDs, modify the query:

```typescript
const specificRecipeIds = ['id1', 'id2', 'id3'];

const recipesWithoutImages = await db
  .select()
  .from(recipes)
  .where(
    and(
      eq(recipes.chef_id, lidia.id),
      inArray(recipes.id, specificRecipeIds)
    )
  );
```

### Regenerating Existing Images

To force regeneration of images that already exist:

```typescript
// Remove the image filtering condition
const recipesWithoutImages = await db
  .select()
  .from(recipes)
  .where(eq(recipes.chef_id, lidia.id));
```

Or clear images in database first:
```sql
UPDATE recipes
SET images = NULL
WHERE chef_id = 'lidia-chef-id';
```

### Custom Prompts

To customize prompts for specific cuisines or styles:

```typescript
function generateImagePrompt(
  recipeName: string,
  description: string | null,
  cuisine: string | null
): string {
  // Add custom logic here
  if (cuisine === 'dessert') {
    return `Elegant dessert photography of ${recipeName}...`;
  }
  // Default prompt
  return `Professional food photography of ${recipeName}...`;
}
```

### Dry Run Mode

To test without generating images:

```typescript
// Add a dry-run flag
const DRY_RUN = true;

async function processRecipe(recipe: any): Promise<boolean> {
  console.log(`Would process: ${recipe.name}`);
  if (DRY_RUN) return true;
  // ... rest of logic
}
```

## Integration with Other Scripts

### Workflow Integration

1. **Import Chefs**:
   ```bash
   npx tsx scripts/import-chefs.ts
   ```

2. **Scrape Recipes** (if available):
   ```bash
   npx tsx scripts/scrape-lidia-recipes.ts
   ```

3. **Generate Images** (this script):
   ```bash
   npx tsx scripts/generate-lidia-images.ts
   ```

4. **Verify Results**:
   - Visit: http://localhost:3002/discover/chefs/lidia-bastianich
   - Check image quality
   - Flag poor images for regeneration

### Database Verification

Check generation status:
```sql
-- Count recipes with/without images
SELECT
  chef_id,
  COUNT(*) as total,
  COUNT(images) FILTER (WHERE images != '[]' AND images IS NOT NULL) as with_images,
  COUNT(*) FILTER (WHERE images = '[]' OR images IS NULL) as without_images
FROM recipes
WHERE chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich')
GROUP BY chef_id;
```

View generated images:
```sql
SELECT id, name, images
FROM recipes
WHERE chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich')
  AND images IS NOT NULL
  AND images != '[]'
LIMIT 10;
```

## Troubleshooting Checklist

Before running the script, verify:

- [ ] `OPENROUTER_API_KEY` is set in `.env.local`
- [ ] `DATABASE_URL` is set and accessible
- [ ] Lidia Bastianich exists in `chefs` table
- [ ] Recipes exist linked to Lidia's `chef_id`
- [ ] `public/recipes/` directory exists and is writable
- [ ] OpenRouter account has sufficient credits
- [ ] Node.js version is 18+ (for fetch API support)
- [ ] All dependencies are installed (`pnpm install`)

## Maintenance and Monitoring

### Image Quality Review

Periodically review generated images:
1. Check for incorrect compositions
2. Verify food matches recipe description
3. Flag poor-quality images for regeneration

### Flagging for Regeneration

Use the admin interface to flag images:
```typescript
import { flagRecipeImageForRegeneration } from '@/app/actions/admin-recipes';

await flagRecipeImageForRegeneration('recipe-id');
```

### Bulk Regeneration

For flagged images:
```sql
-- Find flagged recipes
SELECT id, name FROM recipes
WHERE image_flagged_for_regeneration = true
  AND chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich');

-- Clear images for regeneration
UPDATE recipes
SET images = NULL
WHERE image_flagged_for_regeneration = true
  AND chef_id = (SELECT id FROM chefs WHERE slug = 'lidia-bastianich');
```

Then rerun the generation script.

## Future Enhancements

Potential improvements:
- [ ] Support for multiple image variants per recipe
- [ ] A/B testing different prompt styles
- [ ] Parallel processing for faster generation
- [ ] Image quality scoring and auto-regeneration
- [ ] Support for multiple chefs in one run
- [ ] Integration with image CDN (Cloudinary, etc.)
- [ ] Automatic image optimization/compression
- [ ] Support for different aspect ratios per recipe type

## Support

For issues or questions:
1. Check the error logs in the console output
2. Review the Common Errors section above
3. Verify environment variables and database connectivity
4. Check OpenRouter API status: https://status.openrouter.ai
5. Review OpenRouter documentation: https://openrouter.ai/docs

## License

This script is part of the Recipe Manager project and follows the project's license.

---

**Last Updated**: 2025-10-17
**Version**: 1.0.0
**Maintainer**: Recipe Manager Team
