# Ingredient Consolidation Mapping

**Status**: ✅ Implemented (v0.7.1)
**Purpose**: Automatically consolidate ingredient name variants to canonical forms for better search results

---

## Overview

The ingredient consolidation mapping system ensures that when users search for ingredient variants (like "basil"), the system automatically includes the canonical form ("basil leaves") and all related variants in the search results.

This provides a better user experience by:
- Reducing ambiguity in ingredient names
- Increasing recipe discoverability
- Maintaining consistency across the ingredient database
- Allowing flexible search without requiring exact matches

---

## Architecture

### Components

1. **Consolidation Map** (`src/lib/ingredients/consolidation-map.ts`)
   - Defines canonical mappings (e.g., "basil" → "basil leaves")
   - Provides utility functions for applying consolidation
   - Supports reverse lookups (canonical → variants)

2. **Normalization Integration** (`src/lib/ingredients/normalization.ts`)
   - Integrates consolidation into ingredient normalization pipeline
   - Optional parameter to enable/disable consolidation
   - Preserves important qualifiers (e.g., "fresh", "dried")

3. **Search Integration** (`src/app/actions/ingredient-search.ts`)
   - Applies consolidation to user search queries
   - Expands searches to include all variants
   - Ensures comprehensive recipe matching

---

## Usage

### Basic Consolidation

```typescript
import { applyConsolidation } from '@/lib/ingredients/consolidation-map';

// Consolidate ingredient name
const canonical = applyConsolidation('basil');
// Returns: 'basil leaves'

const alreadyCanonical = applyConsolidation('basil leaves');
// Returns: 'basil leaves' (no change)
```

### Normalization with Consolidation

```typescript
import { normalizeIngredientName } from '@/lib/ingredients/normalization';

// With consolidation (default)
const normalized = normalizeIngredientName('Basil');
// Returns: { base: 'Basil Leaves', original: 'Basil' }

// Without consolidation
const noConsolidation = normalizeIngredientName('Basil', false);
// Returns: { base: 'Basil', original: 'Basil' }
```

### Reverse Lookup

```typescript
import { getVariantsForCanonical } from '@/lib/ingredients/consolidation-map';

const variants = getVariantsForCanonical('basil leaves');
// Returns: ['basil', 'basil leaf']
```

---

## Current Mappings

### Herbs

| Variant | Canonical Form | Rationale |
|---------|---------------|-----------|
| `basil` | `basil leaves` | Users searching "basil" typically mean the edible leaves |
| `basil leaf` | `basil leaves` | Singular/plural normalization |

### Adding New Mappings

To add new consolidation mappings, edit `src/lib/ingredients/consolidation-map.ts`:

```typescript
export const INGREDIENT_CONSOLIDATION_MAP = new Map<string, string>([
  // Existing mappings
  ['basil', 'basil leaves'],
  ['basil leaf', 'basil leaves'],

  // Add new mappings here
  ['cilantro', 'cilantro leaves'],
  ['parsley', 'parsley leaves'],
]);
```

**Guidelines for adding mappings:**
1. Map common variants to the most specific canonical form
2. Use lowercase for all keys and values
3. Ensure the canonical form exists in the ingredients database
4. Document the rationale for non-obvious mappings
5. Run tests after adding new mappings

---

## Testing

### Unit Tests

Run the comprehensive consolidation test suite:

```bash
pnpm tsx scripts/test-basil-consolidation.ts
```

This validates:
- ✅ Consolidation map basic functionality
- ✅ Normalization integration
- ✅ Database integration
- ✅ Search query simulation
- ✅ Case sensitivity handling

**Current test results:** 21/21 tests passing (100%)

### Database State

As of implementation (2025-10-23), basil variants in database:

| Ingredient | Usage Count | Category | Status |
|------------|------------|----------|--------|
| Basil | 232 | herbs | Variant |
| **Basil Leaves** | 30 | herbs | ⭐ Canonical |
| Basil Leaf | 2 | herbs | Variant |
| Fresh Basil Sprigs | 0 | herbs | Variant |

---

## Search Behavior

### Before Consolidation

User searches for: `"basil"`
Results: Only recipes with exact match `"basil"` (232 recipes)

### After Consolidation

User searches for: `"basil"`
Search expands to:
- `basil` (original query)
- `basil leaves` (canonical form)
- `basil leaf` (known variant)

Results: All recipes containing any basil variant (262+ recipes)

---

## Implementation Details

### Consolidation Pipeline

```
User Input: "basil"
     ↓
[1] Normalize (lowercase, trim)
     ↓
[2] Apply Consolidation Map
     → "basil" becomes "basil leaves"
     ↓
[3] Expand to All Variants
     → ["basil leaves", "basil", "basil leaf"]
     ↓
[4] Database Query
     → Search for all variants
     ↓
Results: All matching recipes
```

### Special Cases

1. **Preserved Prefixes**
   - Qualifiers like "fresh", "dried", "frozen" are preserved
   - Example: "Fresh Basil" stays as "Fresh Basil" (not consolidated)
   - Rationale: Qualifiers indicate important distinctions

2. **Special Ingredient Names**
   - Some ingredients have "leaves" as part of the name
   - Example: "Bay Leaves", "Curry Leaves"
   - These bypass the consolidation logic

3. **Case Insensitivity**
   - All consolidation is case-insensitive
   - "BASIL", "Basil", "basil" all consolidate to "basil leaves"

---

## Database Considerations

### Migration Strategy

No database migration is required. The consolidation mapping is application-level and doesn't modify the database schema.

**Advantages:**
- Zero downtime implementation
- Easy to add/remove mappings
- Doesn't affect existing data
- Can be toggled on/off via feature flag

### Future Optimization (Optional)

If consolidation mappings grow significantly, consider:
1. Adding an `aliases` field to the ingredients table
2. Creating a `canonical_ingredient_id` foreign key
3. Denormalizing frequently-searched variants

---

## Performance Impact

**Negligible.** Consolidation adds:
- ~1ms per query (map lookup)
- Minimal memory overhead (2-3 mappings = ~200 bytes)
- No database changes (same queries, just expanded WHERE clauses)

---

## Monitoring

### Success Metrics

Track these metrics to validate consolidation effectiveness:

1. **Search Coverage**
   - % of "basil" searches that return recipes with "basil leaves"
   - Target: >95%

2. **User Satisfaction**
   - Click-through rate on search results
   - Time to find desired recipe

3. **Recipe Discoverability**
   - Number of recipes found per search
   - Variance in result counts for variant searches

### Debugging

To debug consolidation issues:

```typescript
import { getConsolidationStats } from '@/lib/ingredients/consolidation-map';

const stats = getConsolidationStats();
console.log(stats);
// {
//   totalMappings: 2,
//   uniqueCanonicalIngredients: 1,
//   averageVariantsPerCanonical: 2
// }
```

---

## Roadmap

### Phase 1: ✅ Complete
- Basil consolidation ("basil" → "basil leaves")
- Infrastructure for consolidation mappings
- Comprehensive test suite

### Phase 2: 🚧 Planned
- Expand to more herbs (cilantro, parsley, mint, thyme)
- Add common vegetable variants
- Protein consolidation (e.g., "ground beef" variants)

### Phase 3: 🔮 Future
- LLM-powered consolidation suggestions
- User-reported variant mappings
- Category-specific consolidation rules

---

## References

- **Source Code**: `src/lib/ingredients/consolidation-map.ts`
- **Normalization**: `src/lib/ingredients/normalization.ts`
- **Search Integration**: `src/app/actions/ingredient-search.ts`
- **Tests**: `scripts/test-basil-consolidation.ts`
- **Related**: [Ingredient Normalization Guide](./INGREDIENT_NORMALIZATION.md)

---

**Last Updated**: 2025-10-23
**Maintained By**: Recipe Manager Team
**Questions?** Check the test suite or review the source code comments
