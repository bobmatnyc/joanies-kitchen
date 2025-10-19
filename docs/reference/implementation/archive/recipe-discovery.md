# Recipe Discovery Pipeline

Automated recipe discovery, extraction, and quality evaluation system.

## Overview

The Recipe Discovery Pipeline automatically finds, extracts, evaluates, and imports recipes from external sources using AI-powered crawling and quality assessment.

## Features

- **Automated Discovery**: Find recipes via web search APIs
- **Smart Extraction**: AI-powered content extraction from recipe URLs
- **Quality Evaluation**: AI rating system for recipe quality
- **Duplicate Detection**: Prevent duplicate recipe imports
- **Batch Processing**: Process multiple recipes efficiently
- **Background Scraping**: Continuous recipe acquisition

## Architecture

### Components

1. **Search Layer**
   - Brave Search API integration
   - Query optimization
   - Source filtering

2. **Extraction Layer**
   - AI-powered content extraction (Perplexity)
   - Structured data parsing
   - Error handling and retries

3. **Quality Layer**
   - AI quality evaluation
   - Rating and reasoning generation
   - Quality threshold filtering

4. **Storage Layer**
   - Database persistence
   - Embedding generation
   - Metadata enrichment

## Usage

### Manual Recipe Discovery

```typescript
import { discoverRecipes } from '@/app/actions/recipe-discovery';

const result = await discoverRecipes({
  query: 'chocolate chip cookies',
  maxResults: 5,
  autoApprove: false,
  weeksAgo: 0  // Current week
});

console.log(`Found ${result.stats.stored} recipes`);
```

### Automated Crawling

```bash
# Run continuous scraper
npx tsx scripts/continuous-scraper.ts

# Or use PM2
pm2 start ecosystem.config.js
```

### Recipe Crawl API

```bash
# Crawl recipes for specific week
curl -X POST http://localhost:3004/api/crawl/weekly \
  -H "Content-Type: application/json" \
  -d '{
    "weeksAgo": 1,
    "maxResults": 10,
    "autoApprove": true
  }'
```

## Configuration

### Environment Variables

```env
# Search API
BRAVE_SEARCH_API_KEY=your_brave_api_key

# AI Services
OPENROUTER_API_KEY=your_openrouter_key
HUGGINGFACE_API_KEY=your_hf_key

# Discovery Settings
MAX_RECIPES_PER_QUERY=10
AUTO_APPROVE_THRESHOLD=4.0
```

### Quality Thresholds

```typescript
// Auto-approve recipes with rating >= 4.0
autoApprove: true
autoApproveThreshold: 4.0

// Manual review for lower-rated recipes
autoApprove: false
```

## Pipeline Workflow

### 1. Search Phase

```
Query → Brave Search API → Recipe URLs
```

- Generates search queries based on week offset
- Filters for recipe-related content
- Deduplicates URLs

### 2. Extraction Phase

```
URLs → Perplexity AI → Structured Recipe Data
```

- Extracts title, ingredients, instructions
- Parses cooking times and servings
- Identifies cuisine and tags

### 3. Quality Evaluation Phase

```
Recipe Data → Claude AI → Quality Rating + Reasoning
```

- Evaluates clarity of instructions
- Assesses ingredient completeness
- Rates overall quality (0.0-5.0)

### 4. Storage Phase

```
Evaluated Recipe → Database + Embeddings
```

- Stores recipe with metadata
- Generates semantic embeddings
- Marks as system recipe if approved

## Monitoring

### Success Metrics

```typescript
{
  searched: 10,      // URLs searched
  converted: 8,      // Successfully extracted
  stored: 7,         // Stored in database
  failed: 1,         // Extraction failures
  duplicates: 2      // Duplicate URLs skipped
}
```

### Error Handling

- Extraction failures logged but don't block pipeline
- Embedding failures don't prevent recipe storage
- Duplicate detection prevents re-import
- Rate limiting respected for all APIs

## Continuous Scraping

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'recipe-scraper',
    script: 'scripts/continuous-scraper.ts',
    interpreter: 'npx',
    interpreterArgs: 'tsx',
    instances: 1,
    autorestart: true,
    watch: false,
    maxMemoryRestart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### Start Scraper

```bash
# Install PM2
npm install -g pm2

# Start scraper
pm2 start ecosystem.config.js

# Monitor
pm2 logs recipe-scraper

# Stop scraper
pm2 stop recipe-scraper
```

## Testing

### Test Recipe Crawl

```bash
# Test single crawl
npx tsx scripts/test-crawl.ts

# Test date validation
npx tsx scripts/test-date-validation.ts
```

### Validate Setup

```bash
# Test Brave Search API
node scripts/test-brave-search.js

# Test Perplexity extraction
npx tsx scripts/test-perplexity-direct.ts
```

## Cost Optimization

### API Usage

- **Brave Search**: Free tier (2,500 queries/month)
- **Perplexity**: Pay-per-request
- **Claude (Quality Eval)**: ~$0.0002 per recipe
- **Embeddings**: Free tier available

### Optimization Strategies

1. **Batch Processing**: Process multiple recipes per API call
2. **Caching**: Store search results to avoid duplicate queries
3. **Rate Limiting**: Respect API limits with delays
4. **Quality Filtering**: Only import high-quality recipes

## Troubleshooting

### No Recipes Found

```bash
# Check API keys
echo $BRAVE_SEARCH_API_KEY

# Test search manually
node scripts/test-brave-search.js
```

### Extraction Failures

- Check Perplexity API quota
- Verify URL accessibility
- Review extraction logs
- Test with known-good recipe URL

### Embedding Errors

- Embeddings are optional (recipes still stored)
- Check Hugging Face API key
- See Embedding Implementation guide

## Related Documentation

- [Semantic Search Guide](../guides/semantic-search.md)
- [Rating System Guide](../guides/rating-system.md)
- [Data Acquisition Guide](../guides/data-acquisition.md)
- [Embeddings Implementation](./embeddings.md)

---

**Last Updated:** October 2025
**Version:** 1.0.0
