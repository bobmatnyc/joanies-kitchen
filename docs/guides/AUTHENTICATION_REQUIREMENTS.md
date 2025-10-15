# Authentication Requirements for Joanie's Kitchen

**Last Updated:** 2025-10-15

## Overview

All AI/LLM-powered features require user authentication to:
- **Prevent abuse and spam** - Protect against automated bot usage
- **Manage API costs** - LLM API calls cost money per request
- **Track usage per user** - Monitor and limit per-user quotas
- **Provide personalized experiences** - Associate recipes with user accounts

## Features Requiring Authentication

### 🔒 AI-Powered Features (Authentication Required)

#### 1. AI Recipe Generation (`/discover` page)
**Location:** `src/app/discover/page.tsx`, `src/app/actions/ai-recipes.ts`

**Why Auth Required:**
- Uses OpenRouter API (costs per request)
- Generates custom recipes based on user preferences
- Saves generated recipes to user's collection

**Server Actions:**
- `discoverRecipe(options)` - Requires auth
- `saveDiscoveredRecipe(recipe)` - Requires auth

**Implementation:**
```typescript
// Server action
export async function discoverRecipe(options: DiscoverRecipeOptions) {
  await requireAuth('AI recipe generation');
  // ... implementation
}

// UI Component
<RequireAuthAI
  featureName="AI Recipe Discovery"
  description="Generate custom recipes with AI..."
>
  {/* Feature content */}
</RequireAuthAI>
```

---

#### 2. Recipe Discovery Pipeline
**Location:** `src/components/recipe/RecipeDiscoveryPanel.tsx`, `src/app/actions/recipe-discovery.ts`

**Why Auth Required:**
- Uses Brave Search API (paid service)
- Uses Claude 3 Haiku for extraction and validation (costs per request)
- Generates embeddings with Hugging Face models
- Saves discovered recipes to user's collection

**Server Actions:**
- `discoverRecipes(query, options)` - Requires auth
- `discoverRecipeFromUrl(url)` - Requires auth

**Pipeline Steps (All Require Auth):**
1. Brave Search → Find recipe URLs
2. LLM Extraction → Extract recipe data with Claude
3. LLM Tagging → Generate metadata with Claude
4. Generate Embeddings → Create 384-dimensional vectors
5. Save to Database → Store with full provenance

**Implementation:**
```typescript
// Server action
export async function discoverRecipes(query: string, options) {
  await requireAuth('recipe discovery');
  // ... 6-step pipeline
}

// UI Component
<RequireAuthAI
  featureName="Recipe Discovery Pipeline"
  description="Discover, validate, and import recipes..."
>
  {/* Pipeline UI */}
</RequireAuthAI>
```

---

#### 3. Markdown Recipe Import
**Location:** `src/components/recipe/MarkdownImporter.tsx`, `src/app/actions/recipe-import.ts`

**Why Auth Required:**
- Saves imported recipes to user's collection
- Prevents anonymous bulk imports

**Server Actions:**
- `importRecipeFromMarkdown(markdownContent)` - Requires auth
- `importRecipesFromMarkdown(markdownFiles)` - Requires auth

**Implementation:**
```typescript
// Server action
export async function importRecipeFromMarkdown(markdownContent: string) {
  const { userId } = await requireAuth('recipe import from markdown');
  // ... parse and save
}

// UI Component
<RequireAuth
  featureName="Recipe Importer"
  description="Import recipes from markdown files..."
  icon={<Upload />}
>
  {/* Import UI */}
</RequireAuth>
```

---

### 🌐 Public Features (No Authentication Required)

#### 1. Browse Recipes
**Location:** `src/app/page.tsx`, `src/app/recipes/page.tsx`

**Why Public:**
- Allows discovery before sign-up
- Shows system/public recipes only when not authenticated
- Includes user's private recipes when authenticated

---

#### 2. Search Recipes (Text Search)
**Location:** Standard recipe list search

**Why Public:**
- Basic text-based filtering
- No AI/LLM costs involved
- Respects visibility rules (public/system only for anonymous users)

---

#### 3. Semantic Search (Vector Similarity)
**Location:** `src/app/actions/semantic-search.ts`

**Why Public (But Enhanced with Auth):**
- Generates embeddings for search queries (minimal cost)
- Shows public/system recipes for anonymous users
- **Enhanced for authenticated users:** Includes their private recipes

**Implementation:**
```typescript
export async function semanticSearchRecipes(query: string, options) {
  const { userId } = await auth(); // Optional auth check

  // Generate embedding (runs for all users)
  const queryEmbedding = await generateEmbedding(query);

  // Filter by visibility
  if (!userId) {
    // Anonymous: only public/system recipes
    visibilityFilter = or(eq(recipes.isPublic, true), eq(recipes.isSystemRecipe, true));
  } else {
    // Authenticated: public/system + user's private recipes
    visibilityFilter = or(
      eq(recipes.isPublic, true),
      eq(recipes.isSystemRecipe, true),
      eq(recipes.userId, userId)
    );
  }
}
```

---

#### 4. View Recipe Details
**Location:** `src/app/recipes/[id]/page.tsx`

**Why Public:**
- Allows sharing recipe links
- Shows public/system recipes to everyone
- Only shows private recipes to the owner

---

#### 5. Recipe Ratings (View Only)
**Location:** Recipe detail pages

**Why Public to View:**
- Ratings are aggregate data
- Helps users evaluate recipes before sign-up
- **Adding ratings requires auth** (separate action)

---

## Implementation Details

### Server-Side Authentication

#### Using `requireAuth()`
For features that MUST have authentication:

```typescript
import { requireAuth } from '@/lib/auth-guard';

export async function myLLMFunction() {
  const { userId } = await requireAuth('feature name');

  // Feature implementation
  // userId is guaranteed to exist
}
```

**Benefits:**
- Throws clear error message if not authenticated
- Returns guaranteed `userId`
- Consistent error handling

---

#### Using `checkAuth()`
For features with optional authentication:

```typescript
import { checkAuth } from '@/lib/auth-guard';

export async function myPublicFunction() {
  const { userId, isAuthenticated } = await checkAuth();

  if (isAuthenticated) {
    // Enhanced functionality for authenticated users
  } else {
    // Basic functionality for anonymous users
  }
}
```

**Benefits:**
- Non-blocking auth check
- Returns boolean flag
- Allows graceful degradation

---

### Client-Side Authentication

#### Using `<RequireAuth>`
For general features requiring authentication:

```typescript
import { RequireAuth } from '@/components/auth/RequireAuth';

export function MyFeature() {
  return (
    <RequireAuth
      featureName="My Feature"
      description="Sign in to access this feature"
      icon={<Icon />}
    >
      {/* Feature content - only shown to authenticated users */}
    </RequireAuth>
  );
}
```

---

#### Using `<RequireAuthAI>`
For AI-powered features (shows Sparkles icon):

```typescript
import { RequireAuthAI } from '@/components/auth/RequireAuth';

export function MyAIFeature() {
  return (
    <RequireAuthAI
      featureName="AI Feature"
      description="Sign in to use AI-powered features"
    >
      {/* AI feature content */}
    </RequireAuthAI>
  );
}
```

---

### Error Handling

#### Server Actions
```typescript
export async function myAction() {
  try {
    const { userId } = await requireAuth('my feature');
    // ... implementation
  } catch (error) {
    if (error.message.includes('Authentication required')) {
      return {
        success: false,
        error: 'Please sign in to use this feature.',
      };
    }
    throw error; // Re-throw other errors
  }
}
```

---

#### Client Components
```typescript
'use client';

import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';

export function MyComponent() {
  const { isSignedIn } = useAuth();

  const handleAction = async () => {
    if (!isSignedIn) {
      toast.error('Please sign in to continue', {
        action: {
          label: 'Sign In',
          onClick: () => {/* Open sign-in modal */}
        }
      });
      return;
    }

    // Proceed with action
  };
}
```

---

## Authentication Flow

### 1. Anonymous User Visits Feature

```
User visits /discover
    ↓
<RequireAuthAI> detects no auth
    ↓
Shows sign-in prompt with feature description
    ↓
User clicks "Sign In to Continue"
    ↓
Clerk modal opens
    ↓
User signs in or signs up
    ↓
<RequireAuthAI> detects auth
    ↓
Shows feature content
```

### 2. Authenticated User Calls Server Action

```
User triggers action (e.g., generate recipe)
    ↓
Client calls server action
    ↓
requireAuth() checks Clerk session
    ↓
✅ Session valid → Continue with userId
    ↓
Action executes successfully
    ↓
Result returned to client
```

### 3. Session Expires During Action

```
User triggers action
    ↓
requireAuth() checks Clerk session
    ↓
❌ Session expired → Throw error
    ↓
Error caught by client
    ↓
Show "Session expired" message
    ↓
Prompt user to sign in again
```

---

## Testing Authentication

### Test Authenticated Features

1. **Sign in** with test account
2. Navigate to protected feature (e.g., `/discover`)
3. Verify feature is accessible
4. Test functionality works correctly

### Test Auth Gates

1. **Sign out** (use Clerk UserButton or `/sign-out`)
2. Navigate to protected feature
3. Verify sign-in prompt displays
4. Verify feature content is hidden
5. Click "Sign In to Continue"
6. Verify Clerk modal opens

### Test Error Handling

1. Sign in
2. Start a long-running action (e.g., recipe discovery)
3. Open browser DevTools → Application → Cookies
4. Delete Clerk session cookies
5. Wait for action to complete
6. Verify error message shows correctly

---

## Security Considerations

### ✅ DO

- Always use `requireAuth()` for LLM-powered server actions
- Validate `userId` is present before database operations
- Use Clerk middleware in `src/middleware.ts` to protect routes
- Return user-friendly error messages
- Log authentication failures for monitoring

### ❌ DON'T

- Trust client-side auth state for security decisions
- Expose API keys to the client
- Allow anonymous users to call LLM endpoints
- Skip auth checks because "it's easier"
- Return sensitive error details to client

---

## Rate Limiting (Future Enhancement)

### Recommended Implementation

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 requests per hour
});

export async function discoverRecipe(options) {
  const { userId } = await requireAuth('AI recipe generation');

  // Check rate limit
  const { success, limit, remaining } = await ratelimit.limit(userId);

  if (!success) {
    return {
      success: false,
      error: `Rate limit exceeded. ${remaining} requests remaining.`,
    };
  }

  // Continue with generation
}
```

---

## Monitoring & Analytics

### Track Auth Events

```typescript
// In server actions
export async function discoverRecipe(options) {
  const { userId } = await requireAuth('AI recipe generation');

  // Log usage
  await analytics.track({
    userId,
    event: 'ai_recipe_generated',
    properties: {
      model: options.model,
      timestamp: new Date(),
    },
  });

  // Continue...
}
```

### Key Metrics to Track

- **Auth Failures:** Count of `requireAuth()` failures
- **Feature Usage:** Per-user usage of LLM features
- **API Costs:** Track per-user LLM API spending
- **Conversion Rate:** Anonymous → signed-up users

---

## Troubleshooting

### "Authentication required" error in browser

**Cause:** User not signed in or session expired

**Solution:**
1. Check Clerk session in browser DevTools
2. Try signing in again
3. Clear browser cookies and retry

---

### Server action fails silently

**Cause:** `requireAuth()` throwing error but not caught

**Solution:**
```typescript
try {
  const { userId } = await requireAuth('feature');
  // ...
} catch (error) {
  console.error('Auth error:', error);
  return { success: false, error: error.message };
}
```

---

### User signed in but still sees auth gate

**Cause:** Client auth state not synchronized

**Solution:**
1. Verify `<ClerkProvider>` wraps app in `src/app/layout.tsx`
2. Check `useAuth()` hook returns `isSignedIn: true`
3. Refresh page to sync state

---

## Related Documentation

- **Authentication Setup:** `docs/guides/AUTHENTICATION_GUIDE.md`
- **Clerk Configuration:** `docs/guides/CLERK_SETUP_GUIDE.md`
- **Auth Guard Utilities:** `src/lib/auth-guard.ts`
- **RequireAuth Component:** `src/components/auth/RequireAuth.tsx`

---

## Summary Checklist

### ✅ Features Gated Successfully

- [x] AI Recipe Generation (`discoverRecipe`)
- [x] Recipe Discovery Pipeline (`discoverRecipes`, `discoverRecipeFromUrl`)
- [x] Markdown Import (`importRecipeFromMarkdown`, `importRecipesFromMarkdown`)
- [x] All server actions use `requireAuth()`
- [x] All UI components wrapped with `<RequireAuth>` or `<RequireAuthAI>`

### ✅ Public Features Remain Accessible

- [x] Browse recipes (home page)
- [x] Search recipes (text search)
- [x] Semantic search (enhanced with auth)
- [x] View recipe details
- [x] View ratings

### ✅ Implementation Complete

- [x] `auth-guard.ts` utility created
- [x] `RequireAuth.tsx` component created
- [x] All LLM server actions protected
- [x] Error handling implemented
- [x] User-friendly prompts
- [x] Documentation complete

---

**Status:** ✅ Authentication gates fully implemented

All LLM-powered features are now protected with proper authentication gates, while public features remain accessible to anonymous users for discovery and conversion.
