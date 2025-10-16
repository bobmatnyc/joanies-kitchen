# Recipe Rating & Flagging System

Complete implementation guide for Joanie's Kitchen recipe rating and content moderation system.

## Overview

This document describes the comprehensive rating and flagging system implemented for recipe quality assessment and content moderation.

### Features Implemented

✅ **User Rating System**
- Star rating interface (1-5 stars)
- Optional review text
- One rating per user per recipe
- Real-time average rating calculation
- Display of community ratings
- System (AI) quality scores

✅ **Content Flagging System**
- Report inappropriate content
- Multiple flag reasons (inappropriate, spam, copyright, quality, other)
- Admin review workflow
- Flag status tracking (pending, reviewed, resolved, dismissed)
- Admin dashboard for flag management

---

## Database Schema

### Recipe Ratings Table

**Table**: `recipe_ratings`

Already existed in schema. Used for storing individual user ratings.

```typescript
{
  id: uuid (primary key)
  recipeId: text (foreign key → recipes.id)
  userId: text (Clerk user ID)
  rating: integer (0-5)
  review: text (optional)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Constraints**:
- Unique constraint on (recipeId, userId) - one rating per user per recipe
- Cascade delete when recipe is deleted

**Indexes**:
- `recipe_ratings_recipe_id_idx` - Fast recipe lookup
- `recipe_ratings_user_id_idx` - Fast user lookup

### Recipe Flags Table

**Table**: `recipe_flags`

Newly created for content moderation.

```typescript
{
  id: uuid (primary key)
  recipeId: text (foreign key → recipes.id)
  userId: text (Clerk user ID - reporter)
  reason: enum ['inappropriate', 'spam', 'copyright', 'quality', 'other']
  description: text (optional detailed explanation)
  status: enum ['pending', 'reviewed', 'resolved', 'dismissed']
  reviewedBy: text (admin user ID)
  reviewedAt: timestamp
  reviewNotes: text (admin notes)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Constraints**:
- Cascade delete when recipe is deleted

**Indexes**:
- `recipe_flags_recipe_id_idx` - Fast recipe lookup
- `recipe_flags_status_idx` - Fast status filtering
- `recipe_flags_user_id_idx` - Fast user lookup
- `recipe_flags_created_at_idx` - Chronological sorting

---

## Server Actions

### Rating Actions

**File**: `src/app/actions/rate-recipe.ts`

Already existed with full implementation.

#### `rateRecipe(recipeId, rating, review?)`

Creates or updates a user's rating for a recipe.

**Parameters**:
- `recipeId: string` - Recipe to rate
- `rating: number` - Star rating (0-5)
- `review?: string` - Optional review text

**Returns**:
```typescript
{
  success: boolean
  error?: string
  rating?: number
  avgUserRating?: number
  totalRatings?: number
}
```

**Behavior**:
- Validates user authentication
- Validates rating range (0-5)
- Upserts rating (creates or updates existing)
- Recalculates average rating
- Updates recipe.avgUserRating and recipe.totalUserRatings
- Revalidates recipe pages

#### `getUserRating(recipeId)`

Gets the current user's rating for a recipe.

**Returns**: User's rating object or null if not rated

#### `getRecipeRatings(recipeId, limit?)`

Gets all ratings for a recipe (for display/analysis).

**Returns**: Array of rating objects

#### `deleteRating(recipeId, targetUserId?)`

Deletes a rating (user's own or admin action).

**Returns**: Success status

---

### Flagging Actions

**File**: `src/app/actions/flag-recipe.ts`

Newly created for content moderation.

#### `flagRecipe(recipeId, reason, description?)`

Flags a recipe for admin review.

**Parameters**:
- `recipeId: string` - Recipe to flag
- `reason: FlagReason` - Reason enum value
- `description?: string` - Optional details

**Returns**:
```typescript
{
  success: boolean
  error?: string
  flagId?: string
}
```

**Behavior**:
- Requires authentication
- Validates reason
- Creates flag with 'pending' status
- Revalidates recipe and admin pages

#### `getFlagCount(recipeId)`

Gets count of pending flags for a recipe.

**Returns**: Number of pending flags

#### `hasUserFlagged(recipeId)`

Checks if current user has flagged this recipe.

**Returns**: Boolean

#### `getAllFlags(status?, limit?)`

Gets all flags (admin only).

**Parameters**:
- `status?: FlagStatus` - Filter by status
- `limit?: number` - Max results (default 50)

**Returns**: Array of flag objects with recipe info

**Authorization**: Checks for admin role in sessionClaims

#### `reviewFlag(flagId, status, reviewNotes?)`

Reviews and updates a flag (admin only).

**Parameters**:
- `flagId: string` - Flag to review
- `status: 'reviewed' | 'resolved' | 'dismissed'` - New status
- `reviewNotes?: string` - Optional admin notes

**Returns**: Success status

**Authorization**: Checks for admin role in sessionClaims

#### `getRecipeFlags(recipeId)`

Gets all flags for a specific recipe (admin only).

**Returns**: Array of flags for the recipe

---

## UI Components

### RecipeRating Component

**File**: `src/components/recipe/RecipeRating.tsx`

Already existed with full implementation.

**Features**:
- Displays system rating (AI quality score)
- Displays community rating (average user ratings)
- Interactive star rating input
- Optional review text input
- Authentication gate
- Optimistic updates with router.refresh()
- Success/error feedback

**Props**:
```typescript
{
  recipeId: string
  systemRating?: number | string | null
  systemRatingReason?: string | null
  avgUserRating?: number | string | null
  totalUserRatings?: number
  userRating?: number | null
  userReview?: string | null
  isAuthenticated?: boolean
}
```

**Usage**:
```tsx
<RecipeRating
  recipeId={recipe.id}
  systemRating={recipe.systemRating}
  systemRatingReason={recipe.systemRatingReason}
  avgUserRating={recipe.avgUserRating}
  totalUserRatings={recipe.totalUserRatings}
  userRating={userRating?.rating}
  userReview={userRating?.review}
  isAuthenticated={!!userId}
/>
```

---

### FlagRecipeButton Component

**File**: `src/components/recipe/FlagRecipeButton.tsx`

Newly created for content flagging.

**Features**:
- Subtle flag button
- Dialog with reason selection
- Optional description field
- Authentication gate
- Disabled state if already flagged
- Success confirmation
- Error handling

**Props**:
```typescript
{
  recipeId: string
  recipeName: string
  isAuthenticated?: boolean
  hasUserFlagged?: boolean
}
```

**Flag Reasons**:
- `inappropriate` - Inappropriate Content
- `spam` - Spam
- `copyright` - Copyright Violation
- `quality` - Quality Issues
- `other` - Other

**Usage**:
```tsx
<FlagRecipeButton
  recipeId={recipe.id}
  recipeName={recipe.name}
  isAuthenticated={!!userId}
  hasUserFlagged={hasUserFlagged}
/>
```

---

### FlagList Component

**File**: `src/components/admin/FlagList.tsx`

Admin component for displaying and managing flags.

**Features**:
- Flag card display with details
- Link to flagged recipe
- Status badges
- Review actions (Under Review, Resolve, Dismiss)
- Review notes dialog
- Real-time updates

**Props**:
```typescript
{
  flags: FlagData[]
}
```

---

## Admin Dashboard

### Flags Page

**File**: `src/app/admin/flags/page.tsx`

Admin dashboard for content moderation.

**Features**:
- Statistics overview (pending, reviewed, resolved, dismissed counts)
- Tab-based filtering by status
- All flags view
- Suspense boundaries for loading states
- Server-side data fetching

**Navigation**: Added to admin layout at `/admin/flags`

**Authorization**: Protected by admin layout (checks sessionClaims.metadata.isAdmin === 'true')

---

## Integration Examples

### Recipe Detail Page Integration

```tsx
import { auth } from '@clerk/nextjs/server';
import { getUserRating } from '@/app/actions/rate-recipe';
import { hasUserFlagged } from '@/app/actions/flag-recipe';
import { RecipeRating } from '@/components/recipe/RecipeRating';
import { FlagRecipeButton } from '@/components/recipe/FlagRecipeButton';

export default async function RecipePage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  const recipe = await getRecipe(params.id);

  // Get user's existing rating
  const userRating = userId ? await getUserRating(params.id) : null;

  // Check if user has flagged this recipe
  const userHasFlagged = userId ? await hasUserFlagged(params.id) : false;

  return (
    <div>
      <h1>{recipe.name}</h1>

      {/* Rating Component */}
      <RecipeRating
        recipeId={recipe.id}
        systemRating={recipe.systemRating}
        systemRatingReason={recipe.systemRatingReason}
        avgUserRating={recipe.avgUserRating}
        totalUserRatings={recipe.totalUserRatings}
        userRating={userRating?.rating}
        userReview={userRating?.review}
        isAuthenticated={!!userId}
      />

      {/* Flag Button */}
      <FlagRecipeButton
        recipeId={recipe.id}
        recipeName={recipe.name}
        isAuthenticated={!!userId}
        hasUserFlagged={userHasFlagged}
      />
    </div>
  );
}
```

---

## Authentication & Authorization

### User Authentication

Both rating and flagging require user authentication via Clerk:

```typescript
const { userId } = await auth();

if (!userId) {
  return { success: false, error: 'You must be logged in' };
}
```

### Admin Authorization

Admin actions check for admin role in sessionClaims:

```typescript
const { userId, sessionClaims } = await auth();

if (!userId) {
  throw new Error('Unauthorized');
}

const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
if (metadata?.isAdmin !== 'true') {
  throw new Error('Admin access required');
}
```

**Setting Admin Role**: Admin status is managed through Clerk metadata.

---

## Database Operations

### Rating Aggregation

When a rating is submitted or updated:

1. Upsert rating record
2. Calculate average rating:
   ```sql
   SELECT CAST(AVG(rating) AS DECIMAL(2,1)), COUNT(*)
   FROM recipe_ratings
   WHERE recipe_id = ?
   ```
3. Update recipe table:
   ```typescript
   await db.update(recipes)
     .set({
       avgUserRating: avgRating.toFixed(1),
       totalUserRatings: totalRatings,
     })
     .where(eq(recipes.id, recipeId));
   ```

### Flag Management

Flags follow a state machine:

```
pending → reviewed → resolved
        ↘         ↘
         dismissed  dismissed
```

Status transitions are handled by `reviewFlag` action with admin-only access.

---

## Performance Considerations

### Indexes

All tables have appropriate indexes for common queries:
- Recipe ID lookups (for displaying ratings/flags)
- User ID lookups (for user-specific data)
- Status filtering (for admin dashboard)
- Chronological sorting (for recent activity)

### Caching Strategy

- Uses Next.js `revalidatePath()` to invalidate cached pages after mutations
- Recipe pages are revalidated when ratings/flags change
- Admin dashboard is revalidated when flag status changes

### Pagination

Admin flag list supports pagination via `limit` parameter (default 50, max configurable).

---

## Testing Checklist

### Rating System

- [ ] User can rate a recipe (1-5 stars)
- [ ] User can add optional review text
- [ ] User can update their existing rating
- [ ] Average rating updates correctly
- [ ] Rating count increments
- [ ] Unauthenticated users see "Sign in to rate"
- [ ] Rating persists after page refresh
- [ ] Multiple users' ratings aggregate correctly

### Flagging System

- [ ] User can flag a recipe
- [ ] All flag reasons are selectable
- [ ] Optional description can be added
- [ ] Flag appears in admin dashboard
- [ ] User cannot flag same recipe twice
- [ ] Unauthenticated users see disabled state
- [ ] Admin can view all flags
- [ ] Admin can filter flags by status
- [ ] Admin can mark flag as reviewed
- [ ] Admin can resolve flag
- [ ] Admin can dismiss flag
- [ ] Admin notes are saved
- [ ] Non-admin users cannot access admin dashboard

---

## Security Considerations

### Input Validation

- Rating values validated (0-5 range)
- Flag reasons validated against enum
- Text inputs sanitized (XSS protection via React)
- User IDs validated through Clerk auth

### Authorization

- User authentication required for rating/flagging
- Admin role required for flag management
- Recipe ownership not required (any user can rate/flag public recipes)
- Server-side validation on all actions

### Data Integrity

- Unique constraint prevents duplicate ratings
- Foreign key constraints maintain referential integrity
- Cascade deletes remove ratings/flags when recipe deleted
- Transaction support for atomic operations

---

## Future Enhancements

### Potential Improvements

1. **Rating Analytics**
   - Rating distribution charts
   - Rating trends over time
   - Compare system vs. user ratings

2. **Enhanced Moderation**
   - Auto-hide recipes with multiple flags
   - Email notifications for admin
   - Bulk flag actions
   - Flag appeal system

3. **User Reputation**
   - Track user rating patterns
   - Identify helpful reviewers
   - Flag abuse detection

4. **Review Features**
   - Helpful/not helpful votes on reviews
   - Sort reviews by rating/date/helpfulness
   - Image uploads in reviews

5. **Reporting**
   - Flag statistics dashboard
   - Moderation activity logs
   - Recipe quality reports

---

## Deployment Checklist

- [x] Database schema created (`recipe_flags` table)
- [x] Server actions implemented (rate-recipe.ts, flag-recipe.ts)
- [x] UI components created (RecipeRating, FlagRecipeButton, FlagList)
- [x] Admin dashboard created (/admin/flags)
- [x] Admin navigation updated
- [ ] Database migrations run on production
- [ ] Admin users configured in Clerk
- [ ] Test all features in staging environment
- [ ] Monitor flag volume and response times

---

## Support & Troubleshooting

### Common Issues

**Issue**: Ratings not updating
- Check database connection
- Verify Clerk authentication
- Check browser console for errors
- Ensure `revalidatePath()` is working

**Issue**: Admin dashboard not accessible
- Verify admin metadata in Clerk
- Check sessionClaims structure
- Ensure admin role is set correctly

**Issue**: Flags not appearing in dashboard
- Check flag status (might be filtered out)
- Verify database query in `getAllFlags()`
- Check admin authorization

### Debug Tools

- **Drizzle Studio**: `pnpm db:studio` - Inspect database
- **Browser DevTools**: Check network requests and console logs
- **Server Logs**: Check Next.js server logs for errors

---

## Documentation Updates

This system adds the following to the codebase:

1. **Schema Changes**: Added `recipe_flags` table
2. **Server Actions**: Added `flag-recipe.ts`
3. **UI Components**: Added `FlagRecipeButton`, `FlagList`, `Textarea`
4. **Admin Pages**: Added `/admin/flags`
5. **Navigation**: Updated admin layout

All changes follow existing project patterns and coding standards.

---

**Last Updated**: 2025-10-15
**Version**: 1.0.0
**Author**: Recipe Manager Team
