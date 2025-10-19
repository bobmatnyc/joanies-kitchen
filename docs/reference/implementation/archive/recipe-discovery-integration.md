# Recipe Discovery Pipeline - Integration Guide

Quick guide for integrating the Recipe Discovery Pipeline into your application.

## Installation

No additional dependencies needed! All required packages are already in the project:
- `openai` - For OpenRouter/Claude API
- `drizzle-orm` - For database operations
- `@radix-ui` components - For UI

## Integration Steps

### Step 1: Add Environment Variables

Add to `.env.local`:

```env
# OpenRouter API (for Claude 3 Haiku)
OPENROUTER_API_KEY=sk-or-v1-...

# Brave Search API
BRAVE_API_KEY=BSA...

# Hugging Face API (for embeddings)
HUGGINGFACE_API_KEY=hf_...

# App URL for OpenRouter
NEXT_PUBLIC_APP_URL=http://localhost:3004
```

### Step 2: Add to Existing Page

Import and use the component:

```tsx
// In your page.tsx or component
import { RecipeDiscoveryPanel } from '@/components/recipe/RecipeDiscoveryPanel';

export default function DiscoverPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Discover Recipes</h1>
      <RecipeDiscoveryPanel />
    </div>
  );
}
```

### Step 3: Add Navigation Link

Add to your navigation menu:

```tsx
<Link href="/recipes/discover">
  <Button variant="ghost">
    <Sparkles className="w-4 h-4 mr-2" />
    Discover Recipes
  </Button>
</Link>
```

### Step 4: Test the Pipeline

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to discovery page:**
   ```
   http://localhost:3004/recipes/discover
   ```

3. **Test basic search:**
   - Enter "authentic Italian pasta"
   - Click Search
   - Wait for pipeline to complete
   - View discovered recipes

4. **Test URL import:**
   - Paste a recipe URL (e.g., from AllRecipes.com)
   - Click Search
   - Recipe will be extracted automatically

5. **Test advanced filters:**
   - Open "Advanced Options"
   - Set cuisine: "Thai"
   - Set ingredients: "chicken, coconut milk"
   - Set dietary: "gluten-free"
   - Adjust confidence slider
   - Click Search

## Usage Examples

### Basic Search

```typescript
import { discoverRecipes } from '@/app/actions/recipe-discovery';

const result = await discoverRecipes("chocolate chip cookies");
console.log(`Found ${result.recipes.length} recipes`);
```

### Advanced Search

```typescript
const result = await discoverRecipes("pasta", {
  cuisine: "Italian",
  ingredients: ["tomatoes", "basil", "garlic"],
  dietaryRestrictions: ["vegetarian"],
  maxResults: 10,
  minConfidence: 0.7
});
```

### Single URL Import

```typescript
import { discoverRecipeFromUrl } from '@/app/actions/recipe-discovery';

const result = await discoverRecipeFromUrl(
  "https://www.allrecipes.com/recipe/12345/perfect-pasta/"
);

if (result.success && result.recipe) {
  console.log(`Imported: ${result.recipe.name}`);
}
```

## File Structure

```
recipe-manager/
├── src/
│   ├── app/
│   │   └── actions/
│   │       └── recipe-discovery.ts      # ✅ Server actions (NEW)
│   ├── components/
│   │   ├── recipe/
│   │   │   └── RecipeDiscoveryPanel.tsx # ✅ UI component (NEW)
│   │   └── ui/
│   │       ├── progress.tsx             # ✅ Progress bar (NEW)
│   │       └── alert.tsx                # ✅ Alert component (NEW)
│   └── lib/
│       ├── brave-search.ts              # ✅ Already exists
│       ├── ai/
│       │   ├── embeddings.ts            # ✅ Already exists
│       │   └── openrouter-server.ts     # ✅ Already exists
│       └── db/
│           ├── embeddings.ts            # ✅ Already exists
│           └── schema.ts                # ✅ Already exists
└── RECIPE_DISCOVERY_PIPELINE.md         # ✅ Documentation (NEW)
```

## Database Schema Check

Ensure your database has the provenance tracking fields:

```sql
-- Check if fields exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'recipes'
AND column_name IN (
  'search_query',
  'discovery_date',
  'confidence_score',
  'validation_model',
  'embedding_model'
);
```

If missing, add them:

```sql
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS search_query TEXT,
ADD COLUMN IF NOT EXISTS discovery_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS validation_model TEXT,
ADD COLUMN IF NOT EXISTS embedding_model TEXT;
```

## Common Integration Points

### 1. Existing Recipe Search Page

Replace or enhance your existing search:

```tsx
// Before: Old search
import { WebSearchPanel } from '@/components/recipe/WebSearchPanel';

// After: New discovery pipeline
import { RecipeDiscoveryPanel } from '@/components/recipe/RecipeDiscoveryPanel';
```

### 2. Recipe Import Flow

Add discovery as an import option:

```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
    <TabsTrigger value="discover">Discover</TabsTrigger>
    <TabsTrigger value="import">Import File</TabsTrigger>
  </TabsList>
  <TabsContent value="discover">
    <RecipeDiscoveryPanel />
  </TabsContent>
</Tabs>
```

### 3. Semantic Search Integration

Use discovered recipe embeddings for similarity search:

```typescript
import { findSimilarRecipes } from '@/lib/db/embeddings';
import { generateEmbedding } from '@/lib/ai/embeddings';

// Find recipes similar to a query
const queryEmbedding = await generateEmbedding("spicy Asian noodles");
const similar = await findSimilarRecipes(queryEmbedding, 10, 0.5);
```

## Customization Options

### 1. Adjust Quality Sources

Edit `recipe-discovery.ts` to change search filters:

```typescript
// Add/remove recipe sources
searchQuery += ' (site:allrecipes.com OR site:yoursite.com)';
```

### 2. Change LLM Model

Switch to different OpenRouter models:

```typescript
// In recipe-discovery.ts
model: MODELS.CLAUDE_3_5_SONNET, // Higher quality
model: MODELS.LLAMA_3_8B,        // Free tier
```

### 3. Adjust Confidence Threshold

Set default minimum confidence:

```typescript
const {
  minConfidence = 0.7, // Increase for higher quality
} = options;
```

### 4. Custom Embedding Model

Future: Support for different embedding models in `embeddings.ts`

## Performance Tuning

### Production Optimizations

1. **Increase rate limits:**
   ```typescript
   // Reduce delay between requests (if API allows)
   await new Promise(resolve => setTimeout(resolve, 1000)); // 1s instead of 2s
   ```

2. **Parallel processing:**
   ```typescript
   // Process multiple URLs in parallel (careful with rate limits)
   const results = await Promise.all(
     urls.slice(0, 3).map(url => extractAndValidateRecipe(url))
   );
   ```

3. **Enable caching:**
   ```typescript
   // Add URL deduplication before processing
   const existingRecipe = await db.query.recipes.findFirst({
     where: eq(recipes.source, url)
   });
   if (existingRecipe) return existingRecipe;
   ```

### Monitoring

Add monitoring to track pipeline performance:

```typescript
// In recipe-discovery.ts
console.time(`recipe-discovery-${query}`);
const result = await discoverRecipes(query, options);
console.timeEnd(`recipe-discovery-${query}`);

// Log statistics
console.log('Discovery stats:', result.stats);
```

## Troubleshooting

### Issue: No recipes found

**Solution:**
1. Check Brave API key is valid
2. Try broader search terms
3. Check console for error messages
4. Verify internet connectivity

### Issue: Low confidence scores

**Solution:**
1. Lower `minConfidence` threshold
2. Try more specific queries
3. Check source quality (some sites harder to parse)

### Issue: Slow performance

**Solution:**
1. Reduce `maxResults` (fewer URLs to process)
2. Increase `minConfidence` (skip low-quality early)
3. Check API rate limits
4. Monitor network latency

### Issue: Embedding generation fails

**Solution:**
1. Verify Hugging Face API key
2. Model may be cold-starting (wait 20s and retry)
3. Check Hugging Face service status
4. Recipe still saved, embedding can be regenerated later

### Issue: TypeScript errors

**Solution:**
1. Ensure all UI components installed:
   ```bash
   npm install @radix-ui/react-progress
   ```
2. Check imports are correct
3. Verify types match schema

## Testing

### Manual Testing Checklist

- [ ] Basic text search works
- [ ] URL import works
- [ ] Advanced filters apply correctly
- [ ] Confidence threshold filters results
- [ ] Progress indicator updates
- [ ] Statistics display correctly
- [ ] Error handling shows user-friendly messages
- [ ] Recipe preview works
- [ ] Navigation to full recipe works
- [ ] Provenance data saves correctly

### Automated Testing (Future)

```typescript
// Example test
describe('Recipe Discovery Pipeline', () => {
  it('should discover recipes from query', async () => {
    const result = await discoverRecipes('pasta');
    expect(result.success).toBe(true);
    expect(result.recipes.length).toBeGreaterThan(0);
  });

  it('should extract recipe from URL', async () => {
    const result = await discoverRecipeFromUrl('https://example.com/recipe');
    expect(result.success).toBe(true);
    expect(result.recipe?.name).toBeTruthy();
  });
});
```

## Migration from Old Search

If you're replacing `recipe-search.ts` (Perplexity-based):

1. **Keep old search as fallback:**
   ```typescript
   try {
     return await discoverRecipes(query, options);
   } catch (error) {
     console.warn('Discovery failed, using fallback search');
     return await searchWebRecipes(query); // Old Perplexity search
   }
   ```

2. **Gradual rollout:**
   - Test with internal users first
   - Monitor error rates
   - Compare result quality
   - Full migration after validation

3. **Data migration:**
   - No migration needed (new recipes use new fields)
   - Old recipes continue to work
   - Optionally regenerate embeddings for old recipes

## Support & Resources

- **Pipeline Documentation:** `RECIPE_DISCOVERY_PIPELINE.md`
- **API Documentation:**
  - [Brave Search API](https://brave.com/search/api/)
  - [OpenRouter API](https://openrouter.ai/docs)
  - [Hugging Face Inference](https://huggingface.co/docs/api-inference)
- **Components:**
  - Server Actions: `/src/app/actions/recipe-discovery.ts`
  - UI Component: `/src/components/recipe/RecipeDiscoveryPanel.tsx`

## Next Steps

1. ✅ Integration complete - Test basic functionality
2. 🔄 Monitor performance and error rates
3. 🎨 Customize UI to match your design system
4. 📊 Add analytics to track usage
5. 🚀 Deploy to production after testing

## Questions?

Common questions and answers:

**Q: Can I use this without Brave Search?**
A: Yes, you can modify Step 1 to use a different search API or provide URLs directly.

**Q: Can I use a different LLM?**
A: Yes, change `MODELS.CLAUDE_3_HAIKU` to any OpenRouter-supported model.

**Q: Does this work with authentication?**
A: Yes, recipes are associated with the authenticated user via Clerk.

**Q: Can I disable embedding generation?**
A: Yes, the pipeline continues even if embedding generation fails. Embeddings can be regenerated later.

**Q: How do I regenerate embeddings for existing recipes?**
A: Use the batch functions in `embeddings.ts`:
```typescript
import { getRecipesNeedingEmbedding } from '@/lib/db/embeddings';
const recipes = await getRecipesNeedingEmbedding();
// Process recipes...
```
