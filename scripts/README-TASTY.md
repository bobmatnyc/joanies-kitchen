# Tasty Recipe Import Guide

Complete guide for importing recipes from BuzzFeed's Tasty API via RapidAPI.

## Overview

The Tasty import system extracts high-quality recipe content from BuzzFeed's popular Tasty platform, featuring:

- **Video Tutorials**: Most recipes include step-by-step video instructions
- **Rich Metadata**: Tags, topics, nutrition information, ratings
- **Professional Content**: Curated recipes from BuzzFeed's test kitchen
- **Structured Data**: Well-formatted ingredients and instructions
- **API-Based**: Clean, reliable data extraction (no scraping needed)

**Estimated Content**: 5,000+ recipes with video tutorials

---

## Quick Start

### 1. Get RapidAPI Access

1. Sign up at [RapidAPI](https://rapidapi.com/)
2. Subscribe to [Tasty API](https://rapidapi.com/apidojo/api/tasty)
3. Copy your API key from the dashboard

### 2. Configure Environment

Add to `.env.local`:

```env
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=tasty.p.rapidapi.com
```

### 3. Test API Connection

```bash
pnpm import:tasty:test
```

Expected output:
```
✅ API connection successful!
✅ Found 5000+ total recipes
✅ Retrieved 5 recipes
✅ Recipe details retrieved successfully!
```

### 4. Run Pilot Import (10 recipes)

```bash
pnpm import:tasty:pilot
```

This will import 10 recipes to validate:
- API connectivity
- Data transformation
- Video URL extraction
- Database insertion

### 5. Run Full Import

```bash
pnpm import:tasty
```

**Note**: Free tier is limited to 500 API requests/month = 500 recipes

---

## API Pricing

### Free Tier (500 requests/month)
- **Cost**: Free
- **Recipes**: ~500 recipes/month
- **Best for**: Testing, small-scale imports
- **Rate limit**: 1 request/second (enforced by script)

### Pro Tier ($9.99/month)
- **Cost**: $9.99/month
- **Requests**: 10,000/month
- **Recipes**: ~10,000 recipes/month
- **Best for**: Full library import

### Calculate Costs

Each recipe import = 1 API request (for recipe details)

Example:
- 500 recipes = 500 requests = Free tier
- 5,000 recipes = 5,000 requests = $9.99/month (Pro tier)

Monitor usage at: https://rapidapi.com/developer/dashboard

---

## Command Reference

### Test API Connectivity
```bash
pnpm import:tasty:test
```
- Tests API connection
- Validates API key
- Fetches sample recipes
- Displays recipe structure

### Pilot Import (10 recipes)
```bash
pnpm import:tasty:pilot
```
- Imports 10 test recipes
- Full data transformation
- Validates video URLs
- Safe for testing

### Full Import (default: 500 recipes)
```bash
pnpm import:tasty
```
- Imports up to 500 recipes (free tier limit)
- Progress tracking with resume capability
- Rate limiting (1 request/second)
- Duplicate detection

### Custom Limits
```bash
# Import 50 recipes
pnpm import:tasty -- --max=50

# Import 1000 recipes (requires Pro tier)
pnpm import:tasty -- --max=1000
```

### Filter by Tag
```bash
# Import only quick recipes (under 30 minutes)
pnpm import:tasty -- --tag=under_30_minutes

# Import vegetarian recipes
pnpm import:tasty -- --tag=vegetarian

# Import desserts
pnpm import:tasty -- --tag=desserts
```

Available tags:
- `under_30_minutes`
- `under_45_minutes`
- `under_1_hour`
- `vegetarian`
- `vegan`
- `gluten_free`
- `dairy_free`
- `keto`
- `paleo`
- `healthy`
- `comfort_food`
- `easy`
- `kid_friendly`
- And many more...

---

## Data Quality

### What Gets Imported

Each recipe includes:
- ✅ **Name**: Recipe title
- ✅ **Description**: Recipe summary
- ✅ **Ingredients**: With measurements (structured data)
- ✅ **Instructions**: Step-by-step with position ordering
- ✅ **Images**: Thumbnail URL
- ✅ **Video URL**: Step-by-step video tutorial (Tasty's unique feature)
- ✅ **Prep/Cook Time**: Minutes
- ✅ **Servings**: Number of servings
- ✅ **Nutrition**: Calories, fat, carbs, protein, fiber, sugar
- ✅ **Tags**: Dietary, meal type, difficulty, cuisine
- ✅ **Ratings**: User ratings (positive/negative counts)

### Data Transformation

The transformer maps Tasty data to our schema:

**Ingredients**:
```javascript
// Tasty format:
{
  "raw_text": "2 cups all-purpose flour"
}

// Our format:
{
  "item": "2 cups all-purpose flour",
  "quantity": ""
}
```

**Instructions**:
```javascript
// Tasty format:
{
  "display_text": "Preheat oven to 350°F",
  "position": 1
}

// Our format (sorted by position):
[
  "Preheat oven to 350°F",
  "Mix dry ingredients...",
  "..."
]
```

**Tags** (mapped to our taxonomy):
- `vegetarian` → `dietary.vegetarian`
- `under_30_minutes` → `time.quick`
- `dessert` → `meal-type.dessert`
- `italian` → `cuisine.italian`
- Has video → `media.video`

**Difficulty** (calculated):
- Easy: ≤30 min AND ≤5 steps
- Hard: ≥90 min OR ≥12 steps
- Medium: Everything else

### Quality Filters

Recipes are skipped if:
- ❌ No ingredients
- ❌ No instructions
- ❌ Already exists (by slug)

---

## Progress Tracking

### Resume Capability

If import is interrupted, progress is saved to:
```
tmp/import-progress-tasty.json
```

On restart, the script automatically resumes from where it left off.

### Progress File Format

```json
{
  "source": "tasty",
  "total": 500,
  "imported": 342,
  "failed": 3,
  "skipped": 15,
  "lastImportedId": "8456",
  "startedAt": "2025-10-19T10:00:00Z",
  "updatedAt": "2025-10-19T10:45:00Z",
  "errors": [
    {
      "id": "1234",
      "error": "Recipe not found",
      "timestamp": "2025-10-19T10:30:00Z"
    }
  ]
}
```

### Manual Cleanup

To start fresh (delete progress file):
```bash
rm tmp/import-progress-tasty.json
```

---

## Rate Limiting

### Built-in Rate Limiting

The script enforces:
- **1 second delay** between API requests
- **Automatic retry** on rate limit errors (429)
- **60 second wait** if rate limited
- **Exponential backoff** on failures

### API Rate Limits

RapidAPI enforces:
- Free tier: 500 requests/month
- Pro tier: 10,000 requests/month
- Requests reset monthly

### Best Practices

1. **Start with pilot mode** to validate setup
2. **Monitor API quota** at RapidAPI dashboard
3. **Use --max flag** to control import size
4. **Avoid concurrent imports** (respect rate limits)
5. **Plan imports** around monthly quota reset

---

## Video URLs

### Tasty's Unique Feature

Tasty recipes include video tutorials:
- **Format**: MP4 video files
- **Location**: `video_url` or `original_video_url` field
- **Content**: Step-by-step cooking instructions
- **Quality**: Professional recipe videos

### Video URL Storage

Videos are stored in the `video_url` field:
```sql
ALTER TABLE recipes ADD COLUMN video_url TEXT;
```

### Accessing Videos

```typescript
// Example: Display video in recipe page
{recipe.video_url && (
  <video src={recipe.video_url} controls>
    Your browser does not support the video tag.
  </video>
)}
```

### Video Availability

Not all recipes have videos:
- Pilot import: Track `videoCount` in summary
- Typical: 80-90% of Tasty recipes include videos

---

## Database Schema

### Recipe Source

```typescript
{
  name: 'Tasty (BuzzFeed)',
  slug: 'tasty',
  website_url: 'https://tasty.co',
  description: 'BuzzFeed Tasty - Popular recipe videos...',
  is_active: true
}
```

### Recipe Fields

```typescript
{
  name: string,              // Recipe name
  slug: string,              // SEO-friendly URL slug
  description: string,       // Recipe description
  ingredients: string,       // JSON array
  instructions: string,      // JSON array (sorted by position)
  prep_time: number,         // Minutes
  cook_time: number,         // Minutes
  servings: number,          // Number of servings
  difficulty: string,        // 'easy' | 'medium' | 'hard'
  image_url: string,         // Thumbnail URL
  images: string,            // JSON array
  video_url: string,         // VIDEO URL (NEW!)
  tags: string,              // JSON array
  nutrition_info: string,    // JSON object
  is_system_recipe: true,    // System recipe
  is_public: true,           // Public visibility
  is_ai_generated: false,    // Not AI-generated
  license: 'FAIR_USE',       // Fair use license
  source: string,            // 'Tasty (BuzzFeed) - ID: 1234'
  source_id: uuid,           // Reference to recipe source
}
```

---

## Troubleshooting

### API Key Not Found

**Error**:
```
❌ RAPIDAPI_KEY not found in environment variables
```

**Solution**:
1. Add `RAPIDAPI_KEY` to `.env.local`
2. Copy key from https://rapidapi.com/developer/dashboard
3. Restart script

### Rate Limit Exceeded

**Error**:
```
⏳ Rate limit hit, waiting 60 seconds...
```

**Solution**:
- Wait for automatic retry (script handles this)
- Check remaining quota at RapidAPI dashboard
- Consider upgrading to Pro tier

### API Connection Failed

**Error**:
```
❌ API connection failed
```

**Solutions**:
1. Verify API key is correct
2. Check internet connection
3. Verify RapidAPI subscription is active
4. Check API status at https://rapidapi.com/apidojo/api/tasty

### Duplicate Recipes

**Behavior**:
```
⏭️  Recipe already exists: "Chocolate Chip Cookies"
```

**Explanation**:
- Script checks for duplicates by slug
- Safe to re-run import (won't create duplicates)
- Progress tracker skips already-imported recipes

### Insufficient Data

**Behavior**:
```
⚠️  Skipped: Insufficient data
```

**Explanation**:
- Recipe has no ingredients or instructions
- Quality filter prevents importing incomplete recipes
- These are logged in progress tracker errors

---

## Architecture

### File Structure

```
scripts/
├── lib/
│   ├── tasty-client.ts          # RapidAPI client
│   ├── recipe-transformers.ts   # Tasty transformer
│   └── import-progress.ts       # Progress tracking (shared)
├── import-tasty.ts              # Main import script
├── test-tasty-api.ts            # API connectivity test
└── README-TASTY.md              # This file
```

### Code Reuse

The Tasty import reuses 90% of code from TheMealDB import:
- ✅ `ImportProgressTracker` class (unchanged)
- ✅ Progress file pattern (`.tasty-import.json`)
- ✅ Transformer pattern structure
- ✅ Database insertion logic
- ✅ Error handling patterns
- ✅ Rate limiting approach

**Net New Code**: ~300 LOC (API client + transformer + import script)

---

## License & Attribution

### License Type

**FAIR_USE**: Tasty content used under fair use doctrine

Justification:
- Educational and informational purpose
- Non-commercial use (Joanie's Kitchen is personal)
- Transformative use (imported into different platform)
- Minimal market impact (driving traffic to Tasty)

### Attribution

All recipes include source attribution:
```typescript
source: 'Tasty (BuzzFeed) - ID: 1234'
```

Display on recipe pages:
```typescript
{recipe.source?.includes('Tasty') && (
  <p>
    Recipe from <a href="https://tasty.co">Tasty by BuzzFeed</a>
  </p>
)}
```

### Terms of Service

- Respect RapidAPI rate limits
- Follow BuzzFeed's terms of service
- Provide attribution on recipe pages
- Do not redistribute Tasty content commercially

---

## Success Metrics

### Pilot Import (10 recipes)

Expected results:
```
✅ Imported: 10
⏭️  Skipped: 0
❌ Failed: 0
Progress: 100%
With video URLs: 8-9 (80-90%)
```

### Full Import (500 recipes)

Expected results:
```
✅ Imported: 480-490
⏭️  Skipped: 5-10 (duplicates)
❌ Failed: 5-10 (insufficient data)
Progress: 100%
With video URLs: 380-440 (80-90%)
Time: 10-15 minutes (with 1s rate limiting)
```

### Data Quality Checks

After import, verify:
1. ✅ All recipes have ingredients and instructions
2. ✅ Video URLs are valid and accessible
3. ✅ Images display correctly
4. ✅ Tags are properly mapped
5. ✅ Nutrition info is present (most recipes)
6. ✅ Source attribution is included

---

## Next Steps

### After Pilot Import

1. **Review imported recipes** in database:
   ```sql
   SELECT name, video_url, tags FROM recipes WHERE source LIKE 'Tasty%' LIMIT 10;
   ```

2. **Test video URLs**:
   ```bash
   # Pick a video URL from imported recipe
   curl -I https://video.tasty.co/...
   # Should return 200 OK
   ```

3. **Check data quality**:
   - Ingredients have proper formatting
   - Instructions are in correct order
   - Tags are mapped correctly
   - Nutrition info is present

4. **Run full import** if satisfied:
   ```bash
   pnpm import:tasty
   ```

### After Full Import

1. **Update recipe source** if needed:
   ```sql
   UPDATE recipe_sources
   SET description = 'BuzzFeed Tasty - 500 recipes imported...'
   WHERE slug = 'tasty';
   ```

2. **Generate embeddings** for semantic search:
   ```bash
   pnpm embeddings:generate
   ```

3. **Test recipe display** on frontend:
   - Navigate to `/discover`
   - Filter by `source.tasty` tag
   - Verify videos play correctly

4. **Monitor API usage**:
   - Check RapidAPI dashboard monthly
   - Plan for quota reset
   - Consider upgrading if needed

---

## Support

### Documentation
- RapidAPI Tasty: https://rapidapi.com/apidojo/api/tasty
- RapidAPI Dashboard: https://rapidapi.com/developer/dashboard
- Tasty Website: https://tasty.co

### Issues
- API key issues: Check RapidAPI dashboard
- Rate limits: Monitor monthly quota
- Data quality: Review progress tracker errors
- Technical issues: Check `tmp/import-progress-tasty.json`

---

**Last Updated**: 2025-10-19
**Version**: 1.0.0
**Status**: Production Ready
