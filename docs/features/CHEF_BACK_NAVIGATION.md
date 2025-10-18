# Chef Page Back Navigation

**Status**: ✅ Implemented
**Date**: 2025-10-18
**Version**: 0.45.0

## Overview

Users can now navigate back to a chef's page when viewing a recipe that they accessed from a chef profile page. This improves navigation flow and makes it easier to browse multiple recipes from the same chef.

## Implementation Summary

### User Experience

1. **From Chef Page**: When a user clicks on a recipe from a chef's page (e.g., `/chef/lidia-bastianich`), the recipe URL includes a `from` parameter
2. **Recipe Detail Page**: The recipe page detects this parameter and shows "Back to [Chef Name]'s Recipes" instead of the generic "Back to Recipes" link
3. **Navigation**: Clicking the back link returns the user to the chef's profile page

### Technical Implementation

#### 1. URL Parameter Tracking

Recipe links from chef pages include the chef slug as a URL parameter:
- **Format**: `/recipes/[slug]?from=chef/[chef-slug]`
- **Example**: `/recipes/pasta-primavera?from=chef/lidia-bastianich`

#### 2. Components Modified

**`RecipeCard.tsx`** - Updated to accept and use `fromChefSlug` prop:
```typescript
interface RecipeCardProps {
  recipe: Recipe;
  // ... other props
  fromChefSlug?: string; // New prop
}

// URL construction now includes chef slug when provided
let recipeUrl = recipe.slug ? `/recipes/${recipe.slug}` : `/recipes/${recipe.id}`;
if (fromChefSlug) {
  recipeUrl += `?from=chef/${fromChefSlug}`;
}
```

**`RecipeList.tsx`** - Passes `fromChefSlug` to individual recipe cards:
```typescript
interface RecipeListProps {
  recipes: Recipe[];
  onRecipeDeleted?: () => void;
  fromChefSlug?: string; // New prop
}

// Passes prop to each card
<RecipeCard key={recipe.id} recipe={recipe} fromChefSlug={fromChefSlug} />
```

**`BackToChef.tsx`** - New component for chef navigation:
```typescript
export function BackToChef({ chefSlug }: BackToChefProps) {
  // Fetches chef name from server
  // Displays "Back to [Chef Name]'s Recipes" link
  // Returns to /chef/[chefSlug]
}
```

**`/chef/[slug]/page.tsx`** - Chef page passes slug to RecipeList:
```typescript
<RecipeList recipes={recipes} fromChefSlug={slug} />
```

**`/recipes/[slug]/page.tsx`** - Recipe detail page shows appropriate back navigation:
```typescript
const searchParams = useSearchParams();
const fromParam = searchParams.get('from');
const chefSlug = fromParam?.startsWith('chef/') ? fromParam.replace('chef/', '') : null;

// Render logic
{chefSlug ? (
  <BackToChef chefSlug={chefSlug} />
) : (
  <Link href="/recipes">Back to Recipes</Link>
)}
```

#### 3. Files Changed

- ✅ `src/components/recipe/RecipeCard.tsx` - Add `fromChefSlug` prop
- ✅ `src/components/recipe/RecipeList.tsx` - Pass through `fromChefSlug` prop
- ✅ `src/components/recipe/BackToChef.tsx` - New component (created)
- ✅ `src/app/chef/[slug]/page.tsx` - Pass chef slug to RecipeList
- ✅ `src/app/recipes/[slug]/page.tsx` - Show BackToChef when appropriate

## Mobile-Friendly Design

The back navigation links meet mobile parity requirements:

- **Touch Target Size**: 44x44px minimum (uses padding to expand clickable area)
- **Visual Feedback**: Hover states with background color change
- **Accessibility**: ARIA labels for screen readers
- **Typography**: Uses appropriate text sizing for mobile devices

## Edge Cases Handled

1. **Missing Chef Data**: If chef lookup fails, BackToChef component renders nothing
2. **Invalid URL Parameter**: Only parameters starting with `chef/` are processed
3. **Direct Navigation**: Users who navigate directly to recipes see "Back to Recipes" as before
4. **Private Recipes**: Auth-required page also shows BackToChef when appropriate

## Testing Recommendations

### Manual Testing

1. **Happy Path**:
   - Navigate to `/chef/lidia-bastianich`
   - Click on a recipe
   - Verify URL includes `?from=chef/lidia-bastianich`
   - Verify "Back to Lidia Bastianich's Recipes" is shown
   - Click back link and verify return to chef page

2. **Direct Navigation**:
   - Navigate directly to `/recipes/[slug]`
   - Verify "Back to Recipes" is shown (no chef context)

3. **Multiple Chefs**:
   - Test with different chef slugs
   - Verify each chef's name is correctly displayed

4. **Mobile**:
   - Test touch targets on mobile device
   - Verify responsive layout works correctly

### Automated Testing (Recommended)

```typescript
// E2E test example
test('navigates back to chef page from recipe', async ({ page }) => {
  await page.goto('/chef/lidia-bastianich');
  await page.click('[data-testid="recipe-card"]').first();

  // Verify URL includes from parameter
  await expect(page).toHaveURL(/from=chef\/lidia-bastianich/);

  // Verify back link text
  await expect(page.getByText(/Back to.*Lidia Bastianich.*Recipes/i)).toBeVisible();

  // Click back and verify return to chef page
  await page.click('text=Back to');
  await expect(page).toHaveURL('/chef/lidia-bastianich');
});
```

## Benefits

1. **Improved UX**: Users can easily return to browsing a specific chef's recipes
2. **Reduced Clicks**: No need to use browser back button or navigate through menus
3. **Context Preservation**: Maintains the user's browsing context
4. **Mobile-Friendly**: Meets touch target size requirements
5. **Backwards Compatible**: Does not affect existing recipe navigation flows

## Future Enhancements

Potential improvements for future versions:

1. **Scroll Position**: Preserve scroll position when returning to chef page
2. **Breadcrumb Trail**: Show full path (Home > Chefs > [Chef Name] > [Recipe])
3. **History API**: Use browser history state to avoid URL parameters
4. **Recipe Filtering**: Return to chef page with previous filter state
5. **Analytics**: Track chef-to-recipe navigation patterns

## Related Features

- Chef Profile Pages (`/chef/[slug]`)
- Recipe Detail Pages (`/recipes/[slug]`)
- RecipeCard Component
- RecipeList Component

## References

- Feature Request: "Add back navigation from recipe pages to chef pages"
- Mobile Parity Requirements: `docs/guides/MOBILE_PARITY_REQUIREMENTS.md`
- Project Organization: `docs/reference/PROJECT_ORGANIZATION.md`
