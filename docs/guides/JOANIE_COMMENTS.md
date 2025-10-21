# Joanie Comments Feature Guide

## Overview

**Joanie Comments** is a personal notes system that allows Joanie to attach authentic observations, cooking stories, tips, and substitution advice to recipes, meals, or ingredients throughout the platform.

These are NOT user-generated comments - they represent Joanie's authentic voice and cooking wisdom, adding a personal touch to the platform.

---

## Database Schema

### Table: `joanie_comments`

```sql
CREATE TABLE joanie_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Flexible references (exactly one must be set)
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,

  -- Comment content
  comment_text TEXT NOT NULL,
  comment_type TEXT CHECK (comment_type IN ('story', 'tip', 'substitution', 'general')),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: exactly one reference must be set
  CONSTRAINT joanie_comments_single_reference_check
    CHECK (
      (recipe_id IS NOT NULL AND meal_id IS NULL AND ingredient_id IS NULL) OR
      (meal_id IS NOT NULL AND recipe_id IS NULL AND ingredient_id IS NULL) OR
      (ingredient_id IS NOT NULL AND recipe_id IS NULL AND meal_id IS NULL)
    )
);
```

### Indexes

- `joanie_comments_recipe_id_idx` - Fast lookups by recipe
- `joanie_comments_meal_id_idx` - Fast lookups by meal
- `joanie_comments_ingredient_id_idx` - Fast lookups by ingredient
- `joanie_comments_type_idx` - Filter by comment type
- `joanie_comments_created_at_idx` - Chronological sorting

---

## Comment Types

| Type | Description | Icon | Use Case |
|------|-------------|------|----------|
| `story` | Personal cooking story or anecdote | 💬 MessageCircle | Recipe origin stories, cooking memories |
| `tip` | Cooking tip or technique advice | 💡 Lightbulb | Helpful shortcuts, best practices |
| `substitution` | Substitution suggestions and experiences | 🔄 RefreshCw | What worked when ingredients were missing |
| `general` | General observation or note | ✏️ PenLine | Miscellaneous thoughts |

---

## Setup & Migration

### 1. Run Database Migration

```bash
pnpm tsx scripts/migrations/create-joanie-comments-table.ts
```

This will:
- Create the `joanie_comments` table
- Add all necessary indexes
- Set up the `updated_at` trigger
- Validate the single-reference constraint

### 2. Verify Schema

```bash
# Check table exists
psql $DATABASE_URL -c "\d joanie_comments"

# Check constraints
psql $DATABASE_URL -c "\d+ joanie_comments"
```

---

## Server Actions API

All server actions are in `/src/app/actions/joanie-comments.ts`

### Get Comment for Recipe

```typescript
import { getCommentForRecipe } from '@/app/actions/joanie-comments';

const result = await getCommentForRecipe(recipeId);
if (result.success && result.data) {
  console.log(result.data.comment_text);
}
```

### Get Comment for Meal

```typescript
import { getCommentForMeal } from '@/app/actions/joanie-comments';

const result = await getCommentForMeal(mealId);
```

### Get Comment for Ingredient

```typescript
import { getCommentForIngredient } from '@/app/actions/joanie-comments';

const result = await getCommentForIngredient(ingredientId);
```

### Create Comment

```typescript
import { createComment } from '@/app/actions/joanie-comments';

const result = await createComment({
  recipe_id: 'abc-123',
  comment_text: 'Monday night after grocery delivery...',
  comment_type: 'story',
});
```

**Validation Rules:**
- Exactly one reference (recipe_id, meal_id, or ingredient_id) must be provided
- `comment_text` is required and cannot be empty
- `comment_type` must be one of: 'story', 'tip', 'substitution', 'general'

### Update Comment

```typescript
import { updateComment } from '@/app/actions/joanie-comments';

const result = await updateComment(commentId, 'Updated comment text...');
```

### Delete Comment

```typescript
import { deleteComment } from '@/app/actions/joanie-comments';

const result = await deleteComment(commentId);
```

### Get All Comments (Admin)

```typescript
import { getAllComments } from '@/app/actions/joanie-comments';

const result = await getAllComments();
// Returns all comments across recipes, meals, and ingredients
```

---

## UI Components

Three component variants are available in `/src/components/recipe/JoanieComment.tsx`:

### 1. Full Comment (Default)

**Use Case:** Recipe detail pages, meal pages

```tsx
import { JoanieComment } from '@/components/recipe/JoanieComment';

<JoanieComment comment={comment} />
```

**Features:**
- Large quote-style formatting
- Prominent icon and label
- Decorative quote marks
- Signature line
- Amber color scheme (warm, personal)

### 2. Compact Comment

**Use Case:** Recipe cards, list views, sidebars

```tsx
import { JoanieCommentCompact } from '@/components/recipe/JoanieComment';

<JoanieCommentCompact comment={comment} />
```

**Features:**
- Smaller footprint
- Icon + truncated text (3 lines max)
- Border accent
- Signature

### 3. Inline Comment

**Use Case:** Ingredient lists, tags, minimal spaces

```tsx
import { JoanieCommentInline } from '@/components/recipe/JoanieComment';

<JoanieCommentInline comment={comment} />
```

**Features:**
- Single line
- Minimal icon
- No signature
- Border badge style

---

## Integration Example: Recipe Page

```tsx
// src/app/recipes/[id]/page.tsx
import { getRecipeById } from '@/app/actions/recipes';
import { getCommentForRecipe } from '@/app/actions/joanie-comments';
import { JoanieComment } from '@/components/recipe/JoanieComment';

export default async function RecipePage({ params }: { params: { id: string } }) {
  const { data: recipe } = await getRecipeById(params.id);
  const { data: joanieComment } = await getCommentForRecipe(params.id);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold">{recipe.name}</h1>

      <p className="mt-4 text-lg text-gray-600">{recipe.description}</p>

      {/* Joanie's Comment (if exists) */}
      {joanieComment && (
        <JoanieComment comment={joanieComment} className="mt-6" />
      )}

      {/* Rest of recipe content */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold">Ingredients</h2>
        {/* ... */}
      </div>
    </div>
  );
}
```

---

## Example: Adding Comment to Monday Night Crab Salad

```typescript
// scripts/add-joanie-comment-crab-salad.ts
import { createComment } from '@/app/actions/joanie-comments';

async function addCommentToCrabSalad() {
  const recipeId = 'monday-night-crab-salad-id'; // Replace with actual ID

  const result = await createComment({
    recipe_id: recipeId,
    comment_text: `Monday night after grocery delivery. Had some beautiful crab meat, peppers and spring onions from the garden, week-old kale that needed rescuing, and leftover sourdough. The kale was looking sad but I knew massaging it with lime and salt would bring it back to life. Ran out of lime halfway through dressing the salad (oops!) so I subbed sweet rice wine vinegar - honestly, it was brilliant. The acidity cut through the rich Kewpie mayo perfectly.`,
    comment_type: 'story',
  });

  if (result.success) {
    console.log('✓ Joanie comment added to Monday Night Crab Salad');
  } else {
    console.error('Failed:', result.error);
  }
}

addCommentToCrabSalad();
```

---

## Admin Tools (Future)

### Admin Panel Features (To Be Implemented)

1. **Comment Management Dashboard**
   - List all comments across recipes/meals/ingredients
   - Filter by type
   - Quick edit/delete
   - Search functionality

2. **Inline Comment Editor**
   - Add comment directly from recipe edit page
   - Preview before saving
   - Type selector dropdown

3. **Bulk Operations**
   - Import comments from CSV
   - Export comments for backup
   - Bulk delete by date range

### Access Control (Production)

In production, restrict comment mutations to admin users:

```typescript
// src/app/actions/joanie-comments.ts
import { auth } from '@/lib/auth';

export async function createComment(data: NewJoanieComment) {
  const { userId } = await auth();

  // Check if user is admin (Joanie's account)
  const JOANIE_USER_ID = process.env.JOANIE_USER_ID;
  if (userId !== JOANIE_USER_ID) {
    return {
      success: false,
      error: 'Unauthorized: Only Joanie can create comments',
    };
  }

  // ... rest of implementation
}
```

---

## Best Practices

### Writing Style

✅ **DO:**
- Write in first person ("I knew massaging it...")
- Be conversational and authentic
- Share specific details (times, quantities, feelings)
- Mention substitutions that worked
- Tell the story behind the recipe

❌ **DON'T:**
- Use formal recipe language
- Write generic tips
- Copy from other sources
- Use marketing speak
- Write multiple comments per recipe (one is enough)

### Comment Length

- **Story:** 100-300 words (a good paragraph)
- **Tip:** 50-150 words (concise advice)
- **Substitution:** 30-100 words (specific swap + why it worked)
- **General:** Flexible

### Comment Placement

**Recipes:** Below description, before ingredients
- Most common use case
- Sets the context for the dish

**Meals:** After meal overview
- Explains occasion or inspiration
- Multi-course pairing rationale

**Ingredients:** In ingredient detail pages (future)
- Sourcing tips
- Storage advice
- Flavor profiles

---

## Testing Checklist

- [ ] Migration runs successfully
- [ ] Single-reference constraint works (prevents multiple references)
- [ ] Updated_at trigger fires on edits
- [ ] Comments display correctly in all three UI variants
- [ ] Dark mode styling works
- [ ] Comments revalidate on create/update/delete
- [ ] Server actions handle errors gracefully
- [ ] Foreign key cascades work (delete recipe → delete comment)

---

## Future Enhancements

### Phase 2: Rich Comments
- Add image attachments (e.g., photo of the actual dish)
- Support for multiple paragraphs with formatting
- Link to related recipes/ingredients

### Phase 3: Interactive Features
- "Ask Joanie" - AI-powered Q&A based on comments
- Audio clips (Joanie reading the comment)
- Video snippets for technique tips

### Phase 4: Community Integration
- Users can save favorite Joanie comments
- "More like this" - find recipes with similar stories
- Comment highlights in newsletters

---

## Support & Questions

For issues or questions about Joanie Comments:
1. Check this guide first
2. Review server action error messages
3. Check database constraints
4. Verify component props

**Common Issues:**

**"Must provide exactly one reference"**
→ Ensure only recipe_id, meal_id, OR ingredient_id is set (not multiple)

**"Comment not found"**
→ Verify the ID exists in the database

**Comment not displaying**
→ Check that `getCommentForRecipe` is awaited and returns data

---

**Last Updated:** 2025-10-20
**Version:** 1.0.0
**Maintained By:** Recipe Manager Team
