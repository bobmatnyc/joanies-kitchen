# Admin Recipe Image Flagging & Regeneration System

**Version**: 1.0.0
**Status**: ✅ Implemented
**Date**: 2025-10-17

---

## Overview

A comprehensive admin-only feature that allows administrators to flag incorrect or low-quality recipe images and regenerate them using AI, with proper caching for public users to ensure zero performance impact.

## Features

### 1. Client-Side Image Flagging
- **Admin-Only Button**: Appears on recipe images only for admin users
- **Visual Feedback**: Immediate flagging with orange/red indicators
- **Confirmation Dialog**: Prevents accidental flagging
- **Unflag Capability**: One-click removal of flags
- **Zero Public Impact**: Client-side only, doesn't affect caching

### 2. Admin Dashboard Management
- **Flagged Images Section**: Dedicated card showing all flagged recipes
- **Batch Operations**: Regenerate all flagged images at once
- **Individual Control**: Regenerate or unflag per recipe
- **Real-Time Status**: Shows regeneration progress with animations
- **Audit Trail**: Tracks who flagged, when, and regeneration history

### 3. AI Image Regeneration
- **OpenRouter Integration**: Uses DALL-E 3 via OpenRouter API
- **Context-Aware**: Generates based on recipe name and description
- **High Quality**: 1024x1024 standard quality images
- **Automatic Updates**: Replaces old image and clears flag
- **Path Revalidation**: Updates all cached pages

### 4. ISR Caching Strategy
Public recipe pages properly cached with no impact from admin features:
- **Recipe Detail Pages**: Client-side (admin features load after hydration)
- **Shared Recipes**: 1800s (30 minutes) ISR
- **Discover Page**: Client-side (interactive)
- **Chef Pages**: Can implement 3600s (1 hour) ISR if needed

---

## Architecture

### Database Schema

**New columns in `recipes` table:**
```sql
image_flagged_for_regeneration: boolean DEFAULT false
image_regeneration_requested_at: timestamp
image_regeneration_requested_by: text  -- Admin user ID
```

**Index for performance:**
```sql
CREATE INDEX idx_recipes_flagged_images
ON recipes(image_flagged_for_regeneration)
WHERE image_flagged_for_regeneration = true;
```

### Component Structure

```
src/
├── components/admin/
│   ├── RecipeImageFlag.tsx          # Flag button overlay on images
│   └── FlaggedImagesManager.tsx     # Admin dashboard management UI
├── app/actions/
│   └── admin-recipes.ts             # Server actions for flagging/regeneration
└── app/recipes/[slug]/page.tsx      # Recipe detail with flag integration
```

---

## Usage Guide

### For Admins

#### Flagging an Image

1. Navigate to any recipe page
2. Hover over the recipe image
3. Click the "Flag Image" button in the top-right corner
4. Confirm the flagging action
5. Image is marked with orange "Flagged for regeneration" badge

#### Unflagging an Image

1. Click the "Unflag" button on a flagged image
2. Flag is removed immediately (no confirmation needed)

#### Regenerating Images

**Single Recipe:**
1. Go to Admin Dashboard (`/admin`)
2. Scroll to "Flagged Images" section
3. Find the recipe in the grid
4. Click "Regenerate Image" button
5. Wait for AI generation (shown with spinner)
6. New image replaces old, flag cleared automatically

**Batch Regeneration:**
1. Go to Admin Dashboard (`/admin`)
2. Scroll to "Flagged Images" section
3. Click "Regenerate All" button
4. Confirm batch operation
5. System processes all flagged recipes sequentially
6. Results shown: X succeeded, Y failed

### For Developers

#### Server Actions API

```typescript
// Flag a recipe image
const result = await flagRecipeImageForRegeneration(recipeId);

// Unflag a recipe image
const result = await unflagRecipeImage(recipeId);

// Get all flagged recipes
const result = await getFlaggedRecipes();

// Get count of flagged recipes
const result = await getFlaggedRecipesCount();

// Regenerate single image
const result = await regenerateRecipeImage(recipeId);

// Batch regenerate all flagged images
const result = await regenerateAllFlaggedImages();
```

#### Admin Check

```typescript
import { isAdmin } from '@/lib/admin';

// Client-side check
const userIsAdmin = isAdmin(userId);

// Server-side check (required for all admin actions)
const { userId } = await requireAdmin(); // Throws if not admin
```

#### ISR Configuration

```typescript
// Shared recipes page
export const revalidate = 1800; // 30 minutes

// Recipe detail page (if converted to server component)
export const revalidate = 3600; // 1 hour

// Discover page remains client-side (interactive)
```

---

## Technical Implementation

### Image Generation Process

1. **Trigger**: Admin clicks "Regenerate Image"
2. **Validation**: Check recipe is flagged and admin is authorized
3. **Prompt Creation**: Build descriptive prompt from recipe data
4. **API Call**: OpenRouter → DALL-E 3 (1024x1024, standard quality)
5. **Update Database**: Replace `image_url` and `images` array
6. **Clear Flag**: Remove all flagging metadata
7. **Revalidate Paths**: Update cached pages
8. **Return Result**: Success with new image URL or error

### Error Handling

- **API Failures**: Graceful error messages, flag remains
- **Rate Limiting**: 1-second delay between batch operations
- **Missing Recipes**: Validation before regeneration
- **Auth Failures**: requireAdmin() throws clear errors
- **Network Issues**: Retry logic could be added

### Performance Considerations

- **No Public Impact**: Admin features load client-side only
- **Indexed Queries**: Fast lookup of flagged recipes
- **Batch Delays**: Prevents API rate limiting (1s between requests)
- **Path Revalidation**: Smart invalidation of affected pages only
- **Lazy Loading**: Flagged images section loads on-demand

---

## Security

### Authorization Layers

1. **Client-Side**: `isAdmin(userId)` check (UI only)
2. **Server Actions**: `requireAdmin()` enforces on every call
3. **Database**: No direct user access to admin tables
4. **API Keys**: OpenRouter key server-side only

### Admin Definition

Admins configured via:
- **Environment Variable**: `ADMIN_USER_IDS=user_xxxxx,user_yyyyy`
- **Clerk Metadata**: `sessionClaims.metadata.isAdmin === 'true'`
- **Multi-Layer Checks**: Both methods supported

### Audit Trail

Every flag records:
- **Who**: `image_regeneration_requested_by` (admin user ID)
- **When**: `image_regeneration_requested_at` (timestamp)
- **What**: Recipe ID and flag status

---

## Testing Checklist

### Manual Testing

- [ ] Admin can flag image on recipe page
- [ ] Non-admin users don't see flag button
- [ ] Flagged indicator appears correctly
- [ ] Unflag works without confirmation
- [ ] Admin dashboard shows flagged count
- [ ] Single image regeneration works
- [ ] Batch regeneration processes all recipes
- [ ] New images display correctly
- [ ] Flags cleared after successful regeneration
- [ ] Error messages shown for failures
- [ ] Public pages remain cached properly

### API Testing

```bash
# Test flag creation
curl -X POST /api/admin/flag-image \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"recipeId": "recipe-123"}'

# Test regeneration
curl -X POST /api/admin/regenerate-image \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"recipeId": "recipe-123"}'
```

---

## Migration Guide

### Running the Migration

```bash
# Apply database changes
npx tsx scripts/apply-image-flagging-migration.ts

# Verify schema
npx drizzle-kit studio
```

### Rollback (if needed)

```sql
ALTER TABLE recipes
DROP COLUMN IF EXISTS image_flagged_for_regeneration,
DROP COLUMN IF EXISTS image_regeneration_requested_at,
DROP COLUMN IF EXISTS image_regeneration_requested_by;

DROP INDEX IF EXISTS idx_recipes_flagged_images;
```

---

## Future Enhancements

### Potential Improvements

1. **Bulk Image Upload**: Allow admins to upload replacement images directly
2. **Flag Reasons**: Add dropdown for why image was flagged
3. **Image History**: Keep track of all previous images
4. **Quality Scoring**: AI-powered automatic quality assessment
5. **User Reporting**: Allow public users to report issues (moderated)
6. **Image Variations**: Generate multiple options for admin to choose
7. **Style Presets**: Different image styles (photo, illustration, minimalist)
8. **Scheduled Regeneration**: Queue for off-peak processing

### Integration Ideas

- **Analytics**: Track most commonly flagged recipe types
- **Notifications**: Alert admins when flag count exceeds threshold
- **Bulk Operations**: Flag by criteria (cuisine, date range, etc.)
- **Export Reports**: Generate CSV of flagged recipes with reasons

---

## Troubleshooting

### Common Issues

**Flag button not appearing:**
- Check user has admin role in Clerk metadata
- Verify `ADMIN_USER_IDS` environment variable includes user ID
- Ensure client-side hydration completed

**Image regeneration fails:**
- Check `OPENROUTER_API_KEY` is set correctly
- Verify API quota on OpenRouter dashboard
- Check network connectivity to OpenRouter
- Review server logs for detailed error messages

**Cached images not updating:**
- Revalidation paths may need expansion
- Try manual cache clear: `next build`
- Check ISR configuration on affected pages

**Batch regeneration slow:**
- Expected behavior: 1s delay between requests prevents rate limiting
- For faster processing, increase API tier on OpenRouter
- Consider implementing async job queue

---

## Code Examples

### Adding Flag Button to Custom Component

```typescript
import { RecipeImageFlag } from '@/components/admin/RecipeImageFlag';
import { isAdmin } from '@/lib/admin';

function CustomRecipeCard({ recipe, userId }) {
  const userIsAdmin = isAdmin(userId);

  return (
    <div className="relative">
      <img src={recipe.image_url} alt={recipe.name} />
      <RecipeImageFlag
        recipeId={recipe.id}
        isFlagged={recipe.image_flagged_for_regeneration}
        isAdmin={userIsAdmin}
      />
    </div>
  );
}
```

### Custom Regeneration Logic

```typescript
import { regenerateRecipeImage } from '@/app/actions/admin-recipes';

async function customRegeneration(recipeId: string) {
  const result = await regenerateRecipeImage(recipeId);

  if (result.success) {
    console.log('New image:', result.data.newImageUrl);
    toast.success('Image regenerated!');
  } else {
    console.error('Failed:', result.error);
    toast.error(result.error);
  }
}
```

---

## Metrics & Analytics

### Recommended Tracking

- **Flagging Rate**: % of recipes flagged by admins
- **Regeneration Success**: % of successful regenerations
- **Time to Regenerate**: Average API response time
- **Most Flagged Cuisines**: Which cuisines have quality issues
- **Admin Activity**: Which admins flag/regenerate most

### Sample Queries

```sql
-- Get flagging statistics
SELECT
  COUNT(*) as total_flagged,
  COUNT(DISTINCT image_regeneration_requested_by) as admin_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - image_regeneration_requested_at))/3600) as avg_hours_flagged
FROM recipes
WHERE image_flagged_for_regeneration = true;

-- Get regeneration history (requires audit table)
SELECT
  DATE(created_at) as date,
  COUNT(*) as regenerations
FROM recipe_image_audit
WHERE action = 'regenerated'
GROUP BY date
ORDER BY date DESC
LIMIT 30;
```

---

## Resources

### Documentation
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [DALL-E 3 Guide](https://platform.openai.com/docs/guides/images)
- [Next.js ISR](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)

### Related Files
- `src/app/actions/admin-recipes.ts` - Server actions
- `src/components/admin/RecipeImageFlag.tsx` - Flag button
- `src/components/admin/FlaggedImagesManager.tsx` - Dashboard UI
- `src/lib/admin.ts` - Admin utilities
- `scripts/apply-image-flagging-migration.ts` - Database migration

---

## Support

For issues or questions:
1. Check server logs: `npm run dev` output
2. Review OpenRouter API usage: https://openrouter.ai/account
3. Inspect browser console for client-side errors
4. Verify admin permissions in Clerk dashboard

---

**Last Updated**: 2025-10-17
**Implemented By**: Claude Code Engineer
**Version**: 1.0.0
