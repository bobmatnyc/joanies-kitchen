# Admin Setup Guide

This guide explains how to set up and configure admin access for the Recipe Manager application.

## Overview

Admin access in this application is controlled through Clerk's user metadata system. The middleware checks for admin status in session claims, and the UI shows admin-specific features based on user metadata.

## Setting Up Admin Access

### Step 1: Configure Custom Session Claims in Clerk Dashboard

1. Go to your Clerk Dashboard: https://dashboard.clerk.com/
2. Navigate to **Sessions** → **Customize session token**
3. Add the following JSON to include user metadata in session claims:

```json
{
  "metadata": "{{user.public_metadata}}"
}
```

4. Click **Save**

This configuration makes the user's `publicMetadata` available in the session token as `metadata`, which the middleware uses to check admin access.

### Step 2: Add Admin Flag to User's Public Metadata

1. In Clerk Dashboard, go to **Users**
2. Select the user you want to make an admin
3. Scroll to **Public metadata** section
4. Click **Edit**
5. Add the following JSON:

```json
{
  "isAdmin": "true"
}
```

6. Click **Save**

### Step 3: Verify Admin Setup

#### Method 1: Use the Debug Endpoint

Visit the debug endpoint while signed in:
```
http://localhost:3000/api/debug-session
```

You should see JSON output like:
```json
{
  "userId": "user_xxxxxxxxxxxxx",
  "hasSessionClaims": true,
  "metadata": {
    "isAdmin": "true"
  },
  "isAdminFromMetadata": "true",
  "allKeys": ["userId", "metadata", ...]
}
```

If `isAdminFromMetadata` is `"true"`, the admin setup is working correctly.

#### Method 2: Check the Profile Popup

1. Sign in with the admin user
2. Click on your profile avatar in the top right
3. You should see an "Admin Dashboard" menu item with a shield icon
4. Click it to navigate to `/admin`

#### Method 3: Direct Access

Try visiting the admin page directly:
```
http://localhost:3000/admin
```

- If you're an admin: You should see the Admin Dashboard
- If you're not an admin: You should be redirected to the home page
- If you're not signed in: You should be redirected to the sign-in page

## Troubleshooting

### Admin Link Not Appearing in Profile Popup

**Possible causes:**
1. User's `publicMetadata` doesn't have `isAdmin: "true"`
2. Clerk session hasn't refreshed after metadata change
3. Browser cache issue

**Solutions:**
1. Verify metadata in Clerk Dashboard (see Step 2 above)
2. Sign out and sign back in to refresh the session
3. Clear browser cache and reload
4. Check the debug endpoint to see what metadata is in the session

### Access Denied When Visiting /admin

**Possible causes:**
1. Custom session claims not configured in Clerk Dashboard
2. Metadata not syncing to session token
3. Middleware looking in wrong place for metadata

**Solutions:**
1. Verify custom session token configuration (see Step 1 above)
2. Check the debug endpoint to see session claims structure
3. Sign out and sign back in
4. Wait a few minutes for Clerk configuration to propagate

### Debug Endpoint Shows Wrong Metadata Structure

If the debug endpoint shows that `metadata` is `undefined` but `publicMetadata` has values, it means the custom session claims are not configured correctly.

**Solution:**
1. Go back to Step 1 and ensure the custom session token is configured
2. The key insight: Clerk doesn't include `publicMetadata` in session claims by default
3. You must explicitly add it using the custom session token configuration
4. After configuring, sign out and sign back in

## How It Works

### Frontend (Profile Popup)

The `AuthButtons.tsx` component:
1. Uses Clerk's `useUser()` hook to get user data
2. Checks `user?.publicMetadata?.isAdmin === 'true'`
3. Conditionally renders the "Admin Dashboard" menu item
4. Uses `useRouter()` to navigate to `/admin` when clicked

### Backend (Middleware)

The `middleware.ts`:
1. Gets session claims from Clerk using `auth()`
2. For admin routes, checks `sessionClaims?.metadata?.isAdmin === 'true'`
3. Redirects non-admin users to home page
4. Redirects unauthenticated users to sign-in page

### Why Two Checks?

- **Frontend check** (`publicMetadata`): Controls UI visibility, instant feedback
- **Backend check** (`sessionClaims.metadata`): Enforces security, prevents unauthorized access

Both checks look at the same underlying data, but access it differently:
- Frontend: Direct from user object
- Backend: From session token (requires custom claims configuration)

## Admin Features

Once admin access is set up, admins can:

1. **Access Admin Dashboard** (`/admin`)
   - View recipe statistics
   - See system health
   - Quick actions for common tasks

2. **Manage Recipes** (`/admin/recipes`)
   - View all recipes in the system
   - Edit any recipe
   - Delete recipes
   - Toggle recipe visibility

3. **View System Information**
   - Total recipes count
   - Public recipes count
   - System recipes count
   - Active users count

## Security Notes

1. **Never store sensitive data in publicMetadata** - it's visible to the frontend
2. **Always enforce access control in middleware** - frontend checks are for UX only
3. **Use string values** for metadata flags - Clerk stores metadata as JSON strings
4. **Sign out/in after metadata changes** - Clerk caches session tokens

## Testing Admin Access

### Test as Admin User

1. Set up admin access (Steps 1-2 above)
2. Sign in
3. Visit debug endpoint to verify: `http://localhost:3000/api/debug-session`
4. Check profile popup for admin link
5. Visit `/admin` directly
6. Verify access granted

### Test as Non-Admin User

1. Create a second user without admin metadata
2. Sign in with that user
3. Check profile popup - should NOT see admin link
4. Try visiting `/admin` directly - should redirect to home
5. Visit debug endpoint - should show `isAdminFromMetadata: null`

### Test Unauthenticated Access

1. Sign out
2. Try visiting `/admin` directly
3. Should redirect to `/sign-in?redirect_url=/admin`
4. After signing in, should redirect back to `/admin` (if admin)

## Common Metadata Patterns

### Admin Only
```json
{
  "isAdmin": "true"
}
```

### Admin with Permissions
```json
{
  "isAdmin": "true",
  "permissions": ["manage_recipes", "manage_users", "view_analytics"]
}
```

### Role-Based Access
```json
{
  "isAdmin": "true",
  "role": "super_admin",
  "department": "engineering"
}
```

## Development vs Production

The admin setup works identically in development and production, but remember:

### Development (localhost)
- Use development Clerk keys
- Can use Clerk test accounts
- Debug endpoint available

### Production
- Use production Clerk keys
- Real user accounts only
- Consider disabling/protecting debug endpoint

## Need Help?

1. Check the debug endpoint first: `/api/debug-session`
2. Verify Clerk Dashboard configuration
3. Check browser console for errors
4. Review middleware logs in terminal
5. Ensure you've signed out and back in after changes
