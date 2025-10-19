# Meal Pairing System - Developer Quick Start

**Last Updated**: 2025-10-19
**For**: Developers implementing the meal pairing feature

---

## TL;DR

We're integrating an AI-powered meal pairing system that creates balanced multi-course meals using flavor science principles. Recipe Manager already has 80% of the infrastructure (pgvector, semantic search, OpenRouter). We just need to add the pairing engine, UI, and metadata.

**Estimated Effort**: 5-7 days
**Status**: Ready to implement

---

## What We're Building

**Input**: User selects a main dish (e.g., "Roasted Chicken")
**Output**: Complete balanced meal:
- Appetizer (light, acidic to stimulate appetite)
- Main (the selected dish)
- Side (complements main, provides balance)
- Dessert (sweet closure, palate cleanser)

**Pairing Principles**:
1. Weight balance (heavy main → light sides)
2. Acid-fat balance (rich dishes need acidity)
3. Texture variety (6+ unique textures)
4. Temperature progression (hot/cold alternation)
5. Cultural coherence (matching cuisines)

---

## What Already Works

### ✅ Semantic Search (Production-Ready)
```typescript
// Find recipes semantically similar to query
const results = await semanticSearchRecipes('light Italian appetizer', {
  limit: 5,
  minSimilarity: 0.4
});
// Returns actual recipes from database with embeddings!
```

**Location**: `src/app/actions/semantic-search.ts`
**Status**: ✅ Works perfectly, no changes needed

---

### ✅ OpenRouter AI (Ready for Pairing)
```typescript
// Call AI with system prompt
const client = getOpenRouterClient();
const response = await client.chat.completions.create({
  model: 'google/gemini-2.0-flash-exp:free',  // FREE tier
  messages: [
    { role: 'system', content: MEAL_PAIRING_SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ]
});
```

**Location**: `src/lib/ai/openrouter-server.ts`
**Status**: ✅ Works, just needs pairing prompts

---

### ✅ Database Schema (Ready for Extension)
```typescript
// Meals table already exists
const meal = await db.insert(meals).values({
  user_id: userId,
  name: "Family Dinner",
  meal_type: "dinner",
  serves: 4
});

// Add recipes to meal
await db.insert(mealRecipes).values({
  meal_id: meal.id,
  recipe_id: "recipe-123",
  course_category: "main",
  serving_multiplier: 1.0
});
```

**Location**: `src/lib/db/schema.ts`, `src/app/actions/meals.ts`
**Status**: ✅ Complete meal management system

---

## What We Need to Build

### 1. Pairing Metadata (Database Migration)

**Add to `recipes` table**:
```sql
ALTER TABLE recipes
ADD COLUMN pairing_weight INTEGER CHECK (pairing_weight BETWEEN 1 AND 5),
ADD COLUMN pairing_richness INTEGER CHECK (pairing_richness BETWEEN 1 AND 5),
ADD COLUMN pairing_acidity INTEGER CHECK (pairing_acidity BETWEEN 1 AND 5),
ADD COLUMN dominant_textures TEXT,  -- JSON array
ADD COLUMN serving_temperature VARCHAR(10);
```

**Drizzle Schema**:
```typescript
// src/lib/db/schema.ts
export const recipes = pgTable('recipes', {
  // ... existing fields ...

  // Pairing metadata
  pairing_weight: integer('pairing_weight'),  // 1-5 (light to heavy)
  pairing_richness: integer('pairing_richness'),  // 1-5 (lean to rich)
  pairing_acidity: integer('pairing_acidity'),  // 1-5 (alkaline to acidic)
  dominant_textures: text('dominant_textures'),  // JSON: ["crispy", "creamy"]
  serving_temperature: text('serving_temperature'),  // "hot" | "cold" | "room"
});
```

**Commands**:
```bash
# Generate migration
pnpm db:generate

# Review and apply
pnpm db:migrate
```

---

### 2. Meal Pairing Engine (Core Logic)

**File**: `src/lib/ai/meal-pairing-engine.ts` (NEW)

```typescript
export async function generateBalancedMeal(
  params: MealPairingParams
): Promise<MealPlanResult> {
  // 1. Get main recipe (if main-first mode)
  const mainRecipe = params.mainRecipeId
    ? await db.query.recipes.findFirst({ where: eq(recipes.id, params.mainRecipeId) })
    : null;

  // 2. Find candidate recipes using semantic search
  const appetizerCandidates = await semanticSearchRecipes(
    `light appetizer ${params.cuisine}`,
    { limit: 5, minSimilarity: 0.4 }
  );

  const sideCandidates = mainRecipe
    ? await findComplementaryRecipes(mainRecipe, 'side')
    : await semanticSearchRecipes(`side dish ${params.cuisine}`, { limit: 5 });

  const dessertCandidates = await semanticSearchRecipes(
    `dessert ${params.cuisine}`,
    { limit: 5 }
  );

  // 3. Build AI prompt with pairing principles
  const prompt = buildMealPairingPrompt({
    mode: params.mode,
    mainDish: mainRecipe?.name,
    cuisine: params.cuisine,
    dietaryRestrictions: params.dietaryRestrictions,
    // ... include candidate recipes as context
  });

  // 4. Call OpenRouter with pairing system prompt
  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: 'google/gemini-2.0-flash-exp:free',
    messages: [
      { role: 'system', content: MEAL_PAIRING_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });

  // 5. Parse and enrich with database recipe IDs
  const mealPlan = JSON.parse(response.choices[0].message.content);
  return enrichWithRecipeLinks(mealPlan, {
    appetizerCandidates: appetizerCandidates.recipes,
    sideCandidates: sideCandidates.recipes,
    dessertCandidates: dessertCandidates.recipes
  });
}
```

**Key Functions**:
- `generateBalancedMeal()` - Main entry point
- `buildMealPairingPrompt()` - Constructs AI prompt
- `findComplementaryRecipes()` - Finds recipes that balance main dish
- `enrichWithRecipeLinks()` - Matches AI suggestions to database recipes
- `validateMealBalance()` - Checks pairing quality scores

---

### 3. Pairing System Prompt (AI Instructions)

**File**: `src/lib/ai/prompts/meal-pairing.ts` (NEW)

```typescript
export const MEAL_PAIRING_SYSTEM_PROMPT = `You are an expert meal planning assistant that creates balanced multi-course meals using flavor science principles.

CORE PAIRING PRINCIPLES:

1. WEIGHT MATCHING (1-5 scale)
   - Heavy mains (4-5) → Light sides/appetizers (1-2)
   - Medium mains (3) → Light-medium sides (2-3)
   Example: Rich beef stew (5) pairs with light salad (1)

2. ACID-FAT BALANCE
   - Rich/fatty dishes REQUIRE acidic components
   - Rule: side_acidity >= main_richness - 1
   Example: Creamy pasta (richness 5) needs acidic salad (acidity 4+)

3. TEXTURE CONTRAST (minimum 6 unique textures per meal)
   - Never serve consecutive courses with identical texture
   - Layer opposites: crispy/creamy, crunchy/soft, flaky/smooth
   Example: Crispy chicken → Creamy mashed potatoes → Crunchy salad

4. TEMPERATURE PROGRESSION
   - Classic: Hot → Cold → Hot → Cold
   - Alternation prevents sensory fatigue
   Example: Hot soup → Cold salad → Hot main → Cold dessert

5. CULTURAL COHERENCE
   - Match regional pairing traditions when cuisine specified
   - Western: prefer shared flavor compounds
   - East Asian: embrace contrasting profiles

6. NUTRITIONAL BALANCE
   - Target: 40% carbs, 30% protein, 30% fats
   - Distribute protein: appetizer 15%, main 65%, side 20%

OUTPUT FORMAT: Respond with JSON containing appetizer, main, side, dessert courses with pairing rationale and balance scores.`;
```

---

### 4. Server Actions (API Layer)

**File**: `src/app/actions/meal-pairing.ts` (NEW)

```typescript
'use server';

import { auth } from '@/lib/auth';
import { generateBalancedMeal } from '@/lib/ai/meal-pairing-engine';

export async function generateMealFromMain(
  mainRecipeId: string,
  preferences: {
    dietaryRestrictions?: string[];
    timeLimit?: number;
    servings?: number;
  }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const mealPlan = await generateBalancedMeal({
      mode: 'main-first',
      mainRecipeId,
      dietaryRestrictions: preferences.dietaryRestrictions,
      timeLimit: preferences.timeLimit,
      servings: preferences.servings || 4
    });

    return { success: true, data: mealPlan };
  } catch (error) {
    console.error('Meal pairing failed:', error);
    return { success: false, error: 'Failed to generate meal' };
  }
}

export async function generateMealFromCuisine(
  cuisine: string,
  preferences: { /* ... */ }
) {
  // Similar implementation for cuisine-based mode
}

export async function generateMealFromTheme(
  theme: string,
  preferences: { /* ... */ }
) {
  // Similar implementation for theme-based mode
}
```

---

### 5. UI Components

**File**: `src/components/meals/MealPairingWizard.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { generateMealFromMain } from '@/app/actions/meal-pairing';

export function MealPairingWizard() {
  const [step, setStep] = useState(1);
  const [mainRecipeId, setMainRecipeId] = useState('');
  const [mealPlan, setMealPlan] = useState(null);

  const handleGenerate = async () => {
    const result = await generateMealFromMain(mainRecipeId, {
      servings: 4
    });

    if (result.success) {
      setMealPlan(result.data);
      setStep(3);
    }
  };

  return (
    <div className="meal-pairing-wizard">
      {step === 1 && (
        <StepSelectMode onNext={(mode) => setStep(2)} />
      )}

      {step === 2 && (
        <StepSelectMain
          onSelect={(id) => setMainRecipeId(id)}
          onGenerate={handleGenerate}
        />
      )}

      {step === 3 && mealPlan && (
        <StepReviewMeal
          mealPlan={mealPlan}
          onSave={() => saveMeal(mealPlan)}
        />
      )}
    </div>
  );
}
```

**Other Components**:
- `CourseRecommendationCard.tsx` - Display course with pairing notes
- `MealBalanceDashboard.tsx` - Visual balance indicators
- `SwapCourseDialog.tsx` - Replace course with alternatives

---

## Implementation Checklist

### Phase 1: Database & Core Engine (2-3 days)
- [ ] Create migration for pairing metadata
- [ ] Update Drizzle schema
- [ ] Implement `meal-pairing-engine.ts`
- [ ] Create pairing system prompt
- [ ] Implement `findComplementaryRecipes()`
- [ ] Write unit tests
- [ ] Test with sample recipes

### Phase 2: Server Actions (1 day)
- [ ] Implement `generateMealFromMain()`
- [ ] Implement `generateMealFromCuisine()`
- [ ] Implement `generateMealFromTheme()`
- [ ] Add validation and error handling
- [ ] Write integration tests

### Phase 3: UI Components (2-3 days)
- [ ] Build `MealPairingWizard`
- [ ] Build `CourseRecommendationCard`
- [ ] Build `MealBalanceDashboard`
- [ ] Create `/meals/new/pairing` page
- [ ] Test user flow end-to-end
- [ ] Mobile responsive design

### Phase 4: Metadata Population (1-2 days)
- [ ] Create `scripts/populate-pairing-metadata.ts`
- [ ] Implement batch processing
- [ ] Run on existing recipes
- [ ] Validate results

---

## Testing Strategy

### Unit Tests
```typescript
// __tests__/lib/ai/meal-pairing.test.ts

describe('Meal Pairing Engine', () => {
  test('generates balanced meal from heavy main', async () => {
    const result = await generateBalancedMeal({
      mode: 'main-first',
      mainRecipeId: 'recipe-beef-stew'
    });

    expect(result.appetizer.weight_score).toBeLessThan(3);
    expect(result.side.acidity_score).toBeGreaterThan(3);
  });

  test('respects dietary restrictions', async () => {
    const result = await generateBalancedMeal({
      mode: 'cuisine',
      cuisine: 'Italian',
      dietaryRestrictions: ['vegetarian']
    });

    expect(result.main.key_ingredients).not.toContain('meat');
  });
});
```

### Integration Tests
```typescript
// __tests__/integration/meal-pairing-flow.test.ts

describe('Meal Pairing Flow', () => {
  test('complete flow: generate → save → shopping list', async () => {
    // 1. Generate meal
    const pairing = await generateMealFromMain('recipe-123', {});
    expect(pairing.success).toBe(true);

    // 2. Save meal
    const meal = await createMeal({ name: 'AI-Paired Meal' });

    // 3. Add courses
    await addRecipeToMeal({
      meal_id: meal.data.id,
      recipe_id: pairing.data.appetizer.recipe_id,
      course_category: 'appetizer'
    });

    // 4. Generate shopping list
    const list = await generateShoppingList({ mealId: meal.data.id });
    expect(list.success).toBe(true);
  });
});
```

---

## Key Files to Create

```
src/
├── lib/
│   ├── ai/
│   │   ├── meal-pairing-engine.ts          ← Core pairing logic (NEW)
│   │   ├── course-recommendations.ts       ← Complementary recipe finder (NEW)
│   │   └── prompts/
│   │       └── meal-pairing.ts             ← System prompt (NEW)
│   └── db/
│       └── schema.ts                       ← Update with pairing fields
├── app/
│   └── actions/
│       └── meal-pairing.ts                 ← Server actions (NEW)
└── components/
    └── meals/
        ├── MealPairingWizard.tsx           ← Main UI (NEW)
        ├── CourseRecommendationCard.tsx    ← Course display (NEW)
        └── MealBalanceDashboard.tsx        ← Balance visualization (NEW)

scripts/
└── populate-pairing-metadata.ts            ← Background job (NEW)

drizzle/
└── 0XXX_add_recipe_pairing_metadata.sql    ← Migration (NEW)
```

---

## Reference Implementation Mapping

**Where to find the reference code**:
`src/lib/ai/meal-pairing-system.ts` (530 lines)

**How to adapt it**:

| Reference Code | Adaptation Needed | Recipe Manager Equivalent |
|----------------|-------------------|---------------------------|
| Lines 1-52: System prompt | ✅ Copy with minor edits | `src/lib/ai/prompts/meal-pairing.ts` |
| Lines 118-257: Prompt builder | ✅ Use as-is, adapt for our schema | `meal-pairing-engine.ts:buildMealPairingPrompt()` |
| Lines 266-278: Mock semantic search | ⚠️ REPLACE with real implementation | `semanticSearchRecipes()` already exists! |
| Lines 283-315: Recipe link enrichment | ✅ Enhance with semantic matching | `meal-pairing-engine.ts:enrichWithRecipeLinks()` |
| Lines 321-438: Main generation function | ✅ Core logic, adapt API calls | `meal-pairing-engine.ts:generateBalancedMeal()` |
| Lines 457-481: Simplified API | ✅ Use as template for server actions | `src/app/actions/meal-pairing.ts` |

**Key Insight**: Most of the reference implementation is **prompt engineering and orchestration**. The hard parts (semantic search, database, AI client) we already have!

---

## Common Pitfalls to Avoid

### ❌ Don't Do This
```typescript
// DON'T use direct Anthropic API
const response = await fetch("https://api.anthropic.com/v1/messages", {
  headers: { "Authorization": `Bearer ${process.env.ANTHROPIC_API_KEY}` }
});
```

### ✅ Do This Instead
```typescript
// Use OpenRouter (supports multiple models including Anthropic)
const client = getOpenRouterClient();
const response = await client.chat.completions.create({
  model: 'google/gemini-2.0-flash-exp:free',  // Or anthropic/claude-3.5-sonnet
  // ...
});
```

---

### ❌ Don't Do This
```typescript
// DON'T implement mock semantic search
async function semanticSearch() {
  console.log('TODO');
  return [];
}
```

### ✅ Do This Instead
```typescript
// Use existing production semantic search
import { semanticSearchRecipes } from '@/app/actions/semantic-search';

const results = await semanticSearchRecipes(query, options);
// Returns actual recipes with embeddings!
```

---

### ❌ Don't Do This
```typescript
// DON'T match recipes by name substring
const match = candidates.find(c =>
  c.name.toLowerCase().includes(courseName.toLowerCase())
);
```

### ✅ Do This Instead
```typescript
// Use semantic similarity for better matching
const courseEmbedding = await generateEmbedding(courseDescription);
const bestMatch = candidates
  .map(c => ({
    ...c,
    similarity: cosineSimilarity(courseEmbedding, c.embedding)
  }))
  .sort((a, b) => b.similarity - a.similarity)[0];

if (bestMatch.similarity > 0.7) {
  return bestMatch.id;
}
```

---

## Environment Variables

**Required**:
```env
# Already have these
OPENROUTER_API_KEY=sk-or-...
HUGGINGFACE_API_KEY=hf_...
DATABASE_URL=postgresql://...

# No new env vars needed!
```

**Cost Considerations**:
- Gemini 2.0 Flash: **FREE** (recommended for v1)
- Claude 3.5 Sonnet: ~$0.003/request (premium option)
- HuggingFace embeddings: FREE tier (30k/month)

---

## Getting Started

### 1. Review Reference Implementation
```bash
# Read the reference file
cat src/lib/ai/meal-pairing-system.ts

# Focus on:
# - System prompt (lines 8-52)
# - Pairing principles
# - Prompt builder logic
# - API integration patterns
```

### 2. Set Up Development Environment
```bash
# Create feature branch
git checkout -b feature/meal-pairing-system

# Install dependencies (already installed)
pnpm install

# Start dev server
pnpm dev
```

### 3. Start with Phase 1
```bash
# Create migration
pnpm db:generate

# Create core files
touch src/lib/ai/meal-pairing-engine.ts
touch src/lib/ai/prompts/meal-pairing.ts
touch src/lib/ai/course-recommendations.ts

# Write tests first (TDD)
touch __tests__/lib/ai/meal-pairing.test.ts
```

---

## Quick Reference: Key Functions

### Semantic Search (Already Works!)
```typescript
import { semanticSearchRecipes } from '@/app/actions/semantic-search';

const results = await semanticSearchRecipes('light Italian appetizer', {
  limit: 5,
  minSimilarity: 0.4,
  cuisine: 'Italian',
  includePrivate: true
});
```

### OpenRouter AI (Already Works!)
```typescript
import { getOpenRouterClient } from '@/lib/ai/openrouter-server';

const client = getOpenRouterClient();
const response = await client.chat.completions.create({
  model: 'google/gemini-2.0-flash-exp:free',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
});
```

### Embedding Generation (Already Works!)
```typescript
import { generateEmbedding } from '@/lib/ai/embeddings';

const embedding = await generateEmbedding('Light garden salad with lemon');
// Returns: [0.123, -0.456, ...] (384 dimensions)
```

### Database Operations (Already Work!)
```typescript
import { db } from '@/lib/db';
import { recipes, meals, mealRecipes } from '@/lib/db/schema';

// Get recipe
const recipe = await db.query.recipes.findFirst({
  where: eq(recipes.id, recipeId)
});

// Create meal
const meal = await db.insert(meals).values({
  user_id: userId,
  name: 'Family Dinner',
  serves: 4
});

// Add recipe to meal
await db.insert(mealRecipes).values({
  meal_id: meal.id,
  recipe_id: recipe.id,
  course_category: 'main'
});
```

---

## Next Steps

1. **Read full integration plan**: `docs/research/MEAL_PAIRING_INTEGRATION_PLAN.md`
2. **Review reference implementation**: `src/lib/ai/meal-pairing-system.ts`
3. **Start Phase 1**: Database migration + core engine
4. **Test thoroughly**: Write tests before implementation
5. **Iterate**: Get feedback, refine pairing logic

---

## Questions?

**Full Documentation**:
- Integration Plan: `docs/research/MEAL_PAIRING_INTEGRATION_PLAN.md`
- Executive Summary: `MEAL_PAIRING_INTEGRATION_SUMMARY.md`
- This Quick Start: `docs/research/MEAL_PAIRING_QUICK_START.md`

**Reference Implementation**: `src/lib/ai/meal-pairing-system.ts`

**Existing Infrastructure**:
- Semantic Search: `src/app/actions/semantic-search.ts`
- OpenRouter: `src/lib/ai/openrouter-server.ts`
- Embeddings: `src/lib/ai/embeddings.ts`
- Meals: `src/app/actions/meals.ts`
- Schema: `src/lib/db/schema.ts`

---

**Happy Coding!** 🚀
