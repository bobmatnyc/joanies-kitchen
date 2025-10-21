# Ingredients Feature Guide

**Comprehensive ingredient directory with Joanie's personal notes and cooking tips**

Version: 1.0.0
Last Updated: 2025-10-20

---

## Overview

The Ingredients feature provides a dedicated directory for browsing all ingredients used in Joanie's Kitchen recipes. Each ingredient has its own detail page featuring:

- Ingredient information and images
- Joanie's personal notes and tips
- Storage recommendations
- Substitution suggestions
- List of recipes using the ingredient
- Usage statistics and popularity metrics

---

## Features

### 1. Ingredients Directory (`/ingredients`)

**Browsing Capabilities:**
- Grid view with ingredient cards
- Search functionality (by name or aliases)
- Category filtering (vegetables, proteins, dairy, etc.)
- Sort options:
  - Alphabetical (default)
  - Most used (by recipe count)
  - Recently added

**Visual Design:**
- Card-based layout for modern feel
- Ingredient images with fallback icons
- Usage count and popularity badges
- Trending indicator for popular ingredients

### 2. Individual Ingredient Pages (`/ingredients/[slug]`)

**URL Structure:**
- SEO-friendly slugs (e.g., `/ingredients/carrots`)
- Automatically generated from ingredient names
- Unique constraint ensures no duplicates

**Content Sections:**
- **Header Image**: Large ingredient photo or placeholder
- **Basic Information**: Name, category, usage statistics
- **Description**: General information about the ingredient
- **Joanie's Notes**: Personal observations and cooking stories (using JoanieComment component)
- **Storage Tips**: How to properly store the ingredient
- **Substitutions**: Alternative ingredients that can be used
- **Related Recipes**: Grid of recipes using this ingredient

**Actions:**
- "Find Recipes with [Ingredient]" button (links to fridge search)
- Navigate to related recipes
- Back to all ingredients

---

## Database Schema

### New Columns Added to `ingredients` Table:

```sql
slug VARCHAR(255) UNIQUE          -- URL-friendly identifier
description TEXT                  -- General information
storage_tips TEXT                 -- Storage recommendations
substitutions TEXT                -- JSON array of alternatives
image_url TEXT                    -- Ingredient image URL
```

### Indexes:
- `ingredients_slug_idx`: Fast slug lookups
- `ingredients_slug_unique`: Ensures unique slugs

---

## Server Actions

Located in: `src/app/actions/ingredients.ts`

### `getAllIngredients(options)`

Fetch all ingredients with optional filtering and sorting.

**Parameters:**
```typescript
{
  category?: string;           // Filter by category
  search?: string;             // Search by name or aliases
  sort?: 'alphabetical' | 'most-used' | 'recently-added';
  limit?: number;              // Default: 100
  offset?: number;             // Default: 0
}
```

**Returns:**
```typescript
{
  success: boolean;
  ingredients: IngredientWithStats[];
  totalCount: number;
  error?: string;
}
```

### `getIngredientBySlug(slug)`

Get detailed information about a specific ingredient.

**Parameters:**
- `slug`: URL-friendly ingredient identifier (e.g., "green-onion")

**Returns:**
```typescript
{
  success: boolean;
  ingredient?: Ingredient;
  joanieComment?: JoanieComment;
  recipesUsingIngredient?: Recipe[];
  error?: string;
}
```

### `getRecipesUsingIngredient(ingredientId, options)`

Get all recipes that use a specific ingredient.

**Parameters:**
```typescript
ingredientId: string;
options?: {
  limit?: number;              // Default: 50
  offset?: number;             // Default: 0
  sortBy?: 'popular' | 'recent' | 'rating';
}
```

### `getIngredientCategories()`

Get all unique ingredient categories with counts.

**Returns:**
```typescript
{
  success: boolean;
  categories: Array<{ category: string; count: number }>;
  error?: string;
}
```

---

## UI Components

### IngredientCard

Card component for displaying ingredient in grid view.

**Location:** `src/components/ingredient/IngredientCard.tsx`

**Props:**
```typescript
{
  ingredient: IngredientWithStats;
  className?: string;
}
```

**Features:**
- Ingredient image with fallback
- Name and category badge
- Usage count
- Trending indicator
- Hover effects

### IngredientList

Container component for displaying ingredients.

**Location:** `src/components/ingredient/IngredientList.tsx`

**Props:**
```typescript
{
  ingredients: IngredientWithStats[];
  viewMode?: 'grid' | 'list';  // Default: 'grid'
  className?: string;
}
```

**Features:**
- Responsive grid layout (2-5 columns)
- Empty state handling
- List view option (future)

### IngredientFilters

Filter and search controls for ingredients.

**Location:** `src/components/ingredient/IngredientFilters.tsx`

**Props:**
```typescript
{
  categories: Array<{ category: string; count: number }>;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  totalCount: number;
}
```

**Features:**
- Search input with debouncing (500ms)
- Category dropdown with counts
- Sort options dropdown
- Clear filters button
- Results count display
- Sticky positioning on desktop

---

## Navigation

**Desktop Navigation:**
- Icon: `Package` (lucide-react)
- Label: "Ingredients"
- Position: Between "Rescue Ingredients" and "Learn"
- Component: `src/components/navigation/DesktopNav.tsx`

---

## Migration Scripts

### 1. Apply Schema Changes

**Script:** `scripts/apply-ingredient-schema.ts`

```bash
pnpm tsx scripts/apply-ingredient-schema.ts
```

Adds new columns to the `ingredients` table.

### 2. Populate Slugs

**Script:** `scripts/populate-ingredient-slugs.ts`

```bash
pnpm tsx scripts/populate-ingredient-slugs.ts
```

Generates URL-friendly slugs for all existing ingredients.

**Slug Generation Rules:**
- Lowercase and trim
- Replace `&` with "and"
- Remove parentheses and brackets
- Replace spaces and special characters with hyphens
- Remove leading/trailing hyphens
- Replace multiple hyphens with single hyphen

**Examples:**
- "Green Onion" → "green-onion"
- "Tomatoes (Cherry)" → "tomatoes-cherry"
- "Salt & Pepper" → "salt-and-pepper"

### 3. Fix Duplicate Slugs

**Script:** `scripts/fix-duplicate-slugs.ts`

```bash
pnpm tsx scripts/fix-duplicate-slugs.ts
```

Finds and fixes duplicate slugs by appending numeric suffixes.

**Example:**
- First instance: "extra-virgin-olive-oil"
- Second instance: "extra-virgin-olive-oil-2"
- Third instance: "extra-virgin-olive-oil-3"

### 4. Add Unique Constraint

**Script:** `scripts/add-slug-unique-constraint.ts`

```bash
pnpm tsx scripts/add-slug-unique-constraint.ts
```

Adds unique constraint to `slug` column after all slugs are populated and duplicates resolved.

---

## Usage Examples

### Adding a New Ingredient with Full Details

```typescript
import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';

await db.insert(ingredients).values({
  name: 'carrots',
  display_name: 'Carrots',
  slug: 'carrots',
  category: 'vegetables',
  description: 'Root vegetable, naturally sweet and crunchy. Rich in beta-carotene.',
  storage_tips: 'Store submerged horizontally in water in fridge. Remove tops immediately.',
  substitutions: JSON.stringify(['Parsnips', 'Sweet potatoes']),
  image_url: 'https://example.com/carrots.jpg',
  is_common: true,
  is_allergen: false,
  typical_unit: 'piece',
  usage_count: 0,
});
```

### Adding Joanie's Comment to an Ingredient

```typescript
import { createComment } from '@/app/actions/joanie-comments';

await createComment({
  ingredient_id: 'uuid-of-carrots-ingredient',
  comment_text: 'Never buy baby carrots (they\'re carved mature carrots, dry out fast, disgusting). Remove tops immediately, wash and peel before storing.',
  comment_type: 'tip',
});
```

### Fetching Ingredient with All Related Data

```typescript
import { getIngredientBySlug } from '@/app/actions/ingredients';

const result = await getIngredientBySlug('carrots');

if (result.success && result.ingredient) {
  console.log('Ingredient:', result.ingredient.display_name);
  console.log('Joanie says:', result.joanieComment?.comment_text);
  console.log('Used in recipes:', result.recipesUsingIngredient?.length);
}
```

---

## Image Management

### Current Approach
- `image_url` field stores external image URLs
- Supports URLs from:
  - Unsplash API
  - Pexels API
  - Direct uploads (future)
  - CDN links

### Image Requirements
- **Format**: JPG, PNG, WebP
- **Aspect Ratio**: 1:1 (square) preferred
- **Resolution**: Minimum 400x400px
- **Size**: Maximum 500KB per image

### Fallback Behavior
- If no `image_url`, displays `Package` icon
- Graceful degradation for broken URLs
- Next.js Image component for optimization

---

## Integration with Existing Features

### Fridge Search
- Ingredient detail pages include "Find Recipes" button
- Links to `/fridge?ingredient={name}`
- Pre-fills fridge search with ingredient

### Recipe Pages
- Recipe ingredient lists can link to ingredient detail pages
- Future enhancement: Clickable ingredients

### Joanie Comments
- Shared component used across:
  - Recipe pages
  - Meal pages
  - Ingredient pages (NEW)

---

## Future Enhancements

### Phase 1 (Immediate)
- [ ] Bulk image upload for popular ingredients
- [ ] Admin interface for editing ingredient details
- [ ] Ingredient aliases autocomplete

### Phase 2 (Medium-term)
- [ ] Seasonal availability indicators
- [ ] Price tracking (optional)
- [ ] Nutritional information panel
- [ ] User-submitted storage tips

### Phase 3 (Long-term)
- [ ] Ingredient substitution calculator
- [ ] Shopping list integration
- [ ] Local availability checker
- [ ] Ingredient pairing suggestions

---

## Performance Considerations

### Caching
- Category list cached (rarely changes)
- Popular ingredients cached (updates weekly)
- Individual ingredient pages: Server-side rendering (SSR)

### Database Indexes
- Slug lookup: Indexed for fast page loads
- Category filter: Indexed for quick filtering
- Search: Trigram indexes for fuzzy matching

### Image Optimization
- Next.js Image component with lazy loading
- Responsive image sizes for different devices
- WebP format with fallbacks

---

## Accessibility

### Keyboard Navigation
- All interactive elements keyboard-accessible
- Skip links for filter controls
- Focus management on modal close

### Screen Readers
- Semantic HTML structure
- ARIA labels on icon-only buttons
- Alt text for all images
- Clear heading hierarchy

### Color Contrast
- WCAG AA compliance
- Dark mode support
- High contrast mode compatible

---

## Testing Checklist

### Manual Testing
- [ ] Ingredients list page loads with all categories
- [ ] Search functionality works (by name, aliases)
- [ ] Category filtering updates results
- [ ] Sort options change order correctly
- [ ] Individual ingredient pages load
- [ ] Joanie comments display properly
- [ ] Recipe links work from ingredient pages
- [ ] "Find Recipes" button navigates correctly
- [ ] Mobile responsive layout works
- [ ] Dark mode styling is correct

### Database Testing
- [ ] All slugs are unique
- [ ] No null slugs in production
- [ ] Duplicate ingredient names handled
- [ ] Category standardization

### Performance Testing
- [ ] Page load time < 2 seconds
- [ ] Search debouncing works (500ms)
- [ ] Image lazy loading functional
- [ ] Filter changes are instant

---

## Troubleshooting

### Issue: Duplicate slug error

**Symptom:** Database error when adding unique constraint

**Solution:**
```bash
pnpm tsx scripts/fix-duplicate-slugs.ts
pnpm tsx scripts/add-slug-unique-constraint.ts
```

### Issue: Ingredient images not loading

**Symptom:** Broken image icons

**Possible causes:**
- Invalid `image_url`
- CORS issues with external images
- Network connectivity

**Solution:**
- Verify `image_url` is valid and accessible
- Use proxy for external images if needed
- Fallback to placeholder icon

### Issue: Joanie comment not appearing

**Symptom:** Comment section not visible on ingredient page

**Debugging:**
1. Check if `ingredient_id` is correct in `joanie_comments` table
2. Verify `getCommentForIngredient()` returns data
3. Check JoanieComment component props

---

## Support

For questions or issues with the Ingredients feature:

1. Check this documentation first
2. Review migration scripts in `/scripts`
3. Check database schema in `src/lib/db/ingredients-schema.ts`
4. Review server actions in `src/app/actions/ingredients.ts`

---

**Built with love by Joanie's Kitchen team** 🥕
