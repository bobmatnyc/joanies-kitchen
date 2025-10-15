# Top 50 Recipes Feature - Implementation Guide

**Version**: 0.4.0
**Status**: ✅ COMPLETED
**Last Updated**: 2025-10-15

---

## Overview

The Top 50 Recipes feature showcases the highest-rated recipes in Joanie's Kitchen, providing users with a curated view of the best recipes based on AI system ratings and user ratings.

## Features Implemented

### ✅ 1. Top 50 Recipes Page (`/recipes/top-50`)

**File**: `src/app/recipes/top-50/page.tsx`

**Features**:
- Hero section with Trophy icon and gradient background
- Stats bar showing:
  - Number of top recipes
  - Average rating
  - Total recipes in database (400K+)
- Grid layout (1-4 columns responsive)
- Rank badges (1-50) on recipe cards
- Empty state handling
- CTA section encouraging users to rate recipes
- SEO-optimized metadata

**Design**:
- Follows Joanie's Kitchen branding
- Uses color palette: jk-olive, jk-clay, jk-tomato, jk-sage, jk-linen
- Typography: Playfair Display (headings), Lora (body), Inter (UI)
- Fully responsive mobile-first design

---

### ✅ 2. Server Action: `getTopRatedRecipes()`

**File**: `src/app/actions/recipes.ts`

**Function Signature**:
```typescript
export async function getTopRatedRecipes({
  limit = 50
}: {
  limit?: number
} = {})
```

**Features**:
- Fetches public recipes with ratings
- Combines system ratings (`systemRating`) and user ratings (`avgUserRating`)
- Advanced sorting logic:
  1. **Both ratings exist**: Uses average of both
  2. **Only system rating**: Uses system rating
  3. **Only user rating**: Uses user rating
- Falls back to `createdAt` for tiebreakers
- Configurable limit (default: 50)
- Error handling with empty array fallback

**SQL Query Logic**:
```sql
COALESCE(
  (COALESCE(systemRating, 0) + COALESCE(avgUserRating, 0)) /
  NULLIF(
    (CASE WHEN systemRating IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN avgUserRating IS NOT NULL THEN 1 ELSE 0 END),
    0
  ),
  COALESCE(systemRating, avgUserRating, 0)
) DESC
```

---

### ✅ 3. Enhanced RecipeCard Component

**File**: `src/components/recipe/RecipeCard.tsx`

**New Props**:
- `showRank?: number` - Displays rank badge (1-50)

**New Features**:
- **Rank Badge**: Circular badge with ranking number (top-left corner)
  - Red background (`jk-tomato`)
  - White text
  - Absolute positioning with shadow
- **Top Rated Badge**: Star icon with "Top Rated" text
  - Shown when rating ≥ 4.5 stars
  - Only displayed if `showRank` is not set (no duplication)
  - Positioned top-right corner
- **Rating Calculation**: Checks both `systemRating` and `avgUserRating`

**Badge Logic**:
```typescript
const systemRating = parseFloat(recipe.systemRating || '0') || 0;
const userRating = parseFloat(recipe.avgUserRating || '0') || 0;
const isTopRated = systemRating >= 4.5 || userRating >= 4.5;
```

---

### ✅ 4. Navigation Link

**File**: `src/app/layout.tsx`

**Added**:
- Navigation link to `/recipes/top-50` in main header
- Trophy icon (`lucide-react`)
- Label: "Top 50"
- Positioned between "My Recipes" and "Shared"
- Follows existing navigation button styling

---

### ✅ 5. Homepage Top Recipes Preview

**File**: `src/app/page.tsx`

**Section**: "Top-Rated Recipes"

**Features**:
- Fetches top 8 recipes using `getTopRatedRecipes({ limit: 8 })`
- Trophy icon header
- 4-column grid (responsive: 1 col mobile → 2 → 4)
- Shows rank badges (1-8)
- "View All Top 50 Recipes" CTA button
- Conditional rendering (only shows if recipes exist)
- Positioned before "About Joanie" section

**Design Elements**:
- Decorative divider (`jk-divider`)
- Centered heading and description
- Button with ChevronRight icon
- Links to `/recipes/top-50` page

---

### ✅ 6. Recipe Filtering System

**File**: `src/components/recipe/RecipeFilters.tsx`

**Existing Feature** (no changes needed):
- Minimum Rating filter already supports:
  - 4.5+ Stars (Top Rated)
  - 4.0+ Stars
  - 3.5+ Stars
  - 3.0+ Stars
- URL parameter: `?minRating=4.5`
- Works with existing `getRecipesPaginated()` function

**Usage**:
Users can filter for top-rated recipes on any page using RecipeFilters by selecting "4.5+ Stars" from the Minimum Rating dropdown.

---

## Database Schema

The feature relies on existing schema fields in the `recipes` table:

```typescript
// Rating fields (already exist)
systemRating: decimal('system_rating', { precision: 2, scale: 1 })
avgUserRating: decimal('avg_user_rating', { precision: 2, scale: 1 })
totalUserRatings: integer('total_user_ratings').default(0)
isPublic: boolean('is_public').default(false)

// Indexes for performance
ratingIdx: index('idx_recipes_rating').on(
  table.systemRating.desc(),
  table.avgUserRating.desc()
)
```

**No schema changes required** - all necessary fields already exist.

---

## User Flow

1. **Homepage**:
   - User sees preview of top 8 recipes
   - Clicks "View All Top 50 Recipes" → navigates to `/recipes/top-50`

2. **Navigation**:
   - User clicks "Top 50" in header → navigates to `/recipes/top-50`

3. **Top 50 Page**:
   - Views all top 50 recipes with rankings
   - Sees stats (count, avg rating, total recipes)
   - Clicks recipe card → views recipe details
   - Clicks "Browse All Recipes" → navigates to `/shared`

4. **Filtering** (any recipe page):
   - Selects "4.5+ Stars" filter → sees only top-rated recipes

---

## Performance Considerations

### Query Optimization

- **Index Usage**: Query leverages `idx_recipes_rating` for fast sorting
- **LIMIT Clause**: Returns only top 50 (or specified limit)
- **Public Filter**: Uses `idx_recipes_public_system` index
- **No N+1 Queries**: Single database query per page

### Caching Strategy

- Server components with static rendering (where possible)
- Next.js automatic caching for `/recipes/top-50` route
- Revalidation on recipe creation/update via `revalidatePath()`

### Loading Performance

- **Homepage**: Fetches only top 8 (minimal data)
- **Top 50 Page**: Single query for 50 recipes
- **Image Loading**: Lazy loading with `loading="lazy"`
- **Recipe Card**: Optimized rendering with minimal re-renders

---

## Testing Checklist

### ✅ Page Rendering
- [x] `/recipes/top-50` page loads without errors
- [x] Hero section displays correctly
- [x] Stats bar shows accurate data
- [x] Empty state displays when no recipes

### ✅ Recipe Display
- [x] Rank badges (1-50) display correctly
- [x] Recipe cards render properly
- [x] Images load with fallback handling
- [x] Grid layout is responsive

### ✅ Navigation
- [x] "Top 50" link appears in header
- [x] Link navigates to correct page
- [x] Homepage preview links to `/recipes/top-50`

### ✅ Rating Logic
- [x] Recipes sorted by combined ratings
- [x] System-only ratings handled
- [x] User-only ratings handled
- [x] Both ratings averaged correctly

### ✅ UI/UX
- [x] Mobile responsive design
- [x] Branding consistency
- [x] Typography follows design system
- [x] Colors match Joanie's Kitchen palette

---

## File Summary

### New Files
1. `/src/app/recipes/top-50/page.tsx` - Top 50 recipes page

### Modified Files
1. `/src/app/actions/recipes.ts` - Added `getTopRatedRecipes()`
2. `/src/components/recipe/RecipeCard.tsx` - Added rank badge + top-rated badge
3. `/src/app/layout.tsx` - Added navigation link
4. `/src/app/page.tsx` - Added top recipes preview section

### Documentation
1. `/docs/guides/TOP_50_RECIPES_FEATURE.md` (this file)

---

## Success Criteria (All Met ✅)

- ✅ `/recipes/top-50` page created and accessible
- ✅ Top 50 recipes queried with proper sorting (system + user ratings)
- ✅ Rank badges displayed (1-50)
- ✅ Hero section with Trophy icon
- ✅ Stats bar showing aggregate data
- ✅ Navigation link added to main menu
- ✅ Homepage preview section (top 8 recipes)
- ✅ "Top Rated" badge on recipe cards (4.5+ rating)
- ✅ Filter option for top-rated recipes (existing)
- ✅ Mobile responsive design
- ✅ Joanie's Kitchen branding maintained

---

## Future Enhancements

### Potential Improvements
- [ ] Add pagination for Top 100, Top 200, etc.
- [ ] Weekly/monthly top recipes (trending)
- [ ] Category-specific top recipes (e.g., "Top Desserts")
- [ ] User-curated lists
- [ ] Social sharing for top recipes
- [ ] Downloadable "Top 50 Cookbook" PDF

### Analytics
- [ ] Track views on top-rated recipes
- [ ] Measure conversion from homepage preview
- [ ] A/B test ranking algorithm variations

---

## Troubleshooting

### Issue: Recipes not showing
**Cause**: No recipes with ratings in database
**Solution**: Ensure recipes have `systemRating` or `avgUserRating` values

### Issue: Incorrect sorting
**Cause**: Rating fields are NULL
**Solution**: Verify database has rating data; check SQL COALESCE logic

### Issue: Rank badges not visible
**Cause**: Z-index or positioning issue
**Solution**: Check `absolute` positioning and `z-10` class on badge

### Issue: Empty stats bar
**Cause**: No recipes returned
**Solution**: Check database query filters (isPublic = true)

---

## Code Examples

### Using getTopRatedRecipes in other pages

```typescript
import { getTopRatedRecipes } from '@/app/actions/recipes';

export default async function MyPage() {
  const topRecipes = await getTopRatedRecipes({ limit: 10 });

  return (
    <div>
      {topRecipes.map((recipe, index) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          showRank={index + 1}
        />
      ))}
    </div>
  );
}
```

### Filtering for top-rated recipes programmatically

```typescript
import { getRecipesPaginated } from '@/app/actions/recipes';

const result = await getRecipesPaginated({
  page: 1,
  limit: 24,
  filters: { minRating: 4.5 },
  sort: 'rating',
});
```

---

## Related Documentation

- [Project Organization](/docs/reference/PROJECT_ORGANIZATION.md)
- [Recipe Schema](/src/lib/db/schema.ts)
- [Server Actions](/src/app/actions/recipes.ts)
- [Recipe Rating System](/RECIPE_RATING_SYSTEM.md)

---

**Implementation Status**: ✅ COMPLETE
**Ready for Production**: YES
**Breaking Changes**: NONE
