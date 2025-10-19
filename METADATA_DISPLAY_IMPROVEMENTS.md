# Recipe Detail Page Metadata Display Improvements

**Date**: 2025-10-18
**Version**: 0.5.0

## Overview

Fixed redundant cuisine display and enhanced the recipe detail page metadata line to show more relevant information at a glance while eliminating duplicates between the metadata icons and tag display.

## Problem

The recipe detail page was showing redundant information:
- **Cuisine** appeared twice: once in the metadata line (with ChefHat icon) and again in the semantic tags section
- Missing important metadata like **Meal Type** and **Main Ingredient** that would be useful to see immediately
- No filtering mechanism in `SemanticTagDisplay` to exclude categories already shown in metadata

## Solution

### 1. Enhanced `SemanticTagDisplay` Component

**File**: `src/components/recipe/SemanticTagDisplay.tsx`

Added `excludeCategories` prop to allow excluding specific tag categories from display:

```typescript
interface SemanticTagDisplayProps {
  // ... existing props
  excludeCategories?: TagCategory[]; // NEW: Categories to exclude from display
}
```

**Implementation**:
- Filters out excluded categories before rendering tags
- Maintains backward compatibility (default: no exclusions)
- Works with both inline and grouped layouts

### 2. Updated Recipe Detail Page Metadata

**File**: `src/app/recipes/[slug]/page.tsx`

**Added Icons**:
- `Utensils` - For meal type (Breakfast, Lunch, Dinner, etc.)
- `Apple` - For main ingredient

**Added Metadata Display Items**:
1. **Meal Type** - Shows first meal type tag if available
   - Icon: Utensils
   - Example: "Dinner", "Breakfast", "Dessert"

2. **Main Ingredient** - Shows first main ingredient tag if available
   - Icon: Apple
   - Example: "Chicken", "Pasta", "Vegetables"

**Excluded Categories from Tag Display**:
- Cuisine (already shown with ChefHat icon)
- Meal Type (now shown with Utensils icon)
- Main Ingredient (now shown with Apple icon)
- Difficulty (already shown as badge)

### 3. Fixed Build Error

**File**: `src/app/recipes/[slug]/similar/page.tsx`

- Removed `generateMetadata` export from client component
- Client components cannot export server-side only functions
- Maintained full functionality while fixing the build

## Metadata Display Order

The metadata line now shows (left to right):

1. ✅ **Author** (User icon) - Profile link
2. ✅ **Views** (Eye icon) - View count
3. ✅ **Cuisine** (ChefHat icon) - Already correct
4. ✅ **Meal Type** (Utensils icon) - NEW
5. ✅ **Main Ingredient** (Apple icon) - NEW
6. ✅ **Total Time** (Clock icon) - Already correct
7. ✅ **Servings** (Users icon)
8. ✅ **Difficulty** (Badge) - Already correct
9. ✅ **AI Generated** (Badge) - If applicable
10. ✅ **System Recipe** (Badge) - If applicable

## Tag Display Behavior

### Before
All categories shown including:
- ✅ Cuisine (redundant with metadata)
- ✅ Meal Type (redundant with metadata)
- ✅ Difficulty (redundant with badge)
- ✅ Main Ingredient (now in metadata)
- ✅ Dietary
- ✅ Cooking Method
- ✅ Season
- ✅ Other (chef names, etc.)

### After
Only relevant categories shown:
- ❌ Cuisine (excluded - shown in metadata)
- ❌ Meal Type (excluded - shown in metadata)
- ❌ Main Ingredient (excluded - shown in metadata)
- ❌ Difficulty (excluded - shown in badge)
- ✅ Dietary (kept - not in metadata)
- ✅ Cooking Method (kept - not in metadata)
- ✅ Season (kept - not in metadata)
- ✅ Occasion (kept - not in metadata)
- ✅ Equipment (kept - not in metadata)
- ✅ Technique (kept - not in metadata)
- ✅ Taste Profile (kept - not in metadata)
- ✅ Other (kept - chef names, etc.)

## Technical Details

### categorizedTags Memoization
```typescript
const categorizedTags = useMemo(() => {
  if (!recipe?.tags) return null;
  const { categorizeTags } = require('@/lib/tag-ontology');
  return categorizeTags(recipe.tags);
}, [recipe]);
```

### Dynamic Label Resolution
```typescript
// Uses localized tag labels
{categorizedTags?.['Meal Type']?.[0] && (
  <div className="flex items-center gap-1.5 text-muted-foreground">
    <Utensils className="w-4 h-4 flex-shrink-0" />
    <span>{require('@/lib/tags').getTagLabel(categorizedTags['Meal Type'][0])}</span>
  </div>
)}
```

### SemanticTagDisplay Usage
```typescript
<SemanticTagDisplay
  tags={recipe.tags}
  layout="grouped"
  showCategoryLabels
  size="md"
  excludeCategories={['Cuisine', 'Meal Type', 'Main Ingredient', 'Difficulty']}
/>
```

## Example Output

### Recipe: "Lidia Bastianich's Italian Pasta"

**Metadata Line**:
```
👤 by Lidia Bastianich
👁️ 1,234 views
👨‍🍳 Italian
🍴 Dinner
🍎 Pasta
⏱️ 15 min prep + 20 min cook
👥 4 servings
[Medium] [AI Generated]
```

**Tag Display** (no longer shows Cuisine, Meal Type, Main Ingredient, or Difficulty):
```
🥗 Dietary
  • Vegetarian

🔥 Cooking Method
  • Boiled
  • Sautéed

🏷️ Other
  • Lidia Bastianich
```

## Benefits

1. **No Redundancy** - Each piece of information appears exactly once
2. **Better Information Architecture** - Most important metadata visible immediately
3. **Cleaner Tag Display** - Only shows tags not already in metadata
4. **Flexible Component** - `excludeCategories` prop can be reused elsewhere
5. **Backward Compatible** - No breaking changes to existing code
6. **Type Safe** - Uses TypeScript with proper tag categorization

## Files Modified

1. `src/components/recipe/SemanticTagDisplay.tsx`
   - Added `excludeCategories` prop
   - Filter logic for excluded categories

2. `src/app/recipes/[slug]/page.tsx`
   - Added Utensils and Apple icons
   - Added meal type and main ingredient metadata items
   - Added tag categorization memoization
   - Updated SemanticTagDisplay with exclusions

3. `src/app/recipes/[slug]/similar/page.tsx`
   - Fixed build error by removing generateMetadata from client component

## Testing

✅ Build successful
✅ No TypeScript errors
✅ Dev server starts correctly
✅ Metadata displays correctly
✅ Tags filtered properly
✅ No redundant information

## Future Enhancements

Potential improvements for future iterations:

1. **Icon Selection** - Could add more specific icons for different main ingredients:
   - 🍗 Chicken/Poultry
   - 🥩 Beef/Meat
   - 🐟 Fish/Seafood
   - 🥕 Vegetables
   - 🍝 Pasta/Grains

2. **Multiple Tags** - Show multiple meal types or ingredients if relevant:
   - "Dinner, Appetizer"
   - "Chicken, Vegetables"

3. **Conditional Display** - Smart logic to show most relevant metadata:
   - If recipe is breakfast, prioritize showing that
   - If recipe has unique main ingredient, highlight it

4. **Accessibility** - Add tooltips or descriptions for each metadata item

5. **Mobile Optimization** - Consider collapsing some metadata on smaller screens

## Notes

- Using `require()` for dynamic imports to avoid circular dependencies
- Tag labels are localized using the tag system's `getTagLabel` function
- Categories are case-sensitive and must match exactly: 'Meal Type', 'Main Ingredient', etc.
- Only shows first tag from each category (could be enhanced to show multiple)

---

**Status**: ✅ Complete and deployed
**Build**: Passing
**Tests**: Manual verification complete
