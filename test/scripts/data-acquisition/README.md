# Data Acquisition Scripts

**Multi-Source Recipe Data Pipeline for Joanie's Kitchen**

---

## Overview

This directory contains scripts for acquiring recipe data from multiple sources:

1. **TheMealDB** - 600+ recipes from TheMealDB.com API
2. **Food.com** - 180K+ recipes from Kaggle dataset
3. **Epicurious** - Coming soon

All scripts follow the same pattern:
1. **Download/Crawl** - Fetch raw data
2. **Parse** - Transform to standard format
3. **Ingest** - Store in database with AI evaluation and embeddings

---

## Quick Start

### TheMealDB (Easy, No Setup)
```bash
# Sample (50 recipes)
npm run data:themealdb:sample

# Full crawl (600+ recipes)
npm run data:themealdb
```

### Food.com (Requires Kaggle Setup)
```bash
# Setup Kaggle API credentials
npm run data:setup

# Sample test (1000 recipes, ~10 minutes)
npm run data:food-com:sample

# Full ingestion (180K recipes, 10-24 hours)
npm run data:food-com:full
```

---

## Available Scripts

### Setup
- `npm run data:setup` - Validate Kaggle API credentials

### TheMealDB
- `npm run data:themealdb` - Crawl all recipes (~600)
- `npm run data:themealdb:sample` - Sample crawl (50 recipes)

### Food.com
- `npm run data:food-com` - Download dataset from Kaggle
- `npm run data:food-com:ingest` - Ingest recipes into database
- `npm run data:food-com:full` - Download + Ingest (complete workflow)
- `npm run data:food-com:sample` - Test with 1000 recipes

### Universal
- `npm run data:ingest <file>` - Ingest from JSON file
- `npm run data:acquire-all` - Run all data sources

---

## Directory Structure

```
scripts/data-acquisition/
├── README.md                    # This file
├── setup-kaggle.ts             # Kaggle credential validation
├── download-food-com.ts        # Download Food.com dataset
├── ingest-foodcom.ts          # Food.com ingestion pipeline
├── crawl-themealdb.ts         # TheMealDB crawler
├── ingest-recipes.ts          # Universal ingestion script
├── acquire-all.ts             # Master orchestration script
└── parsers/
    ├── food-com-parser.ts     # Food.com CSV parser
    └── themealdb-parser.ts    # TheMealDB API parser

data/recipes/incoming/
├── themealdb/
│   ├── recipes.json           # TheMealDB recipes
│   ├── metadata.json          # Crawl metadata
│   └── logs/                  # Ingestion logs
├── food-com/
│   ├── RAW_recipes.csv        # Food.com dataset
│   ├── RAW_interactions.csv   # User interactions
│   ├── metadata.json          # Download metadata
│   └── logs/                  # Ingestion logs
└── epicurious/
    └── (coming soon)
```

---

## Data Sources

### 1. TheMealDB
- **Source**: TheMealDB.com API (free tier)
- **Size**: ~600 recipes
- **Setup**: None required
- **Duration**: 5-10 minutes
- **Documentation**: See TheMealDB API docs

**Features**:
- ✅ Free, no authentication
- ✅ High-quality recipes
- ✅ Includes images and videos
- ✅ Categorized by cuisine

### 2. Food.com
- **Source**: Kaggle dataset
- **Size**: 180K+ recipes
- **Setup**: Kaggle API credentials
- **Duration**: 10-24 hours
- **Documentation**: `docs/guides/data-acquisition-foodcom.md`

**Features**:
- ✅ Massive dataset (180K recipes)
- ✅ User ratings and reviews
- ✅ Detailed nutrition information
- ✅ Ingredient lists and instructions

**Setup Required**:
1. Create Kaggle account
2. Download API token (`kaggle.json`)
3. Configure credentials: `~/.kaggle/kaggle.json`
4. Install Kaggle CLI: `pip install kaggle`

### 3. Epicurious (Coming Soon)
- **Source**: Kaggle dataset
- **Size**: ~20K recipes
- **Setup**: Kaggle API credentials
- **Duration**: 2-4 hours

---

## Pipeline Architecture

### Stage 1: Download/Crawl
```
External Source → Raw Data Files
```
- TheMealDB: API calls → JSON
- Food.com: Kaggle download → CSV
- Epicurious: Kaggle download → CSV

### Stage 2: Parse
```
Raw Data → Standardized Recipe Format
```
- Parse various formats (CSV, JSON, API responses)
- Transform to common schema
- Validate required fields
- Handle edge cases

### Stage 3: Ingest
```
Standardized Recipe → Database
```
1. **AI Quality Evaluation** (0-5 rating)
   - Uses: `src/lib/ai/recipe-quality-evaluator.ts`
   - Model: `anthropic/claude-3-haiku`
   - Criteria: Clarity, completeness, practicality

2. **Embedding Generation** (384d vector)
   - Uses: `src/lib/ai/embeddings.ts`
   - Model: `sentence-transformers/all-MiniLM-L6-v2`
   - Purpose: Semantic search

3. **Database Storage**
   - Table: `recipes` (recipe data)
   - Table: `recipeEmbeddings` (search vectors)
   - Duplicate detection by name + source
   - Error handling and logging

---

## Standard Recipe Format

All parsers transform to this format:

```typescript
interface StandardRecipe {
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  category?: string;
  cuisine?: string;
  tags?: string[];
  nutrition?: Record<string, string>;
  rating?: number;
  reviewCount?: number;
  images?: string[];
  videoUrl?: string;
  source: string;
  sourceUrl: string;
}
```

---

## Error Handling

### Automatic Retries
- **API Calls**: 3-5 retries with exponential backoff
- **Embedding Generation**: 5 retries (handles cold starts)
- **Quality Evaluation**: 3 retries

### Graceful Degradation
- Missing embeddings: Recipe stored, embedding generated later
- Failed quality evaluation: Default rating of 3.0
- Invalid fields: Recipe skipped, logged as error

### Duplicate Detection
- Checks: Exact name + source URL
- Action: Skip duplicate, log message
- Safe: Can re-run scripts after failures

### Logging
- Console output: Real-time progress
- JSON logs: Detailed statistics and errors
- Location: `data/recipes/incoming/{source}/logs/`

---

## Performance

### TheMealDB
- **Speed**: ~10 requests/second
- **Duration**: 5-10 minutes for 600 recipes
- **Memory**: <100MB

### Food.com
- **Speed**: ~10 recipes/second
- **Duration**: 10-24 hours for 180K recipes
- **Memory**: ~500MB
- **Rate Limiting**: 500ms between recipes

### Database
- **Storage**: ~2.5GB for 180K recipes
- **Embeddings**: ~500MB
- **Indexes**: pgvector for similarity search

---

## Requirements

### API Keys
Add to `.env.local`:

```env
# OpenRouter (quality evaluation)
OPENROUTER_API_KEY=sk-or-...

# Hugging Face (embeddings)
HUGGINGFACE_API_KEY=hf_...

# Database
DATABASE_URL=postgresql://...
```

### External Tools
- **Node.js**: v18+ with pnpm
- **tsx**: For running TypeScript scripts
- **Kaggle CLI**: For Food.com dataset (`pip install kaggle`)
- **PostgreSQL**: With pgvector extension

---

## Monitoring

### Real-Time Progress
Watch console output during ingestion:
```
[1234/180164] Processing "Recipe Name"...
[1234/180164]   Quality: 4.2/5.0 - Clear instructions
[1234/180164]   Embedding: ✓ Generated (384d)
[1234/180164] ✓ Stored "Recipe Name"
```

### Database
```bash
npm run db:studio
```
Navigate to:
- `recipes` table: See imported recipes
- `recipeEmbeddings` table: See embeddings

### Logs
```bash
# List logs
ls data/recipes/incoming/*/logs/

# View latest Food.com log
cat data/recipes/incoming/food-com/logs/ingestion-*.json | jq
```

---

## Troubleshooting

### Common Issues

**Kaggle CLI Not Found**
```bash
pip install kaggle
```

**Kaggle API Not Configured**
```bash
npm run data:setup
# Follow instructions
```

**CSV File Not Found**
```bash
npm run data:food-com  # Download first
```

**Hugging Face Rate Limit**
Wait 5-10 minutes, then resume. Duplicates are skipped.

**Database Connection Error**
```bash
# Verify DATABASE_URL in .env.local
npm run db:push
```

### Detailed Troubleshooting
- **Food.com**: `docs/guides/data-acquisition-foodcom.md`
- **TheMealDB**: See TheMealDB API documentation

---

## Documentation

### Comprehensive Guides
- **Food.com Full Guide**: `docs/guides/data-acquisition-foodcom.md` (500+ lines)
- **Food.com Quick Start**: `docs/guides/FOODCOM_QUICK_START.md`
- **Food.com Implementation**: `docs/guides/FOODCOM_IMPLEMENTATION_SUMMARY.md`

### Code Documentation
- Inline comments in all scripts
- TypeScript type definitions
- JSDoc for public functions

---

## Contributing

### Adding New Data Source

1. **Create downloader** (if external dataset)
   ```typescript
   // scripts/data-acquisition/download-{source}.ts
   export async function download{Source}() {
     // Download logic
   }
   ```

2. **Create parser**
   ```typescript
   // scripts/data-acquisition/parsers/{source}-parser.ts
   export function parse{Source}(data): StandardRecipe[] {
     // Transform to StandardRecipe format
   }
   ```

3. **Create ingester**
   ```typescript
   // scripts/data-acquisition/ingest-{source}.ts
   // Use existing ingest-recipes.ts as template
   ```

4. **Add package.json scripts**
   ```json
   {
     "data:{source}": "tsx scripts/data-acquisition/download-{source}.ts",
     "data:{source}:ingest": "tsx scripts/data-acquisition/ingest-{source}.ts",
     "data:{source}:full": "npm run data:{source} && npm run data:{source}:ingest"
   }
   ```

5. **Write documentation**
   - Full guide: `docs/guides/data-acquisition-{source}.md`
   - Quick start: `docs/guides/{SOURCE}_QUICK_START.md`

### Code Quality Standards
- ✅ TypeScript with strict types
- ✅ Comprehensive error handling
- ✅ Automatic retries for API calls
- ✅ Duplicate detection
- ✅ Progress logging
- ✅ JSON log files
- ✅ Reuse existing utilities (quality evaluator, embeddings)

---

## Future Enhancements

### Planned Data Sources
- [ ] Epicurious dataset (Kaggle)
- [ ] AllRecipes scraper
- [ ] NYT Cooking (if API available)
- [ ] Recipe websites scraping

### Planned Features
- [ ] Parallel processing (multiple workers)
- [ ] Image downloading and storage
- [ ] Video downloading
- [ ] User interaction import (ratings, comments)
- [ ] Cuisine auto-detection
- [ ] Difficulty auto-inference
- [ ] Serving size extraction from text
- [ ] Recipe deduplication across sources

### Optimizations
- [ ] Batch embedding generation
- [ ] Database bulk inserts
- [ ] Connection pooling
- [ ] Caching for repeated API calls

---

## Support

### Issues
- Check documentation first
- Review troubleshooting sections
- Check logs: `data/recipes/incoming/*/logs/`

### Questions
- Food.com: See `docs/guides/data-acquisition-foodcom.md`
- General: See main project README.md

---

**Last Updated**: 2025-10-14
**Maintained By**: Recipe Manager Team
**Status**: Production Ready ✅
