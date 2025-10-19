# RecipeCard Tag Display Improvements

**Date**: 2025-10-19
**Component**: `src/components/recipe/RecipeCard.tsx`
**Status**: ✅ Complete

## Summary

Improved the RecipeCard component to optimize tag display hierarchy and remove unnecessary visual elements (rank bubble).

## Changes Implemented

### 1. ✅ Removed Rank Bubble Display

**Before**:
```typescript
{showRank && (
  <div className="absolute -top-3 -left-3 z-10 bg-jk-tomato text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg font-heading">
    {showRank}
  </div>
)}
```

**After**:
- Completely removed rank bubble rendering
- Removed `!showRank` condition from top-rated star badge
- Rank bubbles no longer appear on Top 50 page or anywhere else

**Rationale**: The rank bubble was cluttering the card design and wasn't providing significant value. The position on the page (grid order) already indicates ranking.

---

### 2. ✅ Excluded Cuisine from Tag Badges

**Before**:
```typescript
const primaryTags = [
  ...(categorizedTags.Difficulty || []),
  ...(categorizedTags.Cuisine || []),
].filter(Boolean);
```

**After**:
```typescript
const primaryTags = [
  ...(categorizedTags['Main Ingredient'] || []).slice(0, 2),  // Up to 2 main ingredients
  ...(categorizedTags.Dietary || []).slice(0, 1),             // 1 dietary preference
].filter(Boolean).slice(0, 3); // Max 3 primary tags
```

**Rationale**: Cuisine is already displayed prominently at the bottom of the card with a chef hat icon. Showing it again in the tags was redundant.

---

### 3. ✅ Updated Tag Priority Hierarchy

**New Priority Order**:
1. **Main Ingredient** (e.g., "Chicken", "Beef", "Seafood") - Up to 2 tags
2. **Dietary Preferences** (e.g., "Vegan", "Gluten-Free", "Keto") - 1 tag
3. **Meal Type** (e.g., "Breakfast", "Dinner", "Snack")
4. **Cooking Method** (e.g., "Grilled", "Baked", "Slow-Cooked")
5. **Course**, **Season**, **Time**, **Other** categories

**Excluded Categories**:
- ❌ **Difficulty** - Internal categorization, not user-facing
- ❌ **Cuisine** - Already shown at bottom of card

**Implementation**:
```typescript
// Primary tags (always visible): Main Ingredient, Dietary
// Exclude Difficulty (internal) and Cuisine (shown at bottom)
const primaryTags = [
  ...(categorizedTags['Main Ingredient'] || []).slice(0, 2),
  ...(categorizedTags.Dietary || []).slice(0, 1),
].filter(Boolean).slice(0, 3); // Max 3 primary tags

// Other tags (collapsible): Everything else, excluding Difficulty and Cuisine
const otherTags = [
  ...(categorizedTags['Meal Type'] || []),
  ...(categorizedTags['Cooking Method'] || []),
  ...(categorizedTags.Course || []),
  ...(categorizedTags.Season || []),
  ...(categorizedTags.Time || []),
  ...(categorizedTags.Other || []),
].filter(tag => {
  // Exclude Difficulty and Cuisine tags
  const tagId = normalizeTagToId(tag);
  return !tagId.startsWith('difficulty.') && !tagId.startsWith('cuisine.');
}).slice(0, 10); // Max 10 other tags
```

---

### 4. ✅ Reduced Badge Size

**Before**:
```typescript
<Badge
  key={tag}
  variant="secondary"
  className="text-xs font-ui"
>
  {getTagLabel(normalizeTagToId(tag))}
</Badge>
```

**After**:
```typescript
<Badge
  key={tag}
  variant="secondary"
  className="text-xs px-2 py-0.5 font-ui"  // Added smaller padding
>
  {getTagLabel(normalizeTagToId(tag))}
</Badge>
```

**Changes**:
- Added `px-2` (reduced horizontal padding)
- Added `py-0.5` (reduced vertical padding)
- Result: More compact, less obtrusive badges

---

## Visual Impact

### Before
```
┌─────────────────────────┐
│   #1                   │ ← Rank bubble (REMOVED)
│   [Difficulty] [Italian]│ ← Redundant tags
│                         │
│   Recipe Title          │
│                         │
│   🍴 Italian            │ ← Duplicate cuisine
└─────────────────────────┘
```

### After
```
┌─────────────────────────┐
│   [Chicken] [Low-Carb]  │ ← Relevant, prioritized tags
│   + 3 more              │ ← Expandable
│                         │
│   Recipe Title          │
│                         │
│   🍴 Italian            │ ← Single cuisine display
└─────────────────────────┘
```

---

## User Experience Benefits

✅ **Cleaner Design**: Removed rank bubble reduces visual clutter
✅ **No Redundancy**: Cuisine only shown once (at bottom)
✅ **Better Information**: Tags show what matters (ingredients, dietary)
✅ **More Compact**: Smaller badges fit better on mobile
✅ **Logical Hierarchy**: Most important tags (ingredients) shown first

---

## Testing

### Build Verification
```bash
pnpm run build
```
**Result**: ✅ Build completed successfully (Build #44)

### Expected Behavior
1. ✅ No rank bubbles visible on recipe cards
2. ✅ Cuisine NOT shown in tag badges (only at bottom with chef icon)
3. ✅ Difficulty NOT shown in tag badges
4. ✅ Main ingredient tags prioritized (up to 2)
5. ✅ Dietary preference tags shown (up to 1)
6. ✅ Maximum 3 primary tags visible by default
7. ✅ "+ X more" button expands to show other relevant tags
8. ✅ Smaller, more compact tag badges

---

## Files Modified

- ✅ `src/components/recipe/RecipeCard.tsx`

**Line Changes**:
- Lines 63-82: Updated tag prioritization logic
- Lines 96-98: Removed rank bubble rendering
- Lines 138-147: Simplified top-rated star condition
- Lines 177-185: Updated primary badge styling
- Lines 201-207: Updated secondary badge styling

---

## Future Considerations

### Potential Enhancements
1. **Tag Analytics**: Track which tags users click most often
2. **Smart Tag Selection**: Use ML to determine most relevant tags per recipe
3. **User Preferences**: Allow users to customize which tag categories they see first
4. **Tag Filtering**: Click tags to filter recipe results
5. **Tag Synonyms**: Handle "Vegan" vs "Plant-Based" intelligently

### Tag Ontology Expansion
Consider adding these categories to `tag-ontology.ts`:
- **Flavor Profile** (Spicy, Sweet, Savory, Tangy, etc.)
- **Equipment** (Instant Pot, Air Fryer, Grill, etc.) ← Already exists as 'Cooking Method'
- **Occasion** (Holiday, Party, Quick Meal, etc.)
- **Technique** (Pan-Seared, Deep-Fried, Steamed, etc.)

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Rank bubble removed | 100% | ✅ |
| Cuisine not duplicated | 100% | ✅ |
| Tag priority correct | 100% | ✅ |
| Badge size reduced | 100% | ✅ |
| Build successful | Pass | ✅ |
| Max 3 primary tags | Enforced | ✅ |
| Difficulty excluded | 100% | ✅ |

---

## Related Documentation

- **Tag Ontology**: `src/lib/tag-ontology.ts`
- **Tag Utilities**: `src/lib/tags/index.ts`
- **Recipe Schema**: `src/lib/db/schema.ts`
- **Top 50 Page**: `src/app/recipes/top-50/page.tsx`

---

**Implemented By**: Claude Code (React Engineer)
**Build Version**: 0.5.0 (Build #44)
**Next.js Version**: 15.5.3
