'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  insertUserProfileSchema,
  type NewUserProfile,
  type UserProfile,
  userProfiles,
} from '@/lib/db/user-discovery-schema';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * User Profile Server Actions
 *
 * All actions validate authentication and user ownership before executing.
 * Username must be unique and follow strict validation rules.
 */

// ============================================================================
// CREATE / UPDATE PROFILE
// ============================================================================

/**
 * Create or update user profile
 * If profile exists, updates it. Otherwise creates new profile.
 */
export async function createOrUpdateProfile(data: Partial<NewUserProfile>) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized - Please sign in' };
    }

    // Validate input data
    const validatedData = insertUserProfileSchema.parse({
      ...data,
      user_id: userId,
    });

    // Check if profile already exists
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    if (existingProfile.length > 0) {
      // Update existing profile
      const [updatedProfile] = await db
        .update(userProfiles)
        .set({
          ...validatedData,
          updated_at: new Date(),
        })
        .where(eq(userProfiles.user_id, userId))
        .returning();

      revalidatePath('/profile/edit');
      revalidatePath(`/profile/${updatedProfile.username}`);

      return { success: true, profile: updatedProfile };
    } else {
      // Create new profile
      const [newProfile] = await db.insert(userProfiles).values(validatedData).returning();

      revalidatePath('/profile/edit');
      revalidatePath(`/profile/${newProfile.username}`);

      return { success: true, profile: newProfile };
    }
  } catch (error) {
    console.error('Error creating/updating profile:', error);

    const errorMsg = toErrorMessage(error);

    // Check for unique constraint violations
    if (errorMsg.includes('unique')) {
      return { success: false, error: 'Username already taken' };
    }

    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// GET PROFILE
// ============================================================================

/**
 * Get user profile by username
 * Returns null if profile not found or not public (unless it's the user's own profile)
 */
export async function getProfileByUsername(username: string): Promise<UserProfile | null> {
  try {
    const { userId: currentUserId } = await auth();

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(sql`LOWER(${userProfiles.username})`, username.toLowerCase()))
      .limit(1);

    if (!profile) {
      return null;
    }

    // If profile is private and not the current user's profile, return null
    if (!profile.is_public && profile.user_id !== currentUserId) {
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

/**
 * Get current user's profile
 * Returns null if not authenticated or profile doesn't exist
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    return profile || null;
  } catch (error) {
    console.error('Error fetching current user profile:', error);
    return null;
  }
}

/**
 * Get user profile by userId (Clerk ID)
 */
export async function getProfileByUserId(targetUserId: string): Promise<UserProfile | null> {
  try {
    const { userId: currentUserId } = await auth();

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, targetUserId))
      .limit(1);

    if (!profile) {
      return null;
    }

    // If profile is private and not the current user's profile, return null
    if (!profile.is_public && profile.user_id !== currentUserId) {
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error fetching profile by userId:', error);
    return null;
  }
}

// ============================================================================
// USERNAME VALIDATION
// ============================================================================

/**
 * Check if username is available
 * Returns true if available, false if taken
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  try {
    // Validate username format
    const usernameRegex = /^[a-z0-9_-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return false;
    }

    const [existingProfile] = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(eq(sql`LOWER(${userProfiles.username})`, username.toLowerCase()))
      .limit(1);

    return !existingProfile;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
}

// ============================================================================
// PROFILE SETTINGS
// ============================================================================

/**
 * Update profile privacy settings
 */
export async function updateProfileSettings(settings: { isPublic?: boolean }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const [updatedProfile] = await db
      .update(userProfiles)
      .set({
        ...settings,
        updated_at: new Date(),
      })
      .where(eq(userProfiles.user_id, userId))
      .returning();

    if (!updatedProfile) {
      return { success: false, error: 'Profile not found' };
    }

    revalidatePath('/profile/edit');
    revalidatePath(`/profile/${updatedProfile.username}`);

    return { success: true, profile: updatedProfile };
  } catch (error) {
    console.error('Error updating profile settings:', error);
    return { success: false, error: 'Failed to update settings' };
  }
}

// ============================================================================
// PROFILE STATISTICS
// ============================================================================

/**
 * Get profile statistics with real counts
 * Computes statistics from recipes and collections tables
 */
export async function getProfileStats(username: string) {
  try {
    const profile = await getProfileByUsername(username);

    if (!profile) {
      return null;
    }

    // Import tables and functions
    const { recipes } = await import('@/lib/db/schema');
    const { collections } = await import('@/lib/db/user-discovery-schema');
    const { and, eq, sql } = await import('drizzle-orm');

    // Get recipe counts (total and public)
    const [recipeCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        public: sql<number>`count(*) FILTER (WHERE ${recipes.is_public} = true)::int`,
      })
      .from(recipes)
      .where(eq(recipes.user_id, profile.user_id));

    // Get collection counts (total and public)
    const [collectionCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        public: sql<number>`count(*) FILTER (WHERE ${collections.is_public} = true)::int`,
      })
      .from(collections)
      .where(eq(collections.user_id, profile.user_id));

    const stats = {
      username: profile.username,
      displayName: profile.display_name,
      joinedDate: profile.created_at,
      isPublic: profile.is_public,
      specialties: profile.specialties || [],
      recipesCreated: recipeCounts?.total || 0,
      publicRecipes: recipeCounts?.public || 0,
      collectionsCreated: collectionCounts?.total || 0,
      publicCollections: collectionCounts?.public || 0,
    };

    return stats;
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    return null;
  }
}

// ============================================================================
// USER RECIPES
// ============================================================================

/**
 * Get recipes by username with filtering, pagination, and sorting
 */
export async function getUserRecipes(
  username: string,
  options?: {
    visibility?: 'public' | 'private' | 'all';
    limit?: number;
    offset?: number;
    sortBy?: 'recent' | 'popular' | 'rating';
  }
): Promise<{ recipes: any[]; total: number }> {
  try {
    const { userId: currentUserId } = await auth();

    // Get profile by username
    const profile = await getProfileByUsername(username);

    if (!profile) {
      return { recipes: [], total: 0 };
    }

    const isOwner = currentUserId === profile.user_id;

    // Import recipes table here to avoid circular dependency
    const { recipes } = await import('@/lib/db/schema');
    const { eq, and, desc, asc, sql } = await import('drizzle-orm');

    // Build visibility filter
    let visibilityCondition;
    const requestedVisibility = options?.visibility || 'public';

    if (requestedVisibility === 'all' && isOwner) {
      // Owner can see all their recipes
      visibilityCondition = eq(recipes.user_id, profile.user_id);
    } else if (requestedVisibility === 'private' && isOwner) {
      // Owner can see their private recipes
      visibilityCondition = and(eq(recipes.user_id, profile.user_id), eq(recipes.is_public, false));
    } else {
      // Default: only public recipes (for non-owners or when not specified)
      visibilityCondition = and(eq(recipes.user_id, profile.user_id), eq(recipes.is_public, true));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recipes)
      .where(visibilityCondition);

    const total = countResult?.count || 0;

    // Determine sort order
    const sortBy = options?.sortBy || 'recent';
    let orderByClause;

    switch (sortBy) {
      case 'popular':
        // Sort by view count (will need to join with recipeViews once implemented)
        orderByClause = [desc(recipes.created_at)]; // Fallback to recent for now
        break;
      case 'rating':
        // Sort by rating
        orderByClause = [
          desc(recipes.system_rating),
          desc(recipes.avg_user_rating),
          desc(recipes.created_at),
        ];
        break;
      default:
        orderByClause = [desc(recipes.created_at)];
        break;
    }

    // Get recipes with pagination
    const userRecipes = await db
      .select()
      .from(recipes)
      .where(visibilityCondition)
      .orderBy(...orderByClause)
      .limit(options?.limit || 24)
      .offset(options?.offset || 0);

    return {
      recipes: userRecipes,
      total,
    };
  } catch (error) {
    console.error('Error fetching user recipes:', error);
    return { recipes: [], total: 0 };
  }
}

// ============================================================================
// AUTO-PROFILE CREATION
// ============================================================================

/**
 * Ensure user has a profile, create one if it doesn't exist
 * This should be called from recipe creation, favorites, and collection actions
 */
export async function ensureUserProfile(): Promise<UserProfile | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    // Check if profile exists
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    if (existingProfile.length > 0) {
      return existingProfile[0];
    }

    // Get user info from Clerk
    const { clerkClient } = await import('@clerk/nextjs/server');
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    if (!user) {
      console.error('User not found in Clerk:', userId);
      return null;
    }

    // Generate username from Clerk data
    // Priority: username > firstName+lastName > email prefix
    let username = user.username;

    if (!username) {
      if (user.firstName && user.lastName) {
        username = `${user.firstName.toLowerCase()}-${user.lastName.toLowerCase()}`;
      } else if (user.firstName) {
        username = user.firstName.toLowerCase();
      } else if (user.primaryEmailAddress?.emailAddress) {
        username = user.primaryEmailAddress.emailAddress.split('@')[0];
      } else {
        // Fallback: use user ID
        username = `user-${userId.slice(0, 8)}`;
      }
    }

    // Clean username (remove special characters, ensure lowercase)
    username = username
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Ensure username is unique by appending numbers if needed
    let finalUsername = username;
    let counter = 1;
    let isUnique = false;

    while (!isUnique) {
      const existing = await db
        .select({ username: userProfiles.username })
        .from(userProfiles)
        .where(eq(sql`LOWER(${userProfiles.username})`, finalUsername.toLowerCase()))
        .limit(1);

      if (existing.length === 0) {
        isUnique = true;
      } else {
        finalUsername = `${username}-${counter}`;
        counter++;
      }
    }

    // Generate display name
    const displayName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.username || finalUsername;

    // Create profile
    const profileData = insertUserProfileSchema.parse({
      user_id: userId,
      username: finalUsername,
      display_name: displayName,
      profile_image_url: user.imageUrl || null,
      is_public: true, // Default to public
    });

    const [newProfile] = await db.insert(userProfiles).values(profileData).returning();

    revalidatePath('/profile/edit');
    revalidatePath(`/profile/${newProfile.username}`);

    return newProfile;
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return null;
  }
}
