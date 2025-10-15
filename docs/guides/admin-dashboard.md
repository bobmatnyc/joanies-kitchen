# Admin Dashboard Guide

## Overview

A comprehensive admin dashboard with multi-layer security using Clerk's `isAdmin` metadata for role-based access control. Provides full database management capabilities for recipes, users, and system settings.

## Access Control Architecture

### Multi-Layer Security

1. **Middleware Layer** (`src/middleware.ts`)
   - Checks admin routes `/admin(.*)`
   - Validates `sessionClaims.metadata.isAdmin === 'true'`
   - Redirects non-admin users to homepage

2. **Server Component Layer** (`src/app/admin/layout.tsx`)
   - Server-side auth check on every admin page
   - Redirects non-admin users before rendering

3. **Server Actions Layer** (`src/app/actions/admin.ts`)
   - Every admin action calls `requireAdmin()` first
   - Throws error if user is not admin

## Setting Admin Users

To grant admin access to a user in Clerk:

```javascript
// In Clerk Dashboard → Users → Select User → Metadata → Public Metadata
{
  "isAdmin": "true"
}
```

Or programmatically via Clerk API:

```javascript
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: {
    isAdmin: "true"
  }
});
```

## File Structure

```
src/
├── lib/
│   └── admin.ts                          # Admin utility functions
├── middleware.ts                         # Route protection (updated)
├── app/
│   ├── actions/
│   │   ├── admin.ts                      # Admin server actions (NEW)
│   │   └── recipes.ts                    # Updated with admin check
│   └── admin/
│       ├── layout.tsx                    # Admin layout with auth (NEW)
│       ├── page.tsx                      # Dashboard home (NEW)
│       └── recipes/
│           └── page.tsx                  # Recipe management (NEW)
└── components/
    └── admin/
        ├── StatsCard.tsx                 # Statistics display (NEW)
        ├── RecipeDataTable.tsx           # Recipe table (NEW)
        ├── RecipeRow.tsx                 # Recipe row with actions (NEW)
        └── BulkActionBar.tsx             # Bulk operations (NEW)
```

## Features Implemented

### Admin Dashboard Home (`/admin`)

**Statistics Cards:**
- Total Recipes
- Public Recipes
- System Recipes
- Active Users

**Recent Activity:**
- Last 10 recipes created
- Shows public/system/AI status
- Links to recipe details

**Quick Actions:**
- Manage Recipes
- View Public Recipes
- Create Recipe
- Back to Site

**System Info:**
- Database health status
- Environment information
- Auth provider details

### Recipe Management (`/admin/recipes`)

**Search & Filters:**
- Search by name, description, cuisine, tags
- Filter by visibility (all/public/private)
- Filter by type (all/system/user)
- Real-time filtering

**Recipe Table:**
- **Columns:**
  - Checkbox for bulk selection
  - Recipe name with description
  - User ID
  - Public toggle (Switch)
  - System toggle (Switch)
  - Created date/time
  - Actions (View, Delete)

**Individual Actions:**
- Toggle public/private status
- Toggle system recipe status
- Delete with confirmation dialog
- View recipe details

**Bulk Operations:**
- Select multiple recipes
- Publish all selected
- Unpublish all selected
- Delete all selected (with confirmation)

**Pagination:**
- 20 recipes per page
- Previous/Next navigation
- Page counter

## Admin Server Actions

Location: `src/app/actions/admin.ts`

### Statistics

```typescript
getAdminRecipeStats()
// Returns: totalRecipes, publicRecipes, systemRecipes, privateRecipes, totalUsers, aiGeneratedRecipes
```

### Recipe Management

```typescript
getAllRecipesForAdmin(filters?: AdminRecipeFilters)
// Get all recipes with optional filtering
// Filters: search, isPublic, isSystemRecipe, difficulty, cuisine, limit, offset

adminToggleRecipePublic(id: string, isPublic: boolean)
// Toggle recipe visibility

adminToggleSystemRecipe(id: string, isSystem: boolean)
// Mark recipe as system recipe (auto-sets public=true)

adminDeleteRecipe(id: string)
// Delete any recipe (admin override)

adminBulkTogglePublic(ids: string[], isPublic: boolean)
// Bulk visibility change

adminBulkDeleteRecipes(ids: string[])
// Bulk delete with confirmation
```

### User Management

```typescript
getUsersWithRecipes()
// Get users who have created recipes with stats
// Returns: userId, recipeCount, publicRecipeCount, systemRecipeCount, latestRecipeDate

getRecentRecipeActivity(limit: number = 10)
// Get recent recipes for activity feed
```

## Admin Utility Library

Location: `src/lib/admin.ts`

```typescript
// Check if current user has admin access
checkAdminAccess(): Promise<AdminCheckResult>
// Returns: { isAdmin, userId, sessionClaims }

// Require admin access (throws error if not admin)
requireAdmin(): Promise<{ userId: string }>
// Use in server actions for enforcement

// Check if specific user ID has admin access
isUserAdmin(checkUserId: string): Promise<boolean>
```

## Security Features

### Route Protection
- Middleware blocks non-admin access to `/admin/*`
- Redirects to homepage if not authenticated
- Redirects to sign-in if not logged in

### Server Component Protection
- Admin layout checks auth on every page load
- Server-side validation prevents bypassing middleware

### Server Action Protection
- Every admin action calls `requireAdmin()` first
- Throws error if user is not admin
- No way to bypass via client manipulation

### Confirmation Dialogs
- Delete operations require confirmation
- Bulk delete requires confirmation
- Prevents accidental destructive actions

## UI/UX Features

### Toast Notifications
- Success messages for completed actions
- Error messages with details
- Loading states during operations

### Loading States
- Skeleton loading for statistics
- Loading spinners during data fetch
- Disabled buttons during operations

### Error Handling
- Graceful error display
- Retry functionality
- Clear error messages

### Responsive Design
- Mobile-friendly tables
- Responsive grid layouts
- Touch-friendly controls

## Usage Examples

### Accessing Admin Dashboard

1. Sign in to your account
2. Ensure your user has `isAdmin: "true"` in Clerk metadata
3. Navigate to `/admin`
4. If not admin, you'll be redirected to homepage

### Managing Recipes

**Toggle Public Status:**
1. Go to `/admin/recipes`
2. Find recipe in table
3. Click the "Public" switch
4. Recipe visibility updates immediately

**Mark as System Recipe:**
1. Find recipe in table
2. Click the "System" switch
3. Recipe is marked as system and automatically made public

**Bulk Operations:**
1. Select multiple recipes using checkboxes
2. Choose action from bulk action bar
3. Confirm if destructive operation
4. All selected recipes are updated

**Delete Recipe:**
1. Click "Delete" button on recipe row
2. Confirm deletion in dialog
3. Recipe is permanently deleted

## TypeScript Types

```typescript
// Admin Recipe Stats
interface AdminRecipeStats {
  totalRecipes: number;
  publicRecipes: number;
  systemRecipes: number;
  privateRecipes: number;
  totalUsers: number;
  aiGeneratedRecipes: number;
}

// Admin Recipe Filters
interface AdminRecipeFilters {
  search?: string;
  isPublic?: boolean;
  isSystemRecipe?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  isAiGenerated?: boolean;
  limit?: number;
  offset?: number;
}

// User with Recipes
interface UserWithRecipes {
  userId: string;
  recipeCount: number;
  publicRecipeCount: number;
  systemRecipeCount: number;
  latestRecipeDate: Date | null;
}

// Admin Check Result
interface AdminCheckResult {
  isAdmin: boolean;
  userId: string | null;
  sessionClaims: any;
}
```

## Middleware Updates

The middleware now includes admin route protection:

```typescript
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

// In clerkMiddleware callback:
if (isAdminRoute(req)) {
  if (!userId) {
    // Redirect to sign-in
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Check admin role
  const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
  const isAdmin = metadata?.isAdmin === 'true';
  if (!isAdmin) {
    // Redirect to home
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}
```

## Database Schema

The admin dashboard works with the existing `recipes` table:

```sql
- id (text, primary key)
- userId (text, Clerk user ID)
- name (text)
- description (text)
- ingredients (text, JSON)
- instructions (text, JSON)
- prepTime (integer, minutes)
- cookTime (integer, minutes)
- servings (integer)
- difficulty (text, enum: easy/medium/hard)
- cuisine (text)
- tags (text, JSON)
- images (text, JSON array)
- isAiGenerated (boolean)
- isPublic (boolean)       -- Recipe visibility
- isSystemRecipe (boolean) -- System/curated recipes
- nutritionInfo (text, JSON)
- createdAt (timestamp)
- updatedAt (timestamp)
```

## Testing Checklist

### Security Tests
- [ ] Non-admin users cannot access `/admin`
- [ ] Non-authenticated users redirected to sign-in
- [ ] Server actions reject non-admin calls
- [ ] Middleware properly validates admin role

### Functionality Tests
- [ ] Dashboard displays correct statistics
- [ ] Recipe table loads all recipes
- [ ] Search and filters work correctly
- [ ] Public toggle updates recipe visibility
- [ ] System toggle updates recipe status
- [ ] Delete operations work with confirmation
- [ ] Bulk operations update multiple recipes
- [ ] Pagination works correctly

### UI/UX Tests
- [ ] Loading states display correctly
- [ ] Error messages are clear and helpful
- [ ] Toast notifications appear for actions
- [ ] Confirmation dialogs prevent accidents
- [ ] Responsive design works on mobile
- [ ] Navigation is intuitive

## Performance Considerations

- Server components for better performance
- Pagination limits queries to 20 items
- Efficient database queries with proper indexing
- Client-side filtering for instant feedback
- Optimistic UI updates for better UX

## Future Enhancements

Potential features to add:

1. **User Management**
   - View all users
   - Manage user roles
   - Ban/suspend users

2. **Analytics**
   - Recipe view counts
   - Popular recipes dashboard
   - User activity trends

3. **Content Moderation**
   - Flag inappropriate content
   - Review flagged recipes
   - Automated content filters

4. **Bulk Import/Export**
   - CSV import for recipes
   - JSON export for backups
   - Migration tools

5. **Audit Logs**
   - Track admin actions
   - View change history
   - Rollback capabilities

## Troubleshooting

### Common Issues

**Issue: Cannot access /admin**
- Solution: Check that your user has `isAdmin: "true"` in Clerk public metadata

**Issue: TypeScript errors about metadata.isAdmin**
- Solution: Use type assertion: `const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined`

**Issue: Build fails on global-error.tsx**
- Solution: This is a pre-existing issue. Fix global-error.tsx to use proper Next.js error boundary syntax

**Issue: Actions not working**
- Solution: Check that `requireAdmin()` is called at the start of each server action

## Support

For issues or questions:
- Check Clerk documentation for metadata setup
- Review Next.js App Router authentication patterns
- Ensure all admin users have correct metadata in Clerk Dashboard

## License

Part of the Recipe Manager application.
