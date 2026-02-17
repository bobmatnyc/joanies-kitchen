# Tavily Integration for Recipe URL Discovery

## Overview

Tavily is an AI-powered search API integrated into Joanie's Kitchen for discovering high-quality recipe URLs from the web. It serves as an alternative/complement to SerpAPI for recipe URL discovery.

## Implementation Location

- **Core Module**: `src/lib/tavily.ts`
- **Test Script**: `test/scripts/test-tavily-discovery.ts`
- **Environment Variables**: `.env.local` and `.env.example`

## Features

- AI-powered web search optimized for recipe discovery
- Automatic filtering of social media and non-recipe pages
- Relevance scoring for search results
- Rate limiting (1 second between requests)
- Support for both basic and advanced search depths
- Domain-based filtering (include/exclude lists)

## API Configuration

### Environment Variables

```bash
# Get your API key from https://tavily.com/
TAVILY_API_KEY=tvly-prod-your-api-key-here
```

### Check Configuration

```typescript
import { isTavilyConfigured } from '@/lib/tavily';

if (isTavilyConfigured()) {
  console.log('Tavily is ready to use');
}
```

## Usage

### Basic Search

```typescript
import { searchRecipesWithTavily } from '@/lib/tavily';

const results = await searchRecipesWithTavily('pasta carbonara', {
  maxResults: 10,
  searchDepth: 'basic'
});

if (results.success) {
  console.log(`Found ${results.results.length} recipes`);
  results.results.forEach(result => {
    console.log(`${result.title}: ${result.url} (score: ${result.score})`);
  });
}
```

### Advanced Search with Custom Domains

```typescript
const results = await searchRecipesWithTavily('chocolate chip cookies', {
  maxResults: 20,
  searchDepth: 'advanced',
  includeDomains: ['allrecipes.com', 'seriouseats.com'],
  excludeDomains: ['youtube.com', 'pinterest.com']
});
```

### Filter Recipe URLs

```typescript
import { filterRecipeUrls } from '@/lib/tavily';

// Filter out non-recipe URLs (social media, video platforms)
const recipeOnly = filterRecipeUrls(results.results);
```

## API Reference

### `searchRecipesWithTavily(query, options?)`

Main search function for recipe URL discovery.

**Parameters:**
- `query` (string): Search query (e.g., "pasta carbonara")
- `options` (optional):
  - `searchDepth`: 'basic' | 'advanced' (default: 'basic')
  - `maxResults`: number (default: 10)
  - `includeDomains`: string[] (default: RECIPE_SITES list)
  - `excludeDomains`: string[] (default: EXCLUDED_DOMAINS list)

**Returns:** `TavilySearchResponse`
```typescript
{
  success: boolean;
  results: TavilyRecipeResult[];
  error?: string;
  searchInfo?: {
    query: string;
    totalResults: number;
  };
}
```

**Result Format:**
```typescript
{
  title: string;          // Recipe title
  url: string;            // Recipe URL
  content: string;        // Content snippet
  score: number;          // Relevance score (0-1)
  publishedDate?: string; // Publication date
  source?: string;        // Domain name
}
```

### `filterRecipeUrls(results)`

Filters search results to only include recipe-like URLs.

**Parameters:**
- `results` (TavilyRecipeResult[]): Array of search results

**Returns:** Filtered array of recipe results

### Helper Functions

- `getSupportedRecipeSites()`: Get list of supported recipe domains
- `getExcludedDomains()`: Get list of excluded domains
- `isRecipeSite(url)`: Check if URL is from a known recipe site
- `isTavilyConfigured()`: Check if API key is configured

## Recipe Site Filtering

### Included Recipe Sites (Default)
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

### Excluded Domains (Default)
- youtube.com
- facebook.com
- instagram.com
- pinterest.com
- twitter.com
- tiktok.com
- reddit.com

## Rate Limiting

The module implements automatic rate limiting to respect API constraints:
- Minimum interval: 1 second between requests
- Automatic wait time enforcement
- Console logging when rate limiting is active

## Testing

### Run Test Script

```bash
# Basic test with default query
npx tsx test/scripts/test-tavily-discovery.ts

# Test with custom query
npx tsx test/scripts/test-tavily-discovery.ts --query "chocolate chip cookies"
```

### Test Output

The test script validates:
1. API key configuration
2. Search functionality
3. Recipe URL filtering
4. URL validation
5. Response timing

### Expected Results

```
✓ TAVILY_API_KEY found
✓ Supported recipe sites: 15 domains
✓ Excluded domains: 7 domains
✓ Tavily search successful!
✓ Raw results: 10
✓ Filtered recipe URLs: 10
✓ Valid URLs: 10
✓ Response time: ~900-1200ms
```

## Comparison with SerpAPI

| Feature | Tavily | SerpAPI |
|---------|--------|---------|
| Search Type | AI-powered | Google Search API |
| Quality Filtering | Built-in AI filtering | Manual post-filtering |
| Relevance Scoring | Yes (0-1 scale) | Position-based |
| Domain Filtering | Native support | Manual implementation |
| Rate Limits | 1 req/second | API-dependent |
| Content Snippets | AI-generated | Google snippets |
| Response Time | ~900-1200ms | ~500-800ms |
| Best For | Quality discovery | Comprehensive coverage |

## Integration with Scraping Pipeline

Tavily is designed to work with the existing Firecrawl scraping pipeline:

1. **Discovery**: Use Tavily to find recipe URLs
2. **Scraping**: Use Firecrawl to scrape content from discovered URLs
3. **Processing**: Parse and import recipes into database

```typescript
// Example workflow
const discovery = await searchRecipesWithTavily('pasta recipes');
const urls = discovery.results.map(r => r.url);

for (const url of urls) {
  const content = await scrapeRecipePage(url); // Firecrawl
  // Process and import recipe
}
```

## Error Handling

The module implements robust error handling:
- API key validation
- HTTP error handling with status codes
- API-level error checking
- Detailed console logging for debugging

```typescript
const results = await searchRecipesWithTavily('pasta');

if (!results.success) {
  console.error('Search failed:', results.error);
  // Handle error gracefully
}
```

## Best Practices

1. **Rate Limiting**: The module handles this automatically
2. **Error Handling**: Always check `results.success` before using results
3. **Query Optimization**: The module automatically adds "recipe" keyword
4. **Domain Filtering**: Use default lists unless specific needs require customization
5. **Result Scoring**: Higher scores (closer to 1) indicate better matches

## Troubleshooting

### "TAVILY_API_KEY not configured"
- Add `TAVILY_API_KEY` to your `.env.local` file
- Verify the key is valid at https://tavily.com/

### No Results Returned
- Check if query is too specific
- Verify included/excluded domains are correct
- Try using 'advanced' search depth

### Rate Limiting Messages
- This is normal - module enforces 1 second between requests
- No action needed - handled automatically

### "This module cannot be imported from a Client Component"
- Tavily module uses `server-only` directive
- Only import in Server Components or API routes
- For testing, use the standalone test script

## Future Enhancements

Potential improvements for future versions:
- [ ] Batch search support
- [ ] Caching of search results
- [ ] Integration with recipe quality scoring
- [ ] Automatic recipe extraction
- [ ] Advanced filtering based on dietary restrictions
- [ ] Multi-language support

## References

- Tavily API Documentation: https://docs.tavily.com/
- Tavily Dashboard: https://app.tavily.com/
- Module Source: `src/lib/tavily.ts`
- Test Script: `test/scripts/test-tavily-discovery.ts`
