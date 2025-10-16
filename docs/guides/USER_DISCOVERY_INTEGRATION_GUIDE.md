# User Discovery - Integration Guide

**Last Updated**: 2025-10-15
**Version**: 0.5.0

---

## Quick Start Integration

This guide shows how to integrate Phase 1 User Discovery features with existing recipe pages and components.

---

## 1. Add Favorite Button to Recipe Cards

### File: `src/components/recipe/RecipeCard.tsx`

Add the FavoriteButton to the recipe card:

```tsx
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

export function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <div className="recipe-card">
      {/* Existing card content */}

      {/* Add favorite button in top-right corner */}
      <div className="absolute top-2 right-2">
        <FavoriteButton
          recipeId={recipe.id}
          variant="ghost"
          size="icon"
        />
      </div>

      {/* Rest of card... */}
    </div>
  );
}
```

---

## 2. Add Collection & Favorite Buttons to Recipe Detail Page

### File: `src/app/recipes/[id]/page.tsx`

Add both buttons to the recipe detail page:

```tsx
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { AddToCollectionButton } from '@/components/collections/AddToCollectionButton';

export default async function RecipeDetailPage({ params }) {
  const recipe = await getRecipeById(params.id);

  return (
    <div className="recipe-detail">
      {/* Recipe Header */}
      <div className="flex items-center justify-between mb-6">
        <h1>{recipe.name}</h1>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <FavoriteButton
            recipeId={recipe.id}
            variant="outline"
            size="default"
            showLabel={true}
          />
          <AddToCollectionButton
            recipeId={recipe.id}
            variant="outline"
            size="default"
          />
        </div>
      </div>

      {/* Rest of recipe details... */}
    </div>
  );
}
```

---

## 3. Link Recipes to User Profiles

### Update Recipe Actions to Create Profile if Missing

**File**: `src/app/actions/recipes.ts`

```typescript
import { getCurrentUserProfile, createOrUpdateProfile } from './user-profiles';

export async function createRecipe(recipeData: NewRecipe) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if user has a profile, create if missing
  let profile = await getCurrentUserProfile();

  if (!profile) {
    // Create basic profile from Clerk data
    const user = await clerkClient.users.getUser(userId);
    const username = user.username || `user_${userId.slice(0, 8)}`;

    const profileResult = await createOrUpdateProfile({
      username,
      displayName: user.fullName || user.firstName || username,
      isPublic: false, // Default to private
    });

    if (!profileResult.success) {
      return { success: false, error: 'Failed to create profile' };
    }
  }

  // Create recipe as normal
  const [newRecipe] = await db
    .insert(recipes)
    .values({
      ...recipeData,
      userId,
    })
    .returning();

  return { success: true, recipe: newRecipe };
}
```

---

## 4. Add Profile Link to Recipe Cards

Show recipe creator information:

```tsx
import Link from 'next/link';
import { getProfileByUserId } from '@/app/actions/user-profiles';

export async function RecipeCard({ recipe }: RecipeCardProps) {
  // Fetch creator profile
  const creator = await getProfileByUserId(recipe.userId);

  return (
    <div className="recipe-card">
      {/* Recipe content */}

      {/* Creator info */}
      {creator && (
        <div className="mt-4 text-sm text-gray-500">
          by{' '}
          <Link
            href={`/chef/${creator.username}`}
            className="hover:text-orange-600"
          >
            {creator.displayName}
          </Link>
        </div>
      )}
    </div>
  );
}
```

---

## 5. Add Navigation Links

### Update Main Navigation

**File**: `src/components/layout/Navigation.tsx` (or similar)

```tsx
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getCurrentUserProfile } from '@/app/actions/user-profiles';

export async function Navigation() {
  const { userId } = await auth();
  const profile = userId ? await getCurrentUserProfile() : null;

  return (
    <nav>
      {/* Existing links */}

      {/* New User Discovery Links */}
      <Link href="/collections">Collections</Link>

      {userId && (
        <>
          <Link href="/favorites">Favorites</Link>
          {profile ? (
            <Link href={`/chef/${profile.username}`}>My Profile</Link>
          ) : (
            <Link href="/profile/edit">Create Profile</Link>
          )}
        </>
      )}
    </nav>
  );
}
```

---

## 6. Add Profile Setup Prompt for New Users

### Check if User Needs Profile

**File**: `src/app/layout.tsx` or create `src/components/ProfileSetupPrompt.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function ProfileSetupPrompt() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has dismissed prompt
    const dismissed = localStorage.getItem('profile-setup-dismissed');

    if (!dismissed) {
      // Check if user has profile (server action)
      checkProfile();
    }
  }, []);

  const checkProfile = async () => {
    // Call server action to check profile
    const profile = await getCurrentUserProfile();
    setShow(!profile);
  };

  const handleDismiss = () => {
    localStorage.setItem('profile-setup-dismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white shadow-lg rounded-lg p-4 border border-orange-200">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2"
      >
        <X className="w-4 h-4" />
      </button>

      <h3 className="font-semibold text-gray-900 mb-2">
        Complete Your Chef Profile
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Create your profile to share recipes and connect with other home cooks
      </p>
      <Button onClick={() => router.push('/profile/edit')} className="w-full">
        Create Profile
      </Button>
    </div>
  );
}
```

---

## 7. Update Recipe List Queries

### Add Creator Information to Recipe Queries

**File**: `src/app/actions/recipes.ts`

```typescript
import { userProfiles } from '@/lib/db/user-discovery-schema';

export async function getPublicRecipes() {
  const publicRecipes = await db
    .select({
      recipe: recipes,
      creator: userProfiles,
    })
    .from(recipes)
    .leftJoin(userProfiles, eq(recipes.userId, userProfiles.userId))
    .where(eq(recipes.isPublic, true))
    .orderBy(desc(recipes.createdAt));

  return publicRecipes.map((r) => ({
    ...r.recipe,
    creator: r.creator,
  }));
}
```

---

## 8. Add Collection Selector to Recipe Creation

### Allow Adding to Collection on Recipe Create

**File**: `src/components/recipe/RecipeForm.tsx`

```tsx
import { getUserCollections, addRecipeToCollection } from '@/app/actions/collections';

export function RecipeForm() {
  const [collections, setCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    const userCollections = await getUserCollections();
    setCollections(userCollections);
  };

  const handleSubmit = async (recipeData) => {
    // Create recipe first
    const result = await createRecipe(recipeData);

    if (result.success && result.recipe) {
      // Add to selected collections
      for (const collectionId of selectedCollections) {
        await addRecipeToCollection(collectionId, result.recipe.id);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Existing fields */}

      {/* Collection selector */}
      {collections.length > 0 && (
        <div className="space-y-2">
          <label>Add to Collections (optional)</label>
          {collections.map((collection) => (
            <label key={collection.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedCollections.includes(collection.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCollections([...selectedCollections, collection.id]);
                  } else {
                    setSelectedCollections(selectedCollections.filter(id => id !== collection.id));
                  }
                }}
              />
              {collection.name}
            </label>
          ))}
        </div>
      )}
    </form>
  );
}
```

---

## 9. Add Social Stats to Recipe Display

### Show Favorite Count

**File**: `src/components/recipe/RecipeStats.tsx` (new file)

```tsx
import { Heart, BookOpen } from 'lucide-react';

interface RecipeStatsProps {
  favoriteCount: number;
  viewCount: number;
  collectionCount?: number;
}

export function RecipeStats({ favoriteCount, viewCount, collectionCount }: RecipeStatsProps) {
  return (
    <div className="flex items-center gap-4 text-sm text-gray-500">
      <div className="flex items-center gap-1">
        <Heart className="w-4 h-4" />
        <span>{favoriteCount} favorites</span>
      </div>

      {collectionCount && collectionCount > 0 && (
        <div className="flex items-center gap-1">
          <BookOpen className="w-4 h-4" />
          <span>In {collectionCount} collections</span>
        </div>
      )}
    </div>
  );
}
```

---

## 10. Testing Checklist

After integration, test these flows:

### User Profile
- [ ] New user can create profile
- [ ] Username validation works
- [ ] Profile displays correctly
- [ ] Edit profile updates successfully

### Collections
- [ ] Can create new collection
- [ ] Can add recipes to collection
- [ ] Collection displays recipes correctly
- [ ] Can remove recipes from collection
- [ ] Public/private visibility works

### Favorites
- [ ] Can favorite a recipe
- [ ] Heart animates correctly
- [ ] Favorites page shows correct recipes
- [ ] Can unfavorite from favorites page
- [ ] Favorite count updates

### Navigation
- [ ] All new routes accessible
- [ ] Profile links work correctly
- [ ] Collection URLs are SEO-friendly
- [ ] 404 pages for missing profiles/collections

---

## Database Queries to Run

### Check Profile Creation
```sql
SELECT COUNT(*) FROM user_profiles;
SELECT * FROM user_profiles LIMIT 5;
```

### Check Collections
```sql
SELECT c.*, u.username
FROM collections c
JOIN user_profiles u ON c.user_id = u.user_id
ORDER BY c.created_at DESC
LIMIT 10;
```

### Check Favorites
```sql
SELECT r.name, u.username, f.created_at
FROM favorites f
JOIN recipes r ON f.recipe_id = r.id
JOIN user_profiles u ON f.user_id = u.user_id
ORDER BY f.created_at DESC
LIMIT 10;
```

---

## Common Issues & Solutions

### Issue: "Please create a profile first"
**Solution**: User needs to visit `/profile/edit` and create a profile before using collections/favorites.

### Issue: Username already taken
**Solution**: Choose a different username. Usernames are globally unique.

### Issue: Collection slug conflict
**Solution**: Collection slugs must be unique per user. Rename the collection.

### Issue: Recipe not appearing in collection
**Solution**: Check that recipe was successfully added. Check `collection_recipes` table.

---

## Performance Monitoring

### Queries to Monitor
- Profile lookups by username (indexed)
- Collection queries with recipes (joins)
- Favorite toggle operations
- Public collection browsing

### Expected Response Times
- Profile page load: < 300ms
- Collection detail page: < 400ms
- Favorite toggle: < 100ms
- Collection browse: < 200ms

---

## Next Steps After Integration

1. **Add Image Uploads**
   - Profile pictures
   - Collection cover images
   - Use Uploadthing or similar

2. **Enhance Statistics**
   - Implement profile_statistics table
   - Calculate recipe counts
   - Track view counts

3. **Search & Discovery**
   - Full-text search for profiles
   - Collection search
   - Featured content section

4. **Social Features** (Phase 2)
   - Follow/unfollow
   - Activity feeds
   - Notifications

---

**Status**: Integration guide ready for implementation
**Estimated Integration Time**: 4-6 hours
