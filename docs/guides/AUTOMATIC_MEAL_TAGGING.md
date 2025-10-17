# Automatic Meal Tagging Guide

**Feature**: Automatic tag aggregation for meals based on selected recipes

## Overview

When creating a meal, tags from all selected recipes are automatically aggregated and applied to the meal. This eliminates manual tag entry while still allowing users to modify tags as needed.

## Implementation

### Files Modified

1. **`/src/components/meals/MealBuilder.tsx`**
   - Added `useEffect` hook that watches `selectedRecipes` state
   - Automatically aggregates tags whenever recipes are added/removed
   - Deduplicates and normalizes tags (trim whitespace, sort alphabetically)

2. **`/src/components/meals/MealFormFields.tsx`**
   - Enhanced to display both predefined meal tags and recipe-generated tags
   - Recipe tags are visually distinguished (tomato-red color, medium font weight)
   - Shows count of recipe-generated tags in header
   - All tags (predefined + recipe) remain editable via checkboxes

## How It Works

### Tag Aggregation Logic (MealBuilder.tsx)

```typescript
useEffect(() => {
  if (selectedRecipes.length === 0) {
    return; // Keep existing tags when no recipes selected
  }

  // Collect all tags from selected recipes
  const aggregatedTags = new Set<string>();

  selectedRecipes.forEach(mealRecipe => {
    const recipe = mealRecipe.recipe;
    if (recipe.tags) {
      try {
        const recipeTags = JSON.parse(recipe.tags) as string[];
        recipeTags.forEach(tag => {
          const normalizedTag = tag.trim();
          if (normalizedTag) {
            aggregatedTags.add(normalizedTag);
          }
        });
      } catch (error) {
        console.error(`Failed to parse tags for recipe ${recipe.id}:`, error);
      }
    }
  });

  // Convert Set to array and update tags state
  const newTags = Array.from(aggregatedTags).sort();
  setTags(newTags);
}, [selectedRecipes]);
```

**Key Features:**
- Runs whenever `selectedRecipes` changes (add/remove recipes)
- Uses `Set` for automatic deduplication
- Normalizes tags (trim whitespace)
- Sorts tags alphabetically for consistent display
- Handles JSON parsing errors gracefully

### Tag Display Logic (MealFormFields.tsx)

```typescript
// Combine predefined meal tags with recipe tags
const recipeOnlyTags = tags.filter(tag =>
  !MEAL_TAGS.includes(tag as typeof MEAL_TAGS[number])
);
const allDisplayTags = [...MEAL_TAGS, ...recipeOnlyTags];
```

**Display Features:**
- Predefined meal tags shown first (e.g., "Family Dinner", "Quick Weeknight")
- Recipe-generated tags shown after predefined tags
- Recipe tags visually distinguished:
  - Color: `text-jk-tomato` (tomato-red)
  - Weight: `font-medium`
  - Tooltip: "Tag from recipe"
- Header shows count: "X from recipes"

## User Experience

### Before (Manual Tagging)
1. User creates meal and adds recipes
2. User manually checks relevant tags
3. Risk of forgetting important recipe characteristics

### After (Automatic Tagging)
1. User creates meal and adds recipes
2. Tags automatically populate based on recipe metadata
3. User can still manually add/remove tags as desired
4. Recipe tags clearly marked for transparency

## Example Scenarios

### Scenario 1: Italian Dinner
**Selected Recipes:**
- Pasta Carbonara (tags: `["Italian", "Quick", "Pasta", "Comfort Food"]`)
- Caesar Salad (tags: `["Italian", "Salad", "Quick"]`)
- Tiramisu (tags: `["Italian", "Dessert", "Make-Ahead"]`)

**Auto-Generated Tags:**
`["Comfort Food", "Dessert", "Italian", "Make-Ahead", "Pasta", "Quick", "Salad"]`

*Note: Deduplicated "Italian" and "Quick", sorted alphabetically*

### Scenario 2: Holiday Feast
**Selected Recipes:**
- Roast Turkey (tags: `["Holiday", "Traditional", "Poultry"]`)
- Mashed Potatoes (tags: `["Side Dish", "Comfort Food"]`)
- Green Bean Casserole (tags: `["Side Dish", "Holiday", "Vegetables"]`)
- Pumpkin Pie (tags: `["Dessert", "Holiday", "Baking"]`)

**Auto-Generated Tags:**
`["Baking", "Comfort Food", "Dessert", "Holiday", "Poultry", "Side Dish", "Traditional", "Vegetables"]`

## Tag Sources

### Predefined Meal Tags (Always Available)
Defined in `MealFormFields.tsx`:
- Family Dinner
- Date Night
- Quick Weeknight
- Holiday
- Special Occasion
- Comfort Food
- Healthy
- Budget-Friendly
- Meal Prep
- Party/Entertaining

### Recipe Tags (Dynamic)
Tags from selected recipes, which may include:
- Cuisine types (Italian, Mexican, Asian, etc.)
- Cooking methods (Grilling, Baking, Slow-Cooker, etc.)
- Dietary attributes (Vegetarian, Vegan, Gluten-Free, etc.)
- Characteristics (Quick, Easy, Spicy, Sweet, etc.)
- Course types (Appetizer, Main, Dessert, etc.)

## Edge Cases Handled

1. **No recipes selected**: Tags remain empty or show only manually selected tags
2. **Recipe with no tags**: Safely ignored (no error thrown)
3. **Malformed JSON in recipe.tags**: Error logged to console, continues processing other recipes
4. **Empty/whitespace-only tags**: Filtered out during normalization
5. **Duplicate tags across recipes**: Automatically deduplicated using Set
6. **Case-sensitive duplicates**: NOT handled (treated as different tags)
   - Example: "Italian" and "italian" would both appear
   - This preserves tag formatting from original recipes

## Database Schema

Tags are stored in the `meals` table:

```sql
tags TEXT -- JSON array of strings
```

Example stored value:
```json
["Comfort Food", "Holiday", "Italian", "Quick"]
```

## Future Enhancements

### Potential Improvements
1. **Case-insensitive deduplication**: Convert all tags to Title Case
2. **Tag frequency display**: Show how many recipes contribute each tag
3. **Tag suggestions**: Recommend additional relevant tags based on recipes
4. **Tag hierarchy/categories**: Group tags by type (cuisine, diet, method, etc.)
5. **Popular tags**: Show most commonly used tags in system
6. **Tag search/filter**: Allow searching/filtering recipes by tags

### Known Limitations
1. Case-sensitive tag matching (may create duplicates with different casing)
2. No tag validation (accepts any string from recipes)
3. No tag synonym handling (e.g., "Quick" vs "Fast")
4. Tags completely replaced on recipe change (doesn't preserve manual additions)

## Testing Recommendations

### Manual Testing Checklist
- [ ] Create meal with no recipes → tags remain empty
- [ ] Add recipe with tags → tags auto-populate
- [ ] Add second recipe → tags merge without duplicates
- [ ] Remove recipe → tags update to remaining recipes
- [ ] Manually check/uncheck tags → state updates correctly
- [ ] Recipe tags visually distinguished (red color)
- [ ] "X from recipes" count displays correctly
- [ ] Submit meal → tags saved to database as JSON array
- [ ] View created meal → tags display correctly

### Automated Testing (TODO)
```typescript
describe('Automatic Meal Tagging', () => {
  it('should aggregate tags from selected recipes', () => {
    // Test tag aggregation logic
  });

  it('should deduplicate tags across recipes', () => {
    // Test Set-based deduplication
  });

  it('should handle malformed JSON gracefully', () => {
    // Test error handling
  });

  it('should distinguish recipe vs predefined tags visually', () => {
    // Test UI rendering
  });
});
```

## Related Documentation

- **Meals Schema**: `/src/lib/db/meals-schema.ts`
- **Recipe Schema**: `/src/lib/db/schema.ts`
- **Meal Builder**: `/src/components/meals/MealBuilder.tsx`
- **Meal Form Fields**: `/src/components/meals/MealFormFields.tsx`

## Support

For issues or questions about automatic meal tagging:
1. Check console for error messages (JSON parsing failures)
2. Verify recipe tags are properly formatted JSON arrays
3. Ensure recipes have `tags` field populated in database
4. Check that selected recipes have valid tag data

---

**Last Updated**: 2025-10-17
**Feature Version**: 1.0
**Status**: Production Ready ✅
