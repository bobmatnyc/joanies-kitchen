# Search Components

Comprehensive search interface components for the Recipe Manager application, including AI-powered semantic search and ingredient-based search.

## Overview

This directory contains React components for searching recipes through multiple approaches:

### 🎯 Semantic Search (NEW)
- AI-powered natural language understanding
- Three search modes: Semantic, Text, Hybrid
- Advanced relevance scoring and ranking
- Transparent similarity badges

### 🥕 Ingredient Search (EXISTING)
- Autocomplete ingredient search with fuzzy matching
- Category-based ingredient browsing
- Visual ingredient match indicators
- Responsive, mobile-friendly UI

## Components

---

## 🎯 Semantic Search Components

### SemanticSearchBar

Main search interface with AI-powered mode switching and intelligent suggestions.

**Features:**
- Three search modes with visual mode selector
- Debounced search suggestions (300ms)
- Recent searches (stored in localStorage)
- Keyboard shortcut (Cmd+K to focus)
- Example queries for inspiration
- URL state management

**Usage:**

```tsx
import { SemanticSearchBar } from '@/components/search';

<SemanticSearchBar
  defaultMode="hybrid"
  onSearch={(query, mode) => handleSearch(query, mode)}
  showExamples
  autoFocus
/>
```

**Props:**
- `defaultQuery?`: Initial search query (string)
- `defaultMode?`: Initial search mode ('semantic' | 'text' | 'hybrid')
- `onSearch?`: Callback when search is submitted
- `placeholder?`: Custom placeholder text
- `className?`: Additional CSS classes
- `autoFocus?`: Auto-focus input on mount (default: false)
- `showExamples?`: Show example queries (default: true)

**Search Modes:**
- **Semantic**: AI-powered understanding of natural language ("comfort food for cold weather")
- **Text**: Traditional keyword matching ("chocolate chip cookies")
- **Hybrid**: Combined approach for best results (recommended)

---

### SearchResults

Display search results with relevance scoring and sorting options.

**Features:**
- Multiple sort options: Relevance, Rating, Recent, Popular
- Similarity badges for each result
- Empty state with refinement suggestions
- Loading and error states
- Responsive grid layout

**Usage:**

```tsx
import { SearchResults } from '@/components/search';

<SearchResults
  recipes={searchResults}
  query="spicy pasta"
  showSimilarity
  defaultSort="relevance"
  onRefineSearch={() => scrollToTop()}
/>
```

**Props:**
- `recipes`: Search results (RecipeWithSimilarity[] | RankedRecipe[])
- `query`: Search query string for display
- `loading?`: Loading state (default: false)
- `error?`: Error message string
- `showSimilarity?`: Show similarity badges (default: true)
- `defaultSort?`: Default sort order ('relevance' | 'rating' | 'recent' | 'popular')
- `className?`: Additional CSS classes
- `emptyMessage?`: Custom empty state message
- `onRefineSearch?`: Callback for refine search action

**Compact Variant:**

```tsx
import { CompactSearchResults } from '@/components/search';

<CompactSearchResults
  recipes={results}
  query="pasta"
  loading={false}
/>
```

---

### SimilarityBadge

Visual indicator of search relevance with color-coded similarity scoring.

**Features:**
- Color-coded by match quality:
  - Green (80-100%): Excellent match
  - Blue (60-80%): Good match
  - Gray (<60%): Fair match
- Optional tooltip with score breakdown
- Three display variants: default, compact, detailed

**Usage:**

```tsx
import { SimilarityBadge } from '@/components/search';

<SimilarityBadge
  similarity={0.87}
  rankingScore={0.82}
  scoreComponents={{
    similarity: 0.87,
    quality: 0.78,
    engagement: 0.65,
    recency: 0.92
  }}
  showTooltip
/>
```

**Props:**
- `similarity`: Similarity score 0-1 (required)
- `rankingScore?`: Overall ranking score 0-1
- `scoreComponents?`: Score breakdown object
- `className?`: Additional CSS classes
- `showTooltip?`: Show detailed tooltip (default: true)
- `variant?`: Display variant ('default' | 'compact' | 'detailed')

**Variants:**

```tsx
// Compact (for tight spaces)
<CompactSimilarityBadge similarity={0.87} />

// Detailed (with score breakdown)
<DetailedSimilarityBadge
  similarity={0.87}
  scoreComponents={components}
/>
```

---

### SearchModeTooltip

Helper component explaining each search mode with examples.

**Usage:**

```tsx
import { SearchModeTooltip } from '@/components/search';

<SearchModeTooltip mode="hybrid" />
```

**Comparison View:**

```tsx
import { SearchModeComparison } from '@/components/search';

// Displays all three modes side-by-side
<SearchModeComparison />
```

---

## 🥕 Ingredient Search Components

### IngredientSearchBar

Autocomplete search input for selecting ingredients.

**Features:**
- Debounced search (300ms) to reduce API calls
- Fuzzy matching with category badges
- Multi-select with removable tags
- Keyboard navigation (arrow keys, Enter, Escape)
- Shows popular ingredients when empty
- Loading states and error handling
- Fully accessible (ARIA labels and roles)

**Usage:**
```tsx
import { IngredientSearchBar } from '@/components/search';
import type { Ingredient } from '@/lib/db/schema';

function RecipeSearch() {
  const [selected, setSelected] = useState<Ingredient[]>([]);

  const handleSearch = () => {
    // Trigger recipe search with selected ingredients
    console.log('Searching with:', selected);
  };

  return (
    <IngredientSearchBar
      selectedIngredients={selected}
      onIngredientsChange={setSelected}
      onSearch={handleSearch}
      placeholder="Search ingredients..."
    />
  );
}
```

**Props:**
- `selectedIngredients`: Array of currently selected ingredients
- `onIngredientsChange`: Callback when selection changes
- `onSearch`: Callback when search button is clicked
- `placeholder?`: Input placeholder text (default: "Search ingredients...")
- `className?`: Additional CSS classes

---

### IngredientFilter

Category-based ingredient selection with collapsible sections.

**Features:**
- Grouped by ingredient categories (vegetables, proteins, etc.)
- Popular ingredients section at top
- Select all / Clear all per category
- Checkbox selection with visual feedback
- Loading states for lazy-loaded categories
- Category icons and color coding
- Scrollable ingredient lists (max 264px)

**Usage:**
```tsx
import { IngredientFilter } from '@/components/search';
import type { Ingredient } from '@/lib/db/schema';

function RecipeFilterPanel() {
  const [selected, setSelected] = useState<Ingredient[]>([]);

  return (
    <IngredientFilter
      selectedIngredients={selected}
      onIngredientsChange={setSelected}
    />
  );
}
```

**Props:**
- `selectedIngredients`: Array of currently selected ingredients
- `onIngredientsChange`: Callback when selection changes
- `className?`: Additional CSS classes

**Categories:**
- vegetables, fruits, proteins, dairy, grains
- herbs, spices, seafood, meat, poultry
- legumes, nuts, oils, sweeteners, baking
- condiments, pasta, beverages, other

---

### IngredientMatchBadge

Display ingredient match percentage on recipe cards.

**Features:**
- Color-coded badges (green ≥80%, yellow 50-80%, gray <50%)
- Shows matched count (e.g., "8/10 ingredients")
- Tooltip with matched ingredient names
- Three variants: default, compact, detailed

**Usage:**

**Default Badge (with tooltip):**
```tsx
import { IngredientMatchBadge } from '@/components/search';

<IngredientMatchBadge
  matchedCount={8}
  totalCount={10}
  matchedIngredients={['tomatoes', 'basil', 'mozzarella', ...]}
  showTooltip={true}
/>
```

**Compact Badge (for tight spaces):**
```tsx
import { CompactIngredientMatchBadge } from '@/components/search';

<CompactIngredientMatchBadge
  matchedCount={8}
  totalCount={10}
/>
```

**Detailed Badge (for recipe detail pages):**
```tsx
import { DetailedIngredientMatchBadge } from '@/components/search';

<DetailedIngredientMatchBadge
  matchedCount={8}
  totalCount={10}
  matchedIngredients={['tomatoes', 'basil', 'mozzarella', ...]}
/>
```

**Props:**
- `matchedCount`: Number of matched ingredients (required)
- `totalCount`: Total ingredients in recipe (required)
- `matchedIngredients?`: Array of matched ingredient names for tooltip
- `showTooltip?`: Show tooltip on hover (default: true)
- `className?`: Additional CSS classes

---

---

## Server Actions

### Semantic Search Actions

The semantic search components use server actions from `@/app/actions/semantic-search`:

#### semanticSearchRecipes
```typescript
import { semanticSearchRecipes } from '@/app/actions/semantic-search';

const result = await semanticSearchRecipes('comfort food for cold weather', {
  limit: 20,
  minSimilarity: 0.3,
  cuisine: 'Italian',
  difficulty: 'easy',
  rankingMode: 'balanced',
  includeScoreBreakdown: true,
});
// Returns: { success: true, recipes: [...] }
```

#### hybridSearchRecipes
```typescript
import { hybridSearchRecipes } from '@/app/actions/semantic-search';

const result = await hybridSearchRecipes('spicy pasta', {
  limit: 20,
  minSimilarity: 0.3,
  rankingMode: 'hybrid',
});
// Returns: { success: true, recipes: [...], mergedCount: 42 }
```

#### findSimilarToRecipe
```typescript
import { findSimilarToRecipe } from '@/app/actions/semantic-search';

const result = await findSimilarToRecipe('recipe-id', 10);
// Returns: { success: true, recipes: [...] }
```

#### getSearchSuggestions
```typescript
import { getSearchSuggestions } from '@/app/actions/semantic-search';

const result = await getSearchSuggestions('chick', 10);
// Returns: { success: true, suggestions: ['chicken', 'chickpeas', ...] }
```

### Ingredient Search Actions

The ingredient search components use server actions from `@/app/actions/ingredient-search`:

### getIngredientSuggestions
```typescript
const result = await getIngredientSuggestions('toma', 10);
// Returns: { success: true, suggestions: [...] }
```

### getIngredientsByCategory
```typescript
const result = await getIngredientsByCategory('vegetables');
// Returns: { success: true, ingredients: [...] }
```

### getPopularIngredients
```typescript
const result = await getPopularIngredients(15);
// Returns: { success: true, ingredients: [...] }
```

### searchRecipesByIngredients
```typescript
const result = await searchRecipesByIngredients(['tomatoes', 'basil'], {
  minMatchPercentage: 50,
  limit: 20
});
// Returns: { success: true, recipes: [...], totalCount: 42 }
```

### getIngredientCategories
```typescript
const result = await getIngredientCategories();
// Returns: { success: true, categories: [...] }
```

### getMatchedIngredients
```typescript
const result = await getMatchedIngredients('recipe-id', ['ing-1', 'ing-2']);
// Returns: { success: true, ingredients: [...] }
```

---

## Complete Semantic Search Example

```tsx
'use client';

import { useState } from 'react';
import { SemanticSearchBar, SearchResults } from '@/components/search';
import { semanticSearchRecipes, hybridSearchRecipes } from '@/app/actions/semantic-search';
import type { SearchMode } from '@/components/search';
import type { RecipeWithSimilarity } from '@/app/actions/semantic-search';

export function SemanticSearchPage() {
  const [results, setResults] = useState<RecipeWithSimilarity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState('');

  const handleSearch = async (searchQuery: string, mode: SearchMode) => {
    setQuery(searchQuery);
    setLoading(true);
    setError(undefined);

    try {
      const options = {
        limit: 50,
        minSimilarity: 0.3,
        rankingMode: 'balanced' as const,
        includeScoreBreakdown: true,
      };

      const result = mode === 'semantic'
        ? await semanticSearchRecipes(searchQuery, options)
        : await hybridSearchRecipes(searchQuery, options);

      if (result.success) {
        setResults(result.recipes);
      } else {
        setError(result.error || 'Search failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-heading text-jk-olive mb-8">
        AI-Powered Recipe Search
      </h1>

      <SemanticSearchBar
        onSearch={handleSearch}
        defaultMode="hybrid"
        showExamples
      />

      <div className="mt-8">
        <SearchResults
          recipes={results}
          query={query}
          loading={loading}
          error={error}
          showSimilarity
          defaultSort="relevance"
        />
      </div>
    </div>
  );
}
```

---

## Complete Ingredient Search Example

```tsx
'use client';

import { useState } from 'react';
import { IngredientSearchBar, IngredientFilter, IngredientMatchBadge } from '@/components/search';
import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';
import type { Ingredient } from '@/lib/db/schema';
import { RecipeCard } from '@/components/recipe/RecipeCard';

export function IngredientSearchPage() {
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (selectedIngredients.length === 0) return;

    setLoading(true);
    try {
      const ingredientIds = selectedIngredients.map(i => i.id);
      const result = await searchRecipesByIngredients(ingredientIds, {
        minMatchPercentage: 50,
        includePublic: true,
        limit: 50,
      });

      if (result.success) {
        setRecipes(result.recipes);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-heading text-jk-olive mb-8">
        Search Recipes by Ingredients
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left sidebar - Filters */}
        <aside className="lg:col-span-1">
          <div className="sticky top-4 space-y-6">
            <IngredientFilter
              selectedIngredients={selectedIngredients}
              onIngredientsChange={setSelectedIngredients}
            />
          </div>
        </aside>

        {/* Main content - Search and Results */}
        <main className="lg:col-span-2">
          {/* Search Bar */}
          <IngredientSearchBar
            selectedIngredients={selectedIngredients}
            onIngredientsChange={setSelectedIngredients}
            onSearch={handleSearch}
          />

          {/* Results */}
          <div className="mt-8">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-jk-charcoal/60">Searching recipes...</p>
              </div>
            ) : recipes.length > 0 ? (
              <>
                <h2 className="text-xl font-heading text-jk-olive mb-4">
                  Found {recipes.length} recipes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recipes.map((recipe) => (
                    <div key={recipe.id} className="relative">
                      <RecipeCard recipe={recipe} />
                      <div className="absolute top-2 right-2">
                        <IngredientMatchBadge
                          matchedCount={recipe.matchedIngredients}
                          totalCount={recipe.totalIngredients}
                          matchedIngredients={recipe.matchedIngredients}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : selectedIngredients.length > 0 ? (
              <div className="text-center py-12">
                <p className="text-jk-charcoal/60">
                  No recipes found with selected ingredients.
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-jk-charcoal/60">
                  Select ingredients to search for recipes.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

## Styling

All components follow the project's design system:
- **Colors**: jk-olive, jk-clay, jk-sage, jk-tomato, jk-charcoal
- **Fonts**: font-heading (headings), font-ui (UI elements), font-body (body text)
- **Mobile-first**: Responsive layouts with Tailwind breakpoints
- **Touch-friendly**: 44x44px minimum touch targets
- **Accessible**: ARIA labels, keyboard navigation, focus states

---

## Dependencies

- `@/components/ui/*` - shadcn/ui base components
- `@/app/actions/ingredient-search` - Server actions
- `@/lib/db/schema` - Database types
- `lucide-react` - Icons
- Tailwind CSS - Styling

---

## Database Schema

Components expect the following database tables:
- `ingredients` - Master ingredient list with categories
- `recipe_ingredients` - Many-to-many recipe-ingredient relationships
- `ingredient_statistics` - Usage statistics for popularity sorting

See `src/lib/db/ingredients-schema.ts` for full schema definitions.

---

## Testing

Test with various scenarios:
- Empty state (no ingredients selected)
- Single ingredient search
- Multiple ingredients (2-10+)
- Category filtering
- Edge cases (typos, special characters)
- Mobile device testing (touch interactions)
- Accessibility (screen readers, keyboard only)

---

## Future Enhancements

Potential improvements:
- Ingredient substitution suggestions
- Dietary restriction filters (vegan, gluten-free, etc.)
- Ingredient exclusion (recipes WITHOUT certain ingredients)
- Save favorite ingredient combinations
- Recipe recommendations based on pantry inventory
- Seasonal ingredient highlighting

---

**Last Updated**: 2025-01-17
**Version**: 2.0.0

**Changelog:**
- **v2.0.0** (2025-01-17): Added comprehensive semantic search components
- **v1.0.0** (2025-10-17): Initial ingredient search components
