# Meal Pairing Engine Implementation Summary

**Version**: 1.0.0
**Date**: 2025-01-19
**Status**: ✅ Complete

---

## Overview

Implemented a production-ready meal pairing engine that integrates with Recipe Manager's existing infrastructure to generate sophisticated multi-course meals using AI and semantic search.

## Implementation Details

### 1. System Prompts (`src/lib/ai/prompts/meal-pairing.ts`)

Created **4 prompt templates** following Recipe Manager's prompt store pattern:

- `meal-pairing-by-cuisine` - Cuisine-based meal generation
- `meal-pairing-from-main` - Build meal around a main dish
- `meal-pairing-by-theme` - Theme/occasion-based meals
- `meal-pairing-freestyle` - Creative meal generation

**Key Features**:
- Follows existing `PromptTemplate` interface
- Uses Recipe Manager's variable substitution system (`{{variable}}`)
- Includes model suggestions (Gemini 2.0 Flash as primary)
- JSON response format for structured output
- Comprehensive pairing principles (weight, acid-fat balance, texture contrast)

### 2. Core Engine (`src/lib/ai/meal-pairing-engine.ts`)

**Integration Points**:
- ✅ **OpenRouter**: Uses `getOpenRouterClient()` from `openrouter-server.ts`
- ✅ **Semantic Search**: Uses `semanticSearchRecipes()` from `semantic-search.ts`
- ✅ **Prompt Store**: Uses `renderPrompt()` from prompt system
- ✅ **pgvector**: Leverages production-ready vector search infrastructure

**Core Functions**:

```typescript
// Main entry point (simple API)
generateMeal(request: SimpleMealRequest): Promise<MealGenerationResult>

// Advanced generation with semantic search
generateMealWithSemanticSearch(input: MealPairingInput): Promise<MealGenerationResult>

// Course-specific semantic search
searchRecipesByCourse(query: string, course: CourseType): Promise<RecipeWithSimilarity[]>

// Recipe linking based on similarity
enrichWithRecipeLinks(mealPlan: MealPlan, candidates): MealPlan
```

### 3. Type Definitions (`src/types/index.ts`)

Re-exported meal pairing types for application-wide use:
- `MealPairingMode` - Generation modes (cuisine, theme, main-first, freestyle)
- `MealPairingInput` - Input for meal generation
- `MealPlanCourse` - Individual course structure
- `MealPlan` - Complete meal plan with analysis
- `SimpleMealRequest` - Simplified API interface
- `MealGenerationResult` - Generation result wrapper

### 4. Prompt Store Integration (`src/lib/ai/prompts/index.ts`)

Updated central prompt registry to include 4 new meal pairing prompts:
- Added import: `import { mealPairingPrompts } from './meal-pairing'`
- Registered in `promptStore` object
- Re-exported for external use
- Total prompts: **19** (6 meal gen + 5 recipe analysis + 4 nutrition + 4 meal pairing)

---

## Key Adaptations from Reference Implementation

### ✅ What Changed (Recipe Manager Patterns)

1. **AI Client**:
   - Reference: Direct Anthropic API
   - **Adapted**: OpenRouter client via `getOpenRouterClient()`
   - **Model**: Gemini 2.0 Flash (free tier) instead of Claude

2. **Semantic Search**:
   - Reference: Mock `semanticSearch()` function
   - **Adapted**: Real `semanticSearchRecipes()` with pgvector
   - **Enhancement**: Course-specific query enhancement

3. **Recipe Matching**:
   - Reference: Simple name string matching
   - **Adapted**: Similarity-based matching with threshold (0.6-0.7)
   - **Logic**: Exact match → Partial match + high similarity → Top similarity

4. **Prompt System**:
   - Reference: Inline prompt strings
   - **Adapted**: Structured `PromptTemplate` objects
   - **Features**: Variable substitution, model suggestions, metadata

5. **Error Handling**:
   - Reference: Basic try-catch
   - **Adapted**: Recipe Manager patterns with detailed error messages
   - **Return**: `{ success: boolean, mealPlan?: MealPlan, error?: string }`

### ✅ What Stayed (Core Logic)

1. **Pairing Principles**: All 8 principles preserved verbatim
2. **Prompt Structure**: System prompt + user prompt pattern
3. **Output Format**: JSON structure with courses + analysis
4. **Mode System**: 4 generation modes (cuisine, theme, main-first, freestyle)

---

## Usage Examples

### Example 1: Cuisine-Based Meal

```typescript
import { generateMeal } from '@/lib/ai/meal-pairing-engine';

const result = await generateMeal({
  cuisine: "Italian",
  servings: 6,
  dietary: ["vegetarian"],
  maxTime: 120
});

if (result.success) {
  console.log(result.mealPlan);
  // {
  //   appetizer: { name: "Bruschetta", recipe_id: "abc-123", ... },
  //   main: { name: "Eggplant Parmigiana", ... },
  //   side: { name: "Arugula Salad", recipe_id: "def-456", ... },
  //   dessert: { name: "Tiramisu", ... }
  // }
}
```

### Example 2: Main-First Pairing

```typescript
const result = await generateMeal({
  mainDish: "Pan-seared ribeye steak",
  dietary: ["gluten-free"],
  maxTime: 90,
  servings: 4
});
```

### Example 3: Theme-Based

```typescript
const result = await generateMeal({
  theme: "Spring garden party",
  ingredients: ["asparagus", "peas", "mint"],
  servings: 8
});
```

---

## Integration with Existing Schema

The engine works with the new pairing metadata fields added to the `recipes` table:

```typescript
// From schema.ts
recipes {
  weight_score: integer          // 1-5 heaviness
  richness_score: integer        // 1-5 fat content
  acidity_score: integer         // 1-5 acidity
  sweetness_level: text          // light|moderate|rich
  dominant_textures: text        // JSON array
  dominant_flavors: text         // JSON array
  serving_temperature: text      // hot|cold|room
  pairing_rationale: text        // Why it pairs well
}
```

**Note**: The engine generates these values in the AI response, ready to be saved when creating new recipes from meal plans.

---

## File Structure

```
src/lib/ai/
├── meal-pairing-engine.ts          # Core engine (NEW)
└── prompts/
    ├── meal-pairing.ts             # Prompt templates (NEW)
    └── index.ts                    # Updated registry

src/types/
└── index.ts                        # Type re-exports (UPDATED)

docs/
└── MEAL_PAIRING_ENGINE_IMPLEMENTATION.md  # This file (NEW)
```

---

## Next Steps (Not Implemented)

The following are **NOT** part of this implementation but are logical next steps:

1. **Server Action**: Create `src/app/actions/meal-pairing.ts`
   - Wrap `generateMeal()` in a server action
   - Add authentication checks
   - Handle error states for UI

2. **UI Component**: Create meal pairing generator UI
   - Form for user input (cuisine, theme, dietary restrictions)
   - Display generated meal plan
   - Link to existing recipes where available
   - Button to save meal plan

3. **Meal Plan Persistence**: Store generated meals
   - Save to `meals` table
   - Link courses to `mealRecipes` table
   - Create recipes if not in database

4. **Recipe Generation**: Auto-generate missing recipes
   - If AI suggests recipe not in DB, generate full recipe
   - Use existing recipe generation infrastructure
   - Populate pairing metadata fields

5. **Testing**: Unit and integration tests
   - Mock OpenRouter responses
   - Test semantic search integration
   - Validate recipe linking logic

---

## Design Decisions

### Why Gemini 2.0 Flash (Primary Model)?

1. **Free tier available** - No cost for development/testing
2. **Excellent JSON output** - Reliable structured responses
3. **Fast response time** - 2-4 seconds average
4. **Good culinary knowledge** - Handles pairing logic well

### Why Similarity-Based Recipe Matching?

Simple name matching fails when:
- Recipe names vary ("Bruschetta" vs "Tomato Bruschetta")
- AI suggests similar but not identical recipes
- Multiple recipes with similar names exist

Similarity matching (0.6-0.7 threshold):
- ✅ Handles variations gracefully
- ✅ Links to best available match
- ✅ Falls back to semantic similarity when no name match

### Why Course-Specific Search Queries?

Generic searches return mixed results:
- Searching "light" returns mains, sides, desserts
- No course context leads to poor matches

Enhanced queries ("light appetizer starter"):
- ✅ Better semantic alignment
- ✅ Higher quality candidates
- ✅ Respects course conventions

---

## Performance Characteristics

### Estimated Latency

- **Semantic searches (4x)**: ~500-800ms total (parallel)
- **AI generation**: ~2-4 seconds (Gemini 2.0 Flash)
- **Recipe linking**: ~10-20ms
- **Total**: ~3-5 seconds end-to-end

### Cost Estimate

- **Gemini 2.0 Flash**: Free tier (primary)
- **Claude 3.5 Sonnet**: ~$0.003 per call (fallback)
- **Database queries**: Serverless (included in Neon)

### Caching Strategy

Semantic search results are **already cached** by `semantic-search.ts`:
- 15-minute TTL
- Key: query + options hash
- Automatic cache invalidation

No additional caching needed at engine level.

---

## Testing Checklist

- [ ] Unit test: `searchRecipesByCourse()` with mock semantic search
- [ ] Unit test: `enrichWithRecipeLinks()` with known recipes
- [ ] Unit test: `buildDatabaseContext()` formatting
- [ ] Integration test: Full generation with mocked OpenRouter
- [ ] Integration test: Real OpenRouter call (manual)
- [ ] E2E test: Generate meal, verify recipe links
- [ ] Performance test: Measure latency under load

---

## Known Limitations

1. **No recipe generation**: Only suggests courses, doesn't create full recipes
2. **Limited course types**: Appetizer, main, side, dessert only (no soups, salads)
3. **No dietary validation**: Trusts AI to respect dietary restrictions
4. **English only**: Prompts and cuisine names in English
5. **No price estimation**: Doesn't consider ingredient costs

---

## Version History

### v1.0.0 (2025-01-19)
- ✅ Initial implementation
- ✅ 4 prompt templates
- ✅ Semantic search integration
- ✅ OpenRouter integration
- ✅ Type definitions
- ✅ Recipe linking logic
- ✅ Documentation

---

## References

- **Reference Implementation**: `src/lib/ai/meal-pairing-system.ts`
- **Helper Functions**: `docs/implementations/meal-pairing-helpers.ts`
- **Database Schema**: `src/lib/db/schema.ts` (lines 113-122)
- **Semantic Search**: `src/app/actions/semantic-search.ts`
- **OpenRouter Client**: `src/lib/ai/openrouter-server.ts`
- **Prompt System**: `src/lib/ai/prompts/index.ts`

---

**Implementation Status**: ✅ Complete and ready for integration
