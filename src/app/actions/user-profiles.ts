'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, insertUserProfileSchema, type UserProfile, type NewUserProfile } from '@/lib/db/user-discovery-schema';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

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
      userId,
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
      const [newProfile] = await db
        .insert(userProfiles)
        .values(validatedData)
        .returning();

      revalidatePath('/profile/edit');
      revalidatePath(`/profile/${newProfile.username}`);

      return { success: true, profile: newProfile };
    }
  } catch (error) {
    console.error('Error creating/updating profile:', error);

    if (error instanceof Error) {
      // Check for unique constraint violations
      if (error.message.includes('unique')) {
        return { success: false, error: 'Username already taken' };
      }
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Failed to save profile' };
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
export async function updateProfileSettings(settings: {
  isPublic?: boolean;
}) {
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
 * Get basic profile statistics
 * This is a simplified version for Phase 1
 * Full statistics table will be added in Phase 3
 */
export async function getProfileStats(username: string) {
  try {
    const profile = await getProfileByUsername(username);

    if (!profile) {
      return null;
    }

    // For Phase 1, we'll just return basic computed stats
    // Phase 3 will add a dedicated profile_statistics table
    const stats = {
      username: profile.username,
      displayName: profile.display_name,
      joinedDate: profile.created_at,
      isPublic: profile.is_public,
      specialties: profile.specialties || [],
      // These will be computed from other tables once we have recipes linked to profiles
      recipesCreated: 0,
      publicRecipes: 0,
      collectionsCreated: 0,
      publicCollections: 0,
    };

    return stats;
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    return null;
  }
}
