# Recipe Crawl Pipeline Documentation

## Overview

The Recipe Crawl Pipeline is a complete system for discovering, extracting, validating, and storing recipes from the web. It uses SerpAPI for search, Claude AI for extraction, and PostgreSQL with pgvector for storage.

## Pipeline Architecture

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Search  │ →  │ Convert │ →  │ Approve │ →  │  Store  │
│ SerpAPI │    │ Claude  │    │ Validate│    │   DB    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

## Pipeline Steps

### Step 1: Search

**Purpose:** Find recipe URLs using SerpAPI

**How it works:**
- Uses SerpAPI Google Search to find recipe URLs
- Automatically adds "recipe" keyword to searches
- Filters results to known recipe sites (optional)
- Returns up to N results (default: 5)

**Supported Recipe Sites:**
- allrecipes.com
- foodnetwork.com
- seriouseats.com
- bonappetit.com
- epicurious.com
- tasty.co
- simplyrecipes.com
- food.com
- delish.com
- myrecipes.com
- thekitchn.com
- cookieandkate.com
- minimalistbaker.com
- budgetbytes.com
- smittenkitchen.com

**Code Example:**
```typescript
const results = await searchRecipesOnline('pasta carbonara', {
  maxResults: 10,
  filterToRecipeSites: true
});
```

### Step 2: Convert

**Purpose:** Extract recipe data from URLs using AI

**How it works:**
- Fetches webpage HTML content
- Uses Claude 3 Haiku via OpenRouter to extract recipe data
- Parses structured recipe information
- Returns validated recipe object

**Extracted Fields:**
- name (required)
- description (required)
- ingredients[] (required)
- instructions[] (required)
- prepTime (optional)
- cookTime (optional)
- servings (optional)
- images[] (optional, max 6)
- cuisine (optional)
- tags[] (optional)
- difficulty (optional: easy/medium/hard)
- confidenceScore (0-1)
- isValid (boolean)

**Code Example:**
```typescript
const result = await convertUrlToRecipe('https://example.com/recipe');
if (result.success) {
  console.log(result.recipe.name);
  console.log(result.recipe.ingredients);
}
```

### Step 3: Approve

**Purpose:** Validate recipe quality and completeness

**How it works:**
- Checks for required fields (name, ingredients, instructions)
- Validates minimum content thresholds
- Calculates quality score (0-100)
- Approves if score >= 60

**Validation Criteria:**
- Name: Must be at least 3 characters
- Ingredients: Must have at least 3 items
- Instructions: Must have at least 2 steps
- Description: Must be at least 10 characters
- Confidence: Must be >= 0.7

**Code Example:**
```typescript
const validation = await validateRecipe(extractedRecipe);
if (validation.approved) {
  console.log('Recipe approved with score:', validation.score);
} else {
  console.log('Issues:', validation.issues);
}
```

### Step 4: Store

**Purpose:** Save recipe to database with embeddings and images

**How it works:**
- Validates and stores image URLs (up to 6)
- Generates embedding for semantic search
- Saves recipe to PostgreSQL
- Saves embedding to pgvector
- Links recipe to user or system

**Database Fields:**
- All recipe data (name, description, ingredients, etc.)
- Source URL and search query (provenance tracking)
- Discovery date and confidence score
- Validation and embedding model names
- User ID (or 'system' for public recipes)

**Code Example:**
```typescript
const result = await storeRecipe(recipe, {
  sourceUrl: 'https://example.com/recipe',
  searchQuery: 'pasta carbonara'
});
console.log('Stored with ID:', result.recipeId);
```

## Complete Pipeline Usage

### Basic Usage

```typescript
import { crawlAndStoreRecipes } from '@/app/actions/recipe-crawl';

const result = await crawlAndStoreRecipes('chocolate cake', {
  maxResults: 5,
  autoApprove: false,
  minConfidence: 0.7
});

console.log('Stats:', result.stats);
console.log('Recipes:', result.recipes);
```

### Advanced Usage

```typescript
// Custom pipeline with manual control
const searchResults = await searchRecipesOnline('pizza margherita', {
  maxResults: 10,
  filterToRecipeSites: true
});

for (const result of searchResults.results) {
  const conversion = await convertUrlToRecipe(result.url);

  if (conversion.success && conversion.recipe) {
    const validation = await validateRecipe(conversion.recipe);

    if (validation.approved) {
      await storeRecipe(conversion.recipe, {
        sourceUrl: result.url,
        searchQuery: 'pizza margherita'
      });
    }
  }
}
```

## UI Component

### RecipeCrawlPanel

Interactive React component for crawling recipes.

**Location:** `src/components/recipe/RecipeCrawlPanel.tsx`

**Features:**
- Search input with Enter key support
- Live progress indicator
- Statistics dashboard
- Detailed results view
- Status badges (Stored, Rejected, Failed)

**Usage:**
```tsx
import { RecipeCrawlPanel } from '@/components/recipe/RecipeCrawlPanel';

export default function CrawlPage() {
  return (
    <div className="container mx-auto py-8">
      <RecipeCrawlPanel />
    </div>
  );
}
```

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# SerpAPI for web recipe crawling
SERPAPI_KEY=your_serpapi_key_here

# OpenRouter for AI extraction
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Hugging Face for embeddings
HUGGINGFACE_API_KEY=hf_your-key-here

# Database
DATABASE_URL=postgresql://user:pass@host/db
```

### Get API Keys

1. **SerpAPI:** https://serpapi.com/
   - Free tier: 100 searches/month
   - Paid: Starting at $50/month for 5,000 searches

2. **OpenRouter:** https://openrouter.ai/
   - Pay-per-use pricing
   - Claude 3 Haiku: ~$0.25 per 1M tokens

3. **Hugging Face:** https://huggingface.co/settings/tokens
   - Free tier available
   - Unlimited API calls (rate-limited)

## Image Handling

### Current Implementation

Images are stored as URLs in the database:
- Maximum 6 images per recipe
- URLs validated before storage
- Original URLs preserved

### Future Enhancement

For production, implement cloud storage:

```typescript
async function downloadAndStoreImages(imageUrls: string[]): Promise<string[]> {
  const stored = [];

  for (const url of imageUrls.slice(0, 6)) {
    // Download image
    const response = await fetch(url);
    const blob = await response.blob();

    // Upload to Vercel Blob Storage
    const { url: blobUrl } = await put(`recipes/${uuid()}.jpg`, blob, {
      access: 'public',
    });

    stored.push(blobUrl);
  }

  return stored;
}
```

## Error Handling

### Common Errors

**1. SerpAPI Errors**
```
Error: SERPAPI_KEY not configured
Solution: Add SERPAPI_KEY to .env.local
```

**2. Extraction Failures**
```
Status: failed
Reason: Extraction failed
Cause: Page doesn't contain a recipe or HTML is malformed
```

**3. Validation Rejections**
```
Status: rejected
Reason: No ingredients found, No instructions found
Cause: Recipe doesn't meet quality thresholds
```

**4. Storage Failures**
```
Status: failed
Reason: Failed to save recipe
Cause: Database connection error or invalid data
```

### Error Recovery

The pipeline includes automatic error handling:
- Each recipe is processed independently
- Failures don't stop the pipeline
- Detailed error messages for debugging
- Statistics track success/failure rates

## Rate Limiting

### Built-in Rate Limiting

The pipeline includes automatic rate limiting:
- 2-second delay between recipe processing
- Prevents overwhelming external sites
- Respects SerpAPI rate limits

### Customization

Adjust rate limiting in `recipe-crawl.ts`:

```typescript
// Change delay between requests
await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
```

## Performance

### Expected Times

For a typical crawl with 5 results:
- Search: 1-2 seconds
- Convert (per recipe): 5-10 seconds
- Validate: < 1 second
- Store: 2-3 seconds

**Total:** Approximately 1-2 minutes for 5 recipes

### Optimization Tips

1. **Reduce Results:** Fewer results = faster completion
2. **Auto-Approve:** Skip validation for trusted sites
3. **Batch Processing:** Process multiple searches in parallel
4. **Cache Results:** Store search results to avoid re-crawling

## Monitoring

### Console Logging

The pipeline logs all steps to the console:

```
[Pipeline] Starting crawl for: "pasta carbonara"
[Search] Searching for recipes: "pasta carbonara"
[Search] Found 5 recipe results
[Pipeline] Step 1 complete: Found 5 results
[Convert] Extracting recipe from: https://example.com/recipe
[Convert] Successfully extracted recipe: Spaghetti Carbonara
[Pipeline] Step 2 complete: Extracted "Spaghetti Carbonara"
[Validate] Recipe "Spaghetti Carbonara": APPROVED (score: 95)
[Pipeline] Step 3 complete: Approved "Spaghetti Carbonara"
[Store] Storing recipe: Spaghetti Carbonara
[Store] Successfully stored recipe with ID: abc123
[Pipeline] Step 4 complete: Stored "Spaghetti Carbonara"
[Pipeline] Complete! Stats: { searched: 5, converted: 4, approved: 3, stored: 3, failed: 2 }
```

### Statistics

The pipeline returns detailed statistics:

```typescript
{
  searched: 5,    // URLs found
  converted: 4,   // Recipes extracted
  approved: 3,    // Recipes validated
  stored: 3,      // Recipes saved
  failed: 2       // Total failures
}
```

## Best Practices

### 1. Start Small

Test with 1-2 results before scaling up:
```typescript
const result = await crawlAndStoreRecipes('test recipe', {
  maxResults: 2
});
```

### 2. Use Specific Queries

More specific queries yield better results:
- Good: "authentic italian carbonara"
- Bad: "pasta"

### 3. Filter to Recipe Sites

Always filter to known recipe sites for best results:
```typescript
filterToRecipeSites: true
```

### 4. Monitor Confidence Scores

Review confidence scores to identify extraction issues:
```typescript
minConfidence: 0.7 // Only accept high-confidence extractions
```

### 5. Handle Errors Gracefully

Always check for success and handle errors:
```typescript
if (result.success) {
  console.log('Stored:', result.stats.stored);
} else {
  console.error('Pipeline failed');
}
```

## Troubleshooting

### No Results Found

**Cause:** Query too specific or no recipe sites in results

**Solution:**
- Use broader search terms
- Disable site filtering
- Try different search engines

### Low Conversion Rate

**Cause:** Pages don't contain structured recipes

**Solution:**
- Filter to recipe sites only
- Increase confidence threshold
- Check extraction logs for patterns

### High Rejection Rate

**Cause:** Recipes don't meet quality thresholds

**Solution:**
- Lower validation thresholds
- Use auto-approve for trusted sites
- Review validation criteria

### Storage Failures

**Cause:** Database connection or data issues

**Solution:**
- Check DATABASE_URL environment variable
- Verify PostgreSQL and pgvector are running
- Check database logs for errors

## Security

### API Key Protection

- Never commit API keys to git
- Use environment variables only
- Rotate keys periodically
- Use different keys for dev/prod

### Content Validation

- All URLs are validated before fetching
- HTML content is limited to 50KB
- Recipe data is sanitized before storage
- User input is validated and escaped

### Rate Limiting

- Built-in delays prevent abuse
- SerpAPI has per-key rate limits
- OpenRouter tracks usage per key
- Database has connection pooling

## Costs

### Estimated Costs per 100 Recipes

1. **SerpAPI:**
   - 100 searches = $0-5 (free tier or paid)

2. **OpenRouter (Claude 3 Haiku):**
   - ~5,000 tokens per extraction
   - 100 recipes = 500K tokens
   - Cost: ~$0.13

3. **Hugging Face:**
   - Free (rate-limited)

4. **Database:**
   - Minimal (storage only)

**Total: ~$0.13-5.13 per 100 recipes**

## Future Enhancements

### Planned Features

1. **Image Storage**
   - Download and store images in cloud storage
   - Generate thumbnails and optimized versions

2. **Batch Processing**
   - Process multiple searches in parallel
   - Queue system for large crawls

3. **Quality Scoring**
   - ML-based quality assessment
   - User feedback integration

4. **Duplicate Detection**
   - Check for existing recipes before storing
   - Merge similar recipes

5. **Scheduling**
   - Automated periodic crawls
   - Monitor recipe sites for updates

6. **Analytics**
   - Track crawl success rates
   - Identify best recipe sources
   - Monitor quality metrics

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Review validation criteria and adjust thresholds
3. Test with simple queries first
4. Check API key configuration

## License

This pipeline is part of the Recipe Manager application.
