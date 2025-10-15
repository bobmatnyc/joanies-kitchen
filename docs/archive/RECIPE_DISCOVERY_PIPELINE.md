# Recipe Discovery Pipeline

Complete AI-powered recipe discovery system with automatic validation, tagging, and embedding generation.

## Architecture Overview

```
User Query "spicy Thai noodles"
  ↓
1. Brave Search API → Find recipe URLs from quality sources
  ↓
2. LLM Validation (Claude 3 Haiku) → Extract & validate recipe data
  ↓
3. LLM Tagging (Claude 3 Haiku) → Generate tags, cuisine, difficulty, dietary info
  ↓
4. Generate Embeddings (all-MiniLM-L6-v2) → Create 384-dimensional vector
  ↓
5. Save to DB → Store recipe with full provenance + embedding
  ↓
6. Return Results → Display validated recipes to user
```

## Components

### 1. Server Action: `recipe-discovery.ts`
Location: `/src/app/actions/recipe-discovery.ts`

**Main Functions:**
- `discoverRecipes(query, options)` - Main discovery pipeline
- `discoverRecipeFromUrl(url)` - Single URL extraction
- `discoverRecipeUrls(query, options)` - Brave Search integration
- `extractAndValidateRecipe(url, title)` - LLM extraction
- `generateRecipeMetadata(recipe)` - LLM tagging
- `saveDiscoveredRecipe(recipe, metadata, source)` - Database persistence

### 2. UI Component: `RecipeDiscoveryPanel.tsx`
Location: `/src/components/recipe/RecipeDiscoveryPanel.tsx`

**Features:**
- Real-time pipeline progress tracking
- Advanced search filters (cuisine, ingredients, dietary)
- Confidence score adjustment
- Result statistics and error reporting
- Recipe preview with provenance information
- Responsive grid layout

### 3. Supporting Libraries

**Brave Search** (`/src/lib/brave-search.ts`):
- Type-safe Brave Search API client
- Quality source filtering
- Error handling and retries

**Embeddings** (`/src/lib/ai/embeddings.ts`):
- Hugging Face sentence-transformers integration
- 384-dimensional vectors
- Automatic retry with exponential backoff

**Database** (`/src/lib/db/embeddings.ts`):
- pgvector integration
- Cosine similarity search
- Batch operations

## Pipeline Steps in Detail

### Step 1: Brave Search Integration

```typescript
// Build optimized search query
let searchQuery = `${query} recipe`;
if (cuisine) searchQuery += ` ${cuisine}`;
if (ingredients.length) searchQuery += ` with ${ingredients.join(' ')}`;

// Filter for quality sources
searchQuery += ' (site:allrecipes.com OR site:foodnetwork.com OR site:seriouseats.com)';

// Execute search
const results = await braveSearchRecipes(searchQuery, maxResults);
```

**Quality Sources:**
- allrecipes.com
- foodnetwork.com
- seriouseats.com
- bonappetit.com
- epicurious.com
- tasty.co

### Step 2: LLM Validation

**Model:** Claude 3 Haiku (anthropic/claude-3-haiku)

**Process:**
1. Fetch webpage content (10s timeout)
2. Clean HTML (remove scripts, styles)
3. Send to Claude with structured prompt
4. Parse JSON response
5. Validate completeness

**Response Format:**
```json
{
  "name": "Recipe name",
  "description": "Brief description",
  "ingredients": ["ingredient 1 with measurement", "..."],
  "instructions": ["step 1", "step 2", "..."],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": 4,
  "confidenceScore": 0.95,
  "isValid": true
}
```

**Validation Criteria:**
- `isValid: false` if no ingredients or instructions
- `confidenceScore < 0.6` marked as low quality
- Complete recipe structure required

### Step 3: LLM Auto-Tagging

**Model:** Claude 3 Haiku (anthropic/claude-3-haiku)

**Generated Metadata:**
```json
{
  "cuisine": "Italian",
  "tags": ["quick", "healthy", "comfort-food", "weeknight"],
  "difficulty": "easy",
  "dietaryInfo": ["vegetarian", "gluten-free"]
}
```

**Tag Categories:**
- **Cuisine:** Italian, Thai, Mexican, French, American, etc.
- **Tags:** quick, healthy, comfort-food, budget-friendly, one-pot, etc.
- **Difficulty:** easy, medium, hard
- **Dietary:** vegetarian, vegan, gluten-free, dairy-free, keto, etc.

### Step 4: Embedding Generation

**Model:** sentence-transformers/all-MiniLM-L6-v2

**Embedding Text Construction:**
```
[Recipe Name]. [Description]. Cuisine: [Cuisine]. Tags: [tag1, tag2].
Ingredients: [ing1, ing2, ...]. Difficulty: [difficulty]
```

**Output:**
- 384-dimensional float vector
- Stored in pgvector column
- Enables semantic similarity search

### Step 5: Database Persistence

**Recipe Table Fields:**
- Standard fields (name, description, ingredients, etc.)
- Provenance tracking:
  - `source` - Original URL
  - `searchQuery` - User's search query
  - `discoveryDate` - Timestamp of discovery
  - `confidenceScore` - LLM confidence (0.00-1.00)
  - `validationModel` - AI model used for extraction
  - `embeddingModel` - Model used for vector generation

**Embedding Table:**
- `embedding` - 384-dimensional vector (pgvector)
- `embeddingText` - Text used to generate embedding
- `modelName` - all-MiniLM-L6-v2

### Step 6: Return Results

**Success Response:**
```typescript
{
  success: true,
  recipes: [Recipe[]],
  stats: {
    searched: 10,      // URLs found by Brave
    validated: 8,      // Successfully extracted
    saved: 6,          // Passed confidence threshold
    failed: 2,         // Extraction/validation failed
    skipped: 2         // Below confidence threshold
  },
  errors?: [         // Optional error details
    {
      url: "...",
      step: "extraction",
      error: "Failed to parse recipe"
    }
  ]
}
```

## Configuration Options

### `RecipeDiscoveryOptions`

```typescript
interface RecipeDiscoveryOptions {
  cuisine?: string;                  // Filter by cuisine
  ingredients?: string[];            // Must include ingredients
  dietaryRestrictions?: string[];    // Dietary filters
  maxResults?: number;               // Max recipes to discover (default: 5)
  minConfidence?: number;            // Confidence threshold 0.0-1.0 (default: 0.6)
}
```

### Usage Examples

**Basic Search:**
```typescript
const result = await discoverRecipes("spicy Thai noodles");
```

**Advanced Search:**
```typescript
const result = await discoverRecipes("pasta", {
  cuisine: "Italian",
  ingredients: ["tomatoes", "basil"],
  dietaryRestrictions: ["vegetarian"],
  maxResults: 10,
  minConfidence: 0.7
});
```

**Single URL Import:**
```typescript
const result = await discoverRecipeFromUrl("https://example.com/recipe");
```

## Error Handling

### Retry Strategy
- **Brave Search:** 3 retries with exponential backoff
- **LLM Extraction:** Single attempt per URL
- **Embedding Generation:** 3 retries with backoff
- **Database Save:** Single attempt (logs error)

### Error Types

**Search Errors:**
- `BraveSearchAuthError` - Authentication required
- `BraveSearchRateLimitError` - Rate limit exceeded
- `BraveSearchServiceError` - Service unavailable

**Extraction Errors:**
- HTTP timeout (10s)
- Invalid HTML content
- LLM parse failure
- Incomplete recipe data

**Embedding Errors:**
- `EmbeddingError` with codes:
  - `API_ERROR` - Hugging Face API failure
  - `RATE_LIMIT` - Model loading or rate limited
  - `VALIDATION_ERROR` - Invalid input
  - `TIMEOUT` - Request timeout

### Error Recovery

1. **Per-URL Isolation:** Errors don't stop pipeline
2. **Graceful Degradation:** Save without embedding if generation fails
3. **Detailed Logging:** All errors logged with context
4. **User Feedback:** Errors reported in UI with actionable info

## Rate Limiting

### Sequential Processing
- Process URLs one at a time
- 2-second delay between requests
- Prevents overwhelming external services

### API Limits
- **Brave Search:** Respects rate limits
- **OpenRouter (Claude):** Per-model limits
- **Hugging Face:** Model cold-start delays

## Performance Optimization

### Timeouts
- Webpage fetch: 10 seconds
- LLM extraction: ~5-10 seconds
- Embedding generation: ~2-5 seconds
- Total per recipe: ~20-30 seconds

### Batch Processing
- Not currently implemented (sequential for safety)
- Future: Parallel processing with rate limiting

### Caching Opportunities
- Recipe URL deduplication
- Previously processed URLs
- Embedding cache for similar recipes

## Database Schema

### `recipes` Table Enhancement

```sql
-- Provenance tracking fields
search_query TEXT,                    -- Discovery search query
discovery_date TIMESTAMP WITH TIME ZONE,  -- When discovered
confidence_score DECIMAL(3,2),        -- Validation confidence
validation_model TEXT,                -- AI model used
embedding_model TEXT                  -- Embedding model name
```

### `recipe_embeddings` Table

```sql
CREATE TABLE recipe_embeddings (
  id UUID PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  embedding VECTOR(384) NOT NULL,     -- pgvector column
  embedding_text TEXT NOT NULL,       -- Source text
  model_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for similarity search
CREATE INDEX ON recipe_embeddings USING ivfflat (embedding vector_cosine_ops);
```

## UI Features

### Real-time Progress

Shows current pipeline step:
1. 🔍 **Searching** - Finding recipe URLs
2. ✓ **Validating** - Extracting recipe data
3. 🏷️ **Tagging** - Generating metadata
4. 📈 **Embedding** - Creating vectors
5. 💾 **Saving** - Storing to database

### Result Statistics

- **Searched** - URLs found
- **Validated** - Successfully extracted
- **Saved** - Stored in database
- **Skipped** - Below confidence threshold
- **Failed** - Errors occurred

### Recipe Cards

Display:
- Recipe name and description
- Cuisine and difficulty badges
- Cooking time and servings
- Generated tags
- Confidence score
- Vector indexed status
- Source link

### Advanced Filters

- Cuisine type
- Required ingredients
- Dietary restrictions
- Max results (1-10)
- Min confidence (0-100%)

## Testing Checklist

- [ ] Basic search query
- [ ] URL direct import
- [ ] Advanced filters (cuisine, ingredients, dietary)
- [ ] Confidence threshold filtering
- [ ] Error handling (invalid URL, network timeout)
- [ ] Rate limiting (multiple searches)
- [ ] Embedding generation
- [ ] Database persistence
- [ ] UI progress display
- [ ] Recipe preview
- [ ] Navigation to full recipe

## Future Enhancements

### Short-term
- [ ] Parallel processing with rate limiting
- [ ] URL deduplication check
- [ ] Embedding regeneration for existing recipes
- [ ] Bulk discovery from recipe list

### Medium-term
- [ ] Image extraction and storage
- [ ] Nutrition information parsing
- [ ] User ratings and reviews
- [ ] Similar recipe suggestions

### Long-term
- [ ] Multiple LLM provider support
- [ ] Custom embedding models
- [ ] Real-time scraping service
- [ ] Recipe quality scoring
- [ ] Automatic categorization

## Troubleshooting

### Common Issues

**No recipes found:**
- Check Brave Search API key
- Try broader search terms
- Check internet connectivity

**Low confidence scores:**
- Increase `minConfidence` threshold
- Try more specific queries
- Check recipe source quality

**Embedding generation fails:**
- Check Hugging Face API key
- Model may be cold-starting (wait and retry)
- Check network connectivity

**UI not updating:**
- Check browser console for errors
- Verify server action is being called
- Check authentication status

## API Keys Required

1. **OPENROUTER_API_KEY** - For Claude 3 Haiku (LLM extraction and tagging)
2. **BRAVE_API_KEY** - For Brave Search API (recipe discovery)
3. **HUGGINGFACE_API_KEY** - For sentence-transformers (embedding generation)

Set in `.env.local`:
```env
OPENROUTER_API_KEY=sk-or-...
BRAVE_API_KEY=BSA...
HUGGINGFACE_API_KEY=hf_...
```

## License & Attribution

This pipeline uses:
- Brave Search API for recipe discovery
- Anthropic Claude 3 Haiku via OpenRouter
- Hugging Face sentence-transformers
- PostgreSQL with pgvector extension

All discovered recipes retain attribution to original sources.
