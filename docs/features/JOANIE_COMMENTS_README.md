# Joanie Comments Feature

> **Personal notes system for Joanie's authentic cooking observations, stories, and tips**

---

## Quick Start

```bash
# 1. Run migration (already completed ✅)
pnpm tsx scripts/migrations/create-joanie-comments-table.ts

# 2. Test the feature (already passed ✅)
pnpm tsx scripts/test-joanie-comments.ts

# 3. Add example comment to Monday Night Crab Salad
pnpm tsx scripts/add-joanie-crab-salad-comment.ts
```

---

## What's Included

### ✅ Database Schema
- `joanie_comments` table with foreign key references
- Single-reference constraint (recipe OR meal OR ingredient)
- Indexes for fast lookups
- Auto-updating timestamps

### ✅ Server Actions
```typescript
import {
  getCommentForRecipe,
  createComment,
  updateComment,
  deleteComment
} from '@/app/actions/joanie-comments';
```

### ✅ UI Components
```tsx
import {
  JoanieComment,        // Full version (recipe pages)
  JoanieCommentCompact, // Compact version (cards)
  JoanieCommentInline   // Inline version (minimal space)
} from '@/components/recipe/JoanieComment';
```

---

## Comment Types

| Type | Label | Use Case |
|------|-------|----------|
| `story` | "Joanie's Story" | Recipe origins, cooking memories |
| `tip` | "Joanie's Tip" | Shortcuts, best practices |
| `substitution` | "Joanie on Substitutions" | What worked when missing ingredients |
| `general` | "From Joanie's Kitchen" | Miscellaneous observations |

---

## Example Usage

### Add Comment to Recipe

```typescript
await createComment({
  recipe_id: recipeId,
  comment_text: "Monday night after grocery delivery. Had some beautiful crab meat...",
  comment_type: 'story'
});
```

### Display in Recipe Page

```tsx
export default async function RecipePage({ params }) {
  const { data: comment } = await getCommentForRecipe(params.id);

  return (
    <div>
      <h1>Recipe Title</h1>
      {comment && <JoanieComment comment={comment} />}
    </div>
  );
}
```

---

## Files

### Core Implementation
- `src/lib/db/schema.ts` - Database schema (updated)
- `src/app/actions/joanie-comments.ts` - Server actions
- `src/components/recipe/JoanieComment.tsx` - UI components

### Scripts & Migration
- `scripts/migrations/create-joanie-comments-table.ts` - Migration ✅ Completed
- `scripts/test-joanie-comments.ts` - Test suite ✅ All tests passed
- `scripts/add-joanie-crab-salad-comment.ts` - Example usage

### Documentation
- `docs/guides/JOANIE_COMMENTS.md` - Full guide (comprehensive)
- `docs/reference/JOANIE_COMMENTS_QUICK_REFERENCE.md` - Quick reference
- `JOANIE_COMMENTS_DELIVERABLES.md` - Detailed deliverables

---

## Visual Design

**Color Scheme:** Amber (warm, personal, kitchen-inspired)

**Full Version:**
- Quote-style formatting with decorative marks
- Icon and label based on comment type
- Signature line ("— Joanie")
- Decorative corner accent
- Dark mode support

**Compact Version:**
- Icon + truncated text (3 lines)
- Border accent
- Minimal signature

**Inline Version:**
- Single line badge style
- Minimal icon
- No signature

---

## Migration Status

✅ **Migration Completed Successfully**

```
Creating joanie_comments table...
✓ Table created successfully
✓ Recipe ID index created
✓ Meal ID index created
✓ Ingredient ID index created
✓ Comment type index created
✓ Created at index created
✓ Updated at trigger created
```

---

## Test Results

✅ **All Tests Passed**

```
=== Test Summary ===
✓ Create comments: PASSED
✓ Read comments: PASSED
✓ Update comments: PASSED
✓ Delete comments: PASSED
✓ Comment types (story, tip, substitution): PASSED
✓ Single-reference constraint: PASSED
```

---

## Next Steps

1. **Immediate**
   - [x] Run migration ✅
   - [x] Run tests ✅
   - [ ] Add comment to Monday Night Crab Salad
   - [ ] Integrate into recipe page UI
   - [ ] Test in browser

2. **Short-term**
   - [ ] Add admin panel for comment management
   - [ ] Implement production access control
   - [ ] Add comments to more recipes
   - [ ] Create bulk import tool

3. **Future**
   - [ ] Rich comments with images
   - [ ] Audio clips (Joanie reading comments)
   - [ ] Video snippets for techniques
   - [ ] "Ask Joanie" AI Q&A feature

---

## Security Note

**Production:** Restrict comment creation to Joanie's admin account.

Add to server actions:
```typescript
const { userId } = await auth();
if (userId !== process.env.JOANIE_USER_ID) {
  return { success: false, error: 'Unauthorized' };
}
```

---

## Support

**Documentation:**
- Full Guide: `docs/guides/JOANIE_COMMENTS.md`
- Quick Reference: `docs/reference/JOANIE_COMMENTS_QUICK_REFERENCE.md`

**Troubleshooting:**
- Check server action error messages
- Verify single-reference constraint (only one of recipe_id/meal_id/ingredient_id)
- Ensure comment_text is not empty
- Check that referenced entity exists

---

**Feature Status:** ✅ Complete and Ready for Use

**Implementation Date:** 2025-10-20

**Priority:** High (adds authentic personal touch to recipes)
