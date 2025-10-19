# Meal Pairing System Integration Plan

**Date**: 2025-10-19
**Reference Implementation**: `src/lib/ai/meal-pairing-system.ts` (530 lines)
**Target Version**: v0.7.0 - AI Meal Pairing & Multi-Course Planning

---

## Executive Summary

The meal-pairing-system.ts reference implementation provides a sophisticated AI-powered meal planning system that uses:
- **Flavor Science Principles** - Weight matching, acid-fat balance, texture contrast
- **OpenRouter AI Integration** - LLM-powered meal course generation
- **Semantic Search Integration** - pgvector-based recipe discovery
- **Multi-Course Planning** - Appetizer, main, side, dessert coordination

**Current Status**: Recipe Manager has most foundational infrastructure in place (database schema, semantic search, OpenRouter integration). The meal pairing system can be integrated with **moderate implementation effort** (estimated 3-5 days).

**Key Finding**: This is a **reference implementation** showing how to use the pairing principles, NOT a production-ready drop-in module. We need to adapt the prompts and logic to work with our existing infrastructure.

---

## Analysis: What Exists vs. What's Needed

### ✅ Already Implemented (Strong Foundation)

#### 1. **Database Infrastructure** (COMPLETE)
- ✅ **pgvector Extension**: Enabled with `vector(384)` type
- ✅ **recipeEmbeddings Table**: Stores 384-dim embeddings with model tracking
- ✅ **Meals Schema**: Comprehensive meal planning tables
  - `meals` - Meal collections with metadata
  - `mealRecipes` - Junction table with serving multipliers and course categories
  - `shoppingLists` - Shopping list generation from meals
  - `mealTemplates` - Predefined meal structures

#### 2. **Semantic Search** (PRODUCTION-READY)
- ✅ **Embedding Generation**: HuggingFace API with `BAAI/bge-small-en-v1.5`
- ✅ **Vector Similarity Search**: Cosine distance queries with pgvector
- ✅ **Recipe Search Actions**: `semanticSearchRecipes()` in `src/app/actions/semantic-search.ts`
- ✅ **Caching Layer**: LRU cache for performance optimization
- ✅ **Ranking System**: Weighted multi-factor ranking (semantic, popularity, recency)

#### 3. **AI Integration** (READY FOR EXTENSION)
- ✅ **OpenRouter Client**: Server-side wrapper in `src/lib/ai/openrouter-server.ts`
- ✅ **Multiple Model Support**: Gemini 2.0 Flash, Claude 3.5 Sonnet, GPT-4o
- ✅ **Recipe Generation**: Existing AI recipe generation logic

#### 4. **Meal Management** (COMPLETE)
- ✅ **CRUD Operations**: Full meal lifecycle in `src/app/actions/meals.ts`
- ✅ **Recipe Association**: Add/remove recipes with serving multipliers
- ✅ **Shopping List Generation**: Ingredient consolidation with unit conversion
- ✅ **Template System**: Reusable meal templates

#### 5. **Smart Meal Suggestions** (PARTIAL)
- ✅ **Basic Suggestions**: `src/app/actions/meal-suggestions.ts`
- ✅ **Dietary Filtering**: Vegetarian, vegan, gluten-free, etc.
- ✅ **Course-Based Search**: Appetizer, main, side, dessert classification
- ⚠️ **NO Pairing Logic**: Lacks flavor science and balance principles

---

### ❌ Missing Components (Implementation Needed)

#### 1. **Meal Pairing Engine** (NEW - CORE FEATURE)
**Status**: Reference implementation exists, needs adaptation

**Required Implementation**:
```typescript
// src/lib/ai/meal-pairing-engine.ts (NEW FILE)

interface MealPairingParams {
  mode: 'cuisine' | 'theme' | 'main-first' | 'freestyle';
  cuisine?: string;
  theme?: string;
  mainRecipeId?: string;  // Use existing recipe as anchor
  dietaryRestrictions?: string[];
  availableIngredients?: string[];
  timeLimit?: number;
  servings?: number;
}

interface MealPlanResult {
  appetizer: CourseRecommendation;
  main: CourseRecommendation;
  side: CourseRecommendation;
  dessert: CourseRecommendation;
  analysis: MealAnalysis;
}

async function generateBalancedMeal(params: MealPairingParams): Promise<MealPlanResult>
```

**Key Features**:
- Implements pairing principles from reference implementation
- Uses semantic search to find candidate recipes
- Calls OpenRouter with flavor science system prompt
- Enriches AI-generated courses with database recipe links
- Validates pairing balance (weight, acid-fat, texture)

**Implementation Scope**: ~400-500 lines

---

#### 2. **Pairing Principles System Prompt** (NEW)
**Status**: Needs conversion from reference implementation

**Required**:
- Port `MEAL_PAIRING_SYSTEM_PROMPT` to production format
- Adapt principles for our recipe schema structure
- Add support for existing recipe enrichment
- Include nutritional balance calculations

**File**: `src/lib/ai/prompts/meal-pairing.ts` (NEW)

**Implementation Scope**: ~150-200 lines

---

#### 3. **Course Recommendation Engine** (NEW)
**Status**: Needs development

**Required Logic**:
```typescript
// src/lib/ai/course-recommendations.ts (NEW)

interface CourseFilters {
  mainDishCharacteristics: {
    weight: 1-5;      // Heavy (5) to Light (1)
    richness: 1-5;    // Rich (5) to Lean (1)
    acidity: 1-5;     // Acidic (5) to Alkaline (1)
  };
  targetCourse: 'appetizer' | 'side' | 'dessert';
}

async function findComplementaryRecipes(filters: CourseFilters): Promise<Recipe[]>
```

**Pairing Rules** (from reference implementation):
1. **Weight Matching**: Heavy mains (4-5) → Light sides (1-2)
2. **Acid-Fat Balance**: Rich dishes require acidic components
3. **Texture Contrast**: Minimum 6 unique textures per meal
4. **Temperature Progression**: Hot → Cold → Hot → Cold
5. **Flavor Intensity**: Match within 1-2 points on 1-5 scale
6. **Cultural Coherence**: Match regional pairing traditions

**Implementation Scope**: ~300-350 lines

---

#### 4. **Recipe Pairing Metadata** (DATABASE SCHEMA EXTENSION)
**Status**: Needs schema migration

**Required Fields** (add to `recipes` table):
```sql
ALTER TABLE recipes ADD COLUMN pairing_weight INTEGER CHECK (pairing_weight BETWEEN 1 AND 5);
ALTER TABLE recipes ADD COLUMN pairing_richness INTEGER CHECK (pairing_richness BETWEEN 1 AND 5);
ALTER TABLE recipes ADD COLUMN pairing_acidity INTEGER CHECK (pairing_acidity BETWEEN 1 AND 5);
ALTER TABLE recipes ADD COLUMN pairing_sweetness VARCHAR(20) CHECK (pairing_sweetness IN ('light', 'moderate', 'rich'));
ALTER TABLE recipes ADD COLUMN dominant_textures TEXT; -- JSON array
ALTER TABLE recipes ADD COLUMN dominant_flavors TEXT; -- JSON array
ALTER TABLE recipes ADD COLUMN serving_temperature VARCHAR(10) CHECK (serving_temperature IN ('hot', 'cold', 'room'));

-- Index for pairing queries
CREATE INDEX idx_recipes_pairing ON recipes(pairing_weight, pairing_richness, pairing_acidity);
```

**Migration File**: `drizzle/0XXX_add_recipe_pairing_metadata.sql`

**Schema Update**: `src/lib/db/schema.ts`

**Implementation Scope**: 1 migration + schema updates

---

#### 5. **Server Actions for Meal Pairing** (NEW)
**Status**: Needs development

**Required Actions**:
```typescript
// src/app/actions/meal-pairing.ts (NEW)

export async function generateBalancedMealFromMain(
  mainRecipeId: string,
  preferences: MealPairingPreferences
): Promise<MealPlanResult>

export async function generateMealFromCuisine(
  cuisine: string,
  preferences: MealPairingPreferences
): Promise<MealPlanResult>

export async function generateMealFromTheme(
  theme: string,
  preferences: MealPairingPreferences
): Promise<MealPlanResult>

export async function validateMealBalance(
  mealId: string
): Promise<MealBalanceReport>
```

**Implementation Scope**: ~250-300 lines

---

#### 6. **UI Components** (NEW)
**Status**: Needs development

**Required Components**:

1. **Meal Pairing Wizard** (`src/components/meals/MealPairingWizard.tsx`)
   - Step 1: Choose pairing mode (cuisine/theme/main-first/freestyle)
   - Step 2: Set preferences (dietary, time limit, servings)
   - Step 3: Review AI-generated courses
   - Step 4: Customize and save meal

2. **Course Recommendation Card** (`src/components/meals/CourseRecommendationCard.tsx`)
   - Display course with pairing rationale
   - Show balance scores (weight, acidity, texture)
   - Option to swap with alternative recipes
   - Link to existing recipe if match found

3. **Meal Balance Dashboard** (`src/components/meals/MealBalanceDashboard.tsx`)
   - Visual balance indicators (weight, acid-fat, texture variety)
   - Color palette visualization
   - Temperature progression chart
   - Nutritional macros breakdown
   - Chef notes and recommendations

**Implementation Scope**: ~600-800 lines total

---

#### 7. **Background Job for Pairing Metadata** (OPTIONAL)
**Status**: Enhancement for production

**Purpose**: Auto-populate pairing metadata for existing recipes using AI

**Implementation**:
```typescript
// scripts/populate-pairing-metadata.ts (NEW)

async function analyzeRecipeForPairing(recipe: Recipe): Promise<PairingMetadata> {
  const prompt = `Analyze this recipe for meal pairing:
    Name: ${recipe.name}
    Ingredients: ${recipe.ingredients}
    Instructions: ${recipe.instructions}

    Provide:
    - Weight score (1-5): How heavy/rich is this dish?
    - Richness score (1-5): Fat content
    - Acidity score (1-5): Acid level
    - Dominant textures: Array of 2-3 textures
    - Dominant flavors: Array of 2-3 flavor profiles
    - Serving temperature: hot/cold/room
  `;

  // Call OpenRouter for analysis
  // Parse and validate response
  // Update recipe with metadata
}
```

**Implementation Scope**: ~200-250 lines

---

## Implementation Phases

### Phase 1: Database & Core Engine (2-3 days)
**Priority**: 🔴 CRITICAL

**Tasks**:
1. ✅ Create database migration for pairing metadata fields
2. ✅ Update Drizzle schema with new fields and types
3. ✅ Implement `meal-pairing-engine.ts` core logic
4. ✅ Port pairing principles system prompt
5. ✅ Create course recommendation engine
6. ✅ Write unit tests for pairing logic

**Deliverables**:
- Migration: `0XXX_add_recipe_pairing_metadata.sql`
- Core Engine: `src/lib/ai/meal-pairing-engine.ts`
- System Prompt: `src/lib/ai/prompts/meal-pairing.ts`
- Recommendations: `src/lib/ai/course-recommendations.ts`

**Testing**:
```bash
# Test pairing engine
pnpm test:pairing-engine

# Test recommendations
pnpm test:course-recommendations
```

---

### Phase 2: Server Actions & Integration (1-2 days)
**Priority**: 🔴 CRITICAL

**Tasks**:
1. ✅ Implement meal pairing server actions
2. ✅ Integrate with existing meal management actions
3. ✅ Add validation and error handling
4. ✅ Implement caching for pairing results
5. ✅ Write integration tests

**Deliverables**:
- Actions: `src/app/actions/meal-pairing.ts`
- Tests: `__tests__/actions/meal-pairing.test.ts`

**API Example**:
```typescript
// Generate meal from main dish
const result = await generateBalancedMealFromMain('recipe-123', {
  dietaryRestrictions: ['vegetarian'],
  timeLimit: 90,
  servings: 4
});

// Result includes:
// - appetizer with pairing rationale
// - main (the selected recipe)
// - side with balance analysis
// - dessert with sweet closure notes
// - overall meal analysis
```

---

### Phase 3: UI Components (2-3 days)
**Priority**: 🟡 HIGH

**Tasks**:
1. ✅ Build Meal Pairing Wizard component
2. ✅ Create Course Recommendation Cards
3. ✅ Implement Meal Balance Dashboard
4. ✅ Add swap/customize functionality
5. ✅ Integrate with existing meal pages
6. ✅ Add mobile-responsive designs

**Deliverables**:
- Wizard: `src/components/meals/MealPairingWizard.tsx`
- Cards: `src/components/meals/CourseRecommendationCard.tsx`
- Dashboard: `src/components/meals/MealBalanceDashboard.tsx`
- Page: `src/app/meals/new/pairing/page.tsx`

**User Flow**:
```
1. User visits /meals/new/pairing
2. Selects pairing mode (e.g., "Main-First")
3. Chooses a main dish from library
4. Sets preferences (dietary, time, servings)
5. AI generates balanced appetizer/side/dessert
6. User reviews recommendations with pairing rationale
7. Can swap courses or use alternatives
8. Saves complete meal to library
9. Can generate shopping list
```

---

### Phase 4: Metadata Population (1-2 days)
**Priority**: 🟢 MEDIUM

**Tasks**:
1. ✅ Create background script for metadata analysis
2. ✅ Implement batch processing with rate limiting
3. ✅ Add progress tracking and resumption
4. ✅ Run on existing recipe database
5. ✅ Validate results and fix outliers

**Deliverables**:
- Script: `scripts/populate-pairing-metadata.ts`
- Documentation: `docs/guides/PAIRING_METADATA_POPULATION.md`

**Usage**:
```bash
# Analyze all recipes without pairing metadata
pnpm scripts:populate-pairing --batch-size=10 --delay=2000

# Analyze specific recipe
pnpm scripts:analyze-pairing --recipe-id=recipe-123

# Re-analyze all recipes (force refresh)
pnpm scripts:populate-pairing --force
```

---

### Phase 5: Testing & Documentation (1 day)
**Priority**: 🟡 HIGH

**Tasks**:
1. ✅ Write comprehensive unit tests
2. ✅ Add integration tests for full flow
3. ✅ Test with various dietary restrictions
4. ✅ Document API and usage examples
5. ✅ Update README and changelog

**Deliverables**:
- Tests: `__tests__/lib/ai/meal-pairing.test.ts`
- Docs: `docs/features/MEAL_PAIRING_SYSTEM.md`
- User Guide: `docs/guides/USING_MEAL_PAIRING.md`
- API Reference: `docs/api/MEAL_PAIRING_API.md`

---

## Technical Considerations

### 1. **OpenRouter vs. Direct Anthropic API**
**Current**: Reference implementation uses direct Anthropic API
**Recommendation**: Use OpenRouter for flexibility

**Adaptation Required**:
```typescript
// Reference implementation:
const response = await fetch("https://api.anthropic.com/v1/messages", {
  model: "claude-sonnet-4-20250514",
  // ...
});

// Recipe Manager implementation:
const client = getOpenRouterClient();
const response = await client.chat.completions.create({
  model: "anthropic/claude-3.5-sonnet",  // OpenRouter format
  messages: [
    { role: "system", content: MEAL_PAIRING_SYSTEM_PROMPT },
    { role: "user", content: enhancedPrompt }
  ],
  // ...
});
```

---

### 2. **Semantic Search Integration**
**Current**: Reference has mock implementation
**Recipe Manager**: Full production-ready semantic search

**Integration**:
```typescript
// Reference mock:
async function semanticSearch(params: { query: string; limit: number; }): Promise<RecipeSearchResult[]> {
  console.log('Semantic search:', params);
  return [];
}

// Recipe Manager actual:
import { semanticSearchRecipes } from '@/app/actions/semantic-search';

const appetizerCandidates = await semanticSearchRecipes(
  `${cuisine} light appetizer acidic fresh`,
  {
    limit: 5,
    minSimilarity: 0.4,
    includePrivate: true,
  }
);
```

**Advantage**: We can immediately find matching recipes in our database!

---

### 3. **Recipe Matching Strategy**
**Reference**: Simple name substring matching
**Recommendation**: Use semantic similarity scores

**Enhanced Matching**:
```typescript
function enrichWithRecipeLinks(
  mealPlan: MealPlan,
  candidates: { appetizerCandidates: RecipeWithSimilarity[] }
): MealPlan {
  // Instead of name matching, use semantic similarity
  const findMatch = (courseDescription: string, candidates: RecipeWithSimilarity[]) => {
    // Generate embedding for AI-generated course
    const courseEmbedding = await generateEmbedding(courseDescription);

    // Find most similar existing recipe
    const bestMatch = candidates
      .map(c => ({
        ...c,
        descriptionSimilarity: cosineSimilarity(courseEmbedding, c.embedding)
      }))
      .sort((a, b) => b.descriptionSimilarity - a.descriptionSimilarity)[0];

    // Only match if similarity > 0.7 (high confidence)
    return bestMatch?.descriptionSimilarity > 0.7 ? bestMatch.id : null;
  };

  return {
    ...mealPlan,
    appetizer: {
      ...mealPlan.appetizer,
      recipe_id: findMatch(mealPlan.appetizer.description, candidates.appetizerCandidates)
    }
  };
}
```

---

### 4. **Pairing Metadata Storage**
**Options**:
1. **Database Fields** (Recommended for v1)
   - Pros: Fast queries, indexable, explicit schema
   - Cons: Requires migration, rigid structure

2. **JSONB Field** (Future consideration)
   - Pros: Flexible, no migration needed
   - Cons: Harder to query, no type safety

**Recommendation**: Use explicit fields for core pairing attributes (weight, richness, acidity), JSONB for extended metadata (dominant_textures, dominant_flavors).

---

### 5. **Performance Optimization**
**Caching Strategy**:
```typescript
// Cache pairing results
const pairingCacheKey = `meal-pairing:${mode}:${JSON.stringify(params)}`;
const cached = searchCaches.pairing.get(pairingCacheKey);
if (cached) return cached;

// Cache enriched recipe candidates
const candidatesCacheKey = `pairing-candidates:${course}:${cuisine}`;
```

**Database Indexing**:
```sql
-- Optimize pairing queries
CREATE INDEX idx_recipes_pairing_weight ON recipes(pairing_weight, cuisine);
CREATE INDEX idx_recipes_pairing_balance ON recipes(pairing_richness, pairing_acidity);
```

---

## API Design

### Server Action: `generateBalancedMealFromMain`

```typescript
// src/app/actions/meal-pairing.ts

export async function generateBalancedMealFromMain(
  mainRecipeId: string,
  preferences: {
    dietaryRestrictions?: string[];
    timeLimit?: number;
    servings?: number;
    cuisinePreference?: string;
  }
): Promise<{
  success: boolean;
  meal?: {
    appetizer: CourseRecommendation;
    main: CourseRecommendation;
    side: CourseRecommendation;
    dessert: CourseRecommendation;
    analysis: MealAnalysis;
  };
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // 1. Get main recipe
    const mainRecipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, mainRecipeId)
    });

    if (!mainRecipe) {
      return { success: false, error: 'Main recipe not found' };
    }

    // 2. Analyze main dish characteristics
    const mainCharacteristics = await analyzeRecipeForPairing(mainRecipe);

    // 3. Find complementary recipe candidates using semantic search
    const appetizerCandidates = await semanticSearchRecipes(
      `light appetizer ${preferences.cuisinePreference || mainRecipe.cuisine} acidic`,
      { limit: 5, minSimilarity: 0.4 }
    );

    const sideCandidates = await findComplementaryRecipes({
      mainDishCharacteristics,
      targetCourse: 'side'
    });

    const dessertCandidates = await semanticSearchRecipes(
      `dessert ${preferences.cuisinePreference || mainRecipe.cuisine}`,
      { limit: 5, minSimilarity: 0.4 }
    );

    // 4. Build enhanced prompt with database context
    const prompt = buildMealPairingPrompt({
      mode: 'main-first',
      mainDish: mainRecipe.name,
      dietaryRestrictions: preferences.dietaryRestrictions,
      timeLimit: preferences.timeLimit,
      servings: preferences.servings,
    });

    const semanticContext = buildSemanticContext({
      mainRecipe,
      appetizerCandidates,
      sideCandidates,
      dessertCandidates
    });

    // 5. Call OpenRouter with pairing principles
    const client = getOpenRouterClient();
    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        { role: 'system', content: MEAL_PAIRING_SYSTEM_PROMPT },
        { role: 'user', content: `${prompt}\n\n${semanticContext}` }
      ],
      response_format: { type: 'json_object' },
    });

    const mealPlan: MealPlan = JSON.parse(response.choices[0].message.content);

    // 6. Enrich with database recipe IDs
    const enrichedMeal = enrichWithRecipeLinks(mealPlan, {
      appetizerCandidates: appetizerCandidates.recipes,
      sideCandidates: sideCandidates.recipes,
      dessertCandidates: dessertCandidates.recipes
    });

    return { success: true, meal: enrichedMeal };
  } catch (error) {
    console.error('Meal pairing failed:', error);
    return { success: false, error: 'Failed to generate balanced meal' };
  }
}
```

---

## Testing Strategy

### Unit Tests
```typescript
// __tests__/lib/ai/meal-pairing.test.ts

describe('Meal Pairing Engine', () => {
  test('generates balanced meal from main dish', async () => {
    const result = await generateBalancedMealFromMain('recipe-heavy-steak', {
      servings: 4
    });

    expect(result.success).toBe(true);
    expect(result.meal.appetizer.weight_score).toBeLessThan(3); // Light appetizer
    expect(result.meal.side.acidity_score).toBeGreaterThan(3); // Acidic to balance richness
  });

  test('respects dietary restrictions', async () => {
    const result = await generateBalancedMealFromMain('recipe-chicken', {
      dietaryRestrictions: ['vegetarian']
    });

    expect(result.success).toBe(true);
    // Should replace chicken with vegetarian alternative
    expect(result.meal.main.key_ingredients).not.toContain('chicken');
  });

  test('maintains cultural coherence', async () => {
    const result = await generateMealFromCuisine('Italian', {
      servings: 6
    });

    expect(result.success).toBe(true);
    expect(result.meal.analysis.cultural_coherence).toContain('Italian');
  });
});
```

### Integration Tests
```typescript
// __tests__/integration/meal-pairing-flow.test.ts

describe('Meal Pairing Flow', () => {
  test('complete flow: main → pairing → save → shopping list', async () => {
    // 1. Generate paired meal
    const pairingResult = await generateBalancedMealFromMain('recipe-123', {
      servings: 4
    });
    expect(pairingResult.success).toBe(true);

    // 2. Save meal
    const mealResult = await createMeal({
      name: 'AI-Paired Family Dinner',
      serves: 4,
    });
    expect(mealResult.success).toBe(true);

    // 3. Add courses to meal
    for (const course of ['appetizer', 'main', 'side', 'dessert']) {
      const courseData = pairingResult.meal[course];
      if (courseData.recipe_id) {
        await addRecipeToMeal({
          meal_id: mealResult.data.id,
          recipe_id: courseData.recipe_id,
          course_category: course,
        });
      }
    }

    // 4. Generate shopping list
    const shoppingListResult = await generateShoppingList({
      mealId: mealResult.data.id
    });
    expect(shoppingListResult.success).toBe(true);
    expect(shoppingListResult.data.items).toBeDefined();
  });
});
```

---

## Migration Path

### Step 1: Add Pairing Metadata Fields (Non-Breaking)
```sql
-- drizzle/0XXX_add_recipe_pairing_metadata.sql

-- Add pairing analysis fields (nullable for backward compatibility)
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS pairing_weight INTEGER CHECK (pairing_weight BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS pairing_richness INTEGER CHECK (pairing_richness BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS pairing_acidity INTEGER CHECK (pairing_acidity BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS pairing_sweetness VARCHAR(20) CHECK (pairing_sweetness IN ('light', 'moderate', 'rich')),
ADD COLUMN IF NOT EXISTS dominant_textures TEXT,  -- JSON array
ADD COLUMN IF NOT EXISTS dominant_flavors TEXT,   -- JSON array
ADD COLUMN IF NOT EXISTS serving_temperature VARCHAR(10) CHECK (serving_temperature IN ('hot', 'cold', 'room'));

-- Add indexes for pairing queries
CREATE INDEX IF NOT EXISTS idx_recipes_pairing_weight ON recipes(pairing_weight);
CREATE INDEX IF NOT EXISTS idx_recipes_pairing_balance ON recipes(pairing_richness, pairing_acidity);

-- Add composite index for course filtering
CREATE INDEX IF NOT EXISTS idx_recipes_pairing_course ON recipes(pairing_weight, serving_temperature, cuisine);
```

### Step 2: Run Migration
```bash
pnpm db:generate
pnpm db:migrate
```

### Step 3: Populate Metadata (Background)
```bash
# Analyze existing recipes
pnpm scripts:populate-pairing --batch-size=10 --delay=2000

# Monitor progress
tail -f logs/pairing-metadata-population.log
```

### Step 4: Deploy Pairing Features
```bash
# Build with new features
pnpm build

# Deploy to production
vercel --prod
```

---

## Risk Assessment

### High Risk
1. **AI Cost**: OpenRouter API calls for meal generation
   - **Mitigation**: Cache results aggressively, use free Gemini model

2. **Pairing Quality**: AI may suggest incompatible combinations
   - **Mitigation**: Validate with pairing rules, allow manual override

### Medium Risk
1. **Database Performance**: Complex pairing queries
   - **Mitigation**: Proper indexing, query optimization

2. **Metadata Completeness**: Not all recipes will have pairing data
   - **Mitigation**: Handle nulls gracefully, use fallback logic

### Low Risk
1. **UI Complexity**: Multi-step wizard
   - **Mitigation**: Clear UX design, save progress

---

## Success Metrics

### Technical Metrics
- Pairing generation time: < 5 seconds (p95)
- Database query time: < 100ms (p95)
- Cache hit rate: > 60%
- Semantic search recall: > 80%

### User Metrics
- Meal pairing completion rate: > 70%
- User satisfaction with pairings: > 4/5
- Meals saved from pairing wizard: > 50%
- Shopping lists generated: > 30%

### Quality Metrics
- Pairing balance scores: Average > 0.8
- Cultural coherence: > 90% accurate cuisine matching
- Dietary restriction compliance: 100% (critical)

---

## Next Steps

1. **Review & Approve Plan** (30 min)
   - Stakeholder review
   - Prioritize phases
   - Allocate resources

2. **Phase 1 Kickoff** (2-3 days)
   - Create migration
   - Implement core engine
   - Write tests

3. **Iteration & Feedback** (ongoing)
   - Test with real recipes
   - Gather user feedback
   - Refine pairing rules

---

## Appendix: Reference Implementation Comparison

### Similarities
- Both use OpenRouter/AI for generation
- Both use semantic search for candidates
- Both support dietary restrictions
- Both handle multiple pairing modes

### Differences

| Feature | Reference Implementation | Recipe Manager |
|---------|-------------------------|----------------|
| **Semantic Search** | Mock (TODO) | ✅ Production-ready with pgvector |
| **AI Provider** | Direct Anthropic API | OpenRouter (multi-model) |
| **Recipe Matching** | Simple name substring | Semantic similarity scores |
| **Database** | Not integrated | Full Drizzle ORM integration |
| **Caching** | None | LRU cache with TTL |
| **UI** | None | Full React components needed |
| **Auth** | None | Clerk authentication |

### Adaptation Strategy
1. **Keep**: Core pairing principles and system prompt
2. **Adapt**: API integration to use OpenRouter
3. **Enhance**: Recipe matching with semantic search
4. **Add**: Database persistence, caching, UI components

---

## Conclusion

The meal-pairing-system.ts reference implementation provides an excellent foundation for AI-powered meal planning. Recipe Manager already has **80% of the required infrastructure** in place:
- ✅ Database schema for meals and embeddings
- ✅ Semantic search with pgvector
- ✅ OpenRouter AI integration
- ✅ Existing meal management system

**Implementation effort**: ~5-7 days for full feature rollout

**Key Value Proposition**:
- Scientifically-balanced meals (flavor science)
- Leverages existing recipe database
- Reduces meal planning decision fatigue
- Generates optimized shopping lists
- Educational (teaches pairing principles)

**Recommendation**: Proceed with phased implementation starting with Phase 1 (Database & Core Engine).

---

**Document Version**: 1.0
**Last Updated**: 2025-10-19
**Author**: Claude Code (Research Agent)
**Next Review**: After Phase 1 completion
