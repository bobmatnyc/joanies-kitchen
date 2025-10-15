# OpenRecipes Dataset - Data Acquisition Guide

**Complete guide to downloading and ingesting OpenRecipes dataset**

## Table of Contents

1. [Overview](#overview)
2. [Dataset Information](#dataset-information)
3. [Prerequisites](#prerequisites)
4. [Download Process](#download-process)
5. [Ingestion Workflow](#ingestion-workflow)
6. [Schema Mapping](#schema-mapping)
7. [Data Transformation](#data-transformation)
8. [Quality Filtering](#quality-filtering)
9. [Troubleshooting](#troubleshooting)
10. [Performance Expectations](#performance-expectations)

---

## Overview

OpenRecipes is a community-maintained collection of 200K+ recipes from multiple sources, stored in schema.org/Recipe JSON format. This guide covers the complete process of downloading and ingesting OpenRecipes data into Joanie's Kitchen.

### Why OpenRecipes?

- **Comprehensive**: 200K+ recipes from diverse sources
- **Standardized**: Uses schema.org/Recipe format
- **Free**: Open-source, no API keys required
- **Multi-source**: Aggregates from AllRecipes, Food Network, Epicurious, BBC Good Food, and more

### Key Features

- ✅ schema.org/Recipe JSON parsing
- ✅ ISO 8601 duration conversion
- ✅ Flexible instruction parsing (HowToStep, string, array)
- ✅ Multiple image format support
- ✅ AI quality evaluation
- ✅ Semantic search embeddings
- ✅ Duplicate detection by URL and name
- ✅ Source attribution

---

## Dataset Information

### Repository

- **GitHub**: [openrecipes/openrecipes](https://github.com/openrecipes/openrecipes)
- **License**: Open Data Commons
- **Format**: JSON (schema.org/Recipe)
- **Size**: ~200K recipes, multiple JSON dumps

### Available Sources

| Source | Approximate Count | File |
|--------|------------------|------|
| AllRecipes | 80K+ | `allrecipes.json` |
| Food Network | 40K+ | `foodnetwork.json` |
| Epicurious | 20K+ | `epicurious.json` |
| BBC Good Food | 10K+ | `bbcgoodfood.json` |
| RecipeLand | 15K+ | `recipeland.json` |
| Others | 35K+ | Various files |

**Note**: File names and availability may change. Check the repository for current structure.

### schema.org/Recipe Format

OpenRecipes uses the official [schema.org/Recipe](https://schema.org/Recipe) specification:

```json
{
  "@context": "http://schema.org",
  "@type": "Recipe",
  "name": "Classic Spaghetti Carbonara",
  "description": "Authentic Italian pasta dish",
  "recipeIngredient": [
    "400g spaghetti",
    "200g pancetta",
    "4 large eggs",
    "100g Parmesan cheese"
  ],
  "recipeInstructions": [
    {
      "@type": "HowToStep",
      "text": "Cook pasta in salted boiling water"
    },
    {
      "@type": "HowToStep",
      "text": "Fry pancetta until crispy"
    }
  ],
  "prepTime": "PT10M",
  "cookTime": "PT15M",
  "recipeYield": "4 servings",
  "image": "https://example.com/carbonara.jpg",
  "url": "https://allrecipes.com/recipe/12345",
  "datePublished": "2023-01-15"
}
```

---

## Prerequisites

### System Requirements

- **Node.js**: 18+ (for tsx)
- **Storage**: 2GB free (for JSON dumps)
- **Database**: PostgreSQL with pgvector extension
- **Memory**: 4GB+ RAM recommended

### Environment Variables

Required in `.env.local`:

```env
# Database
DATABASE_URL=postgresql://...

# AI Services
HUGGINGFACE_API_KEY=hf_...  # For embeddings
OPENROUTER_API_KEY=sk-or-... # For quality evaluation
```

### Dependencies

All dependencies are already in `package.json`. Just ensure they're installed:

```bash
pnpm install
```

---

## Download Process

### Option 1: Automatic Download (Recommended)

Download all available sources:

```bash
pnpm data:openrecipes:download
```

This runs: `tsx scripts/data-acquisition/download-openrecipes.ts --all`

### Option 2: Selective Download

Download specific sources:

```bash
tsx scripts/data-acquisition/download-openrecipes.ts --sources=allrecipes,foodnetwork
```

### Option 3: Sample Download

Download sample files for testing:

```bash
tsx scripts/data-acquisition/download-openrecipes.ts --sample
```

### Download Script Details

**Script**: `scripts/data-acquisition/download-openrecipes.ts`

**How it works**:
1. Downloads JSON files from GitHub raw content URLs
2. Validates JSON structure
3. Counts recipes in each file
4. Saves metadata (file list, record counts, download timestamp)

**Output Directory**: `data/recipes/incoming/openrecipes/`

**Files Created**:
- `allrecipes.json` - AllRecipes recipes
- `foodnetwork.json` - Food Network recipes
- `epicurious.json` - Epicurious recipes
- `bbcgoodfood.json` - BBC Good Food recipes
- `metadata.json` - Download metadata
- `logs/` - Download logs

### Manual Download (Fallback)

If automatic download fails:

1. Clone the repository:
   ```bash
   git clone https://github.com/openrecipes/openrecipes
   ```

2. Copy JSON files to data directory:
   ```bash
   cp openrecipes/*.json data/recipes/incoming/openrecipes/
   ```

---

## Ingestion Workflow

### Quick Start

Ingest all downloaded recipes:

```bash
pnpm data:openrecipes:ingest
```

### Full Pipeline (Download + Ingest)

```bash
pnpm data:openrecipes:full
```

### Sample Ingestion

Test with 1000 recipes:

```bash
pnpm data:openrecipes:sample
```

### Advanced Options

**Specific file only**:
```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts --file allrecipes.json
```

**Custom batch size**:
```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts 250
```

**Limit total recipes**:
```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts --limit 5000
```

### Ingestion Process

For each recipe, the script:

1. **Validate**: Check for required fields (name, ingredients, instructions)
2. **Transform**: Convert schema.org format to database schema
3. **Parse**: Handle ISO 8601 durations, HowToStep instructions, ImageObjects
4. **Deduplicate**: Check for existing recipe by URL and name
5. **Evaluate**: AI quality rating (0-5 scale)
6. **Embed**: Generate semantic search embedding
7. **Store**: Insert recipe and embedding into database
8. **Log**: Track success, failures, and statistics

---

## Schema Mapping

### Complete Field Mapping

| schema.org/Recipe | Database Column | Transformation |
|-------------------|----------------|----------------|
| `name` or `title` | `name` | Direct mapping |
| `description` | `description` | Direct mapping |
| `recipeIngredient` or `ingredients` | `ingredients` | JSON array |
| `recipeInstructions` or `instructions` | `instructions` | Parse HowToStep → JSON array |
| `prepTime` | `prepTime` | ISO 8601 → minutes |
| `cookTime` | `cookTime` | ISO 8601 → minutes |
| `recipeYield` or `servings` | `servings` | Parse number from string |
| `recipeCuisine` | `cuisine` | First value if array |
| `recipeCategory` | `tags` | JSON array |
| `keywords` | `tags` | Merge with categories |
| `image` | `images` | Parse ImageObject → JSON array |
| `url` | `source` | Direct mapping (URL) |
| `datePublished` | `discoveryDate` | Parse date |
| N/A | `difficulty` | Estimated from complexity |
| N/A | `isSystemRecipe` | Always `true` |
| N/A | `isPublic` | Always `true` |
| N/A | `userId` | `system_imported` |

### Fields Not in OpenRecipes

The following are set to defaults or estimated:

- `difficulty`: Estimated from ingredient/step count
- `nutrition`: Not typically present (set to null)
- `prepTime`/`cookTime`: May be missing (set to null if not present)

---

## Data Transformation

### ISO 8601 Duration Parsing

OpenRecipes uses ISO 8601 format for durations:

| ISO 8601 | Minutes | Example |
|----------|---------|---------|
| `PT30M` | 30 | 30 minutes |
| `PT1H30M` | 90 | 1 hour 30 minutes |
| `PT2H` | 120 | 2 hours |
| `P1DT2H` | 1560 | 1 day 2 hours (26 hours) |

**Parser Function** (`parseISO8601Duration`):
```typescript
function parseISO8601Duration(duration: string): number | null {
  // Regex: P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?
  const regex = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const match = duration.match(regex);

  const days = parseInt(match[1] || '0');
  const hours = parseInt(match[2] || '0');
  const minutes = parseInt(match[3] || '0');
  const seconds = parseInt(match[4] || '0');

  return days * 1440 + hours * 60 + minutes + Math.ceil(seconds / 60);
}
```

### Instruction Parsing

OpenRecipes instructions can be in multiple formats:

#### Format 1: Array of HowToStep Objects
```json
{
  "recipeInstructions": [
    {
      "@type": "HowToStep",
      "text": "Preheat oven to 350°F"
    },
    {
      "@type": "HowToStep",
      "text": "Mix ingredients"
    }
  ]
}
```

#### Format 2: HowToSection with Nested Steps
```json
{
  "recipeInstructions": [
    {
      "@type": "HowToSection",
      "name": "Preparation",
      "itemListElement": [
        { "@type": "HowToStep", "text": "Step 1" },
        { "@type": "HowToStep", "text": "Step 2" }
      ]
    }
  ]
}
```

#### Format 3: Simple String Array
```json
{
  "recipeInstructions": [
    "Preheat oven to 350°F",
    "Mix ingredients",
    "Bake for 30 minutes"
  ]
}
```

#### Format 4: Single String with Newlines
```json
{
  "recipeInstructions": "Preheat oven.\nMix ingredients.\nBake."
}
```

**Parser Function** (`parseInstructions`):
- Handles all formats above
- Extracts `text`, `itemListElement`, or `name` properties
- Splits strings by newlines
- Returns flat array of instruction strings

### Image Parsing

OpenRecipes images can be:

#### Format 1: String URL
```json
{
  "image": "https://example.com/recipe.jpg"
}
```

#### Format 2: Array of URLs
```json
{
  "image": [
    "https://example.com/recipe-1.jpg",
    "https://example.com/recipe-2.jpg"
  ]
}
```

#### Format 3: ImageObject
```json
{
  "image": {
    "@type": "ImageObject",
    "url": "https://example.com/recipe.jpg",
    "contentUrl": "https://example.com/recipe-full.jpg",
    "thumbnailUrl": "https://example.com/recipe-thumb.jpg"
  }
}
```

#### Format 4: Array of ImageObjects
```json
{
  "image": [
    {
      "@type": "ImageObject",
      "url": "https://example.com/recipe-1.jpg"
    },
    {
      "@type": "ImageObject",
      "url": "https://example.com/recipe-2.jpg"
    }
  ]
}
```

**Parser Function** (`parseImages`):
- Extracts URLs from all formats
- Prioritizes: `url` > `contentUrl` > `thumbnailUrl`
- Returns array of image URLs

### Servings Parsing

OpenRecipes servings field (`recipeYield`) is highly inconsistent:

| Input | Parsed Output |
|-------|---------------|
| `4` | 4 |
| `"4 servings"` | 4 |
| `"Makes 8"` | 8 |
| `"6-8 people"` | 6 |
| `"Serves 4-6"` | 4 |

**Parser Function** (`parseServings`):
- Extracts first number from string
- Handles numeric input
- Returns null if no number found

---

## Quality Filtering

### Validation Rules

Recipes must pass validation to be ingested:

```typescript
function isRecipeValid(recipe: OpenRecipe): boolean {
  const name = recipe.name || recipe.title;
  const ingredients = recipe.recipeIngredient || recipe.ingredients;
  const instructions = recipe.recipeInstructions || recipe.instructions;

  return (
    name && name.length > 3 &&
    ingredients && (Array.isArray(ingredients) ? ingredients.length > 0 : ingredients.length > 10) &&
    instructions
  );
}
```

**Minimum Requirements**:
- ✅ Name: At least 4 characters
- ✅ Ingredients: At least 1 ingredient (or 10 chars if string)
- ✅ Instructions: Not empty

### AI Quality Evaluation

Each recipe is evaluated using Claude Haiku for quality:

**Evaluation Criteria**:
1. Clarity of instructions
2. Ingredient quality and completeness
3. Cooking techniques
4. Recipe completeness
5. Practicality for home cooks

**Rating Scale**:
- 5.0: Excellent - Professional quality
- 4.0-4.9: Very Good - Highly usable
- 3.0-3.9: Good - Usable with minor issues
- 2.0-2.9: Fair - Significant issues
- 1.0-1.9: Poor - Major problems
- 0.0-0.9: Unusable - Critical issues

**Result**: Stored in `systemRating` and `systemRatingReason` columns

### Duplicate Detection

Two-level duplicate check:

1. **By URL** (most reliable):
   ```sql
   SELECT id FROM recipes WHERE source = 'https://allrecipes.com/recipe/12345'
   ```

2. **By Name + Source**:
   ```sql
   SELECT id FROM recipes WHERE name = 'Spaghetti Carbonara' AND source = 'allrecipes.com'
   ```

**Rationale**: URL matching prevents duplicates even if recipe names change. Name matching catches recipes without URLs.

---

## Troubleshooting

### Download Issues

**Problem**: `HTTP 404: File not found`

**Solution**: Repository structure may have changed. Manual download:
```bash
git clone https://github.com/openrecipes/openrecipes
cp openrecipes/*.json data/recipes/incoming/openrecipes/
```

---

**Problem**: Download stuck or very slow

**Solution**: Large files take time. Check progress:
```bash
ls -lh data/recipes/incoming/openrecipes/
```

---

### Ingestion Issues

**Problem**: `JSON.parse error` during ingestion

**Solution**: File may be corrupted. Re-download:
```bash
rm data/recipes/incoming/openrecipes/*.json
pnpm data:openrecipes:download
```

---

**Problem**: `HUGGINGFACE_API_KEY not configured`

**Solution**: Add to `.env.local`:
```env
HUGGINGFACE_API_KEY=hf_...
```
Get key from: https://huggingface.co/settings/tokens

---

**Problem**: `OPENROUTER_API_KEY not configured`

**Solution**: Add to `.env.local`:
```env
OPENROUTER_API_KEY=sk-or-...
```
Get key from: https://openrouter.ai/keys

---

**Problem**: Rate limit errors from AI services

**Solution**: Reduce batch size or increase delay:
```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts 100  # Smaller batches
```

---

**Problem**: High skip rate (many recipes skipped)

**Solution**: Normal for OpenRecipes. Community data has variable quality. Typical skip rate: 20-30%

Reasons for skipping:
- Missing required fields
- Invalid data format
- Duplicate recipes

---

**Problem**: Database connection timeout

**Solution**: Check `DATABASE_URL`:
```bash
echo $DATABASE_URL
```

Test connection:
```bash
pnpm db:studio
```

---

### Performance Issues

**Problem**: Ingestion very slow

**Bottlenecks**:
1. AI quality evaluation (500ms per recipe)
2. Embedding generation (2s per recipe on cold start)
3. Network latency to Neon PostgreSQL

**Solutions**:
- Skip quality evaluation for testing (comment out in code)
- Use larger batch sizes for better throughput
- Run during off-peak hours

---

**Problem**: Out of memory errors

**Solution**: Process files one at a time:
```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts --file allrecipes.json
# Then:
tsx scripts/data-acquisition/ingest-openrecipes.ts --file foodnetwork.json
```

---

## Performance Expectations

### Download Times

| Source | File Size | Download Time (estimate) |
|--------|-----------|--------------------------|
| AllRecipes | 150 MB | 2-5 minutes |
| Food Network | 80 MB | 1-3 minutes |
| Epicurious | 40 MB | 30-90 seconds |
| BBC Good Food | 20 MB | 15-45 seconds |
| **Total** | **~300 MB** | **5-10 minutes** |

*Times vary based on connection speed*

### Ingestion Times

**Processing Rate**: ~1-2 recipes/second (with AI evaluation and embeddings)

| Recipe Count | Estimated Time |
|--------------|----------------|
| 1,000 | 10-20 minutes |
| 10,000 | 2-3 hours |
| 50,000 | 8-12 hours |
| 200,000 | 30-50 hours |

**Factors**:
- AI quality evaluation: +500ms per recipe
- Embedding generation: +1-2s per recipe (cold start), +200ms (warm)
- Database insertion: +100ms per recipe
- Rate limiting: +500ms delay between recipes

### Resource Usage

**Storage**:
- JSON dumps: ~300 MB
- Database recipes: ~500 MB (200K recipes)
- Database embeddings: ~300 MB (200K × 384 dimensions)
- **Total**: ~1.1 GB

**Memory**:
- Download script: <100 MB
- Ingestion script: 200-500 MB (varies with batch size)

**Network**:
- Download: 300 MB
- AI API calls: ~50 KB per recipe × 200K = 10 GB
- Database writes: ~2 KB per recipe × 200K = 400 MB

---

## Best Practices

### For Testing

1. Start with sample:
   ```bash
   pnpm data:openrecipes:sample
   ```

2. Check database:
   ```bash
   pnpm db:studio
   ```

3. Verify recipes imported correctly

### For Production

1. Download all sources:
   ```bash
   pnpm data:openrecipes:download
   ```

2. Ingest with default settings:
   ```bash
   pnpm data:openrecipes:ingest
   ```

3. Monitor logs for errors

4. Check completion:
   ```bash
   tail -f data/recipes/incoming/openrecipes/logs/ingestion-*.json
   ```

### For Large Datasets

1. Process files sequentially:
   ```bash
   tsx scripts/data-acquisition/ingest-openrecipes.ts --file allrecipes.json
   tsx scripts/data-acquisition/ingest-openrecipes.ts --file foodnetwork.json
   # etc.
   ```

2. Run overnight

3. Use database backups before large ingestions

---

## Next Steps

After successful ingestion:

1. **Verify Data**:
   ```bash
   pnpm db:studio
   # Check recipes and recipeEmbeddings tables
   ```

2. **Test Search**:
   ```bash
   pnpm test:semantic-search
   ```

3. **Check Quality Distribution**:
   Query database for systemRating stats

4. **Run All Sources**:
   ```bash
   pnpm data:all  # Ingests TheMealDB, Food.com, Epicurious, and OpenRecipes
   ```

---

## Additional Resources

- **OpenRecipes GitHub**: https://github.com/openrecipes/openrecipes
- **schema.org/Recipe**: https://schema.org/Recipe
- **HowToStep**: https://schema.org/HowToStep
- **ISO 8601 Durations**: https://en.wikipedia.org/wiki/ISO_8601#Durations

---

**Last Updated**: 2025-10-14
**Maintained By**: Joanie's Kitchen Team
