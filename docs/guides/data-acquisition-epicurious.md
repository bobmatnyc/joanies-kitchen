# Epicurious Dataset - Data Acquisition Guide

## Overview

This guide covers the complete workflow for downloading and ingesting the **Epicurious Recipes** dataset from Kaggle into Joanie's Kitchen database.

**Dataset Information:**
- **Source**: [Kaggle - Epicurious Recipes with Rating and Nutrition](https://www.kaggle.com/datasets/hugodarwood/epirecipes)
- **Format**: JSON (single file: `epi_r.json`)
- **Size**: 20,000+ recipes
- **Data Quality**: High-quality recipes with rich metadata
- **Special Features**: Nutrition data, categories, ratings, image URLs

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Download Workflow](#download-workflow)
3. [Ingestion Workflow](#ingestion-workflow)
4. [Data Schema Mapping](#data-schema-mapping)
5. [Data Transformation Details](#data-transformation-details)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Usage](#advanced-usage)

---

## Prerequisites

### 1. Kaggle CLI Installation

```bash
# Install Kaggle CLI
pip install kaggle

# Verify installation
kaggle --version
```

### 2. Kaggle API Credentials

1. Visit [Kaggle Account Settings](https://www.kaggle.com/settings/account)
2. Scroll to "API" section
3. Click "Create New Token"
4. Download `kaggle.json`
5. Place in credentials directory:
   - **Linux/Mac**: `~/.kaggle/kaggle.json`
   - **Windows**: `%USERPROFILE%\.kaggle\kaggle.json`

```bash
# Set proper permissions (Linux/Mac)
chmod 600 ~/.kaggle/kaggle.json
```

### 3. Environment Setup

Ensure the following environment variables are configured in `.env.local`:

```env
# Required for quality evaluation
OPENROUTER_API_KEY=sk-or-...

# Required for embedding generation
HUGGINGFACE_API_KEY=hf_...

# Database connection
DATABASE_URL=postgresql://...
```

---

## Download Workflow

### Quick Download

```bash
# Download Epicurious dataset
pnpm data:epicurious:download
```

### What Happens During Download

1. **Kaggle CLI Check**: Verifies `kaggle` command is available
2. **Credential Verification**: Confirms `kaggle.json` exists
3. **Directory Setup**: Creates `data/recipes/incoming/epicurious/`
4. **Dataset Download**: Fetches from Kaggle (may take several minutes)
5. **Auto-Unzip**: Extracts `epi_r.json`
6. **Verification**: Counts records in JSON file
7. **Metadata Saved**: Creates `metadata.json` with download info

### Download Output

```
data/recipes/incoming/epicurious/
├── epi_r.json          # Main dataset (20K+ recipes)
├── metadata.json       # Download metadata
└── logs/              # Ingestion logs (created during ingestion)
```

### Download Metadata Format

```json
{
  "datasetName": "hugodarwood/epirecipes",
  "downloadTimestamp": "2025-10-14T10:30:00.000Z",
  "datasetVersion": "latest",
  "recordCount": 20130,
  "fileSize": 45678901,
  "downloadStatus": "success"
}
```

---

## Ingestion Workflow

### Full Ingestion (All Recipes)

```bash
# Ingest all Epicurious recipes with AI quality evaluation
pnpm data:epicurious:ingest
```

**Expected Duration**: 2-4 hours for 20K+ recipes (with AI evaluation)

### Sample Ingestion (Test with 1000 Recipes)

```bash
# Recommended for testing
pnpm data:epicurious:sample
```

**Expected Duration**: 10-15 minutes

### Custom Batch Size

```bash
# Process in smaller batches (250 recipes at a time)
tsx scripts/data-acquisition/ingest-epicurious.ts 250

# Limit to specific number of recipes
tsx scripts/data-acquisition/ingest-epicurious.ts 500 5000  # 5000 recipes max
```

### Complete Download + Ingestion

```bash
# One-command full workflow
pnpm data:epicurious:full
```

---

## Data Schema Mapping

### Epicurious Dataset → Joanie's Kitchen Schema

| Epicurious Field | Our Field | Transformation | Notes |
|-----------------|-----------|----------------|-------|
| `title` | `name` | Direct mapping | Recipe name |
| `desc` | `description` | Direct mapping | May be empty |
| `ingredients` | `ingredients` | Parse to array | Can be string or array |
| `directions` | `instructions` | Parse to array | Can be string or array |
| `categories` | `tags` | Direct mapping | Array of categories |
| `categories` | `cuisine` | Detect from categories | Extract cuisine keywords |
| `date` | `discoveryDate` | Parse and validate | Handle various formats |
| `rating` | _Not stored directly_ | Not used | Epicurious rating (0-5) |
| `calories` | `nutritionInfo.calories` | Parse to string | May be number or string |
| `protein` | `nutritionInfo.protein` | Parse to string | May be number or string |
| `fat` | `nutritionInfo.fat` | Parse to string | May be number or string |
| `sodium` | `nutritionInfo.sodium` | Parse to string | May be number or string |
| `image` | `images[0]` | URL only | Not downloaded |
| _N/A_ | `difficulty` | Estimate from complexity | Based on ingredient/step count |
| _N/A_ | `prepTime` | `null` | Not provided in dataset |
| _N/A_ | `cookTime` | `null` | Not provided in dataset |
| _N/A_ | `servings` | `null` | Not provided in dataset |
| _N/A_ | `source` | `"epicurious.com"` | Fixed value |
| _N/A_ | `isSystemRecipe` | `true` | Imported recipe |
| _N/A_ | `isPublic` | `true` | Public visibility |

---

## Data Transformation Details

### 1. Ingredients Parsing

Epicurious stores ingredients in two formats:

**Array Format** (preferred):
```json
{
  "ingredients": [
    "1 cup all-purpose flour",
    "2 large eggs",
    "1/2 cup milk"
  ]
}
```

**String Format** (needs parsing):
```json
{
  "ingredients": "1 cup all-purpose flour\n2 large eggs\n1/2 cup milk"
}
```

**Transformation Logic**:
```typescript
function parseIngredients(ingredients: string | string[]): string[] {
  if (Array.isArray(ingredients)) {
    return ingredients.filter(ing => ing.trim().length > 0);
  }

  // Split string by newlines
  return ingredients
    .split(/\r?\n/)
    .map(ing => ing.trim())
    .filter(ing => ing.length > 0);
}
```

### 2. Directions Parsing

Similar dual format handling:

**Transformation Logic**:
```typescript
function parseDirections(directions: string | string[]): string[] {
  if (Array.isArray(directions)) {
    return directions.filter(dir => dir.trim().length > 0);
  }

  // Try splitting by newlines
  let steps = directions.split(/\r?\n/).filter(s => s.trim());

  // If single step, try splitting by numbered patterns (1., 2., ...)
  if (steps.length === 1) {
    steps = directions.split(/\d+\.\s+/).filter(s => s.trim());
  }

  return steps;
}
```

### 3. Cuisine Detection

Extract cuisine from categories using keyword matching:

```typescript
const cuisineKeywords = {
  'italian': 'Italian',
  'mexican': 'Mexican',
  'chinese': 'Chinese',
  'japanese': 'Japanese',
  'indian': 'Indian',
  'french': 'French',
  'thai': 'Thai',
  'mediterranean': 'Mediterranean',
  // ... more cuisines
};

function detectCuisine(categories: string[]): string | null {
  for (const category of categories) {
    for (const [keyword, cuisineName] of Object.entries(cuisineKeywords)) {
      if (category.toLowerCase().includes(keyword)) {
        return cuisineName;
      }
    }
  }
  return null;
}
```

### 4. Difficulty Estimation

Estimate difficulty from recipe complexity:

```typescript
function estimateDifficulty(
  ingredients: string[],
  instructions: string[],
  categories: string[]
): 'easy' | 'medium' | 'hard' {
  // Check for explicit difficulty in categories
  const categoriesLower = categories.map(c => c.toLowerCase());
  if (categoriesLower.some(c => c.includes('quick') || c.includes('easy'))) {
    return 'easy';
  }
  if (categoriesLower.some(c => c.includes('advanced') || c.includes('complex'))) {
    return 'hard';
  }

  // Heuristic based on counts
  const ingredientCount = ingredients.length;
  const stepCount = instructions.length;

  if (ingredientCount <= 6 && stepCount <= 5) return 'easy';
  if (ingredientCount <= 12 && stepCount <= 10) return 'medium';
  return 'hard';
}
```

### 5. Date Validation

Handle various date formats and reject invalid values:

```typescript
function validateAndParseDate(dateString: string | undefined): Date | null {
  if (!dateString) return null;

  // Reject invalid keywords
  if (['approximate', 'unknown', 'n/a'].includes(dateString.toLowerCase())) {
    return null;
  }

  const date = new Date(dateString);

  // Check if valid
  if (isNaN(date.getTime())) return null;

  // Sanity check year range (1900-2030)
  const year = date.getFullYear();
  if (year < 1900 || year > 2030) return null;

  return date;
}
```

### 6. Nutrition Parsing

Handle both numeric and string nutrition values:

```typescript
function parseNutritionValue(value: number | string | undefined): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'string') {
    // Remove units and parse
    const cleaned = value.replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed.toString();
  }

  return null;
}
```

---

## Image Handling Strategy

### Current Implementation (MVP)

- **Store URL Only**: Image URLs are stored in database but not downloaded
- **Rationale**: Bandwidth optimization, faster ingestion
- **Storage Format**: JSON array with single URL `["https://epicurious.com/image.jpg"]`

### Future Enhancement (Optional)

To download and store images locally:

1. Create image download service
2. Process images in batches
3. Store in `/public/recipe-images/epicurious/`
4. Update database with local paths
5. Add image optimization (resize, webp conversion)

**Estimated Storage**: ~2-5GB for 20K recipe images

---

## Quality Evaluation

Each recipe undergoes AI quality evaluation:

### Evaluation Criteria (0-5 Scale)

1. **Clarity of Instructions** - Are steps clear and logical?
2. **Ingredient Quality** - Well-defined measurements?
3. **Cooking Techniques** - Appropriate methods?
4. **Recipe Completeness** - All necessary information?
5. **Practicality** - Can average home cook make this?

### Rating Scale

- **5.0**: Excellent - Professional quality
- **4.0-4.9**: Very Good - Minor improvements possible
- **3.0-3.9**: Good - Usable with some issues
- **2.0-2.9**: Fair - Significant issues
- **1.0-1.9**: Poor - Major problems
- **0.0-0.9**: Unusable - Critical issues

### Quality Output

Stored in database:
- `systemRating`: Numeric rating (e.g., "4.2")
- `systemRatingReason`: Brief explanation

---

## Embedding Generation

Each recipe gets a semantic embedding for search:

### Embedding Text Construction

```typescript
const embeddingParts = [
  recipe.name,                          // "Classic Pasta Carbonara"
  recipe.description,                   // "Authentic Italian recipe..."
  `Cuisine: ${recipe.cuisine}`,         // "Cuisine: Italian"
  `Tags: ${recipe.tags.join(', ')}`,    // "Tags: pasta, dinner, italian"
  `Ingredients: ${ingredients.slice(0, 10).join(', ')}`  // Top 10 ingredients
];

const embeddingText = embeddingParts.filter(Boolean).join('. ');
```

### Embedding Model

- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensions**: 384
- **Provider**: Hugging Face Inference API
- **Purpose**: Semantic search and recipe similarity

---

## Ingestion Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. READ JSON FILE                                           │
│    - Parse epi_r.json                                       │
│    - Handle malformed entries                               │
│    - Limit to maxRecipes if specified                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. TRANSFORM RECIPE                                         │
│    - Parse ingredients (string → array)                     │
│    - Parse directions (string → array)                      │
│    - Detect cuisine from categories                         │
│    - Estimate difficulty                                    │
│    - Parse nutrition values                                 │
│    - Validate date                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. VALIDATE RECIPE                                          │
│    - Check required fields (name, ingredients, instructions)│
│    - Skip if missing critical data                          │
│    - Check for duplicates (name + source)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. EVALUATE QUALITY (AI)                                    │
│    - Send to OpenRouter (Claude Haiku)                      │
│    - Get rating (0-5) and reasoning                         │
│    - Default to 3.0 on error (don't fail pipeline)          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. GENERATE EMBEDDING                                       │
│    - Build embedding text                                   │
│    - Call Hugging Face API                                  │
│    - Get 384-dimensional vector                             │
│    - Retry with exponential backoff on failure              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. STORE IN DATABASE                                        │
│    - Insert into recipes table                              │
│    - Insert into recipeEmbeddings table                     │
│    - Log success/failure                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. RATE LIMITING                                            │
│    - Wait 500ms before next recipe                          │
│    - Batch progress reporting (every 500 recipes)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Batch Processing

### Default Configuration

- **Batch Size**: 500 recipes per batch
- **Rate Limit**: 500ms between recipes
- **Progress Updates**: Every 500 recipes

### Why Smaller Batches Than Food.com?

- **Longer Content**: Epicurious recipes have more detailed instructions
- **AI Processing**: Quality evaluation takes more time per recipe
- **API Stability**: Reduce load on OpenRouter and Hugging Face APIs

### Customizing Batch Size

```bash
# Process in smaller batches
tsx scripts/data-acquisition/ingest-epicurious.ts 250

# Process in larger batches (if APIs stable)
tsx scripts/data-acquisition/ingest-epicurious.ts 1000
```

---

## Error Handling

### Recoverable Errors

The pipeline continues processing even if individual recipes fail:

1. **Quality Evaluation Fails**: Default to 3.0 rating
2. **Embedding Generation Fails**: Continue without embedding
3. **Malformed JSON Entry**: Skip and log error
4. **Missing Fields**: Skip recipe, log reason
5. **Duplicate Detection**: Skip silently

### Fatal Errors

Pipeline stops on:

1. **JSON File Not Found**: Check download completed
2. **JSON Parse Error**: File corrupted, re-download
3. **Database Connection Error**: Check `DATABASE_URL`
4. **Missing API Keys**: Configure `.env.local`

---

## Troubleshooting

### Problem: Kaggle CLI Not Found

**Error**:
```
Kaggle CLI not installed. Install with: pip install kaggle
```

**Solution**:
```bash
pip install kaggle
kaggle --version
```

---

### Problem: Kaggle Credentials Not Configured

**Error**:
```
Kaggle credentials not configured. Please create kaggle.json
```

**Solution**:
1. Visit https://www.kaggle.com/settings/account
2. Create API token
3. Download `kaggle.json`
4. Place in `~/.kaggle/kaggle.json` (Linux/Mac)
5. Set permissions: `chmod 600 ~/.kaggle/kaggle.json`

---

### Problem: JSON File Not Found

**Error**:
```
JSON file not found: data/recipes/incoming/epicurious/epi_r.json
```

**Solution**:
```bash
# Re-run download
pnpm data:epicurious:download
```

---

### Problem: HuggingFace API Rate Limit

**Error**:
```
Rate limit or model loading after 5 attempts
```

**Solution**:
- Wait a few minutes for model to warm up
- Reduce batch size to lower request rate
- Check API key quota at https://huggingface.co/settings/tokens

---

### Problem: OpenRouter API Error

**Error**:
```
Quality evaluation failed: OpenRouter API error
```

**Solution**:
- Check `OPENROUTER_API_KEY` in `.env.local`
- Verify API quota at https://openrouter.ai/account
- Pipeline continues with default 3.0 rating

---

### Problem: Database Connection Error

**Error**:
```
Failed to store recipe: connection error
```

**Solution**:
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test database connection
pnpm db:studio
```

---

## Advanced Usage

### Re-run Failed Recipes Only

1. Check ingestion log in `data/recipes/incoming/epicurious/logs/`
2. Extract failed recipe names
3. Create filtered JSON file
4. Re-run ingestion on filtered file

### Quality Re-evaluation

To re-evaluate existing recipes:

```bash
# Create custom script
tsx scripts/re-evaluate-epicurious.ts
```

### Embedding Regeneration

To regenerate embeddings for Epicurious recipes:

```sql
-- Delete existing Epicurious embeddings
DELETE FROM recipe_embeddings
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE source = 'epicurious.com'
);
```

Then re-run ingestion (will skip duplicates, regenerate embeddings).

---

## Performance Metrics

### Expected Performance (20,130 Recipes)

- **Download Time**: 2-5 minutes (depends on network)
- **Ingestion Time**: 2-4 hours (with AI evaluation)
- **Success Rate**: ~95-98%
- **Skip Rate**: ~2-5% (duplicates, missing data)
- **Failure Rate**: ~0-1% (API errors, edge cases)

### Bottlenecks

1. **AI Quality Evaluation**: 1-2 seconds per recipe
2. **Embedding Generation**: 0.5-1 second per recipe (after warmup)
3. **Database Insertion**: Negligible (<0.1s per recipe)

### Optimization Strategies

1. **Skip Quality Evaluation**: Comment out evaluation step (saves ~50% time)
2. **Increase Batch Size**: Process 1000 at a time (if APIs stable)
3. **Parallel Processing**: Run multiple ingestion workers (advanced)

---

## Data Quality

### Epicurious Dataset Quality

**Strengths**:
- ✅ High-quality, professionally curated recipes
- ✅ Rich category/tag metadata
- ✅ Nutrition information available
- ✅ Clear ingredient lists and instructions
- ✅ Rating data (though not used in current implementation)

**Weaknesses**:
- ❌ No prep/cook time data
- ❌ No servings information
- ❌ Date format inconsistencies
- ❌ Occasional missing descriptions
- ❌ String vs array format variations

---

## Next Steps

After successful ingestion:

1. **Verify Data**:
   ```sql
   SELECT COUNT(*) FROM recipes WHERE source = 'epicurious.com';
   ```

2. **Test Semantic Search**:
   ```bash
   pnpm test:semantic-search
   ```

3. **Check Quality Distribution**:
   ```sql
   SELECT
     system_rating,
     COUNT(*) as count
   FROM recipes
   WHERE source = 'epicurious.com'
   GROUP BY system_rating
   ORDER BY system_rating DESC;
   ```

4. **Explore in UI**: Browse Epicurious recipes at `/discover`

---

## Related Documentation

- [EPICURIOUS_QUICK_START.md](./EPICURIOUS_QUICK_START.md) - Quick reference guide
- [data-acquisition-foodcom.md](./data-acquisition-foodcom.md) - Food.com acquisition
- [DATA_ACQUISITION_OVERVIEW.md](./DATA_ACQUISITION_OVERVIEW.md) - All data sources

---

**Last Updated**: 2025-10-14
**Dataset Version**: Latest (hugodarwood/epirecipes)
