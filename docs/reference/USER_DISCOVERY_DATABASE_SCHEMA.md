# User Discovery Database Schema

**Last Updated:** 2025-10-15
**Version:** 0.5.0
**Status:** Planned

## Overview

This document defines the complete database schema for user discovery features, including user profiles, collections, social features, and discovery mechanisms.

**Related Documentation:**
- Feature Guide: `docs/guides/USER_DISCOVERY_FEATURES.md`
- Roadmap: `ROADMAP.md` (Version 0.5.0 - 0.7.0)
- Current Schema: `src/lib/db/schema.ts`

---

## Table of Contents

1. [User Profiles](#1-user-profiles)
2. [Collections](#2-collections)
3. [Social Features](#3-social-features)
4. [Analytics & Tracking](#4-analytics--tracking)
5. [Moderation](#5-moderation)
6. [Indexes & Performance](#6-indexes--performance)
7. [Migration Plan](#7-migration-plan)

---

## 1. User Profiles

### 1.1 user_profiles

Extended user profile information beyond Clerk authentication.

```typescript
export const userProfiles = pgTable('user_profiles', {
  // Primary Key & Identity
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(), // Clerk user ID

  // Profile Information
  username: varchar('username', { length: 30 })
    .notNull()
    .unique(), // URL-friendly, unique identifier
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'), // Markdown support, max 500 chars enforced in app
  avatar: text('avatar'), // Clerk-managed avatar URL

  // Location & Contact
  location: varchar('location', { length: 100 }), // City, State/Country
  website: text('website'),
  socialLinks: json('social_links').$type<{
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    twitter?: string;
  }>(),

  // Cooking Profile
  specialties: json('specialties').$type<string[]>(), // e.g., ["Italian", "Baking"]
  favoriteIngredients: json('favorite_ingredients').$type<string[]>(),
  cookingStyle: varchar('cooking_style', { length: 50 }), // "Home Cook", "Professional Chef"

  // Privacy Settings
  isPublic: boolean('is_public').notNull().default(true),
  showEmail: boolean('show_email').notNull().default(false),
  showStats: boolean('show_stats').notNull().default(true),
  showActivity: boolean('show_activity').notNull().default(true),

  // Admin Fields
  isFeatured: boolean('is_featured').notNull().default(false),
  isVerified: boolean('is_verified').notNull().default(false), // Verified chef badge
  isBanned: boolean('is_banned').notNull().default(false),
  banReason: text('ban_reason'),
  bannedAt: timestamp('banned_at'),

  // Profile Completion Score (computed client-side)
  profileCompletionScore: integer('profile_completion_score').default(0), // 0-100

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes
  userIdIdx: index('user_profiles_user_id_idx').on(table.userId),
  usernameIdx: uniqueIndex('user_profiles_username_idx').on(table.username.lower()),
  featuredIdx: index('user_profiles_featured_idx').on(table.isFeatured, table.createdAt.desc()),
  publicIdx: index('user_profiles_public_idx').on(table.isPublic, table.isBanned),
}));

// Type exports
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// Zod schemas
export const insertUserProfileSchema = createInsertSchema(userProfiles, {
  username: z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores'),
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional(),
  location: z.string().max(100).optional(),
});

export const selectUserProfileSchema = createSelectSchema(userProfiles);
```

**Notes:**
- `username` is unique, lowercase, URL-friendly identifier
- Username regex: `/^[a-z0-9_-]+$/` (3-30 chars)
- `userId` references Clerk user ID (one-to-one relationship)
- Profile is created on first sign-in or when user sets username
- `socialLinks` JSON field for flexible social media URLs
- `isBanned` soft-deletes profile (not shown in search/discovery)

---

### 1.2 profile_statistics

Cached profile statistics for performance optimization.

```typescript
export const profileStatistics = pgTable('profile_statistics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }),

  // Content Statistics
  recipesCreated: integer('recipes_created').notNull().default(0),
  publicRecipes: integer('public_recipes').notNull().default(0),
  collectionsCreated: integer('collections_created').notNull().default(0),
  publicCollections: integer('public_collections').notNull().default(0),

  // Social Statistics
  followers: integer('followers').notNull().default(0),
  following: integer('following').notNull().default(0),

  // Engagement Statistics
  totalRecipeViews: integer('total_recipe_views').notNull().default(0),
  totalRecipeSaves: integer('total_recipe_saves').notNull().default(0),
  avgRecipeRating: decimal('avg_recipe_rating', { precision: 2, scale: 1 }),
  totalRatingsReceived: integer('total_ratings_received').notNull().default(0),

  // Activity Metrics
  recipesAddedThisMonth: integer('recipes_added_this_month').notNull().default(0),
  lastRecipeAddedAt: timestamp('last_recipe_added_at'),
  lastActiveAt: timestamp('last_active_at'),

  // Timestamps
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('profile_statistics_user_id_idx').on(table.userId),
  followersIdx: index('profile_statistics_followers_idx').on(table.followers.desc()),
  recipesIdx: index('profile_statistics_recipes_idx').on(table.recipesCreated.desc()),
}));

export type ProfileStatistics = typeof profileStatistics.$inferSelect;
export type NewProfileStatistics = typeof profileStatistics.$inferInsert;
```

**Update Strategy:**
- Updated via database triggers on recipe/collection changes
- Followers/following updated on follow/unfollow actions
- Views/saves updated via batch job (hourly)
- `lastActiveAt` updated on any user action

---

## 2. Collections

### 2.1 collections

Recipe collections (themed groupings of recipes).

```typescript
export const collections = pgTable('collections', {
  // Primary Key
  id: uuid('id').primaryKey().defaultRandom(),

  // Ownership
  userId: text('user_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }),

  // Collection Information
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(), // URL-friendly
  description: text('description'), // Markdown support, 500 chars
  coverImage: text('cover_image'), // URL or auto-generated

  // Metadata
  tags: json('tags').$type<string[]>(), // Collection tags
  recipeCount: integer('recipe_count').notNull().default(0), // Computed
  followerCount: integer('follower_count').notNull().default(0), // Users who saved

  // Visibility & Curation
  isPublic: boolean('is_public').notNull().default(false),
  isFeatured: boolean('is_featured').notNull().default(false), // Admin-curated

  // Statistics (cached)
  totalViews: integer('total_views').notNull().default(0),
  totalSaves: integer('total_saves').notNull().default(0),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastRecipeAddedAt: timestamp('last_recipe_added_at'),
}, (table) => ({
  // Unique constraint: slug must be unique per user
  userSlugUnique: unique('collections_user_slug_unique').on(table.userId, table.slug),

  // Indexes
  userIdIdx: index('collections_user_id_idx').on(table.userId),
  publicIdx: index('collections_public_idx').on(table.isPublic, table.createdAt.desc()),
  featuredIdx: index('collections_featured_idx').on(table.isFeatured, table.followerCount.desc()),
  followerCountIdx: index('collections_follower_count_idx').on(table.followerCount.desc()),
  slugIdx: index('collections_slug_idx').on(table.slug),
}));

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;

// Zod schemas
export const insertCollectionSchema = createInsertSchema(collections, {
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export const selectCollectionSchema = createSelectSchema(collections);
```

**Notes:**
- `slug` auto-generated from name (e.g., "Thanksgiving Dinner" → "thanksgiving-dinner")
- `slug` must be unique per user (enforced by unique constraint)
- `recipeCount` updated via trigger on collection_recipes changes
- `coverImage` auto-generated from first 4 recipes if not provided

---

### 2.2 collection_recipes

Many-to-many relationship between collections and recipes.

```typescript
export const collectionRecipes = pgTable('collection_recipes', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  collectionId: uuid('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),

  // Organization
  position: integer('position').notNull().default(0), // Manual ordering
  note: text('note'), // Personal note about this recipe in context of collection

  // Timestamps
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: recipe can only be in collection once
  collectionRecipeUnique: unique('collection_recipes_unique').on(
    table.collectionId,
    table.recipeId
  ),

  // Indexes
  collectionIdIdx: index('collection_recipes_collection_id_idx').on(table.collectionId),
  recipeIdIdx: index('collection_recipes_recipe_id_idx').on(table.recipeId),
  positionIdx: index('collection_recipes_position_idx').on(table.collectionId, table.position),
}));

export type CollectionRecipe = typeof collectionRecipes.$inferSelect;
export type NewCollectionRecipe = typeof collectionRecipes.$inferInsert;
```

**Notes:**
- `position` allows manual ordering of recipes within collection
- `note` allows personal annotations (e.g., "Perfect for Christmas dinner")
- Cascade delete: removing collection removes all collection_recipes entries

---

### 2.3 collection_followers

Users who have saved/followed a collection.

```typescript
export const collectionFollowers = pgTable('collection_followers', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  collectionId: uuid('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }),

  // Notifications
  notifyOnUpdate: boolean('notify_on_update').notNull().default(false),

  // Timestamps
  followedAt: timestamp('followed_at').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: user can only follow collection once
  collectionUserUnique: unique('collection_followers_unique').on(
    table.collectionId,
    table.userId
  ),

  // Indexes
  collectionIdIdx: index('collection_followers_collection_id_idx').on(table.collectionId),
  userIdIdx: index('collection_followers_user_id_idx').on(table.userId),
}));

export type CollectionFollower = typeof collectionFollowers.$inferSelect;
export type NewCollectionFollower = typeof collectionFollowers.$inferInsert;
```

---

## 3. Social Features

### 3.1 follows

User follow relationships (users following other users).

```typescript
export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  followerId: text('follower_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }), // User who follows
  followingId: text('following_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }), // User being followed

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: can only follow once
  followerFollowingUnique: unique('follows_unique').on(
    table.followerId,
    table.followingId
  ),

  // Indexes
  followerIdIdx: index('follows_follower_id_idx').on(table.followerId),
  followingIdIdx: index('follows_following_id_idx').on(table.followingId),

  // Prevent self-follows (check constraint)
  selfFollowCheck: check('no_self_follow', sql`${table.followerId} != ${table.followingId}`),
}));

export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
```

**Notes:**
- Check constraint prevents users from following themselves
- Unique constraint prevents duplicate follows
- Cascade delete: removing user removes all follow relationships

---

### 3.2 favorites

User favorite recipes (heart button).

```typescript
export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  userId: text('user_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),

  // Personal Notes
  note: text('note'), // Optional personal note on favorite

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: recipe can only be favorited once per user
  userRecipeUnique: unique('favorites_unique').on(table.userId, table.recipeId),

  // Indexes
  userIdIdx: index('favorites_user_id_idx').on(table.userId, table.createdAt.desc()),
  recipeIdIdx: index('favorites_recipe_id_idx').on(table.recipeId),
}));

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
```

**Notes:**
- Separate from `collectionRecipes` for quick favoriting without organizing
- `note` field allows personal annotations
- Indexed by `userId` + `createdAt` for "Recently Favorited" queries

---

## 4. Analytics & Tracking

### 4.1 recipe_views

Recipe view history for analytics and "recently viewed" feature.

```typescript
export const recipeViews = pgTable('recipe_views', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  userId: text('user_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),

  // View Context
  source: varchar('source', { length: 50 }), // 'search', 'collection', 'profile', 'recommendation'
  referrerUrl: text('referrer_url'),

  // Timestamps
  viewedAt: timestamp('viewed_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes
  userIdViewedAtIdx: index('recipe_views_user_id_viewed_at_idx').on(
    table.userId,
    table.viewedAt.desc()
  ),
  recipeIdIdx: index('recipe_views_recipe_id_idx').on(table.recipeId),
  viewedAtIdx: index('recipe_views_viewed_at_idx').on(table.viewedAt.desc()),
}));

export type RecipeView = typeof recipeViews.$inferSelect;
export type NewRecipeView = typeof recipeViews.$inferInsert;
```

**Notes:**
- No unique constraint: same recipe can be viewed multiple times
- `source` tracks where view came from for analytics
- Indexed by `userId` + `viewedAt` for "Recently Viewed" queries
- Consider partitioning by date for large datasets (future optimization)

**Data Retention Policy:**
- Keep last 90 days of view history per user
- Aggregate older data into daily/weekly summaries
- Batch cleanup job runs weekly

---

### 4.2 profile_views

Profile view tracking for analytics.

```typescript
export const profileViews = pgTable('profile_views', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  profileUserId: text('profile_user_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }), // Profile being viewed
  viewerUserId: text('viewer_user_id')
    .references(() => userProfiles.userId, { onDelete: 'cascade' }), // User viewing (null if anonymous)

  // View Context
  source: varchar('source', { length: 50 }), // 'search', 'recommendation', 'recipe'
  referrerUrl: text('referrer_url'),

  // Timestamps
  viewedAt: timestamp('viewed_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes
  profileUserIdIdx: index('profile_views_profile_user_id_idx').on(table.profileUserId),
  viewedAtIdx: index('profile_views_viewed_at_idx').on(table.viewedAt.desc()),
}));

export type ProfileView = typeof profileViews.$inferSelect;
export type NewProfileView = typeof profileViews.$inferInsert;
```

**Notes:**
- `viewerUserId` can be null for anonymous views
- Same data retention policy as recipe_views

---

### 4.3 collection_views

Collection view tracking.

```typescript
export const collectionViews = pgTable('collection_views', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  collectionId: uuid('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  viewerUserId: text('viewer_user_id')
    .references(() => userProfiles.userId, { onDelete: 'cascade' }), // null if anonymous

  // Timestamps
  viewedAt: timestamp('viewed_at').notNull().defaultNow(),
}, (table) => ({
  collectionIdIdx: index('collection_views_collection_id_idx').on(table.collectionId),
  viewedAtIdx: index('collection_views_viewed_at_idx').on(table.viewedAt.desc()),
}));

export type CollectionView = typeof collectionViews.$inferSelect;
export type NewCollectionView = typeof collectionViews.$inferInsert;
```

---

## 5. Moderation

### 5.1 user_reports

User reporting for content moderation.

```typescript
export const userReports = pgTable('user_reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  reportedUserId: text('reported_user_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'cascade' }),
  reporterUserId: text('reporter_user_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'set null' }),

  // Report Details
  reason: text('reason', {
    enum: ['inappropriate', 'spam', 'harassment', 'impersonation', 'other']
  }).notNull(),
  description: text('description'), // Detailed explanation
  reportedContent: json('reported_content'), // Snapshot of problematic content

  // Review Status
  status: text('status', {
    enum: ['pending', 'under_review', 'resolved', 'dismissed']
  }).notNull().default('pending'),
  reviewedBy: text('reviewed_by'), // Admin user ID
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  actionTaken: text('action_taken'), // 'warning', 'banned', 'no_action'

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  reportedUserIdx: index('user_reports_reported_user_idx').on(table.reportedUserId),
  statusIdx: index('user_reports_status_idx').on(table.status, table.createdAt.desc()),
  reporterUserIdx: index('user_reports_reporter_user_idx').on(table.reporterUserId),
}));

export type UserReport = typeof userReports.$inferSelect;
export type NewUserReport = typeof userReports.$inferInsert;
```

---

### 5.2 collection_reports

Collection reporting for content moderation.

```typescript
export const collectionReports = pgTable('collection_reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  collectionId: uuid('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  reporterUserId: text('reporter_user_id')
    .notNull()
    .references(() => userProfiles.userId, { onDelete: 'set null' }),

  // Report Details
  reason: text('reason', {
    enum: ['inappropriate', 'spam', 'copyright', 'misleading', 'other']
  }).notNull(),
  description: text('description'),

  // Review Status
  status: text('status', {
    enum: ['pending', 'under_review', 'resolved', 'dismissed']
  }).notNull().default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  collectionIdIdx: index('collection_reports_collection_id_idx').on(table.collectionId),
  statusIdx: index('collection_reports_status_idx').on(table.status),
}));

export type CollectionReport = typeof collectionReports.$inferSelect;
export type NewCollectionReport = typeof collectionReports.$inferInsert;
```

---

## 6. Indexes & Performance

### 6.1 Required Indexes

**High Priority (Create Immediately):**

```sql
-- User Profiles
CREATE INDEX CONCURRENTLY idx_user_profiles_username_lower
  ON user_profiles (LOWER(username));

CREATE INDEX CONCURRENTLY idx_user_profiles_featured
  ON user_profiles (is_featured, created_at DESC)
  WHERE is_featured = true AND is_banned = false;

-- Collections
CREATE INDEX CONCURRENTLY idx_collections_public_recent
  ON collections (is_public, created_at DESC)
  WHERE is_public = true;

CREATE INDEX CONCURRENTLY idx_collections_featured
  ON collections (is_featured, follower_count DESC)
  WHERE is_featured = true;

-- Collection Recipes (for collection detail page)
CREATE INDEX CONCURRENTLY idx_collection_recipes_collection_position
  ON collection_recipes (collection_id, position);

-- Follows (for followers/following lists)
CREATE INDEX CONCURRENTLY idx_follows_follower
  ON follows (follower_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_follows_following
  ON follows (following_id, created_at DESC);

-- Favorites (for user's favorites page)
CREATE INDEX CONCURRENTLY idx_favorites_user_created
  ON favorites (user_id, created_at DESC);

-- Recipe Views (for recently viewed)
CREATE INDEX CONCURRENTLY idx_recipe_views_user_recent
  ON recipe_views (user_id, viewed_at DESC);
```

---

### 6.2 Composite Indexes

**For Complex Queries:**

```sql
-- Find public collections by tag
CREATE INDEX CONCURRENTLY idx_collections_public_tags
  ON collections USING GIN (tags)
  WHERE is_public = true;

-- Find user's public recipes (for profile page)
CREATE INDEX CONCURRENTLY idx_recipes_user_public
  ON recipes (user_id, is_public, created_at DESC)
  WHERE is_public = true;

-- Trending collections (by saves in last 30 days)
CREATE INDEX CONCURRENTLY idx_collection_followers_recent
  ON collection_followers (collection_id, followed_at DESC)
  WHERE followed_at > NOW() - INTERVAL '30 days';
```

---

### 6.3 Partial Indexes

**For Filtered Queries:**

```sql
-- Only featured users
CREATE INDEX CONCURRENTLY idx_user_profiles_featured_only
  ON user_profiles (follower_count DESC)
  WHERE is_featured = true AND is_banned = false;

-- Only public, non-banned profiles
CREATE INDEX CONCURRENTLY idx_user_profiles_discoverable
  ON user_profiles (created_at DESC)
  WHERE is_public = true AND is_banned = false;

-- Recent recipe views (last 90 days)
CREATE INDEX CONCURRENTLY idx_recipe_views_recent
  ON recipe_views (user_id, viewed_at DESC)
  WHERE viewed_at > NOW() - INTERVAL '90 days';
```

---

### 6.4 Full-Text Search Indexes

**For Search Functionality:**

```sql
-- User profile search (username + display name + bio)
CREATE INDEX CONCURRENTLY idx_user_profiles_search
  ON user_profiles
  USING GIN (
    to_tsvector('english',
      COALESCE(username, '') || ' ' ||
      COALESCE(display_name, '') || ' ' ||
      COALESCE(bio, '')
    )
  );

-- Collection search (name + description + tags)
CREATE INDEX CONCURRENTLY idx_collections_search
  ON collections
  USING GIN (
    to_tsvector('english',
      COALESCE(name, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      COALESCE(array_to_string(tags, ' '), '')
    )
  );
```

---

### 6.5 Performance Optimization Tips

**Query Optimization:**

```typescript
// ✅ Good: Use indexed fields for filtering
const collections = await db
  .select()
  .from(collections)
  .where(and(
    eq(collections.isPublic, true),
    gt(collections.followerCount, 10)
  ))
  .orderBy(desc(collections.followerCount))
  .limit(20);

// ❌ Bad: Filter in application code
const allCollections = await db.select().from(collections);
const filtered = allCollections
  .filter(c => c.isPublic && c.followerCount > 10)
  .sort((a, b) => b.followerCount - a.followerCount)
  .slice(0, 20);
```

**Caching Strategy:**

```typescript
// Cache frequently accessed data
const CACHE_TTL = {
  userProfile: 60 * 60,        // 1 hour
  profileStats: 10 * 60,       // 10 minutes
  featuredUsers: 30 * 60,      // 30 minutes
  featuredCollections: 30 * 60, // 30 minutes
  followCounts: 5 * 60,        // 5 minutes
};
```

---

## 7. Migration Plan

### 7.1 Phase 1: Core Tables (Week 1)

**Migration 001: User Profiles & Collections**

```typescript
// File: drizzle/migrations/001_user_discovery_core.sql

-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  username VARCHAR(30) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT,
  avatar TEXT,
  location VARCHAR(100),
  website TEXT,
  social_links JSONB,
  specialties JSONB,
  favorite_ingredients JSONB,
  cooking_style VARCHAR(50),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  show_email BOOLEAN NOT NULL DEFAULT FALSE,
  show_stats BOOLEAN NOT NULL DEFAULT TRUE,
  show_activity BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason TEXT,
  banned_at TIMESTAMP,
  profile_completion_score INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create collections table
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  cover_image TEXT,
  tags JSONB,
  recipe_count INTEGER NOT NULL DEFAULT 0,
  follower_count INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  total_views INTEGER NOT NULL DEFAULT 0,
  total_saves INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_recipe_added_at TIMESTAMP,
  UNIQUE (user_id, slug)
);

-- Create collection_recipes table
CREATE TABLE collection_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, recipe_id)
);

-- Create indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE UNIQUE INDEX idx_user_profiles_username_lower ON user_profiles(LOWER(username));
CREATE INDEX idx_user_profiles_featured ON user_profiles(is_featured, created_at DESC)
  WHERE is_featured = true AND is_banned = false;

CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collections_public ON collections(is_public, created_at DESC)
  WHERE is_public = true;
CREATE INDEX idx_collection_recipes_collection_id ON collection_recipes(collection_id);
CREATE INDEX idx_collection_recipes_recipe_id ON collection_recipes(recipe_id);
```

---

### 7.2 Phase 2: Social Features (Week 2)

**Migration 002: Follows & Favorites**

```sql
-- Create follows table
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create favorites table
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, recipe_id)
);

-- Create collection_followers table
CREATE TABLE collection_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  notify_on_update BOOLEAN NOT NULL DEFAULT FALSE,
  followed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, user_id)
);

-- Create indexes
CREATE INDEX idx_follows_follower ON follows(follower_id, created_at DESC);
CREATE INDEX idx_follows_following ON follows(following_id, created_at DESC);
CREATE INDEX idx_favorites_user_id ON favorites(user_id, created_at DESC);
CREATE INDEX idx_favorites_recipe_id ON favorites(recipe_id);
CREATE INDEX idx_collection_followers_collection ON collection_followers(collection_id);
CREATE INDEX idx_collection_followers_user ON collection_followers(user_id);
```

---

### 7.3 Phase 3: Analytics & Stats (Week 3)

**Migration 003: Views & Statistics**

```sql
-- Create profile_statistics table
CREATE TABLE profile_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  recipes_created INTEGER NOT NULL DEFAULT 0,
  public_recipes INTEGER NOT NULL DEFAULT 0,
  collections_created INTEGER NOT NULL DEFAULT 0,
  public_collections INTEGER NOT NULL DEFAULT 0,
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  total_recipe_views INTEGER NOT NULL DEFAULT 0,
  total_recipe_saves INTEGER NOT NULL DEFAULT 0,
  avg_recipe_rating DECIMAL(2,1),
  total_ratings_received INTEGER NOT NULL DEFAULT 0,
  recipes_added_this_month INTEGER NOT NULL DEFAULT 0,
  last_recipe_added_at TIMESTAMP,
  last_active_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create recipe_views table
CREATE TABLE recipe_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  source VARCHAR(50),
  referrer_url TEXT,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create profile_views table
CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  viewer_user_id TEXT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  source VARCHAR(50),
  referrer_url TEXT,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create collection_views table
CREATE TABLE collection_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  viewer_user_id TEXT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_profile_statistics_user_id ON profile_statistics(user_id);
CREATE INDEX idx_recipe_views_user_recent ON recipe_views(user_id, viewed_at DESC);
CREATE INDEX idx_recipe_views_recipe_id ON recipe_views(recipe_id);
CREATE INDEX idx_profile_views_profile_user ON profile_views(profile_user_id);
CREATE INDEX idx_collection_views_collection ON collection_views(collection_id);
```

---

### 7.4 Phase 4: Moderation (Week 4)

**Migration 004: Reporting & Moderation**

```sql
-- Create user_reports table
CREATE TABLE user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  reporter_user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate', 'spam', 'harassment', 'impersonation', 'other')),
  description TEXT,
  reported_content JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  action_taken TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create collection_reports table
CREATE TABLE collection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  reporter_user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate', 'spam', 'copyright', 'misleading', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_user_reports_reported_user ON user_reports(reported_user_id);
CREATE INDEX idx_user_reports_status ON user_reports(status, created_at DESC);
CREATE INDEX idx_collection_reports_collection ON collection_reports(collection_id);
CREATE INDEX idx_collection_reports_status ON collection_reports(status);
```

---

### 7.5 Database Triggers

**Automatic Stats Updates:**

```sql
-- Trigger: Update collection recipe_count on insert/delete
CREATE OR REPLACE FUNCTION update_collection_recipe_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE collections
    SET recipe_count = recipe_count + 1,
        last_recipe_added_at = NEW.added_at,
        updated_at = NOW()
    WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE collections
    SET recipe_count = recipe_count - 1,
        updated_at = NOW()
    WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_collection_recipe_count
AFTER INSERT OR DELETE ON collection_recipes
FOR EACH ROW
EXECUTE FUNCTION update_collection_recipe_count();

-- Trigger: Update collection follower_count
CREATE OR REPLACE FUNCTION update_collection_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE collections
    SET follower_count = follower_count + 1,
        total_saves = total_saves + 1
    WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE collections
    SET follower_count = follower_count - 1
    WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_collection_follower_count
AFTER INSERT OR DELETE ON collection_followers
FOR EACH ROW
EXECUTE FUNCTION update_collection_follower_count();

-- Trigger: Update profile_statistics follower counts
CREATE OR REPLACE FUNCTION update_profile_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower's "following" count
    UPDATE profile_statistics
    SET following = following + 1
    WHERE user_id = NEW.follower_id;

    -- Increment following's "followers" count
    UPDATE profile_statistics
    SET followers = followers + 1
    WHERE user_id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower's "following" count
    UPDATE profile_statistics
    SET following = following - 1
    WHERE user_id = OLD.follower_id;

    -- Decrement following's "followers" count
    UPDATE profile_statistics
    SET followers = followers - 1
    WHERE user_id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_follow_counts
AFTER INSERT OR DELETE ON follows
FOR EACH ROW
EXECUTE FUNCTION update_profile_follow_counts();
```

---

## Summary

### New Tables Created

1. **user_profiles** - Extended user information
2. **profile_statistics** - Cached user stats
3. **collections** - Recipe collections
4. **collection_recipes** - Many-to-many: collections ↔ recipes
5. **collection_followers** - Collection saves/follows
6. **follows** - User follow relationships
7. **favorites** - User favorite recipes
8. **recipe_views** - Recipe view history
9. **profile_views** - Profile view tracking
10. **collection_views** - Collection view tracking
11. **user_reports** - User moderation reports
12. **collection_reports** - Collection moderation reports

### Total Schema Size Estimate

- **12 new tables**
- **~30 indexes** (including composite and partial)
- **5 database triggers**
- **Estimated storage:** ~50MB per 10,000 users with active engagement

### Performance Expectations

**Query Performance Targets:**
- Profile page load: < 300ms
- Collection detail page: < 400ms
- User search: < 200ms
- Collection search: < 200ms
- Follow/unfollow action: < 100ms
- Favorite action: < 100ms

---

**Last Updated:** October 15, 2025
**Version:** 0.5.0
**Status:** Ready for implementation

---

*For implementation details, see:*
- **Feature Guide:** `docs/guides/USER_DISCOVERY_FEATURES.md`
- **Roadmap:** `ROADMAP.md`
- **Current Schema:** `src/lib/db/schema.ts`
