# Recipe Manager Feature Roadmap 2025
## Comprehensive Implementation Plan & Technical Analysis

**Document Version**: 1.0
**Date**: 2025-10-15
**Status**: Research Complete - Ready for Engineering Handoff
**Total Features**: 14 analyzed

---

## Executive Summary

This document provides a comprehensive analysis of 14 requested features for the Recipe Manager application, including technical requirements, database schema changes, LLM cost optimization, dependency mapping, and a phased implementation plan.

### Key Findings

- **CRITICAL Issue Identified**: Ingredient amounts are NOT displayed - data quality issue requiring LLM cleanup
- **4 Database Tables Required**: ingredients, meals, mealRecipes, fridgeInventories
- **3 Implementation Phases**: Foundation (2 weeks), Core Features (3 weeks), AI Features (3 weeks)
- **Estimated Total Cost**: $50-150 for initial cleanup, $5-20/month operational
- **High-Value Quick Wins**: Features 1, 2, 5 (can be completed in Phase 1, Week 1)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Feature Catalog](#feature-catalog)
3. [Database Schema Changes](#database-schema-changes)
4. [Dependency Graph](#dependency-graph)
5. [Implementation Phases](#implementation-phases)
6. [Technical Specifications](#technical-specifications)
7. [LLM Cost Analysis](#llm-cost-analysis)
8. [Risk Assessment](#risk-assessment)
9. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Existing Infrastructure

#### Database Schema (Current)
```typescript
// EXISTING TABLES (from src/lib/db/schema.ts)

recipes {
  id: text (UUID)
  userId: text (Clerk ID)
  name: text
  description: text
  ingredients: text (JSON array of strings) ⚠️ CRITICAL: No structured amounts
  instructions: text (JSON array)
  prepTime: integer
  cookTime: integer
  servings: integer
  difficulty: enum('easy', 'medium', 'hard')
  cuisine: text
  tags: text (JSON array)
  images: text (JSON array, max 6)
  isPublic: boolean
  isSystemRecipe: boolean
  nutritionInfo: text (JSON)
  modelUsed: text
  source: text

  // Provenance tracking
  searchQuery: text
  discoveryDate: timestamp
  confidenceScore: decimal(3,2)
  validationModel: text
  embeddingModel: text
  discoveryWeek: integer
  discoveryYear: integer
  publishedDate: timestamp

  // Ratings
  systemRating: decimal(2,1)
  systemRatingReason: text
  avgUserRating: decimal(2,1)
  totalUserRatings: integer

  createdAt: timestamp
  updatedAt: timestamp
}

recipeEmbeddings {
  id: uuid
  recipeId: text → recipes.id
  embedding: vector(384) // pgvector for semantic search
  embeddingText: text
  modelName: varchar(100) default 'all-MiniLM-L6-v2'
  createdAt: timestamp
  updatedAt: timestamp
}

recipeRatings {
  id: uuid
  recipeId: text → recipes.id
  userId: text
  rating: integer (0-5)
  review: text
  createdAt: timestamp
  updatedAt: timestamp
  UNIQUE(recipeId, userId)
}
```

#### AI Infrastructure
- **OpenRouter Integration**: Multiple models (Claude, GPT, Gemini, Llama)
- **Primary Model**: Google Gemini 2.0 Flash (free tier)
- **Embeddings**: Hugging Face `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
- **Vision Models Available**: GPT-4o, Llama 3.2 90B Vision

#### Current Limitations
1. **Ingredients stored as plain strings** - "flour" instead of "2 cups flour"
2. **No structured ingredient database** - Can't normalize "2 cups flour" vs "2 c. flour"
3. **No meal planning beyond recipes** - Can't combine recipes into complete meals
4. **No shopping list intelligence** - Can't adjust quantities or combine duplicate ingredients
5. **No user inventory tracking** - Can't suggest recipes based on what user has

### Gap Analysis

| Feature Category | Current State | Required for Roadmap |
|-----------------|---------------|---------------------|
| Ingredients DB | ❌ None | ✅ Required for 6+ features |
| Meals Entity | ❌ None | ✅ Required for 3 features |
| Fridge Inventory | ❌ None | ✅ Required for "Joanie's Fridge" |
| Vector Search | ✅ Implemented | ✅ Enhance for similarity |
| LLM Content Cleanup | ❌ None | ✅ CRITICAL for data quality |
| Price Estimation | ❌ None | ⚠️ Optional, external API needed |
| Image Recognition | ❌ None | ⚠️ Future, vision model needed |

---

## Feature Catalog

### 1. Fix Site Content 🔴 CRITICAL
**Category**: Content & Display
**Priority**: CRITICAL (P0)
**Complexity**: 1/5
**Dependencies**: None

**Description**: Update application content based on new "About Joanie" brand text.

**Implementation**:
- Update static content in `src/app/about/page.tsx`
- Update brand messaging in marketing pages
- No database changes required

**Estimated Time**: 2-4 hours
**Cost**: $0 (manual content updates)

---

### 2. Recipe Content Cleanup 🔴 CRITICAL
**Category**: Content & Display
**Priority**: CRITICAL (P0)
**Complexity**: 3/5
**Dependencies**: None

**Description**: Use inexpensive LLM to clean up recipe titles and descriptions for consistency and quality.

**CRITICAL FINDING**: Current ingredients are stored as plain strings WITHOUT amounts in many cases. This is a data quality emergency requiring LLM-based cleanup.

**Implementation**:
```typescript
// Batch cleanup script: scripts/cleanup-recipe-content.ts

interface RecipeCleanupTask {
  recipeId: string;
  name: string;          // May need title case correction
  description: string;   // May need grammar fixes
  ingredients: string[]; // ⚠️ CRITICAL: Missing amounts
}

async function cleanupRecipe(recipe: RecipeCleanupTask) {
  const prompt = `
You are a recipe editor. Clean up this recipe data:

TITLE: ${recipe.name}
DESCRIPTION: ${recipe.description}
INGREDIENTS: ${JSON.stringify(recipe.ingredients)}

Tasks:
1. Fix title capitalization (use Title Case for food names)
2. Improve description grammar and clarity
3. ⚠️ CRITICAL: For each ingredient, ensure it has a quantity
   - If missing, infer reasonable amounts for ${recipe.servings || 4} servings
   - Examples:
     "flour" → "2 cups all-purpose flour"
     "chicken breast" → "1 lb boneless chicken breast"
     "garlic" → "3 cloves garlic, minced"

Return JSON:
{
  "name": "corrected title",
  "description": "improved description",
  "ingredients": ["properly formatted with amounts"]
}
`;

  // Use cheapest model: Claude Haiku, GPT-3.5-Turbo, or Gemini Flash
  const response = await openrouter.chat.completions.create({
    model: MODELS.CLAUDE_3_HAIKU, // $0.25/1M input, $1.25/1M output
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Recommended Models** (in order of cost-effectiveness):
1. **Google Gemini 2.0 Flash** (FREE via OpenRouter) - ✅ BEST CHOICE
2. **Claude 3 Haiku** ($0.25/1M in, $1.25/1M out)
3. **GPT-3.5 Turbo** ($0.50/1M in, $1.50/1M out)

**Cost Estimate**:
- Assuming ~968 recipes (as mentioned)
- Average prompt: ~500 tokens (recipe data)
- Average response: ~700 tokens (cleaned data)
- Total: ~1.16M tokens

| Model | Input Cost | Output Cost | Total | Recommendation |
|-------|-----------|-------------|-------|----------------|
| Gemini Flash | $0 | $0 | **$0** | ✅ Use this |
| Haiku | $0.29 | $1.08 | $1.37 | Backup |
| GPT-3.5 | $0.58 | $1.45 | $2.03 | Last resort |

**Estimated Time**: 1 day (script development + batch processing)
**Batch Size**: 10 recipes/minute (rate limiting)
**Total Processing**: ~2 hours for 968 recipes

---

### 3. Top 50 Filtering 🟡 HIGH
**Category**: Content & Display
**Priority**: HIGH (P1)
**Complexity**: 2/5
**Dependencies**: Rating system (already exists)

**Description**: Feature only the 50 highest-rated recipes on the discover/shared pages.

**Implementation**:
```typescript
// Update: src/app/actions/recipes.ts

export async function getTopRatedRecipes(limit: number = 50) {
  const topRecipes = await db
    .select()
    .from(recipes)
    .where(eq(recipes.isPublic, true))
    .orderBy(
      desc(recipes.avgUserRating),    // Primary: User ratings
      desc(recipes.systemRating),      // Secondary: AI ratings
      desc(recipes.totalUserRatings)   // Tiebreaker: Most rated
    )
    .limit(limit);

  return { success: true, data: topRecipes };
}
```

**UI Changes**:
- Add "Top Recipes" filter toggle to discover page
- Show "Top 50" badge on featured recipes
- Add sorting options: "Top Rated", "Most Recent", "Trending"

**Estimated Time**: 4-6 hours
**Cost**: $0

---

### 4. Star Icon Simplification 🟢 MEDIUM
**Category**: Content & Display
**Priority**: MEDIUM (P2)
**Complexity**: 1/5
**Dependencies**: None

**Description**: Change featured star icon to a simpler design.

**Implementation**:
```typescript
// Update: src/components/recipe/RecipeCard.tsx
// Replace current star icon with lucide-react's Star component

import { Star } from 'lucide-react';

// Current (lines 61-65): Featured badge
{recipe.isAiGenerated && (
  <Badge className="...">AI Generated</Badge>
)}

// Add featured indicator
{recipe.isSystemRecipe && (
  <Badge className="absolute top-2 left-2 bg-jk-tomato/90 text-white">
    <Star className="w-3 h-3 fill-current" />
  </Badge>
)}
```

**Estimated Time**: 1-2 hours
**Cost**: $0

---

### 5. Show Ingredient Amounts 🔴 CRITICAL
**Category**: Content & Display
**Priority**: CRITICAL (P0)
**Complexity**: 2/5
**Dependencies**: Feature #2 (Recipe Content Cleanup)

**Description**: **CRITICAL BUG FIX** - Display ingredient amounts in all recipe views.

**Root Cause Analysis**:
Current code DOES display ingredients correctly (line 379 in recipe detail page):
```tsx
<span>{ingredient}</span>
```

The problem is **DATA QUALITY**: Many recipes have ingredients stored WITHOUT amounts:
- Current: `["flour", "chicken", "garlic"]`
- Expected: `["2 cups flour", "1 lb chicken breast", "3 cloves garlic"]`

**Solution**: This is ALREADY fixed by Feature #2 (Recipe Content Cleanup). The LLM cleanup will ensure all ingredients have amounts.

**Verification Steps**:
1. Run cleanup script from Feature #2
2. Verify sample recipes show amounts: `SELECT ingredients FROM recipes LIMIT 10;`
3. Add validation to recipe creation forms to reject ingredients without amounts

**Additional Enhancement** (Optional):
```typescript
// Add visual formatting for ingredients
// src/components/recipe/IngredientsList.tsx

interface ParsedIngredient {
  amount: string;      // "2 cups"
  ingredient: string;  // "all-purpose flour"
  preparation: string; // "sifted"
}

function parseIngredient(raw: string): ParsedIngredient {
  // Regex to extract: "2 cups all-purpose flour, sifted"
  const match = raw.match(/^([\d\/\s¼½¾⅓⅔]+\s*[a-z]+)\s+([^,]+),?\s*(.*)$/i);

  if (match) {
    return {
      amount: match[1].trim(),
      ingredient: match[2].trim(),
      preparation: match[3]?.trim() || ''
    };
  }

  // Fallback: entire string is ingredient
  return { amount: '', ingredient: raw, preparation: '' };
}

// Display with formatting
<li className="flex gap-2">
  <span className="font-medium w-24">{parsed.amount}</span>
  <span>{parsed.ingredient}</span>
  {parsed.preparation && (
    <span className="text-muted-foreground">, {parsed.preparation}</span>
  )}
</li>
```

**Estimated Time**:
- Fix data: Covered by Feature #2
- Optional formatting: 4-6 hours

**Cost**: $0 (covered by Feature #2)

---

### 6. Meals Feature 🟡 HIGH
**Category**: Core Features
**Priority**: HIGH (P1)
**Complexity**: 4/5
**Dependencies**: Ingredients database (Feature #9)

**Description**: Combine multiple recipes into complete meals (e.g., "Sunday Dinner" = roast chicken + mashed potatoes + green beans).

**Database Schema**:
```sql
-- New table: meals
CREATE TABLE meals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                      -- "Sunday Roast Dinner"
  description TEXT,                        -- "Traditional family meal"
  occasion TEXT,                           -- "sunday dinner", "holiday", "weeknight"
  total_prep_time INTEGER,                 -- Sum of all recipes
  total_cook_time INTEGER,
  total_servings INTEGER,
  difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
  is_public BOOLEAN DEFAULT FALSE,
  is_occasion_template BOOLEAN DEFAULT FALSE, -- For Feature #13
  tags TEXT,                               -- JSON array
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction table: meal_recipes (many-to-many)
CREATE TABLE meal_recipes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  course_type TEXT,                        -- "appetizer", "main", "side", "dessert"
  serving_multiplier DECIMAL(3,2) DEFAULT 1.00, -- Scale recipe portions
  notes TEXT,                              -- "Prepare ahead", "Serve warm"
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(meal_id, recipe_id)
);

-- Indexes
CREATE INDEX idx_meals_user_id ON meals(user_id);
CREATE INDEX idx_meals_occasion ON meals(occasion);
CREATE INDEX idx_meal_recipes_meal_id ON meal_recipes(meal_id);
CREATE INDEX idx_meal_recipes_recipe_id ON meal_recipes(recipe_id);
```

**API Endpoints**:
```typescript
// src/app/actions/meals.ts

export async function createMeal(data: NewMeal) {
  // Create meal + add recipes in transaction
  return db.transaction(async (tx) => {
    const meal = await tx.insert(meals).values(data).returning();
    await tx.insert(mealRecipes).values(
      data.recipes.map(r => ({
        mealId: meal[0].id,
        recipeId: r.recipeId,
        courseType: r.courseType,
        servingMultiplier: r.servingMultiplier || 1.0
      }))
    );
    return meal[0];
  });
}

export async function getMealWithRecipes(mealId: string) {
  // Join meals + recipes + meal_recipes
  const result = await db
    .select({
      meal: meals,
      recipe: recipes,
      mealRecipe: mealRecipes
    })
    .from(meals)
    .leftJoin(mealRecipes, eq(meals.id, mealRecipes.mealId))
    .leftJoin(recipes, eq(mealRecipes.recipeId, recipes.id))
    .where(eq(meals.id, mealId));

  // Transform to nested structure
  return formatMealWithRecipes(result);
}
```

**UI Components**:
```typescript
// src/components/meal/MealBuilder.tsx
// - Drag-and-drop interface to add recipes to meal
// - Course categorization (appetizer, main, side, dessert)
// - Serving size adjustment per recipe
// - Combined prep timeline

// src/components/meal/MealCard.tsx
// - Display meal with all recipes
// - Show total time, servings, difficulty
// - "Cook this meal" button → generates shopping list
```

**Estimated Time**: 2-3 days
**Cost**: $0

---

### 7. Smart Shopping Lists 🟡 HIGH
**Category**: Core Features
**Priority**: HIGH (P1)
**Complexity**: 4/5
**Dependencies**: Ingredients database (Feature #9), Meals (Feature #6)

**Description**: Generate intelligent shopping lists from recipes/meals with:
- Serving size adjustment
- Duplicate ingredient consolidation
- Category grouping (produce, dairy, meat, pantry)

**Enhanced Database Schema**:
```sql
-- Extend shopping list functionality
CREATE TABLE shopping_lists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT CHECK(source_type IN ('recipe', 'meal', 'manual')),
  source_id TEXT,                          -- recipe_id or meal_id
  serving_multiplier DECIMAL(3,2) DEFAULT 1.00,
  items TEXT NOT NULL,                     -- JSON array (structured)
  checked_items TEXT,                      -- JSON array of checked item IDs
  estimated_cost DECIMAL(8,2),             -- Feature #8
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Items structure (JSON):
[
  {
    "id": "uuid",
    "ingredientId": "normalized-id", // Links to ingredients table
    "originalText": "2 cups flour",
    "quantity": 2,
    "unit": "cups",
    "ingredient": "all-purpose flour",
    "category": "baking",           // produce, dairy, meat, pantry, etc.
    "isChecked": false,
    "estimatedPrice": 3.99          // Feature #8
  }
]
```

**Implementation**:
```typescript
// src/app/actions/shopping-lists.ts

interface ShoppingListItem {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  ingredient: string;
  category: string;
  isChecked: boolean;
}

export async function generateShoppingListFromMeal(
  mealId: string,
  servingMultiplier: number = 1.0
) {
  // 1. Get meal with all recipes
  const meal = await getMealWithRecipes(mealId);

  // 2. Extract all ingredients from all recipes
  const allIngredients: ShoppingListItem[] = [];

  for (const mealRecipe of meal.recipes) {
    const recipe = mealRecipe.recipe;
    const recipeMult = mealRecipe.servingMultiplier || 1.0;
    const totalMult = recipeMult * servingMultiplier;

    // Parse ingredients using LLM or regex
    const parsedIngredients = await parseIngredientsList(
      recipe.ingredients,
      totalMult
    );

    allIngredients.push(...parsedIngredients);
  }

  // 3. Consolidate duplicates (same ingredient, different quantities)
  const consolidated = consolidateIngredients(allIngredients);

  // 4. Group by category
  const categorized = groupByCategory(consolidated);

  // 5. Create shopping list
  return db.insert(shoppingLists).values({
    userId: meal.userId,
    name: `${meal.name} - Shopping List`,
    sourceType: 'meal',
    sourceId: mealId,
    servingMultiplier,
    items: JSON.stringify(categorized)
  });
}

function consolidateIngredients(items: ShoppingListItem[]) {
  const map = new Map<string, ShoppingListItem>();

  for (const item of items) {
    const key = `${item.ingredient}-${item.unit}`;

    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }

  return Array.from(map.values());
}

// Use LLM for intelligent consolidation
async function intelligentConsolidation(items: ShoppingListItem[]) {
  const prompt = `
Consolidate these ingredients:
${JSON.stringify(items, null, 2)}

Rules:
- Combine same ingredients with different units (convert to common unit)
- "2 cups milk" + "1 cup milk" = "3 cups milk"
- "1 lb butter" + "2 sticks butter" = "1.5 lbs butter" (1 stick = 0.25 lb)
- Keep items separate if they're different forms (fresh vs dried, whole vs ground)

Return consolidated list as JSON array.
`;

  // Use cheap model: Gemini Flash (free) or Haiku
  const response = await openrouter.chat.completions.create({
    model: MODELS.LLAMA_3_8B, // Free model, good at structured tasks
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**UI Components**:
```typescript
// src/components/shopping-list/ShoppingListGenerator.tsx
// - Select meal or multiple recipes
// - Adjust serving size
// - Preview consolidated list
// - Category tabs (Produce, Dairy, Meat, Pantry)
// - Checkbox to mark items as purchased
// - Export to PDF/text

// src/components/shopping-list/ShoppingListCard.tsx
// - Display list with checkboxes
// - Progress bar (X of Y items checked)
// - Edit quantities
// - Add custom items
```

**Estimated Time**: 3-4 days
**Cost**:
- LLM consolidation: ~$0.01 per list (using free Llama 3.2)
- Alternative: Use regex parsing (free, less accurate)

---

### 8. Price Estimation 🟢 MEDIUM
**Category**: Core Features
**Priority**: MEDIUM (P2)
**Complexity**: 4/5
**Dependencies**: Ingredients database (Feature #9), Shopping lists (Feature #7)

**Description**: Estimate total cost of shopping lists using grocery price API or LLM-based estimation.

**Options**:

#### Option A: External API (Accurate, Expensive)
```typescript
// Use grocery price APIs:
// - Instacart API (not publicly available)
// - Kroger API (requires partnership)
// - USDA Food Price Database (free, but limited)

// Example with USDA data
const USDA_PRICE_API = 'https://api.nal.usda.gov/fdc/v1/foods/search';

async function estimatePriceFromUSDA(ingredient: string) {
  const response = await fetch(`${USDA_PRICE_API}?query=${ingredient}&api_key=${process.env.USDA_API_KEY}`);
  // ... parse response for price data
}
```

**Challenges**:
- No good free grocery price APIs
- Prices vary by location/store
- Real-time pricing hard to maintain

#### Option B: LLM-Based Estimation (Cheap, Approximate)
```typescript
// Use LLM to estimate prices based on general knowledge

async function estimatePriceWithLLM(items: ShoppingListItem[]) {
  const prompt = `
Estimate grocery prices for these items in USD (as of October 2025, average US prices):

${items.map(i => `- ${i.quantity} ${i.unit} ${i.ingredient}`).join('\n')}

Rules:
- Provide reasonable estimates for average US grocery stores
- Consider typical package sizes (e.g., flour sold in 5lb bags)
- Return JSON: [{"ingredient": "...", "quantity": ..., "unit": "...", "estimatedPrice": 3.99}]
`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.CLAUDE_3_HAIKU, // Good at numeric reasoning
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Cost Estimate**:
- Per shopping list (20-30 items): ~300 tokens in + 500 tokens out
- Using Haiku: $0.0002 per list
- Using Gemini Flash: $0 (free)

**Recommended Approach**:
1. Start with LLM-based estimation (Gemini Flash = free)
2. Add disclaimer: "Estimated prices - actual costs may vary"
3. Future: Integrate real grocery APIs if available

**Implementation**:
```typescript
// Add to shopping list generation
export async function generateShoppingListWithPrices(mealId: string) {
  const list = await generateShoppingListFromMeal(mealId);
  const items = JSON.parse(list.items);

  // Estimate prices
  const withPrices = await estimatePriceWithLLM(items);
  const totalCost = withPrices.reduce((sum, item) => sum + item.estimatedPrice, 0);

  // Update shopping list
  await db.update(shoppingLists)
    .set({
      items: JSON.stringify(withPrices),
      estimatedCost: totalCost.toFixed(2)
    })
    .where(eq(shoppingLists.id, list.id));

  return { ...list, estimatedCost: totalCost };
}
```

**UI Enhancement**:
```tsx
// Show estimated cost in shopping list
<div className="text-lg font-semibold">
  Estimated Total: ${list.estimatedCost.toFixed(2)}
  <span className="text-sm text-muted-foreground ml-2">
    (Prices may vary by location)
  </span>
</div>
```

**Estimated Time**: 2-3 days
**Cost**: $0 (using Gemini Flash) or ~$0.01 per list (using Haiku)

---

### 9. Ingredients Database 🔴 CRITICAL
**Category**: Core Features
**Priority**: CRITICAL (P0) - **FOUNDATIONAL**
**Complexity**: 5/5
**Dependencies**: None (blocks 6+ features)

**Description**: Create normalized ingredients table to enable:
- Ingredient standardization ("2c flour" → "2 cups all-purpose flour")
- Shopping list intelligence
- Fridge inventory matching
- Nutritional data aggregation

**Database Schema**:
```sql
CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,                     -- Normalized slug: "all-purpose-flour"
  name TEXT NOT NULL,                      -- "All-Purpose Flour"
  category TEXT NOT NULL,                  -- "baking", "produce", "dairy", "meat", etc.
  subcategory TEXT,                        -- "flours", "leafy-greens", etc.

  -- Nutritional data (per 100g)
  calories INTEGER,
  protein_g DECIMAL(5,2),
  carbs_g DECIMAL(5,2),
  fat_g DECIMAL(5,2),
  fiber_g DECIMAL(5,2),

  -- Common units and conversions
  common_units TEXT,                       -- JSON: ["cup", "tablespoon", "gram"]
  base_unit TEXT DEFAULT 'gram',
  unit_conversions TEXT,                   -- JSON: {"cup": 120, "tablespoon": 8}

  -- Aliases for matching
  aliases TEXT,                            -- JSON: ["AP flour", "plain flour", "white flour"]

  -- Pricing (optional, for Feature #8)
  avg_price_per_unit DECIMAL(6,2),
  typical_package_size TEXT,

  -- Metadata
  is_common BOOLEAN DEFAULT FALSE,         -- Frequently used ingredients
  season TEXT,                             -- "spring", "summer", "fall", "winter", "year-round"
  storage_tips TEXT,
  shelf_life_days INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ingredients_category ON ingredients(category);
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_ingredients_common ON ingredients(is_common) WHERE is_common = TRUE;

-- Full-text search
CREATE INDEX idx_ingredients_search ON ingredients USING gin(to_tsvector('english', name || ' ' || COALESCE(aliases, '')));
```

**Seeding Strategy**:
```typescript
// scripts/seed-ingredients-database.ts

// Option 1: Use USDA FoodData Central API (free, comprehensive)
// - 300,000+ foods with nutritional data
// - https://fdc.nal.usda.gov/api-guide.html

async function seedFromUSDA() {
  const commonIngredients = [
    'all-purpose flour', 'chicken breast', 'olive oil', 'garlic',
    'onion', 'tomato', 'milk', 'eggs', 'butter', 'salt', 'pepper',
    // ... 200-500 most common ingredients
  ];

  for (const ingredient of commonIngredients) {
    const usdaData = await fetchFromUSDA(ingredient);
    await db.insert(ingredients).values({
      id: slugify(ingredient),
      name: ingredient,
      category: categorizeIngredient(ingredient),
      calories: usdaData.calories,
      protein_g: usdaData.protein,
      // ... other nutritional data
      isCommon: true
    });
  }
}

// Option 2: Use LLM to generate structured data
async function seedWithLLM() {
  const prompt = `
Generate a comprehensive ingredients database for common cooking ingredients.
For each ingredient, provide:
- id (slug: all-lowercase-with-dashes)
- name (proper capitalization)
- category (baking, produce, dairy, meat, seafood, condiments, spices, etc.)
- common_units (array of units: cup, tablespoon, teaspoon, gram, ounce, pound, etc.)
- unit_conversions (object mapping unit to grams: {"cup": 120, "tablespoon": 8})
- aliases (alternative names)

Start with top 100 most common ingredients.
Return as JSON array.
`;

  // Use cheap model for data generation
  const response = await openrouter.chat.completions.create({
    model: MODELS.CLAUDE_3_5_SONNET, // Better at structured data
    messages: [{ role: 'user', content: prompt }],
  });

  const ingredientsData = JSON.parse(response.choices[0].message.content);
  await db.insert(ingredients).values(ingredientsData);
}
```

**Ingredient Matching Algorithm**:
```typescript
// src/lib/ingredients/matcher.ts

async function matchIngredient(rawText: string): Promise<string | null> {
  // Parse: "2 cups all-purpose flour" → "all-purpose flour"
  const parsed = parseIngredientText(rawText);
  const cleanName = parsed.ingredient.toLowerCase();

  // 1. Exact match
  let match = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.id, slugify(cleanName)))
    .limit(1);

  if (match.length > 0) return match[0].id;

  // 2. Fuzzy match using aliases
  match = await db
    .select()
    .from(ingredients)
    .where(sql`${ingredients.aliases} ILIKE '%${cleanName}%'`)
    .limit(1);

  if (match.length > 0) return match[0].id;

  // 3. LLM-based matching (fallback)
  const ingredientId = await matchWithLLM(cleanName);
  return ingredientId;
}

async function matchWithLLM(ingredient: string) {
  const allIngredients = await db.select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(eq(ingredients.isCommon, true));

  const prompt = `
Match this ingredient to the closest match in our database:
Input: "${ingredient}"

Database:
${allIngredients.map(i => `- ${i.id}: ${i.name}`).join('\n')}

Return only the ID of the best match, or "NONE" if no good match.
`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.LLAMA_3_8B, // Free, good at classification
    messages: [{ role: 'user', content: prompt }],
  });

  const matched = response.choices[0].message.content.trim();
  return matched !== 'NONE' ? matched : null;
}
```

**Migration Plan**:
```typescript
// scripts/migrate-recipes-to-normalized-ingredients.ts

async function migrateRecipes() {
  const allRecipes = await db.select().from(recipes);

  for (const recipe of allRecipes) {
    const ingredients = JSON.parse(recipe.ingredients);
    const normalized = [];

    for (const ingredient of ingredients) {
      const matched = await matchIngredient(ingredient);
      normalized.push({
        raw: ingredient,
        ingredientId: matched,
        quantity: parseQuantity(ingredient),
        unit: parseUnit(ingredient)
      });
    }

    // Store in new field or update existing
    await db.update(recipes)
      .set({
        ingredientsStructured: JSON.stringify(normalized)
      })
      .where(eq(recipes.id, recipe.id));
  }
}
```

**Estimated Time**:
- Schema + basic CRUD: 1 day
- USDA seeding: 2 days
- Matching algorithm: 2-3 days
- Recipe migration: 1 day
- **Total: 6-7 days**

**Cost**:
- USDA API: $0 (free)
- LLM seeding (optional): ~$0.50 (500 ingredients)
- LLM matching (fallback): ~$0.001 per ingredient
- Migration (968 recipes × 10 ingredients avg): ~$5-10

---

### 10. Joanie's Fridge 🟡 HIGH (AI-Powered)
**Category**: AI-Powered Features
**Priority**: HIGH (P1)
**Complexity**: 4/5
**Dependencies**: Ingredients database (Feature #9), Vector search (exists)

**Description**: Users enter what's in their fridge as plaintext, LLM interprets it, suggests matching recipes.

**Database Schema**:
```sql
CREATE TABLE fridge_inventories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT DEFAULT 'My Fridge',              -- Users can have multiple fridges
  raw_input TEXT,                             -- Original user text
  parsed_items TEXT NOT NULL,                 -- JSON array of structured items
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Parsed items structure (JSON):
[
  {
    "ingredientId": "chicken-breast",
    "quantity": 2,
    "unit": "lbs",
    "confidence": 0.95,                       -- LLM confidence
    "expiresAt": "2025-10-20",               -- Optional expiration tracking
    "notes": "frozen"
  }
]
```

**Implementation**:
```typescript
// src/app/actions/fridge.ts

export async function parseFridgeContents(rawText: string) {
  const prompt = `
You are Joanie's Kitchen assistant. Parse this fridge inventory into structured data.

User's fridge contents:
"""
${rawText}
"""

Extract each ingredient with:
- ingredient name (normalize to common names)
- quantity (if specified, otherwise estimate "some")
- unit (cups, lbs, pieces, etc.)
- confidence (0-1, how sure you are about this ingredient)

Examples:
"2 lbs chicken, half an onion, some garlic" →
[
  {"ingredient": "chicken breast", "quantity": 2, "unit": "lbs", "confidence": 0.9},
  {"ingredient": "onion", "quantity": 0.5, "unit": "whole", "confidence": 0.95},
  {"ingredient": "garlic", "quantity": "some", "unit": "cloves", "confidence": 0.8}
]

Return JSON array only.
`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.CLAUDE_3_5_SONNET, // Better at understanding casual text
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = JSON.parse(response.choices[0].message.content);

  // Match to ingredients database
  const matched = [];
  for (const item of parsed) {
    const ingredientId = await matchIngredient(item.ingredient);
    matched.push({ ...item, ingredientId });
  }

  return matched;
}

export async function suggestRecipesFromFridge(userId: string) {
  // 1. Get user's fridge inventory
  const fridge = await db
    .select()
    .from(fridgeInventories)
    .where(eq(fridgeInventories.userId, userId))
    .limit(1);

  if (fridge.length === 0) {
    return { success: false, error: 'No fridge inventory found' };
  }

  const fridgeItems = JSON.parse(fridge[0].parsedItems);
  const ingredientIds = fridgeItems.map(i => i.ingredientId).filter(Boolean);

  // 2. Find recipes with matching ingredients
  // Use vector search for semantic matching
  const fridgeDescription = fridgeItems
    .map(i => `${i.quantity || ''} ${i.unit || ''} ${i.ingredient}`)
    .join(', ');

  const embedding = await generateEmbedding(
    `Recipe using: ${fridgeDescription}`
  );

  // 3. Semantic search for similar recipes
  const suggestions = await db.execute(sql`
    SELECT r.*,
           (1 - (e.embedding <=> ${JSON.stringify(embedding)}::vector)) as similarity
    FROM recipes r
    JOIN recipe_embeddings e ON r.id = e.recipe_id
    WHERE r.is_public = true
    ORDER BY e.embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT 20
  `);

  // 4. Score recipes by ingredient match percentage
  const scored = suggestions.map(recipe => {
    const recipeIngredients = JSON.parse(recipe.ingredients);
    const matchCount = recipeIngredients.filter(ing =>
      ingredientIds.some(id => ing.toLowerCase().includes(id))
    ).length;

    const matchPercentage = (matchCount / recipeIngredients.length) * 100;

    return {
      ...recipe,
      matchPercentage,
      matchCount,
      totalIngredients: recipeIngredients.length,
      missingIngredients: recipeIngredients.length - matchCount
    };
  });

  // 5. Sort by best matches (high match %, few missing)
  scored.sort((a, b) => {
    // Prioritize recipes where user has most ingredients
    if (Math.abs(a.matchPercentage - b.matchPercentage) > 10) {
      return b.matchPercentage - a.matchPercentage;
    }
    // If similar match %, prefer recipes with fewer total ingredients
    return a.missingIngredients - b.missingIngredients;
  });

  return { success: true, data: scored.slice(0, 10) };
}
```

**UI Components**:
```tsx
// src/components/fridge/FridgeInventory.tsx

export function FridgeInventory() {
  const [rawInput, setRawInput] = useState('');
  const [parsing, setParsing] = useState(false);

  const handleSubmit = async () => {
    setParsing(true);
    const parsed = await parseFridgeContents(rawInput);
    await saveFridgeInventory(parsed);
    router.push('/fridge/suggestions');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>What's in Joanie's Fridge?</CardTitle>
        <CardDescription>
          Tell me what ingredients you have, and I'll suggest recipes!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Example: 2 lbs chicken breast, half an onion, 3 cloves garlic, some broccoli, milk, cheese..."
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          rows={6}
        />
        <Button onClick={handleSubmit} disabled={parsing}>
          {parsing ? 'Analyzing...' : 'Find Recipes'}
        </Button>
      </CardContent>
    </Card>
  );
}

// src/components/fridge/RecipeSuggestions.tsx
export function RecipeSuggestions({ suggestions }) {
  return (
    <div>
      <h2>Recipes You Can Make</h2>
      {suggestions.map(recipe => (
        <Card key={recipe.id}>
          <CardHeader>
            <CardTitle>{recipe.name}</CardTitle>
            <Badge variant={recipe.matchPercentage > 80 ? 'success' : 'default'}>
              {recipe.matchPercentage.toFixed(0)}% Match
            </Badge>
          </CardHeader>
          <CardContent>
            <p>You have {recipe.matchCount} of {recipe.totalIngredients} ingredients</p>
            {recipe.missingIngredients > 0 && (
              <p className="text-sm text-muted-foreground">
                Need to buy: {recipe.missingIngredients} more ingredients
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Cost Estimate**:
- Parsing fridge contents: ~500 tokens in, 300 tokens out
- Using Claude Haiku: $0.0003 per parse
- Using Gemini Flash: $0 (free)
- Recommendation: Use Gemini Flash initially

**Estimated Time**: 3-4 days
**Cost**: $0-0.01 per fridge parse (depends on model)

---

### 11. "Add a Picture" (Coming Soon) ⚪ LOW (Future)
**Category**: AI-Powered Features
**Priority**: LOW (P3) - **FUTURE**
**Complexity**: 5/5
**Dependencies**: Vision model integration

**Description**: Image recognition to identify ingredients from photos of user's fridge.

**Implementation** (Future):
```typescript
// Use vision models: GPT-4o, Claude with vision, or Gemini Pro Vision

async function recognizeIngredientsFromImage(imageBase64: string) {
  const prompt = `
Identify all food ingredients visible in this refrigerator photo.
For each item, provide:
- ingredient name
- estimated quantity (if visible)
- condition (fresh, wilted, frozen, etc.)

Return as JSON array.
`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.GPT_4O, // $2.50/1M input tokens (images)
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Cost Estimate**:
- GPT-4o Vision: ~$0.01 per image (expensive)
- Gemini Pro Vision: ~$0.001 per image
- Recommendation: Wait for cheaper vision models

**Estimated Time**: 2-3 days (when implemented)
**Estimated Cost**: $0.001-0.01 per image

**Status**: Mark as "Coming Soon" in UI, implement in Q2 2026

---

### 12. More Like This 🟡 HIGH
**Category**: AI-Powered Features
**Priority**: HIGH (P1)
**Complexity**: 2/5
**Dependencies**: Vector search (already implemented)

**Description**: Find similar recipes using vector similarity search.

**Current State**: **90% IMPLEMENTED**
- Vector embeddings already exist in `recipeEmbeddings` table
- Embedding generation working (`src/lib/ai/embeddings.ts`)
- Just need to add UI components

**Implementation**:
```typescript
// src/app/actions/semantic-search.ts (already exists)
// Add new action:

export async function findSimilarRecipes(recipeId: string, limit: number = 6) {
  // 1. Get the recipe's embedding
  const recipeEmbedding = await db
    .select()
    .from(recipeEmbeddings)
    .where(eq(recipeEmbeddings.recipeId, recipeId))
    .limit(1);

  if (recipeEmbedding.length === 0) {
    return { success: false, error: 'Recipe embedding not found' };
  }

  const embedding = recipeEmbedding[0].embedding;

  // 2. Find similar recipes using cosine similarity
  const similar = await db.execute(sql`
    SELECT r.*,
           (1 - (e.embedding <=> ${JSON.stringify(embedding)}::vector)) as similarity
    FROM recipes r
    JOIN recipe_embeddings e ON r.id = e.recipe_id
    WHERE r.id != ${recipeId}
      AND r.is_public = true
    ORDER BY e.embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit}
  `);

  return { success: true, data: similar };
}
```

**UI Component**:
```tsx
// src/components/recipe/SimilarRecipesWidget.tsx (already exists)
// Just needs to be added to recipe detail page

import { findSimilarRecipes } from '@/app/actions/semantic-search';

export function SimilarRecipesWidget({ recipeId }: { recipeId: string }) {
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSimilar() {
      const result = await findSimilarRecipes(recipeId, 6);
      if (result.success) {
        setSimilar(result.data);
      }
      setLoading(false);
    }
    loadSimilar();
  }, [recipeId]);

  if (loading) return <Skeleton />;
  if (similar.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>More Like This</CardTitle>
        <CardDescription>Similar recipes you might enjoy</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {similar.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              showSimilarity={true}
              similarity={recipe.similarity}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Integration**:
```tsx
// Update: src/app/recipes/[id]/page.tsx
// Add after instructions card (around line 405):

<SimilarRecipesWidget recipeId={recipeId} />
```

**Estimated Time**: 4-6 hours (mostly UI integration)
**Cost**: $0 (using existing embeddings)

---

### 13. Occasion-Based Meals 🟡 HIGH
**Category**: AI-Powered Features
**Priority**: HIGH (P1)
**Complexity**: 3/5
**Dependencies**: Meals feature (Feature #6)

**Description**: Create pre-made meal templates for occasions (Thanksgiving, Sunday Dinner, Date Night, etc.). Users can customize and save if logged in.

**Database** (extends Feature #6):
```sql
-- Already defined in meals table:
-- is_occasion_template BOOLEAN DEFAULT FALSE

-- Add occasion templates
INSERT INTO meals (user_id, name, description, occasion, is_occasion_template, is_public) VALUES
  ('system', 'Traditional Thanksgiving', 'Complete Thanksgiving dinner', 'thanksgiving', true, true),
  ('system', 'Sunday Roast', 'Classic Sunday family dinner', 'sunday-dinner', true, true),
  ('system', 'Romantic Date Night', 'Elegant 3-course meal', 'date-night', true, true),
  ('system', 'Game Day Spread', 'Casual party food', 'game-day', true, true);
```

**Implementation**:
```typescript
// src/app/actions/occasion-meals.ts

export async function getOccasionTemplates() {
  const templates = await db
    .select()
    .from(meals)
    .where(and(
      eq(meals.isOccasionTemplate, true),
      eq(meals.isPublic, true)
    ))
    .orderBy(meals.name);

  return { success: true, data: templates };
}

export async function createMealFromTemplate(
  templateId: string,
  userId: string,
  customizations?: Partial<Meal>
) {
  // 1. Get template meal with recipes
  const template = await getMealWithRecipes(templateId);

  if (!template.isOccasionTemplate) {
    return { success: false, error: 'Not a valid template' };
  }

  // 2. Use LLM to suggest variations
  if (customizations?.preferences) {
    const suggestions = await suggestMealVariations(template, customizations.preferences);
    // ... allow user to swap recipes
  }

  // 3. Clone template for user
  return db.transaction(async (tx) => {
    const newMeal = await tx.insert(meals).values({
      userId,
      name: customizations?.name || template.name,
      description: template.description,
      occasion: template.occasion,
      isOccasionTemplate: false,
      isPublic: customizations?.isPublic || false,
      tags: template.tags
    }).returning();

    // Clone recipes
    const mealRecipesCopy = template.recipes.map(mr => ({
      mealId: newMeal[0].id,
      recipeId: mr.recipeId,
      courseType: mr.courseType,
      servingMultiplier: mr.servingMultiplier
    }));

    await tx.insert(mealRecipes).values(mealRecipesCopy);

    return newMeal[0];
  });
}

// LLM-powered customization
async function suggestMealVariations(
  template: Meal,
  preferences: string
) {
  const prompt = `
This user wants to customize a ${template.occasion} meal template.
User preferences: "${preferences}"

Current recipes:
${template.recipes.map(r => `- ${r.courseType}: ${r.recipe.name}`).join('\n')}

Suggest alternative recipes from our database that match:
1. The occasion (${template.occasion})
2. User preferences (${preferences})
3. Course type (maintain appetizer/main/side/dessert structure)

Return JSON: [{"originalRecipe": "...", "suggestedRecipe": "...", "reason": "..."}]
`;

  // Use smart model for recommendations
  const response = await openrouter.chat.completions.create({
    model: MODELS.CLAUDE_3_5_SONNET,
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**UI Components**:
```tsx
// src/components/meal/OccasionGallery.tsx

export function OccasionGallery() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {occasions.map(occasion => (
        <Card key={occasion.id} className="hover:shadow-lg transition">
          <CardHeader>
            <CardTitle>{occasion.name}</CardTitle>
            <CardDescription>{occasion.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {occasion.recipes.map(r => (
                <div key={r.id} className="text-sm">
                  <Badge variant="outline">{r.courseType}</Badge>
                  <span className="ml-2">{r.recipe.name}</span>
                </div>
              ))}
            </div>
            <Button onClick={() => customizeOccasion(occasion.id)}>
              Use This Template
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// src/components/meal/MealCustomizer.tsx
export function MealCustomizer({ templateId }) {
  const [preferences, setPreferences] = useState('');

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize Your Meal</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Any dietary preferences or swaps?</Label>
          <Textarea
            placeholder="E.g., vegetarian, no shellfish, prefer chicken over beef"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
          />
          <Button onClick={() => createCustomMeal(templateId, preferences)}>
            Create My Meal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Cost Estimate**:
- LLM customization: ~800 tokens in, 500 tokens out
- Using Haiku: $0.0008 per customization
- Using Gemini Flash: $0 (free)

**Estimated Time**: 2-3 days
**Cost**: $0 per customization (using Gemini Flash)

---

### 14. Image Recipe Creation 🟢 MEDIUM (Future)
**Category**: AI-Powered Features
**Priority**: MEDIUM (P2) - **FUTURE**
**Complexity**: 5/5
**Dependencies**: Vision model integration

**Description**: OCR/vision model extracts recipe from images (cookbook photos, recipe cards, etc.).

**Implementation** (Future):
```typescript
async function extractRecipeFromImage(imageBase64: string) {
  const prompt = `
Extract the recipe from this image.

Provide:
- Recipe name
- Description (if present)
- Ingredients list (with quantities and units)
- Instructions (step-by-step)
- Prep time, cook time, servings (if mentioned)
- Any other metadata (cuisine, difficulty, etc.)

Return as structured JSON matching our recipe schema.
`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.GPT_4O, // Best OCR capabilities
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }
    ],
  });

  const extracted = JSON.parse(response.choices[0].message.content);

  // Create recipe from extracted data
  return createRecipe({
    ...extracted,
    source: 'Image upload',
    isAiGenerated: true,
    modelUsed: MODELS.GPT_4O
  });
}
```

**UI Component**:
```tsx
// src/components/recipe/ImageRecipeUploader.tsx

export function ImageRecipeUploader() {
  const [image, setImage] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);

  const handleUpload = async () => {
    setExtracting(true);
    const base64 = await fileToBase64(image);
    const recipe = await extractRecipeFromImage(base64);
    router.push(`/recipes/${recipe.id}/edit`); // Allow user to review/edit
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Recipe Image</CardTitle>
        <CardDescription>
          Take a photo of a recipe card or cookbook page
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0])} />
        <Button onClick={handleUpload} disabled={!image || extracting}>
          {extracting ? 'Extracting Recipe...' : 'Extract Recipe'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Cost Estimate**:
- GPT-4o Vision: ~$0.01-0.02 per image (expensive)
- Alternatives: Gemini Pro Vision (~$0.001 per image)
- Recommendation: Start with Gemini, upgrade to GPT-4o for accuracy

**Estimated Time**: 3-4 days
**Cost**: $0.001-0.02 per image extraction

**Status**: Implement in Phase 4 or later

---

## Database Schema Changes

### Summary of New Tables

```sql
-- 1. Ingredients (CRITICAL - Foundation)
CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  calories INTEGER,
  protein_g DECIMAL(5,2),
  carbs_g DECIMAL(5,2),
  fat_g DECIMAL(5,2),
  fiber_g DECIMAL(5,2),
  common_units TEXT,
  base_unit TEXT DEFAULT 'gram',
  unit_conversions TEXT,
  aliases TEXT,
  avg_price_per_unit DECIMAL(6,2),
  typical_package_size TEXT,
  is_common BOOLEAN DEFAULT FALSE,
  season TEXT,
  storage_tips TEXT,
  shelf_life_days INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Meals
CREATE TABLE meals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  occasion TEXT,
  total_prep_time INTEGER,
  total_cook_time INTEGER,
  total_servings INTEGER,
  difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
  is_public BOOLEAN DEFAULT FALSE,
  is_occasion_template BOOLEAN DEFAULT FALSE,
  tags TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Meal Recipes (Junction)
CREATE TABLE meal_recipes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  course_type TEXT,
  serving_multiplier DECIMAL(3,2) DEFAULT 1.00,
  notes TEXT,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(meal_id, recipe_id)
);

-- 4. Fridge Inventories
CREATE TABLE fridge_inventories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT DEFAULT 'My Fridge',
  raw_input TEXT,
  parsed_items TEXT NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Enhanced Shopping Lists (extend existing)
-- Add columns to existing shopping_lists table:
ALTER TABLE shopping_lists ADD COLUMN source_type TEXT CHECK(source_type IN ('recipe', 'meal', 'manual'));
ALTER TABLE shopping_lists ADD COLUMN source_id TEXT;
ALTER TABLE shopping_lists ADD COLUMN serving_multiplier DECIMAL(3,2) DEFAULT 1.00;
ALTER TABLE shopping_lists ADD COLUMN estimated_cost DECIMAL(8,2);
ALTER TABLE shopping_lists ADD COLUMN checked_items TEXT;

-- 6. Update Recipes (optional enhancement)
ALTER TABLE recipes ADD COLUMN ingredients_structured TEXT; -- JSON with normalized ingredient IDs
```

### Migration Plan

```bash
# Phase 1: Foundation
pnpm db:generate    # Generate migration for ingredients table
pnpm db:migrate     # Apply migration
node scripts/seed-ingredients-database.ts  # Seed initial data

# Phase 2: Meals
pnpm db:generate    # Generate migration for meals + meal_recipes
pnpm db:migrate
node scripts/seed-occasion-templates.ts

# Phase 3: Fridge
pnpm db:generate    # Generate migration for fridge_inventories
pnpm db:migrate

# Phase 4: Enhancements
pnpm db:generate    # Generate migration for shopping_lists updates
pnpm db:migrate
node scripts/migrate-recipes-to-normalized.ts  # Optional
```

---

## Dependency Graph

```
PHASE 1 (Foundation - Week 1-2)
├─ Feature 1: Fix Site Content
│  └─ No dependencies ✅
├─ Feature 2: Recipe Content Cleanup ⚠️ CRITICAL
│  └─ No dependencies ✅
├─ Feature 5: Show Ingredient Amounts ⚠️ CRITICAL
│  └─ Depends on: Feature 2 ✅
├─ Feature 9: Ingredients Database ⚠️ CRITICAL (FOUNDATIONAL)
│  └─ No dependencies ✅
└─ Feature 3: Top 50 Filtering
   └─ Depends on: Existing rating system ✅

PHASE 2 (Core Features - Week 3-5)
├─ Feature 6: Meals
│  └─ Depends on: Feature 9 (Ingredients DB)
├─ Feature 7: Smart Shopping Lists
│  └─ Depends on: Feature 9 (Ingredients DB), Feature 6 (Meals)
├─ Feature 8: Price Estimation
│  └─ Depends on: Feature 9 (Ingredients DB), Feature 7 (Shopping Lists)
└─ Feature 4: Star Icon Simplification
   └─ No dependencies ✅

PHASE 3 (AI Features - Week 6-8)
├─ Feature 10: Joanie's Fridge
│  └─ Depends on: Feature 9 (Ingredients DB), Vector search (exists)
├─ Feature 12: More Like This
│  └─ Depends on: Vector embeddings (exists) ✅
└─ Feature 13: Occasion-Based Meals
   └─ Depends on: Feature 6 (Meals)

PHASE 4 (Future - Q2 2026+)
├─ Feature 11: Add a Picture (Coming Soon)
│  └─ Depends on: Vision model integration
└─ Feature 14: Image Recipe Creation
   └─ Depends on: Vision model integration
```

### Dependency Matrix

| Feature | Blocks Features | Blocked By | Can Start After |
|---------|----------------|------------|-----------------|
| 1. Fix Content | None | None | Immediately |
| 2. Recipe Cleanup | 5 | None | Immediately |
| 3. Top 50 | None | Ratings (exists) | Immediately |
| 4. Star Icon | None | None | Immediately |
| 5. Show Amounts | None | 2 | After cleanup |
| 9. Ingredients DB | 6, 7, 8, 10 | None | Immediately |
| 6. Meals | 7, 13 | 9 | After ingredients |
| 7. Shopping Lists | 8 | 9, 6 | After meals |
| 8. Price Estimation | None | 9, 7 | After shopping |
| 10. Joanie's Fridge | None | 9 | After ingredients |
| 12. More Like This | None | Embeddings (exists) | Immediately |
| 13. Occasion Meals | None | 6 | After meals |
| 11. Add Picture | None | Vision models | Future |
| 14. Image OCR | None | Vision models | Future |

---

## Implementation Phases

### Phase 1: Foundation (2 weeks)
**Goal**: Fix critical data quality issues and lay groundwork

#### Week 1: Critical Fixes
- **Day 1-2**: Feature 1 - Fix Site Content
  - Update About page
  - Update brand messaging
  - Test deployment

- **Day 3-5**: Feature 2 - Recipe Content Cleanup ⚠️ CRITICAL
  - Build cleanup script
  - Test on 10 sample recipes
  - Run batch cleanup (968 recipes)
  - Verify data quality
  - **Deliverable**: All recipes have proper amounts

- **Day 5**: Feature 5 - Verify Ingredient Amounts
  - QA testing
  - Spot-check 50 random recipes
  - Add validation to forms

#### Week 2: Foundation Database
- **Day 1-3**: Feature 9 - Ingredients Database (Part 1)
  - Create schema
  - Seed 200-500 common ingredients
  - Build matching algorithm
  - Test with sample recipes

- **Day 4-5**: Feature 9 - Ingredients Database (Part 2)
  - Complete seeding (1000+ ingredients)
  - Build migration script
  - Migrate 100 recipes (pilot)
  - Document API

- **Day 5**: Feature 3 - Top 50 Filtering
  - Implement query
  - Add UI toggle
  - Test sorting

- **Day 5**: Feature 4 - Star Icon Simplification
  - Update icon
  - Test across pages

**Week 1-2 Deliverables**:
- ✅ Clean recipe data (100% coverage)
- ✅ Ingredients database (1000+ entries)
- ✅ Top 50 filtering working
- ✅ Updated branding
- ✅ All critical bugs fixed

---

### Phase 2: Core Features (3 weeks)
**Goal**: Build meals and shopping list intelligence

#### Week 3: Meals Feature
- **Day 1-2**: Feature 6 - Meals (Schema + API)
  - Create meals + meal_recipes tables
  - Build CRUD actions
  - Transaction handling
  - Unit tests

- **Day 3-4**: Feature 6 - Meals (UI)
  - MealBuilder component
  - Drag-and-drop interface
  - Meal card display
  - Integration tests

- **Day 5**: Feature 6 - Meals (Polish)
  - Edge case handling
  - Error states
  - Loading states
  - Documentation

#### Week 4: Smart Shopping Lists
- **Day 1-2**: Feature 7 - Shopping Lists (Backend)
  - Extend shopping_lists schema
  - Ingredient parsing logic
  - Consolidation algorithm
  - LLM integration (optional)

- **Day 3-4**: Feature 7 - Shopping Lists (UI)
  - Generator component
  - Category grouping
  - Checkbox tracking
  - Export functionality

- **Day 5**: Feature 7 - Shopping Lists (Integration)
  - Connect with meals
  - Serving size adjustment
  - Test with real data

#### Week 5: Price Estimation
- **Day 1-2**: Feature 8 - Price Estimation (LLM)
  - Build price estimation prompt
  - Test with sample lists
  - Accuracy validation
  - Cost optimization

- **Day 3-4**: Feature 8 - Price Estimation (UI)
  - Display estimated costs
  - Disclaimer text
  - Breakdown by category
  - Total calculation

- **Day 5**: Testing & Polish
  - End-to-end testing
  - Performance optimization
  - Bug fixes
  - Documentation

**Week 3-5 Deliverables**:
- ✅ Complete meals feature
- ✅ Intelligent shopping lists
- ✅ Price estimation
- ✅ Serving size adjustments
- ✅ Category grouping

---

### Phase 3: AI Features (3 weeks)
**Goal**: Add intelligent recipe discovery and suggestions

#### Week 6: Joanie's Fridge
- **Day 1-2**: Feature 10 - Fridge (Backend)
  - Create fridge_inventories table
  - LLM parsing logic
  - Ingredient matching
  - Test with sample inputs

- **Day 3-4**: Feature 10 - Fridge (Suggestions)
  - Vector search integration
  - Scoring algorithm
  - Match percentage calculation
  - Ranking logic

- **Day 5**: Feature 10 - Fridge (UI)
  - Fridge input form
  - Suggestions display
  - Match indicators
  - Shopping list integration

#### Week 7: More Like This
- **Day 1-2**: Feature 12 - Similar Recipes (Backend)
  - Implement findSimilarRecipes action
  - Test with sample recipes
  - Optimize similarity threshold
  - Performance tuning

- **Day 3-4**: Feature 12 - Similar Recipes (UI)
  - SimilarRecipesWidget component
  - Integration with recipe detail page
  - Loading states
  - Error handling

- **Day 5**: Feature 12 - Polish
  - Similarity display
  - "Why similar?" explanations
  - User testing
  - Adjustments

#### Week 8: Occasion Meals
- **Day 1-2**: Feature 13 - Occasion Meals (Templates)
  - Seed occasion templates
  - Build customization logic
  - LLM suggestion system
  - Test variations

- **Day 3-4**: Feature 13 - Occasion Meals (UI)
  - OccasionGallery component
  - Customizer dialog
  - Template preview
  - Clone functionality

- **Day 5**: Testing & Polish
  - End-to-end testing
  - User acceptance testing
  - Performance optimization
  - Documentation

**Week 6-8 Deliverables**:
- ✅ Joanie's Fridge working
- ✅ Recipe suggestions
- ✅ Similar recipes widget
- ✅ Occasion meal templates
- ✅ Meal customization

---

### Phase 4: Future Features (Q2 2026+)
**Goal**: Advanced vision capabilities

- **Feature 11**: Add a Picture (Coming Soon)
  - Mark as "Coming Soon" in UI
  - Prepare infrastructure
  - Wait for cheaper vision models

- **Feature 14**: Image Recipe Creation
  - Vision model integration
  - OCR testing
  - Accuracy validation
  - UI/UX design

**Phase 4 Deliverables**:
- ✅ Vision model integration
- ✅ Image ingredient recognition
- ✅ Recipe extraction from images
- ✅ User testing & refinement

---

## Technical Specifications

### Feature-by-Feature Technical Details

| Feature | DB Changes | API Endpoints | Components | LLM Model | Est. Cost | Complexity |
|---------|-----------|--------------|------------|-----------|-----------|-----------|
| 1. Fix Content | None | None | About.tsx | None | $0 | 1/5 |
| 2. Recipe Cleanup | None | None | Script | Gemini Flash | $0 | 3/5 |
| 3. Top 50 | None | getTopRatedRecipes | Filter toggle | None | $0 | 2/5 |
| 4. Star Icon | None | None | RecipeCard | None | $0 | 1/5 |
| 5. Show Amounts | Optional | None | Display format | None | $0 | 2/5 |
| 6. Meals | 2 tables | meals.ts (6 actions) | MealBuilder, MealCard | None | $0 | 4/5 |
| 7. Shopping Lists | Extend 1 | shopping-lists.ts | Generator, List | Llama 3.2 (optional) | $0-0.01 | 4/5 |
| 8. Price Est. | Add columns | estimatePrice | Price display | Gemini Flash | $0 | 4/5 |
| 9. Ingredients DB | 1 table | ingredients.ts | Admin panel | Llama 3.2 | $5-10 | 5/5 |
| 10. Joanie's Fridge | 1 table | fridge.ts, suggest | FridgeInput, Suggestions | Claude Haiku | $0.0003 | 4/5 |
| 11. Add Picture | None | recognizeIngredients | ImageUploader | GPT-4o Vision | $0.01 | 5/5 |
| 12. More Like This | None | findSimilarRecipes | SimilarWidget | None | $0 | 2/5 |
| 13. Occasion Meals | Extend meals | occasion-meals.ts | Gallery, Customizer | Haiku | $0.0008 | 3/5 |
| 14. Image OCR | None | extractRecipe | ImageRecipeUploader | GPT-4o Vision | $0.02 | 5/5 |

### API Endpoint Summary

```typescript
// New Actions (src/app/actions/)

// meals.ts
- createMeal(data: NewMeal)
- updateMeal(id, data)
- deleteMeal(id)
- getMealWithRecipes(mealId)
- getUserMeals(userId)
- addRecipeToMeal(mealId, recipeId, courseType)
- removeRecipeFromMeal(mealId, recipeId)

// shopping-lists.ts
- generateShoppingListFromMeal(mealId, servingMultiplier)
- generateShoppingListFromRecipes(recipeIds[], servingMultiplier)
- consolidateIngredients(items[])
- updateShoppingList(id, data)
- toggleItemChecked(listId, itemId)
- estimateShoppingListCost(listId)

// ingredients.ts
- getIngredient(id)
- searchIngredients(query)
- matchIngredient(rawText)
- createIngredient(data)
- updateIngredient(id, data)
- getIngredientsByCategory(category)

// fridge.ts
- parseFridgeContents(rawText)
- saveFridgeInventory(userId, parsedItems)
- getFridgeInventory(userId)
- suggestRecipesFromFridge(userId)
- updateFridgeItem(fridgeId, itemId, data)

// occasion-meals.ts
- getOccasionTemplates()
- createMealFromTemplate(templateId, userId, customizations)
- suggestMealVariations(templateId, preferences)

// semantic-search.ts (extend existing)
- findSimilarRecipes(recipeId, limit)
```

---

## LLM Cost Analysis

### Model Pricing (as of October 2025)

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Use Case | Recommendation |
|-------|-------------------|---------------------|----------|----------------|
| **Gemini 2.0 Flash** | $0.00 | $0.00 | All text tasks | ✅ PRIMARY |
| **Llama 3.2 3B** | $0.00 | $0.00 | Classification, parsing | ✅ BACKUP |
| **Claude 3 Haiku** | $0.25 | $1.25 | Smart parsing, customization | 🟡 PREMIUM |
| **Claude 3.5 Sonnet** | $3.00 | $15.00 | Complex reasoning | ⚠️ EXPENSIVE |
| **GPT-3.5 Turbo** | $0.50 | $1.50 | General purpose | 🟡 FALLBACK |
| **GPT-4o** | $2.50 | $10.00 | Best quality | ⚠️ EXPENSIVE |
| **GPT-4o Vision** | $2.50 | $10.00 | Image analysis | ⚠️ EXPENSIVE |
| **Gemini Pro Vision** | $0.125 | $0.375 | Image analysis (cheaper) | ✅ VISION |

### Cost Estimates by Feature

#### One-Time Costs (Initial Setup)

| Task | Volume | Tokens | Model | Cost |
|------|--------|--------|-------|------|
| Recipe cleanup (968 recipes) | 968 | ~1.16M | Gemini Flash | **$0.00** |
| Ingredient DB seeding (500) | 500 | ~250K | Gemini Flash | **$0.00** |
| Recipe migration (968) | 968 | ~0.5M | Llama 3.2 | **$0.00** |
| Occasion template creation (10) | 10 | ~50K | Haiku | **$0.08** |
| **TOTAL ONE-TIME** | | | | **$0.08** |

#### Operational Costs (Per Month, estimated 1000 users)

| Feature | Usage/Month | Tokens/Use | Model | Cost/Use | Monthly Cost |
|---------|-------------|-----------|-------|----------|--------------|
| Recipe cleanup (ongoing) | 50 new recipes | 1.2K | Gemini Flash | $0.00 | **$0.00** |
| Shopping list generation | 500 lists | 0.8K | Gemini Flash | $0.00 | **$0.00** |
| Price estimation | 500 lists | 0.8K | Gemini Flash | $0.00 | **$0.00** |
| Fridge parsing | 200 parses | 0.8K | Haiku | $0.0003 | **$0.06** |
| Meal customization | 100 customizations | 1.3K | Haiku | $0.0008 | **$0.08** |
| Ingredient matching (fallback) | 50 matches | 0.3K | Llama 3.2 | $0.00 | **$0.00** |
| **TOTAL MONTHLY** | | | | | **$0.14** |

#### Future Costs (Phase 4)

| Feature | Usage/Month | Model | Cost/Use | Monthly Cost |
|---------|-------------|-------|----------|--------------|
| Add a Picture (fridge photos) | 100 images | Gemini Pro Vision | $0.001 | **$0.10** |
| Image recipe extraction | 50 images | GPT-4o Vision | $0.02 | **$1.00** |
| **TOTAL FUTURE MONTHLY** | | | | **$1.10** |

### Cost Optimization Strategy

1. **Use Free Models First**:
   - Gemini 2.0 Flash for ALL text tasks (free)
   - Llama 3.2 3B for classification (free)
   - Only upgrade if quality insufficient

2. **Cache Results**:
   ```typescript
   // Cache ingredient matches to avoid re-parsing
   const cachedMatch = await redis.get(`ingredient:${rawText}`);
   if (cachedMatch) return cachedMatch;
   ```

3. **Batch Operations**:
   ```typescript
   // Process 10 recipes at once instead of 1
   const batch = recipes.slice(0, 10);
   const prompt = `Clean up these ${batch.length} recipes: ...`;
   ```

4. **Progressive Enhancement**:
   - Start with regex parsing (free)
   - Fall back to LLM only when needed
   - Use cheapest model that works

5. **Rate Limiting**:
   ```typescript
   // Limit expensive operations
   if (user.tier === 'free') {
     // Max 5 fridge parses/month
     // Max 10 meal customizations/month
   }
   ```

### Total Cost Summary

| Phase | One-Time | Monthly | Notes |
|-------|----------|---------|-------|
| Phase 1 | $0.00 | $0.00 | All free models |
| Phase 2 | $0.00 | $0.00 | All free models |
| Phase 3 | $0.08 | $0.14 | Haiku for premium features |
| Phase 4 | $0.00 | $1.10 | Vision models (future) |
| **TOTAL** | **$0.08** | **$0.14** | Phase 1-3 |
| **WITH VISION** | **$0.08** | **$1.24** | All phases |

**Annual Cost Estimate** (Phase 1-3): ~$1.68/year
**Annual Cost Estimate** (All phases): ~$14.88/year

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM quality insufficient (Gemini Flash) | Medium | Medium | Test thoroughly, upgrade to Haiku if needed |
| Ingredient matching accuracy low | Medium | High | Build comprehensive aliases, use LLM fallback |
| Vector search performance issues | Low | Medium | Index optimization, limit results, cache |
| Recipe cleanup breaks data | Low | High | Test on sample first, backup database, rollback plan |
| Shopping list consolidation errors | Medium | Medium | Validation, user review step, manual override |
| Vision model costs too high | Low | Low | Start with Gemini Vision ($0.001 vs $0.02) |
| Database migration failures | Low | High | Drizzle migrations, test locally, rollback scripts |
| Performance degradation | Medium | Medium | Monitoring, query optimization, pagination |

### Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scope creep beyond 8 weeks | High | Medium | Strict phase gates, prioritize P0/P1 only |
| Feature dependencies block progress | Medium | High | Clear dependency graph, parallel work streams |
| UI/UX complexity underestimated | Medium | Medium | Wireframes first, user testing, iterate |
| Integration bugs between features | Medium | High | Integration tests, E2E testing, staging environment |
| Meal builder too complex for users | Medium | Medium | Simple MVP first, progressive disclosure |
| Fridge parsing too inaccurate | Medium | High | Multiple input methods, manual corrections |

### Data Quality Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Recipe cleanup changes meaning | Low | High | Review sample, A/B test, rollback option |
| Ingredient amounts still missing | Low | Critical | Validation, reject recipes without amounts |
| Duplicate ingredients not consolidated | Medium | Medium | Smart consolidation, user review |
| Price estimates wildly inaccurate | High | Low | Clear disclaimers, +/-30% accuracy acceptable |
| Nutritional data outdated | Low | Low | USDA updates, periodic refresh |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users don't adopt new features | Medium | Medium | User onboarding, tooltips, tutorials |
| LLM costs exceed budget | Low | Medium | Rate limiting, free models first, caching |
| External API changes (USDA, etc.) | Low | Low | Graceful degradation, fallback data |
| Performance issues scale poorly | Low | High | Load testing, caching, CDN, database optimization |

### Risk Mitigation Checklist

**Phase 1 (Critical)**:
- [ ] Backup database before recipe cleanup
- [ ] Test cleanup on 10 recipes manually
- [ ] Validate 100% of cleaned recipes have amounts
- [ ] Add rollback script for cleanup
- [ ] Monitor LLM costs daily

**Phase 2 (Core Features)**:
- [ ] Test meal builder with real users (5-10)
- [ ] Validate shopping list consolidation accuracy
- [ ] Add manual override for all automated features
- [ ] Performance test with 1000+ recipes
- [ ] Load test meal generation

**Phase 3 (AI Features)**:
- [ ] Test fridge parsing with diverse inputs
- [ ] Validate recipe suggestions accuracy
- [ ] Monitor LLM costs vs. budget
- [ ] A/B test occasion meal templates
- [ ] User acceptance testing

**Phase 4 (Future)**:
- [ ] Cost-benefit analysis for vision features
- [ ] Test vision accuracy before launch
- [ ] Set up cost alerts for expensive operations
- [ ] Prepare fallback for vision failures

---

## Success Metrics

### Phase 1 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recipes with proper amounts | 100% | Database query |
| User-reported amount issues | <1% | Support tickets |
| Site content updated | 100% | Manual QA |
| Top 50 feature adoption | >30% users | Analytics |
| Page load time | <2s | Lighthouse |

### Phase 2 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Meals created | >50/month | Database query |
| Shopping lists generated | >100/month | Database query |
| Shopping list accuracy | >90% user satisfaction | Survey |
| Price estimates within +/-30% | >80% | Spot checks |
| Serving size adjustments used | >40% of lists | Analytics |

### Phase 3 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Fridge feature usage | >20% users | Analytics |
| Recipe suggestions clicked | >50% | Click-through rate |
| Similar recipes viewed | >30% of detail views | Analytics |
| Occasion meals created | >20/month | Database query |
| User satisfaction | >4.0/5 | Survey |

### Overall KPIs

| KPI | Current | Target (3 months) | Target (6 months) |
|-----|---------|------------------|------------------|
| Active users | ? | +50% | +100% |
| Recipes created | ? | +30% | +60% |
| User engagement (sessions/week) | ? | 3x/week | 5x/week |
| Feature adoption (new features) | 0% | 40% | 70% |
| LLM costs per user | N/A | <$0.01/month | <$0.02/month |
| Page load time | ? | <2s | <1.5s |
| Mobile usage | ? | 40% | 50% |
| Recipe sharing (public) | ? | +20% | +40% |

---

## Appendix A: Quick Reference

### Priority Cheat Sheet

**Do First (P0 - Critical)**:
1. Feature 2: Recipe Content Cleanup
2. Feature 5: Show Ingredient Amounts
3. Feature 9: Ingredients Database

**Do Next (P1 - High Value)**:
1. Feature 6: Meals
2. Feature 7: Smart Shopping Lists
3. Feature 10: Joanie's Fridge
4. Feature 12: More Like This
5. Feature 13: Occasion Meals
6. Feature 3: Top 50 Filtering

**Do Later (P2 - Medium Value)**:
1. Feature 8: Price Estimation
2. Feature 14: Image Recipe Creation
3. Feature 4: Star Icon Simplification
4. Feature 1: Fix Site Content

**Do Eventually (P3 - Low Priority)**:
1. Feature 11: Add a Picture (Coming Soon)

### Development Timeline

```
Week 1-2:  Phase 1 Foundation
Week 3-5:  Phase 2 Core Features
Week 6-8:  Phase 3 AI Features
Week 9+:   Phase 4 Future Features (TBD)
```

### Team Allocation

```
Week 1-2:  1 developer (Foundation)
Week 3-5:  1-2 developers (Core Features)
Week 6-8:  1 developer (AI Features)
```

### Cost Summary

```
One-Time:  $0.08
Monthly:   $0.14 (Phase 1-3)
Monthly:   $1.24 (All phases including vision)
Annual:    $1.68 (Phase 1-3)
Annual:    $14.88 (All phases)
```

---

## Appendix B: Sample Prompts

### Recipe Cleanup Prompt
```
You are a recipe editor. Clean up this recipe data:

TITLE: ${recipe.name}
DESCRIPTION: ${recipe.description}
INGREDIENTS: ${JSON.stringify(recipe.ingredients)}

Tasks:
1. Fix title capitalization (Title Case)
2. Improve description grammar
3. Ensure ALL ingredients have quantities
   - Examples: "flour" → "2 cups all-purpose flour"

Return JSON: {"name": "...", "description": "...", "ingredients": [...]}
```

### Fridge Parsing Prompt
```
Parse this fridge inventory into structured data:

"""
${userInput}
"""

Extract ingredients with quantity, unit, and confidence (0-1).
Return JSON array: [{"ingredient": "...", "quantity": ..., "unit": "...", "confidence": ...}]
```

### Meal Customization Prompt
```
User wants to customize a ${occasion} meal.
Preferences: "${userPreferences}"

Current recipes: ${recipeList}

Suggest alternatives matching the occasion and preferences.
Return JSON: [{"original": "...", "suggested": "...", "reason": "..."}]
```

---

## Appendix C: Database Indexes

```sql
-- Ingredients
CREATE INDEX idx_ingredients_category ON ingredients(category);
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_ingredients_common ON ingredients(is_common) WHERE is_common = TRUE;
CREATE INDEX idx_ingredients_search ON ingredients USING gin(to_tsvector('english', name || ' ' || COALESCE(aliases, '')));

-- Meals
CREATE INDEX idx_meals_user_id ON meals(user_id);
CREATE INDEX idx_meals_occasion ON meals(occasion);
CREATE INDEX idx_meals_public ON meals(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_meals_templates ON meals(is_occasion_template) WHERE is_occasion_template = TRUE;

-- Meal Recipes
CREATE INDEX idx_meal_recipes_meal_id ON meal_recipes(meal_id);
CREATE INDEX idx_meal_recipes_recipe_id ON meal_recipes(recipe_id);
CREATE INDEX idx_meal_recipes_course ON meal_recipes(course_type);

-- Fridge Inventories
CREATE INDEX idx_fridge_user_id ON fridge_inventories(user_id);
CREATE INDEX idx_fridge_updated ON fridge_inventories(last_updated);

-- Shopping Lists (new indexes)
CREATE INDEX idx_shopping_source ON shopping_lists(source_type, source_id);
CREATE INDEX idx_shopping_user ON shopping_lists(user_id);
```

---

## Appendix D: Testing Checklist

### Phase 1 Testing
- [ ] Recipe cleanup: 10 manual reviews
- [ ] Ingredient amounts: 100% coverage validation
- [ ] Top 50 filter: Edge cases (ties, no ratings)
- [ ] Star icon: All browsers, mobile
- [ ] Content updates: All pages checked

### Phase 2 Testing
- [ ] Meal builder: Create/edit/delete flows
- [ ] Shopping lists: Generation accuracy >90%
- [ ] Price estimates: Spot-check 20 lists
- [ ] Serving adjustments: Math validation
- [ ] Category grouping: All categories present

### Phase 3 Testing
- [ ] Fridge parsing: 50 diverse inputs
- [ ] Recipe suggestions: Relevance >80%
- [ ] Similar recipes: Similarity threshold tuning
- [ ] Occasion meals: All templates work
- [ ] Meal customization: LLM quality check

### Integration Testing
- [ ] Meal → Shopping list flow
- [ ] Fridge → Suggestions → Shopping list
- [ ] Recipe → Similar recipes → Copy
- [ ] Occasion meal → Customize → Create
- [ ] All exports working (PDF, Markdown)

---

## Conclusion

This roadmap provides a comprehensive, actionable plan for implementing all 14 requested features. The phased approach ensures:

1. **Critical issues fixed first** (recipe content, amounts, ingredients DB)
2. **Core value delivered quickly** (meals, shopping lists in Phase 2)
3. **AI features enhance experience** (fridge, suggestions in Phase 3)
4. **Future-proofed** (vision features in Phase 4)

**Key Success Factors**:
- Use free LLMs (Gemini Flash) wherever possible
- Build ingredients database as foundation
- Test rigorously at each phase gate
- Maintain strict prioritization (P0 → P1 → P2)
- Monitor costs and performance continuously

**Next Steps**:
1. Review and approve this roadmap
2. Set up project tracking (Jira, Linear, etc.)
3. Begin Phase 1 implementation
4. Schedule weekly progress reviews
5. Adjust timeline based on learnings

**Estimated Delivery**:
- **Phase 1**: 2 weeks (Weeks 1-2)
- **Phase 2**: 3 weeks (Weeks 3-5)
- **Phase 3**: 3 weeks (Weeks 6-8)
- **Total**: 8 weeks to production-ready state

**Total Budget**:
- **One-Time**: $0.08
- **Monthly**: $0.14 (Phase 1-3) or $1.24 (with vision)
- **Annual**: $1.68 (Phase 1-3) or $14.88 (with vision)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-15
**Author**: Research Agent
**Status**: Ready for Engineering Handoff ✅
