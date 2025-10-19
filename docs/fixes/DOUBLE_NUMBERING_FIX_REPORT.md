# Double Numbering Fix Report

**Date**: 2025-10-18
**Script**: `scripts/fix-double-numbered-instructions.ts`

## Problem Summary

Recipe instructions were displaying with double numbering on the frontend:
```
1. 1. Bring a large pot of salted water to a boil...
2. 2. Heat a large skillet over medium heat...
3. 3. Once the oil is hot, crumble in the sausages...
```

### Root Cause

The frontend recipe display component (`src/app/recipes/[slug]/page.tsx`, lines 822-830) automatically adds step numbers when rendering instructions:

```tsx
<ol className="space-y-4">
  {recipe.instructions.map((instruction: string, index: number) => (
    <li key={index} className="flex">
      <span className="font-semibold text-primary mr-3 flex-shrink-0">
        {index + 1}.  {/* <-- Frontend adds number */}
      </span>
      <span>{instruction}</span>  {/* <-- Instruction text */}
    </li>
  ))}
</ol>
```

However, many recipes imported from external sources (Epicurious, Food.com, etc.) already had numbered instructions stored in the database:
- Database: `["1. Bring a large pot...", "2. Heat a large skillet..."]`
- Frontend renders: `1. 1. Bring a large pot...`

## Solution

Created a migration script that:
1. **Identifies** recipes with instructions starting with number prefixes (e.g., "1. ", "2. ", etc.)
2. **Removes** the number prefix from each instruction
3. **Validates** that the fix was applied correctly

### Pattern Detection
```typescript
function hasNumberPrefix(instruction: string): boolean {
  // Pattern: starts with "number." or "number. "
  const pattern = /^\d+\.\s*/;
  return pattern.test(instruction.trim());
}
```

### Fix Logic
```typescript
function removeNumberPrefix(instruction: string): string {
  // Remove leading "number. " pattern
  // "1. Step text" -> "Step text"
  const pattern = /^\d+\.\s*/;
  return instruction.trim().replace(pattern, '').trim();
}
```

## Execution Results

### Dry Run Analysis
- **Total Recipes Scanned**: 4,345
- **Affected Recipes Found**: 148
- **Error-Free Detection**: 100% success rate

### Fix Execution
**Run 1**:
- Recipes Fixed: 114

**Run 2**:
- Recipes Fixed: 34

**Verification Run**:
- Affected Recipes Found: 0 ✅

**Total Fixed**: 148 recipes

## Sample Fixes

### Example 1: Penne Rigate with Sausage, Mushrooms, and Ricotta
**Before**:
```
1. Bring a large pot of salted water to a boil for the pasta.
2. Heat a large skillet over medium heat and add the olive oil.
3. Once the oil is hot, crumble in the sausages...
```

**After**:
```
Bring a large pot of salted water to a boil for the pasta.
Heat a large skillet over medium heat and add the olive oil.
Once the oil is hot, crumble in the sausages...
```

**Frontend Display**:
```
1. Bring a large pot of salted water to a boil for the pasta.
2. Heat a large skillet over medium heat and add the olive oil.
3. Once the oil is hot, crumble in the sausages...
```

### Example 2: Lentil, Apple, and Turkey Wrap
**Before**:
```json
[
  "1. Place the stock, lentils, celery, carrot, thyme...",
  "2. Fold in the tomato, apple, lemon juice...",
  "3. To assemble a wrap, place 1 lavash sheet..."
]
```

**After**:
```json
[
  "Place the stock, lentils, celery, carrot, thyme...",
  "Fold in the tomato, apple, lemon juice...",
  "To assemble a wrap, place 1 lavash sheet..."
]
```

### Example 3: Cassata Cake
**Before**:
```
1. To make the filling, quickly whisk together 4 tablespoons...
2. Whisk in the rest of the milk and transfer...
3. Cover the milk mixture with plastic wrap...
```

**After**:
```
To make the filling, quickly whisk together 4 tablespoons...
Whisk in the rest of the milk and transfer...
Cover the milk mixture with plastic wrap...
```

## Affected Recipe Sources

The 148 fixed recipes came from various sources:
- Epicurious imports
- Food.com imports
- Manually entered recipes
- Chef-attributed recipes (Lidia Bastianich, etc.)

All imported recipes from external sources that included pre-numbered instructions were affected.

## Technical Details

### Database Changes
- **Table**: `recipes`
- **Column**: `instructions` (JSON text field)
- **Update**: Removed number prefixes from instruction strings
- **Timestamp**: Updated `updated_at` for all modified recipes

### Data Integrity
- ✅ No instruction content was lost
- ✅ All instruction sequences preserved
- ✅ No recipes had invalid JSON after fix
- ✅ Zero errors during execution

### Performance
- Script execution time: ~30 seconds (4,345 recipes scanned)
- Database updates: 148 recipes modified
- No performance impact on application

## Validation

### Post-Fix Checks
1. ✅ Verified 0 recipes with number prefixes remain
2. ✅ Confirmed instructions display correctly on frontend
3. ✅ All modified recipes have valid JSON
4. ✅ Sequential numbering works as expected

### Frontend Behavior
The frontend now correctly displays:
- Step number (added by frontend): `1.`
- Instruction text (from database): `Bring a large pot...`
- Combined display: `1. Bring a large pot...`

## Prevention

### For Future Imports
When importing recipes from external sources, ensure the import scripts strip number prefixes before storing instructions:

```typescript
// Import script example
function normalizeInstructions(instructions: string[]): string[] {
  return instructions.map(inst =>
    inst.trim().replace(/^\d+\.\s*/, '')
  );
}
```

### Files to Update
- `scripts/data-acquisition/ingest-epicurious.ts`
- `scripts/data-acquisition/ingest-foodcom.ts`
- `scripts/import-*.ts` (all import scripts)
- `src/app/actions/recipe-import.ts`

## Conclusion

✅ **Success**: All 148 recipes with double numbering have been fixed

✅ **Zero Errors**: 100% success rate with no data loss

✅ **Verified**: Confirmation run shows 0 remaining issues

✅ **User Experience**: Recipe instructions now display cleanly with single numbering

The double numbering issue has been completely resolved across the entire recipe database.
