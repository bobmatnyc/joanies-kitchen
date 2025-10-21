# Joanie Comments - Quick Reference

## Installation

```bash
# 1. Run migration
pnpm tsx scripts/migrations/create-joanie-comments-table.ts

# 2. Add comment to Monday Night Crab Salad (example)
pnpm tsx scripts/add-joanie-crab-salad-comment.ts
```

---

## Server Actions (Import from @/app/actions/joanie-comments)

```typescript
// Get comment
const { data } = await getCommentForRecipe(recipeId);

// Create comment
await createComment({
  recipe_id: recipeId,
  comment_text: "Your story here...",
  comment_type: 'story' // 'story' | 'tip' | 'substitution' | 'general'
});

// Update comment
await updateComment(commentId, "Updated text...");

// Delete comment
await deleteComment(commentId);
```

---

## UI Components (Import from @/components/recipe/JoanieComment)

```tsx
// Full version (recipe pages)
<JoanieComment comment={comment} />

// Compact version (cards, lists)
<JoanieCommentCompact comment={comment} />

// Inline version (minimal space)
<JoanieCommentInline comment={comment} />
```

---

## Database Schema

```sql
-- Table structure
joanie_comments (
  id UUID PRIMARY KEY,
  recipe_id TEXT,      -- One of these must be set
  meal_id UUID,        -- (exactly one, others null)
  ingredient_id UUID,  --
  comment_text TEXT NOT NULL,
  comment_type TEXT,   -- 'story' | 'tip' | 'substitution' | 'general'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## Comment Types

| Type | Icon | Use Case |
|------|------|----------|
| `story` | 💬 | Recipe origin, cooking memories |
| `tip` | 💡 | Cooking advice, shortcuts |
| `substitution` | 🔄 | What worked when ingredients were missing |
| `general` | ✏️ | Miscellaneous observations |

---

## Example Integration

```tsx
// src/app/recipes/[id]/page.tsx
import { getCommentForRecipe } from '@/app/actions/joanie-comments';
import { JoanieComment } from '@/components/recipe/JoanieComment';

export default async function RecipePage({ params }) {
  const { data: comment } = await getCommentForRecipe(params.id);

  return (
    <div>
      <h1>Recipe Title</h1>
      {comment && <JoanieComment comment={comment} />}
      {/* Rest of recipe */}
    </div>
  );
}
```

---

## Direct Database Query

```sql
-- Get all comments for a recipe
SELECT * FROM joanie_comments WHERE recipe_id = 'your-recipe-id';

-- Get all story-type comments
SELECT * FROM joanie_comments WHERE comment_type = 'story';

-- Count comments by type
SELECT comment_type, COUNT(*) FROM joanie_comments GROUP BY comment_type;
```

---

## Common Patterns

### Add comment during recipe creation

```typescript
// After creating recipe
const recipe = await createRecipe(recipeData);

await createComment({
  recipe_id: recipe.id,
  comment_text: "This recipe came from...",
  comment_type: 'story'
});
```

### Bulk import comments

```typescript
const comments = [
  { recipe_id: 'id1', comment_text: 'Story 1', comment_type: 'story' },
  { recipe_id: 'id2', comment_text: 'Tip 1', comment_type: 'tip' },
];

for (const comment of comments) {
  await createComment(comment);
}
```

### Check if recipe has comment

```typescript
const { data: comment } = await getCommentForRecipe(recipeId);
const hasComment = comment !== null;
```

---

## Files Reference

```
Database:
  src/lib/db/schema.ts                          # Schema definition
  scripts/migrations/create-joanie-comments-table.ts  # Migration

Server Actions:
  src/app/actions/joanie-comments.ts            # CRUD operations

Components:
  src/components/recipe/JoanieComment.tsx       # Display components

Documentation:
  docs/guides/JOANIE_COMMENTS.md                # Full guide
  docs/reference/JOANIE_COMMENTS_QUICK_REFERENCE.md  # This file

Examples:
  scripts/add-joanie-crab-salad-comment.ts      # Example script
```

---

## Validation Rules

✅ **Valid:**
- Exactly one reference (recipe_id OR meal_id OR ingredient_id)
- Non-empty comment_text
- comment_type in ['story', 'tip', 'substitution', 'general']

❌ **Invalid:**
- Multiple references set
- Empty comment_text
- Invalid comment_type
- No reference set

---

## Security Note

**Production:** Restrict create/update/delete to admin/Joanie's account only.

```typescript
const { userId } = await auth();
if (userId !== process.env.JOANIE_USER_ID) {
  return { success: false, error: 'Unauthorized' };
}
```

---

**Quick Links:**
- [Full Guide](../guides/JOANIE_COMMENTS.md)
- [Schema](../../src/lib/db/schema.ts)
- [Server Actions](../../src/app/actions/joanie-comments.ts)
- [Components](../../src/components/recipe/JoanieComment.tsx)
