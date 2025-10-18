# Meal Builder AI Enhancements

**Implementation Date**: October 17, 2025
**Version**: 0.4.1

## Overview

Enhanced the meal builder feature with AI-powered recipe suggestions, required description field, and tag selection to improve meal planning workflow.

## Changes Implemented

### 1. Database Schema Updates

**File**: `src/lib/db/meals-schema.ts`

- Added `tags` field to the `meals` table to store JSON array of meal tags
- Field type: `text` (stores JSON string)
- Example: `["Family Dinner", "Healthy", "Quick Weeknight"]`

**Migration**: Applied via `scripts/add-tags-to-meals.ts`

### 2. Validation Schema Updates

**File**: `src/lib/meals/validation.ts`

- Updated `createMealSchema` to make `description` required (changed from optional)
- Added `tags` field validation (optional JSON string)
- Ensures meal descriptions are always provided for better AI suggestions

### 3. Meal Form Fields Component

**File**: `src/components/meals/MealFormFields.tsx`

#### New Features:
- **Required Description**: Changed from "Description (Optional)" to "Description *"
- **Tag Selection**: Added multi-select checkboxes for predefined tags
- **Predefined Tags**:
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

#### UI Layout:
- Tags displayed in responsive grid (2 cols mobile, 3 cols tablet, 5 cols desktop)
- Checkbox-based selection with label click support
- Mobile-friendly spacing and touch targets

### 4. AI Recipe Suggestions Component

**File**: `src/components/meals/AiRecipeSuggestions.tsx` (NEW)

#### Features:
- **Automatic Suggestions**: Fetches recipe suggestions based on meal description + tags
- **Debounced Search**: 800ms debounce to avoid excessive API calls
- **Course-Specific Suggestions**:
  - Appetizers: 3 suggestions
  - Main/Entrees: 3 suggestions
  - Sides: 4 suggestions
  - Desserts: 3 suggestions

#### UI Components:
- **Expandable Sections**: Click to expand/collapse course categories
- **Recipe Cards**: Display image, name, description, prep/cook time
- **Quick Add**: One-click button to add recipe to meal with correct course
- **Refresh Button**: Manually fetch new suggestions
- **Loading States**: Spinner while fetching recipes

#### Technical Implementation:
- Uses `semanticSearchRecipes` from semantic search actions
- Builds search query: `{description} {tags} {course-specific-keyword}`
- Minimum similarity threshold: 0.4
- Includes user's private recipes in suggestions
- React.memo for performance optimization

### 5. Meal Builder Integration

**File**: `src/components/meals/MealBuilder.tsx`

#### Updates:
- Added `tags` state management
- Updated form submission to include tags (stored as JSON)
- Added description validation (required field check)
- Integrated `AiRecipeSuggestions` component between form fields and selected recipes
- Updated button disabled state to check description

#### Workflow:
1. User fills in meal name, description (required), type, serves, occasion, tags
2. AI automatically suggests recipes based on description + tags
3. User can:
   - Accept AI-suggested recipes (click "Add")
   - Refresh suggestions
   - Use manual search dialog
   - Remove/adjust any recipes

## Technical Details

### Search Query Generation

For each course category, the AI builds a query like:
```
"{description} {tag1} {tag2} {tag3} appetizer starter"
"{description} {tag1} {tag2} {tag3} main dish entree"
"{description} {tag1} {tag2} {tag3} side dish"
"{description} {tag1} {tag2} {tag3} dessert sweet"
```

### Performance Optimizations

1. **Debouncing**: 800ms delay before fetching suggestions
2. **React.memo**: Memoized components to prevent unnecessary re-renders
3. **Parallel Fetching**: All course categories fetched simultaneously with Promise.all
4. **Caching**: Semantic search uses built-in cache system

### Mobile Responsiveness

- Tag grid: 2 columns on mobile, 3 on tablet, 5 on desktop
- Recipe cards: 1 column on mobile, 2 on tablet, 3 on desktop
- Touch-friendly 44x44px minimum button sizes
- Collapsible sections to reduce scroll on mobile

## Usage Example

### Creating a Meal with AI Suggestions

1. **Navigate to**: `/meals/new`

2. **Fill in details**:
   - Name: "Sunday Family Dinner"
   - Description: "Cozy comfort food meal for the whole family"
   - Type: Dinner
   - Serves: 6
   - Tags: Select "Family Dinner", "Comfort Food"

3. **AI Suggestions appear automatically**:
   - Appetizers: Caesar Salad, Bruschetta, Soup of the Day
   - Mains: Roasted Chicken, Beef Stew
   - Sides: Mashed Potatoes, Green Beans, Dinner Rolls
   - Desserts: Apple Pie, Chocolate Cake

4. **Add recipes**:
   - Click "Add" on desired recipes
   - Recipes automatically categorized by course
   - Adjust serving multipliers if needed

5. **Submit**: Create meal with all selected recipes

## Future Enhancements

Potential improvements for future versions:

1. **AI-Powered Meal Generation**: Generate entire meal plans from description
2. **Smart Pairing**: Suggest complementary recipes based on existing selections
3. **Dietary Filters**: Filter suggestions by dietary restrictions
4. **Seasonal Recommendations**: Prioritize seasonal recipes
5. **User Preferences**: Learn from past meal selections
6. **Custom Tags**: Allow users to create custom tags
7. **Tag-Based Templates**: Save tag combinations as meal templates

## API Integration

### Semantic Search Action

```typescript
semanticSearchRecipes(query: string, options: {
  limit: number,
  minSimilarity: number,
  includePrivate: boolean
})
```

### Course-Specific Limits

```typescript
const COURSE_LIMITS = {
  appetizer: 3,
  main: 3,
  side: 4,
  dessert: 3,
}
```

## Testing Checklist

- [x] Tags can be selected and deselected
- [x] Description is required for form submission
- [x] AI suggestions appear after description is entered
- [x] Suggestions update when description/tags change (debounced)
- [x] Recipes can be added from suggestions
- [x] Recipes are correctly categorized by course
- [x] Refresh button fetches new suggestions
- [x] Loading states display correctly
- [x] Empty states work when no suggestions found
- [x] Mobile layout is responsive
- [x] Tags are saved to database as JSON
- [x] Meal creation includes tags

## Files Modified

1. `src/lib/db/meals-schema.ts` - Added tags field
2. `src/lib/meals/validation.ts` - Updated validation
3. `src/components/meals/MealFormFields.tsx` - Added tags UI
4. `src/components/meals/AiRecipeSuggestions.tsx` - NEW component
5. `src/components/meals/MealBuilder.tsx` - Integration
6. `scripts/add-tags-to-meals.ts` - NEW migration script

## Dependencies

- Existing semantic search functionality
- Recipe embeddings and vector search
- shadcn/ui components (Card, Button, Badge, Checkbox)
- Next.js App Router and Server Actions
- React 19 features (memo, useCallback, useState)

## Migration Notes

The `tags` column was added to the `meals` table using a direct SQL migration script to avoid interactive prompts in the drizzle-kit push command.

To verify the migration:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meals' AND column_name = 'tags';
```

## Success Metrics

- ✅ Description now required (prevents empty meal descriptions)
- ✅ Tags provide context for AI suggestions
- ✅ AI suggestions reduce time to build meals
- ✅ Course-appropriate suggestions improve meal balance
- ✅ Mobile-friendly interface maintains usability
- ✅ All features work with existing authentication and database systems

## Related Documentation

- `docs/guides/MOBILE_PARITY_REQUIREMENTS.md` - Mobile responsiveness guidelines
- `docs/guides/SEARCH_CACHE_GUIDE.md` - Semantic search caching
- `docs/developer/implementation/RANKING_SYSTEM_SUMMARY.md` - Recipe ranking algorithm
- `src/lib/meals/type-guards.ts` - Meal type validations
