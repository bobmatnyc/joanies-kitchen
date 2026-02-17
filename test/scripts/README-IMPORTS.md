# Recipe Import Scripts

Comprehensive guide for importing recipes from external sources into the Recipe Manager application.

## Table of Contents

- [Overview](#overview)
- [Available Importers](#available-importers)
- [Setup](#setup)
- [Usage](#usage)
- [Progress Tracking & Resume](#progress-tracking--resume)
- [Quality Filtering](#quality-filtering)
- [Troubleshooting](#troubleshooting)
- [Legal & Attribution](#legal--attribution)

---

## Overview

The Recipe Manager application supports importing recipes from multiple external sources:

1. **TheMealDB** - Free API with ~500 curated recipes
2. **Open Recipe DB** - Community database with 10,000+ recipes (quality filtered)

All importers include:
- ✅ Progress tracking with resume capability
- ✅ Automatic deduplication (by recipe slug)
- ✅ Quality filtering (Open Recipe DB only)
- ✅ Error handling and logging
- ✅ Rate limiting (TheMealDB)
- ✅ Proper attribution and licensing

---

## Available Importers

### 1. TheMealDB Importer

**Source**: https://www.themealdb.com/api/json/v1/1

**Script**: `scripts/import-themealdb.ts`

**Features**:
- Free API (no authentication required)
- ~500 high-quality, tested recipes
- Covers 14 categories (Beef, Chicken, Dessert, etc.)
- Full ingredient lists with measurements
- Step-by-step instructions
- High-quality images
- Cuisine and category metadata

**Categories Imported**:
- Beef
- Chicken
- Dessert
- Lamb
- Miscellaneous
- Pasta
- Pork
- Seafood
- Side
- Starter
- Vegan
- Vegetarian
- Breakfast
- Goat

**Rate Limiting**: 1 request per second (API courtesy)

**License**: Free for educational/non-commercial use (attribution recommended)

---

### 2. Open Recipe DB Importer

**Source**: https://github.com/somecoding/openrecipedb

**Script**: `scripts/import-open-recipe-db.ts`

**Features**:
- Community-driven database
- 10,000+ recipes available
- **Quality filtering** with configurable threshold
- Open licensing (ODbL + Database Contents License)
- Commercial use allowed with attribution

**Quality Filtering Algorithm**:

Recipes are scored 0-100 based on:
- Has complete instructions (not just ingredient lists): +30 points
- Has prep_time and cook_time: +20 points
- Has at least 5 ingredients: +15 points
- Instructions have at least 3 steps: +20 points
- Has cuisine/category information: +10 points
- Has image: +5 points

**Default threshold**: 70/100 (only imports recipes scoring 70 or higher)

**License**: ODbL (Open Database License) + CC BY-SA for images

---

## Setup

### Prerequisites

1. **Node.js & pnpm** installed
2. **Database** configured (Neon PostgreSQL)
3. **Environment variables** set in `.env.local`:
   ```env
   DATABASE_URL=postgresql://...
   ```

### Installation

No additional dependencies needed - all importers use built-in Node.js modules and existing project dependencies.

---

## Usage

### TheMealDB Importer

#### First Time Import

```bash
# Run the importer
pnpm tsx scripts/import-themealdb.ts
```

**Expected Output**:

```
🚀 TheMealDB Recipe Importer

📋 Fetching meal IDs from all categories...

  Fetching category: Beef...
    Found 38 meals in Beef
  Fetching category: Chicken...
    Found 68 meals in Chicken
  ...

📊 Total unique meals found: 485
📈 Current progress: 0% (0 imported, 0 failed, 0 skipped / 485 total)

📥 Starting import...

✅ [1/485] Imported: "Beef Wellington" (Beef - British)
✅ [2/485] Imported: "Beef and Mustard Pie" (Beef - British)
...
```

**Import Time**: ~8-10 minutes (rate limited to 1 req/sec)

---

#### Resume Interrupted Import

If import is interrupted, simply run the same command again:

```bash
pnpm tsx scripts/import-themealdb.ts
```

The script will automatically:
1. Load previous progress from `tmp/import-progress-themealdb.json`
2. Skip already imported recipes
3. Continue from where it left off

**Example**:

```
🚀 TheMealDB Recipe Importer

📂 Loaded existing progress: 245/485 imported

📊 Total unique meals found: 485
📈 Current progress: 50% (245 imported, 2 failed, 10 skipped / 485 total)

📥 Starting import...

⏭️  [1/485] Skipping 52772 (already imported)
⏭️  [2/485] Skipping 52773 (already imported)
...
✅ [246/485] Imported: "Thai Green Curry" (Chicken - Thai)
```

---

### Open Recipe DB Importer

#### Step 1: Download Dataset

**Option A: JSON File** (Recommended for beginners)

1. Visit: https://github.com/somecoding/openrecipedb
2. Download the recipes JSON file
3. Place it at: `tmp/openrecipedb-recipes.json`

**Option B: PostgreSQL Dump** (Advanced)

1. Download the PostgreSQL dump from the repository
2. Import into a local PostgreSQL instance
3. Export as JSON using a custom query
4. Place JSON at: `tmp/openrecipedb-recipes.json`

**Option C: Use Their API** (If available)

Check the repository for API documentation and modify the importer script accordingly.

---

#### Step 2: Run Import

```bash
# Run the importer
pnpm tsx scripts/import-open-recipe-db.ts
```

**Expected Output**:

```
🚀 Open Recipe DB Importer

Quality threshold: 70/100

📂 Loading dataset...
✅ Loaded 10234 recipes from dataset

🔍 Filtering by quality...
✅ 3456 recipes passed quality filter
❌ 6778 recipes filtered out (low quality)

📈 Current progress: 0% (0 imported, 0 failed, 0 skipped / 3456 total)

📥 Starting import...

✅ [1/3456] Imported: "Perfect Chocolate Chip Cookies" (score: 95/100)
✅ [2/3456] Imported: "Classic Bolognese Sauce" (score: 92/100)
...
```

**Import Time**: ~30-60 minutes (depends on dataset size and quality threshold)

---

#### Adjust Quality Threshold

Edit `scripts/import-open-recipe-db.ts`:

```typescript
// Lower threshold (more recipes, lower quality)
const QUALITY_THRESHOLD = 60; // Instead of 70

// Higher threshold (fewer recipes, higher quality)
const QUALITY_THRESHOLD = 80;
```

---

## Progress Tracking & Resume

### How It Works

All importers use the `ImportProgressTracker` class:

1. **Progress File**: Saved to `tmp/import-progress-{source}.json`
2. **Auto-Save**: Progress saved every 5 seconds automatically
3. **Resume**: On restart, loads progress and skips already imported IDs
4. **Error Tracking**: Records failed imports with error messages

### Progress File Format

```json
{
  "source": "themealdb",
  "total": 485,
  "imported": 245,
  "failed": 2,
  "skipped": 10,
  "lastImportedId": "52772",
  "startedAt": "2025-10-19T10:00:00.000Z",
  "updatedAt": "2025-10-19T10:15:30.000Z",
  "completedAt": null,
  "errors": [
    {
      "id": "52999",
      "error": "Recipe not found or API error",
      "timestamp": "2025-10-19T10:12:15.000Z"
    }
  ]
}
```

### Manual Progress Management

#### Check Progress

```bash
# View progress file
cat tmp/import-progress-themealdb.json
cat tmp/import-progress-open-recipe-db.json
```

#### Reset Progress (Start Over)

```bash
# Delete progress file to start fresh
rm tmp/import-progress-themealdb.json
rm tmp/import-progress-open-recipe-db.json
```

#### Resume After Error

Simply run the import script again - it will automatically resume.

---

## Quality Filtering

### Open Recipe DB Quality Scoring

The importer uses a comprehensive quality scoring system:

| Criteria | Points | Description |
|----------|--------|-------------|
| Complete instructions | 30 | Instructions > 100 characters |
| Timing info | 20 | Has both prep_time and cook_time |
| Sufficient ingredients | 15 | At least 5 ingredients |
| Detailed steps | 20 | At least 3 instruction steps |
| Cuisine/category | 10 | Has cuisine or category info |
| Has image | 5 | At least one image available |

**Total**: 100 points

**Default threshold**: 70 points

### Examples

**High Quality Recipe** (Score: 95):
```json
{
  "name": "Perfect Chocolate Chip Cookies",
  "ingredients": ["flour", "sugar", "butter", "eggs", "chocolate chips", "vanilla", "baking soda", "salt"],
  "instructions": "Step 1: Cream butter and sugar... (200+ chars)",
  "prep_time": 15,
  "cook_time": 12,
  "cuisine": "American",
  "image": "https://..."
}
```
- Complete instructions: ✅ 30
- Timing: ✅ 20
- Ingredients (8): ✅ 15
- Steps (detailed): ✅ 20
- Cuisine: ✅ 10
- Image: ✅ 5
- **Total: 100**

**Low Quality Recipe** (Score: 40):
```json
{
  "name": "Pasta",
  "ingredients": ["pasta", "sauce"],
  "instructions": "Cook pasta.",
  "prep_time": null,
  "cook_time": null
}
```
- Complete instructions: ❌ 0 (too short)
- Timing: ❌ 0
- Ingredients (2): ❌ 0 (< 5)
- Steps: ❌ 0 (only 1 step)
- Cuisine: ❌ 0
- Image: ❌ 0
- **Total: 0** ❌ Filtered out

---

## Troubleshooting

### TheMealDB Importer

#### Error: "Failed to fetch category"

**Cause**: API request failed (network issue, rate limiting)

**Solution**:
- Check internet connection
- Wait a few minutes and retry
- Script will automatically retry on next run

---

#### Error: "Recipe not found or API error"

**Cause**: Meal ID exists in category but details not available

**Solution**:
- This is expected for some meals
- Error is logged, import continues
- Recipe is skipped, not retried

---

#### Import is very slow

**Expected**: ~8-10 minutes for 485 recipes (rate limited to 1 req/sec)

**To speed up** (not recommended):
- Edit `RATE_LIMIT_MS` in script (may violate API terms)

---

### Open Recipe DB Importer

#### Error: "Dataset file not found"

**Cause**: JSON file not placed at `tmp/openrecipedb-recipes.json`

**Solution**:
```bash
# Create tmp directory if needed
mkdir -p tmp

# Download dataset and place it
# See "Download Dataset" section above
```

---

#### Error: "Dataset is not an array"

**Cause**: JSON file format is incorrect

**Solution**:
- Verify JSON file is valid (use `cat tmp/openrecipedb-recipes.json | jq`)
- Ensure it's an array of recipe objects
- Re-download if corrupted

---

#### Very few recipes imported

**Cause**: Quality threshold too high

**Solution**:
```typescript
// Lower threshold in script
const QUALITY_THRESHOLD = 60; // Instead of 70
```

Or:

```bash
# Check quality distribution
grep "score:" tmp/import-progress-open-recipe-db.json
```

---

### General Issues

#### Database connection error

**Cause**: `DATABASE_URL` not set or invalid

**Solution**:
```bash
# Verify .env.local exists
cat .env.local | grep DATABASE_URL

# Test connection
pnpm tsx scripts/check-schema.ts
```

---

#### Out of memory

**Cause**: Large dataset loaded entirely into memory

**Solution** (Open Recipe DB):
- Process in smaller batches
- Edit script to use streaming JSON parser
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 pnpm tsx ...`

---

#### Duplicate recipes

**Cause**: Recipe slug already exists

**Expected behavior**: Script automatically skips duplicates

**To force re-import**:
```sql
-- Delete specific recipe by slug
DELETE FROM recipes WHERE slug = 'recipe-slug-name';

-- Delete all TheMealDB recipes
DELETE FROM recipes WHERE source LIKE 'TheMealDB%';

-- Delete all Open Recipe DB recipes
DELETE FROM recipes WHERE source LIKE 'Open Recipe DB%';
```

---

## Legal & Attribution

### TheMealDB

**License**: Free for educational/non-commercial use

**Attribution**: Recommended but not required

**Recommended attribution**:
```
Recipe from TheMealDB (https://www.themealdb.com)
```

**Usage**:
- ✅ Educational use
- ✅ Personal projects
- ⚠️ Commercial use (contact TheMealDB)
- ❌ Redistribution of API data

---

### Open Recipe DB

**License**:
- Database: Open Database License (ODbL)
- Contents: Database Contents License
- Images: CC BY-SA

**Attribution**: REQUIRED

**Required attribution**:
```
Recipe from Open Recipe DB (https://github.com/somecoding/openrecipedb)
Licensed under ODbL (https://opendatacommons.org/licenses/odbl/)
```

**Usage**:
- ✅ Educational use
- ✅ Personal projects
- ✅ Commercial use (with attribution)
- ✅ Modification and redistribution (with attribution + share-alike)

---

### Implementation

Attribution is automatically added to the `source` field:

**TheMealDB**:
```typescript
source: "TheMealDB (ID: 52772)"
```

**Open Recipe DB**:
```typescript
source: "Open Recipe DB (ID: recipe-123)"
// Or with URL if available:
source: "https://original-recipe-url.com"
```

Display attribution in recipe UI:

```tsx
// Example: RecipeAttribution component
{recipe.source?.includes('TheMealDB') && (
  <p>
    Recipe from{' '}
    <a href="https://www.themealdb.com" target="_blank" rel="noopener">
      TheMealDB
    </a>
  </p>
)}

{recipe.source?.includes('Open Recipe DB') && (
  <p>
    Recipe from{' '}
    <a href="https://github.com/somecoding/openrecipedb" target="_blank" rel="noopener">
      Open Recipe DB
    </a>
    {' '}licensed under{' '}
    <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener">
      ODbL
    </a>
  </p>
)}
```

---

## Advanced Usage

### Custom Filtering

#### Filter by cuisine (TheMealDB)

Edit `CATEGORIES` array in `scripts/import-themealdb.ts`:

```typescript
// Import only specific categories
const CATEGORIES = [
  'Italian',  // Will need to adjust API endpoint
  'Mexican',
  'Chinese',
];
```

#### Filter by ingredients (Open Recipe DB)

Add custom filter logic:

```typescript
// Only import vegetarian recipes
const filteredRecipes = qualityRecipes.filter(({ recipe }) => {
  const ingredients = JSON.stringify(recipe.ingredients).toLowerCase();
  return !ingredients.includes('meat') && !ingredients.includes('chicken');
});
```

---

### Batch Processing

#### Process in smaller batches

Edit importer to process in chunks:

```typescript
// Process 100 recipes at a time
const BATCH_SIZE = 100;

for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
  const batch = recipes.slice(i, i + BATCH_SIZE);
  await processBatch(batch);

  // Save progress after each batch
  await tracker.saveProgress();
}
```

---

### Integration with Existing Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "import:themealdb": "tsx scripts/import-themealdb.ts",
    "import:openrecipedb": "tsx scripts/import-open-recipe-db.ts",
    "import:all": "tsx scripts/import-themealdb.ts && tsx scripts/import-open-recipe-db.ts"
  }
}
```

Usage:

```bash
pnpm import:themealdb
pnpm import:openrecipedb
pnpm import:all  # Run both sequentially
```

---

## Summary

### Quick Start

1. **TheMealDB** (easiest):
   ```bash
   pnpm tsx scripts/import-themealdb.ts
   ```

2. **Open Recipe DB** (requires dataset):
   ```bash
   # Download dataset first
   pnpm tsx scripts/import-open-recipe-db.ts
   ```

### Best Practices

- ✅ Run TheMealDB first (no setup required)
- ✅ Use quality filtering for Open Recipe DB
- ✅ Let scripts run to completion (resume if interrupted)
- ✅ Monitor progress in `tmp/import-progress-*.json`
- ✅ Display proper attribution in UI

### Support

For issues or questions:
- Check troubleshooting section above
- Review progress files in `tmp/`
- Check database logs
- See main research document: `docs/research/RECIPE_SOURCES_RESEARCH.md`

---

**Last Updated**: 2025-10-19
**Version**: 1.0.0
