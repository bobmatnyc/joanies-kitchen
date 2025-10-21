# Ingredients Feature - Quick Start

## What's New

A complete ingredients directory has been added to Joanie's Kitchen!

### Features
- 📋 **Browse all ingredients** with search and filtering
- 🔍 **Individual ingredient pages** with detailed information
- 💬 **Joanie's personal notes** and cooking tips
- 📚 **See all recipes** using each ingredient
- 🏷️ **Categories and tags** for easy organization

---

## Access

Navigate to: **`/ingredients`** or click "Ingredients" in the main navigation

---

## Quick Actions

### Browse All Ingredients
```
/ingredients
```
- View all 495+ ingredients in grid layout
- Search by name
- Filter by category (vegetables, proteins, dairy, etc.)
- Sort alphabetically, by popularity, or by date added

### View Ingredient Details
```
/ingredients/{slug}
```
Example: `/ingredients/carrots`

Each page includes:
- Ingredient photo
- Category and usage statistics
- Description
- Joanie's tips and notes
- Storage recommendations
- Substitution suggestions
- Recipes using this ingredient

---

## For Developers

### Database Migrations

Run these scripts in order (ONLY ONCE):

```bash
# 1. Add new columns to ingredients table
pnpm tsx scripts/apply-ingredient-schema.ts

# 2. Generate slugs for all ingredients
pnpm tsx scripts/populate-ingredient-slugs.ts

# 3. Fix any duplicate slugs
pnpm tsx scripts/fix-duplicate-slugs.ts

# 4. Add unique constraint
pnpm tsx scripts/add-slug-unique-constraint.ts
```

### New Files Created

**Pages:**
- `src/app/ingredients/page.tsx` - List all ingredients
- `src/app/ingredients/[slug]/page.tsx` - Individual ingredient detail

**Components:**
- `src/components/ingredient/IngredientCard.tsx`
- `src/components/ingredient/IngredientList.tsx`
- `src/components/ingredient/IngredientFilters.tsx`

**Server Actions:**
- `src/app/actions/ingredients.ts` - All ingredient data operations

**Navigation:**
- Updated `src/components/navigation/DesktopNav.tsx` with Ingredients link

**Documentation:**
- `docs/guides/INGREDIENTS_FEATURE_GUIDE.md` - Comprehensive guide

### Database Schema Changes

New columns in `ingredients` table:
- `slug` (VARCHAR 255, UNIQUE) - URL-friendly identifier
- `description` (TEXT) - General information
- `storage_tips` (TEXT) - Storage recommendations
- `substitutions` (TEXT) - JSON array of alternatives
- `image_url` (TEXT) - Ingredient image URL

---

## Adding Ingredient Content

### Example: Add Joanie's Note for Carrots

```typescript
import { createComment } from '@/app/actions/joanie-comments';

// First, find the carrot ingredient ID
const carrotResult = await getIngredientBySlug('carrots');
const carrotId = carrotResult.ingredient?.id;

// Add Joanie's comment
await createComment({
  ingredient_id: carrotId,
  comment_text: 'Never buy baby carrots - they are carved from mature carrots and dry out fast. Always remove the tops immediately after purchase, then wash and peel before storing in water.',
  comment_type: 'tip',
});
```

### Example: Add Storage Tips

```typescript
import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { eq } from 'drizzle-orm';

await db.update(ingredients)
  .set({
    storage_tips: 'Store carrots submerged horizontally in water in the fridge. Change water every 3-4 days. They will stay crisp for 2-3 weeks.',
    substitutions: JSON.stringify(['Parsnips', 'Sweet potatoes', 'Turnips']),
  })
  .where(eq(ingredients.slug, 'carrots'));
```

---

## Testing

### Manual Test Checklist
- [ ] Navigate to `/ingredients`
- [ ] Search for an ingredient (e.g., "tomato")
- [ ] Filter by category (e.g., "vegetables")
- [ ] Change sort order
- [ ] Click on an ingredient card
- [ ] Verify ingredient detail page loads
- [ ] Check Joanie's comment appears (if exists)
- [ ] Click "Find Recipes" button
- [ ] Verify navigation back works

---

## Troubleshooting

### Slugs not unique?
```bash
pnpm tsx scripts/fix-duplicate-slugs.ts
```

### Missing navigation link?
Check `src/components/navigation/DesktopNav.tsx` includes:
```tsx
<NavLink href="/ingredients" icon={Package} label="Ingredients" />
```

---

## Next Steps

1. **Add images** to popular ingredients
2. **Add Joanie's notes** to common ingredients
3. **Fill in storage tips** for frequently used items
4. **Test on mobile** devices

---

For detailed documentation, see: `docs/guides/INGREDIENTS_FEATURE_GUIDE.md`
