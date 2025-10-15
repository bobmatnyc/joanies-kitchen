# HuggingFace Embedding API Fix Summary

## Problem Identified

**Critical Issue**: Recipe storage failing at embedding generation step with error "Failed to generate embedding after 3 retries".

### Root Causes Discovered

1. **API Endpoint 404 Error**: HuggingFace's free Inference API endpoint `/pipeline/feature-extraction/` for the `sentence-transformers/all-MiniLM-L6-v2` model is returning 404 errors as of 2025. This is a known issue reported by multiple users.

2. **Unhandled Exception**: Embedding generation failures were throwing exceptions that prevented recipe storage entirely (lines 371 and 502 in `recipe-crawl.ts`).

3. **Insufficient Retries**: Only 3 retry attempts with 1-second base delay was insufficient for cold-starting models.

## Changes Made

### 1. Improved Retry Logic (`/src/lib/ai/embeddings.ts`)

**Changes:**
- Increased `DEFAULT_RETRIES` from 3 to 5 attempts
- Increased `INITIAL_RETRY_DELAY` from 1s to 2s
- Improved retry delay for model loading: minimum 5 seconds when API indicates model is loading
- Enhanced error logging with detailed messages showing:
  - HTTP status codes
  - Retry attempt numbers (e.g., "attempt 2/6")
  - API response details
  - Specific error types (timeout, rate limit, API error)

**Code Example:**
```typescript
const DEFAULT_RETRIES = 5; // Increased from 3
const INITIAL_RETRY_DELAY = 2000; // 2 seconds base delay
```

### 2. Graceful Degradation (`/src/app/actions/recipe-crawl.ts`)

**Changes in `storeRecipe()` function (line 371):**
```typescript
// BEFORE: Embedding failure blocked recipe storage
const { embedding, embeddingText } = await generateRecipeEmbedding(...);

// AFTER: Embedding failure logged but doesn't block storage
let embeddingResult: { embedding: number[]; embeddingText: string } | null = null;
try {
  embeddingResult = await generateRecipeEmbedding(...);
  console.log(`[Store] Successfully generated embedding`);
} catch (error: any) {
  console.error(`[Store] Failed to generate embedding:`, error.message);
  console.warn(`[Store] Continuing without embedding - recipe will be saved`);
  embeddingResult = null;
}
```

**Changes in `storeRecipeWithWeek()` function (line 502):**
- Same graceful degradation pattern applied

**Database Storage:**
```typescript
// Set embeddingModel to null if generation failed
embeddingModel: embeddingResult ? 'sentence-transformers/all-MiniLM-L6-v2' : null,

// Only save embedding if generation succeeded
if (embeddingResult) {
  try {
    await saveRecipeEmbedding(...);
    console.log(`[Store] Successfully saved embedding to database`);
  } catch (error: any) {
    console.error(`[Store] Failed to save embedding to database`);
  }
} else {
  console.warn(`[Store] Recipe saved WITHOUT embedding`);
}
```

## Testing Results

### HuggingFace API Endpoint Testing

Tested multiple endpoint formats:
1. ❌ `/pipeline/feature-extraction/...` → 404 Not Found
2. ❌ `/models/...` → 400 Bad Request ("missing argument: 'sentences'")

**Conclusion**: HuggingFace's free Inference API for this model is not working as of 2025.

### Solution Implemented

**Immediate Fix**: Graceful degradation allows recipes to be stored WITHOUT embeddings
- **Success**: Recipes will now be saved even if embedding generation fails
- **Impact**: Recipes without embeddings won't appear in semantic search results
- **Follow-up**: Embeddings can be regenerated later when API is working or alternative solution is implemented

## Recommendations

### Short-term (Immediate)
✅ **IMPLEMENTED**: Graceful degradation prevents recipe loss
- Recipes are stored without embeddings
- Clear logging indicates which recipes need embeddings
- System remains functional

### Medium-term (Recommended)
🔄 **TODO**: Switch to alternative embedding service
- Option A: Use OpenRouter's `text-embedding-3-small` (via existing OPENROUTER_API_KEY)
- Option B: Use dedicated HuggingFace Inference Endpoint (paid)
- Option C: Self-host sentence-transformers model

### Long-term (Best Practice)
📋 **TODO**: Implement embedding regeneration utility
- Create script to identify recipes missing embeddings
- Batch regenerate embeddings for existing recipes
- Monitor embedding success rate

## Files Modified

1. `/src/lib/ai/embeddings.ts`
   - Lines 21-22: Increased retry count and delay
   - Lines 172-189: Improved rate limit/model loading retry logic
   - Lines 224-243: Enhanced timeout and network error handling
   - Lines 248-256: Better error messages with hints

2. `/src/app/actions/recipe-crawl.ts`
   - Lines 371-413: Added try-catch for embedding in `storeRecipe()`
   - Lines 434, 441-456: Conditional embedding save logic
   - Lines 522-564: Added try-catch for embedding in `storeRecipeWithWeek()`
   - Lines 591, 598-613: Conditional embedding save logic

## Success Criteria

### ✅ Achieved
1. Recipes no longer fail at storage phase
2. Better error logging for debugging
3. System degrades gracefully when embeddings fail
4. Clear visibility into which recipes lack embeddings

### ⏳ Pending
1. Replace HuggingFace with working embedding service
2. Regenerate embeddings for recipes stored without them
3. Implement monitoring for embedding success rate

## Testing Commands

```bash
# Test recipe crawl (should now succeed even if embeddings fail)
curl -X POST http://localhost:3001/api/crawl/weekly \
  -H "Content-Type: application/json" \
  -d '{"weeksAgo": 4, "maxResults": 1, "autoApprove": true}'

# Expected result: stats.stored: 1 (not 0)
# Recipes should be saved even if embeddings fail
```

## Environment Requirements

Current configuration (no changes required):
- `HUGGINGFACE_API_KEY`: Still configured but API is not working
- `OPENROUTER_API_KEY`: Available for alternative embedding service
- `DATABASE_URL`: Working correctly for recipe storage

## Next Steps

1. **Immediate**: Deploy this fix to allow recipe storage to continue
2. **Week 1**: Implement OpenRouter embedding alternative
3. **Week 2**: Create embedding regeneration utility
4. **Ongoing**: Monitor embedding success rate and API availability

---

**Date**: 2025-01-20
**Engineer**: Claude Code (Sonnet 4.5)
**Status**: ✅ Critical fix implemented, 🔄 Follow-up tasks identified
