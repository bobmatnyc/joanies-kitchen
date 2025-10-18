# Meals Planning Feature - Status Report & Implementation Plan

**Date**: 2025-10-18
**Current Completion**: 50% → Target: 90%
**Estimated Time**: 3-4 hours

---

## Executive Summary

The meals planning feature has a **solid foundation** with complete database schema, comprehensive server actions, and basic UI components. The feature is currently at ~50% completion. To reach 90%, we need to:

1. **Enhance AI suggestions** with smarter recommendations
2. **Improve shopping list** with better ingredient consolidation
3. **Add meal prep timeline** for cooking coordination
4. **Polish UI/UX** for better user experience
5. **Add comprehensive testing**

---

## Current State Analysis

### ✅ What Works (50% Complete)

#### 1. Database Schema (100% Complete)
**File**: `src/lib/db/meals-schema.ts`

- ✅ **4 tables fully designed**:
  - `meals` - Core meal entity with metadata
  - `meal_recipes` - Recipe associations with serving multipliers
  - `shopping_lists` - Consolidated shopping lists
  - `meal_templates` - Reusable meal patterns

- ✅ **Advanced features**:
  - Price estimation fields (LLM-powered)
  - Course categorization (appetizer, main, side, dessert, etc.)
  - Serving multipliers for recipe scaling
  - Template system for quick meal creation
  - Shopping list status workflow

- ✅ **Performance optimizations**:
  - Comprehensive indexing on user_id, meal_type, status
  - Unique constraints to prevent duplicates
  - Cascade deletes for referential integrity

#### 2. Server Actions (100% Complete)
**File**: `src/app/actions/meals.ts` (728 lines)

- ✅ **Core CRUD operations**:
  - `createMeal()` - Create new meal
  - `updateMeal()` - Update meal details
  - `deleteMeal()` - Delete meal (cascades to recipes)
  - `getUserMeals()` - List user's meals with filtering
  - `getMealById()` - Get meal with all recipes

- ✅ **Recipe management**:
  - `addRecipeToMeal()` - Add recipe to meal
  - `removeRecipeFromMeal()` - Remove recipe from meal
  - `updateMealRecipe()` - Update serving multipliers, course category

- ✅ **Shopping list**:
  - `generateShoppingList()` - Create shopping list from meal
  - `updateShoppingList()` - Update items and status
  - `getShoppingListById()` - Retrieve shopping list

- ✅ **Templates**:
  - `getMealTemplates()` - List available templates
  - `createMealFromTemplate()` - Create meal from template

- ✅ **Helper functions**:
  - `updateMealTimes()` - Auto-calculate total prep/cook time
  - `categorizeIngredient()` - Smart ingredient categorization (proteins, dairy, vegetables, etc.)

#### 3. Validation Layer (100% Complete)
**File**: `src/lib/meals/validation.ts` (387 lines)

- ✅ **Comprehensive Zod schemas** for all operations
- ✅ **User-friendly error messages**
- ✅ **Type safety** with TypeScript inference
- ✅ **Helper functions** for validation

#### 4. UI Components (80% Complete)
**Directory**: `src/components/meals/`

**Complete Components**:
- ✅ `MealBuilder.tsx` - Main meal creation form (275 lines)
  - Form state management
  - Recipe selection with course categorization
  - Automatic tag aggregation from recipes
  - Validation and error handling

- ✅ `AiRecipeSuggestions.tsx` - AI-powered suggestions (319 lines)
  - Semantic search integration
  - Course-specific suggestions (appetizer, main, side, dessert)
  - Deduplication across courses
  - Expandable sections with counts
  - Auto-refresh on description/tag changes (debounced)

- ✅ `ShoppingListView.tsx` - Shopping list display (324 lines)
  - Grouped by ingredient category (proteins, vegetables, etc.)
  - Check/uncheck items
  - Progress tracking
  - Status management (draft → active → shopping → completed)
  - Estimated cost display

- ✅ `MealTemplateSelector.tsx` - Template-based creation (301 lines)
  - Template browsing with filtering
  - Template usage tracking
  - Quick meal creation from templates

- ✅ `MealCard.tsx` - Meal list card view
- ✅ `MealFormFields.tsx` - Reusable form fields
- ✅ `RecipeSearchDialog.tsx` - Recipe search interface
- ✅ `SelectedRecipesList.tsx` - Manage selected recipes
- ✅ `MealRecipeCard.tsx` - Individual recipe card in meal

#### 5. Pages (100% Complete)

- ✅ `/meals/page.tsx` - List view with type filtering
- ✅ `/meals/new/page.tsx` - Create with builder/template tabs
- ✅ `/meals/[id]/page.tsx` - Detail view with recipes and shopping list
- ✅ Error/loading states for all pages

---

## ❌ What's Missing (to reach 90%)

### Priority 1: Advanced AI Features (15% completion gain)

**Current State**: Basic semantic search for recipe suggestions
**Needed**: Smarter, context-aware recommendations

#### Missing Features:
1. **Dietary Preference Filtering**
   - User profile integration (vegetarian, vegan, gluten-free, etc.)
   - Filter suggestions based on preferences
   - Show dietary badges on suggested recipes

2. **Nutritional Balance Scoring**
   - Analyze meal nutritional completeness
   - Suggest recipes to fill nutritional gaps
   - Show macronutrient breakdown (protein, carbs, fats)

3. **Cuisine Coherence**
   - Detect cuisine from description/tags
   - Prioritize recipes from same cuisine
   - Warn about cuisine mismatches (optional override)

4. **Seasonal Awareness**
   - Boost recipes with seasonal ingredients
   - Show "seasonal pick" badges

5. **Budget Awareness**
   - Estimate meal cost from recipe prices
   - Allow budget constraints in suggestions
   - Show "budget-friendly" badge

**Implementation**:
- Add server action: `getSmartMealSuggestions()`
- Enhance `AiRecipeSuggestions.tsx` with new filters
- Add nutritional analysis using OpenRouter

---

### Priority 2: Shopping List Enhancements (10% completion gain)

**Current State**: Basic ingredient consolidation
**Needed**: Advanced ingredient processing and estimation

#### Missing Features:
1. **Smart Ingredient Consolidation**
   - Handle unit conversions (cups → tbsp, lbs → oz)
   - Consolidate similar ingredients ("chicken breast" + "boneless chicken breast")
   - Fuzzy matching for ingredient names

2. **Price Estimation (LLM-powered)**
   - Use OpenRouter to estimate ingredient prices
   - Store estimates in database
   - Show cost breakdown by category
   - Update estimates periodically

3. **Store Optimization**
   - Group by store sections (produce, meat, dairy, etc.)
   - Suggest shopping order (most efficient route)
   - Store preferences (user's preferred stores)

4. **Pantry Check**
   - Mark items already in pantry
   - Show only items to buy
   - Pantry tracking system (future enhancement)

**Implementation**:
- Add server action: `estimateShoppingListPrices()`
- Add server action: `optimizeShoppingList()`
- Enhance `generateShoppingList()` with unit conversion
- Update `ShoppingListView.tsx` with new features

---

### Priority 3: Meal Prep Timeline (10% completion gain)

**Current State**: None
**Needed**: Step-by-step cooking coordination

#### Features:
1. **Timeline Generation**
   - Analyze all recipes in meal
   - Sort by prep order (longest cook time first)
   - Identify parallel tasks
   - Show timeline visualization

2. **Prep Scheduling**
   - "Day before" tasks (marinating, defrosting)
   - "Morning of" tasks (prep vegetables)
   - "Cooking time" tasks with coordination
   - "Just before serving" tasks

3. **Smart Coordination**
   - Detect oven conflicts (multiple recipes need oven)
   - Suggest workarounds
   - Show critical path

**Implementation**:
- Add server action: `generateMealPrepTimeline(mealId)`
- Create component: `MealPrepTimeline.tsx`
- Add to meal detail page

---

### Priority 4: UI/UX Polish (10% completion gain)

#### Improvements Needed:

1. **Meal Builder Enhancements**
   - Drag-and-drop recipe reordering
   - Visual course organization (collapsible sections)
   - Recipe preview on hover
   - Bulk serving multiplier adjustment

2. **Better Recipe Search**
   - Advanced filters (prep time, difficulty, cuisine)
   - Recent/favorite recipes quick-add
   - Recipe thumbnails in search results

3. **Meal Detail Page**
   - Tabbed interface (recipes, shopping list, timeline)
   - Print-friendly view
   - Share meal functionality
   - Duplicate meal button

4. **Shopping List Improvements**
   - Export to PDF/email
   - Print-friendly format
   - Send to phone (SMS/email)
   - Share with family members

5. **Mobile Optimization**
   - Touch-friendly controls (44px minimum)
   - Swipe gestures for actions
   - Bottom sheet for recipe details
   - Sticky action buttons

**Implementation**:
- Update existing components
- Add new utility components
- Mobile-first responsive design

---

### Priority 5: Testing (5% completion gain)

**Current State**: No tests
**Needed**: Comprehensive test coverage

#### Test Coverage:
1. **Unit Tests**
   - Validation schemas
   - Helper functions (ingredient categorization, consolidation)
   - Price estimation logic

2. **Integration Tests**
   - Server actions with database
   - Shopping list generation
   - Timeline generation

3. **E2E Tests** (Playwright)
   - Create meal flow
   - Add recipes to meal
   - Generate shopping list
   - Use template
   - Update meal

**Implementation**:
- Create `tests/e2e/meals/` directory
- Write test specs
- Add to CI/CD pipeline

---

## Implementation Plan

### Phase 1: Investigation ✅ (CURRENT - 30 minutes)
- [x] Read all meal-related files
- [x] Document current state
- [x] Identify gaps
- [x] Create implementation plan

### Phase 2: AI Enhancements (1 hour)
1. Create `src/app/actions/meal-suggestions.ts`
2. Implement dietary preference filtering
3. Add nutritional analysis
4. Enhance `AiRecipeSuggestions.tsx` UI
5. Test AI suggestions

### Phase 3: Shopping List Improvements (45 minutes)
1. Implement unit conversion utility
2. Add LLM price estimation
3. Enhance `generateShoppingList()` with consolidation
4. Update `ShoppingListView.tsx` with new features
5. Test shopping list generation

### Phase 4: Meal Prep Timeline (45 minutes)
1. Create `src/app/actions/meal-timeline.ts`
2. Implement timeline generation algorithm
3. Create `MealPrepTimeline.tsx` component
4. Add to meal detail page
5. Test timeline generation

### Phase 5: UI/UX Polish (30 minutes)
1. Add drag-and-drop to meal builder
2. Improve recipe search dialog
3. Add tabbed interface to meal detail
4. Mobile optimization tweaks
5. Visual polish

### Phase 6: Testing (30 minutes)
1. Write basic E2E test
2. Test critical flows
3. Document test coverage
4. Create testing guide

---

## Technical Debt & Future Enhancements

### Technical Debt
- ❌ No pagination on meals list (will be slow with many meals)
- ❌ No caching for AI suggestions (redundant API calls)
- ❌ No optimistic updates (UX lag on actions)
- ❌ No undo/redo functionality

### Future Enhancements (Beyond 90%)
- Calendar view for meal planning
- Meal rotation/scheduling
- Leftover tracking
- Meal history and favorites
- Social sharing (share meal with friends)
- Collaborative meal planning
- Integration with grocery delivery services
- Recipe substitution suggestions
- Nutritional goal tracking
- Weekly meal plan templates

---

## Success Metrics

### Completion Percentage Breakdown
- ✅ Database Schema: 100% (10% of total)
- ✅ Server Actions: 100% (15% of total)
- ✅ Validation: 100% (5% of total)
- ✅ Pages: 100% (10% of total)
- ✅ Basic UI Components: 80% (10% of total) → **Current: 50%**

**To reach 90%:**
- ⬜ Advanced AI Features: 0% → 100% (15% of total)
- ⬜ Shopping List Enhancements: 0% → 100% (10% of total)
- ⬜ Meal Prep Timeline: 0% → 100% (10% of total)
- ⬜ UI/UX Polish: 20% → 100% (10% of total)
- ⬜ Testing: 0% → 50% (5% of total)

**Total**: 50% → 90% ✨

---

## Deliverables

1. ✅ **Status Report** (this document)
2. ⬜ **Enhanced AI Suggestions** with dietary filtering
3. ⬜ **Improved Shopping List** with price estimation
4. ⬜ **Meal Prep Timeline** feature
5. ⬜ **Polished UI** with better UX
6. ⬜ **Basic E2E Tests** for critical flows
7. ⬜ **Implementation Summary** with file changes

---

## Notes

### Existing Strengths
- **Excellent schema design** - Well-thought-out with future features in mind
- **Comprehensive validation** - Type-safe with good error messages
- **Clean separation of concerns** - Server actions, components, utilities
- **Semantic search integration** - Already leveraging vector search
- **Course deduplication** - Smart recipe classification

### Architecture Decisions
- Using **semantic search** instead of keyword matching (excellent choice)
- **Server actions** instead of API routes (Next.js best practice)
- **Zod validation** for runtime safety (prevents bugs)
- **Optimistic UI** opportunity (not yet implemented)

### Performance Considerations
- Semantic search can be slow (needs caching)
- Shopping list generation is synchronous (could be async job)
- No pagination yet (will need for scale)
- Price estimation could be cached (avoid redundant LLM calls)

---

**Next Step**: Proceed to Phase 2 - AI Enhancements
