# User Discovery Features Guide

**Last Updated:** 2025-10-15
**Version:** 0.5.0
**Status:** Planned

## Overview

User discovery features transform Joanie's Kitchen from a personal recipe manager into a thriving cooking community. These features enable users to discover talented home cooks, share recipe collections, and build connections around food and cooking.

## Core Philosophy

**"From Garden to Table, Together"**

The discovery features align with Joanie's Kitchen brand values:
- **Community First:** Connect home cooks who share a passion for real food
- **Quality Content:** Curate and showcase the best recipes and collections
- **Personal Connection:** Highlight the people behind the recipes
- **Discovery & Learning:** Help users find new recipes, techniques, and inspiration

---

## Feature Set Overview

### 1. User Collections
Create, organize, and share themed recipe collections

### 2. Profile Pages
Public chef profiles with recipes, collections, and activity

### 3. Social Features
Follow system with activity feeds and discovery mechanisms

### 4. Discovery Mechanisms
Browse, search, and find interesting cooks and content

---

## 1. User Collections

### Overview

Collections allow users to curate themed groups of recipes, similar to Pinterest boards or Spotify playlists. Users can create multiple collections and organize recipes by occasion, cuisine, dietary needs, or any personal categorization.

### Features

#### 1.1 Collection Management

**Create Collection:**
```typescript
interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string;
  slug: string; // URL-friendly identifier
  coverImage: string | null;
  isPublic: boolean;
  isFeatured: boolean; // Admin can feature collections
  recipeCount: number; // Computed field
  followerCount: number; // Users who saved this collection
  tags: string[]; // Collection tags
  createdAt: Date;
  updatedAt: Date;
}
```

**Collection Operations:**
- Create new collection
- Edit collection details
- Delete collection (with confirmation)
- Reorder recipes within collection
- Duplicate collection (create copy)
- Merge collections

**Metadata:**
- Name (required, 3-100 characters)
- Description (optional, markdown supported, 500 characters)
- Cover image (optional, auto-generated from first 4 recipes)
- Visibility (public/private)
- Tags (up to 10 tags)

---

#### 1.2 Recipe Organization

**Add Recipes to Collection:**
- Add from recipe detail page (single recipe)
- Bulk add from search results (multi-select)
- Quick add menu (dropdown on recipe cards)
- Drag-and-drop interface (collection editor)

**Collection Recipe Management:**
```typescript
interface CollectionRecipe {
  id: string;
  collectionId: string;
  recipeId: string;
  position: number; // For manual ordering
  note: string | null; // Personal note about this recipe
  addedAt: Date;
}
```

**Features:**
- Manual ordering (drag-and-drop)
- Recipe notes (personal annotations)
- Remove from collection
- Move to different collection
- View recipe statistics (views, saves, ratings)

---

#### 1.3 Collection Discovery

**Collection Visibility:**

**Public Collections:**
- Visible on user profile
- Discoverable in collection search
- Shareable via unique URL
- Can be featured by admins

**Private Collections:**
- Only visible to owner
- Not searchable
- Not listed on profile
- Can be made public later

**Collection URLs:**
```
/collections/[username]/[collection-slug]
/collections/joanies-favorites
/collections/masas-thanksgiving-dinner
```

---

#### 1.4 Collection Features

**Following Collections:**
- Users can "follow" (save) other users' public collections
- Shows in "Saved Collections" on user profile
- Get notified when collection is updated (optional)

**Collection Statistics:**
```typescript
interface CollectionStats {
  recipeCount: number;
  followerCount: number;
  viewCount: number;
  avgRecipeRating: number;
  totalCookTime: number; // Sum of all recipes
  totalPrepTime: number;
  cuisineBreakdown: Record<string, number>;
  difficultyBreakdown: Record<string, number>;
}
```

**Sharing Options:**
- Share link (copy to clipboard)
- Social media preview cards
- Export as PDF cookbook
- Print-friendly view
- Email collection link

---

### UI Components

**Collection Card:**
```tsx
<CollectionCard
  collection={collection}
  showAuthor={true}
  showStats={true}
  showFollowButton={true}
  size="medium" // small, medium, large
/>
```

**Collection Grid:**
```tsx
<CollectionGrid
  collections={collections}
  layout="grid" // grid, list, masonry
  columns={3}
  showAuthor={true}
/>
```

**Collection Creator:**
```tsx
<CollectionCreator
  onSuccess={(collection) => router.push(`/collections/${collection.id}`)}
  defaultVisibility="public"
/>
```

---

## 2. Profile Pages

### Overview

Public chef profiles showcase a user's cooking identity, their best recipes, curated collections, and social activity. Profiles serve as personal cooking portfolios and help build reputation in the community.

### Profile Structure

#### 2.1 Profile Information

```typescript
interface UserProfile {
  // Identity
  userId: string; // Clerk user ID
  username: string; // Unique, URL-friendly
  displayName: string;
  bio: string | null; // Markdown, 500 chars
  avatar: string | null; // Clerk-managed

  // Location & Details
  location: string | null; // City, State/Country
  website: string | null;
  socialLinks: {
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    twitter?: string;
  } | null;

  // Cooking Profile
  specialties: string[]; // e.g., "Italian", "Baking", "Vegan"
  favoriteIngredients: string[];
  cookingStyle: string | null; // "Home Cook", "Professional Chef", "Food Blogger"

  // Privacy
  isPublic: boolean; // Profile visibility
  showEmail: boolean;
  showStats: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

---

#### 2.2 Profile Statistics

**Public Stats:**
```typescript
interface ProfileStats {
  // Content
  recipesCreated: number;
  publicRecipes: number;
  collectionsCreated: number;
  publicCollections: number;

  // Social
  followers: number;
  following: number;

  // Engagement
  totalRecipeViews: number;
  totalRecipeSaves: number;
  avgRecipeRating: number;
  totalRatingsReceived: number;

  // Activity
  recipesAddedThisMonth: number;
  joinedDate: Date;
  lastActiveDate: Date;
}
```

**Badges & Achievements:**
- Recipe Pioneer (100+ recipes)
- Community Favorite (500+ followers)
- Master Curator (50+ collections)
- Rising Star (featured by admin)
- Verified Chef (admin-granted badge)

---

#### 2.3 Profile Sections

**Profile Layout:**

```
┌─────────────────────────────────────────────┐
│  Avatar    Display Name         [Follow]    │
│            @username                        │
│            Bio text here...                 │
│            📍 Location  🔗 Website          │
│                                             │
│  [Stats: 42 Recipes | 1.2K Followers]      │
│  [Specialties: Italian • Baking • Vegan]   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Tabs: [Recipes] [Collections] [Activity]  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Content (grid/list view)                   │
└─────────────────────────────────────────────┘
```

**Tab 1: Recipes**
- Grid of public recipes
- Filter by: Cuisine, Difficulty, Rating
- Sort by: Newest, Popular, Highest Rated
- Search within user's recipes

**Tab 2: Collections**
- Grid of public collections
- Featured collections highlighted
- Sort by: Newest, Popular, Recipe Count

**Tab 3: Activity** (Optional - Version 0.7.0)
- Recent recipes added
- Recent collections created
- Recipes rated
- Community interactions

---

#### 2.4 Profile URLs

**URL Structure:**
```
/chef/[username]
/chef/[username]/recipes
/chef/[username]/collections
/chef/[username]/collection/[slug]
```

**Examples:**
```
/chef/joanie
/chef/masa/recipes?cuisine=italian
/chef/masa/collections
/chef/masa/collection/thanksgiving-favorites
```

**Username Rules:**
- 3-30 characters
- Alphanumeric + hyphens/underscores
- Case-insensitive, stored lowercase
- Unique across platform
- Cannot be changed (or limit changes to 1 per 90 days)

---

#### 2.5 Profile Privacy

**Privacy Levels:**

**Public Profile (Default for Recipe Creators):**
- Profile page visible to all
- Public recipes visible
- Public collections visible
- Can be followed
- Shows in search results

**Private Profile:**
- Profile page shows "Private Profile"
- No recipes/collections visible
- Cannot be followed
- Hidden from search

**Selective Privacy:**
- Public profile but limit what's shown
- Hide email
- Hide location
- Hide stats
- Hide activity tab

---

### Profile Management

#### Profile Setup Flow

**First-Time Setup:**
1. User signs up → Clerk creates account
2. System checks if `userProfile` exists
3. If not, show profile setup wizard:
   - Choose username (required)
   - Add display name (defaults to Clerk name)
   - Write bio (optional)
   - Add location (optional)
   - Select specialties (optional)
   - Choose privacy level

**Profile Completion Score:**
- Username: 20%
- Bio: 20%
- Location: 10%
- Specialties: 10%
- Avatar: 15%
- Social links: 10%
- At least 1 public recipe: 15%

---

## 3. Social Features

### Overview

Social features enable users to connect, follow each other, and build a community around shared culinary interests.

### 3.1 Follow System

**Following Users:**
```typescript
interface Follow {
  id: string;
  followerId: string; // User who follows
  followingId: string; // User being followed
  createdAt: Date;
}
```

**Features:**
- Follow/unfollow users
- View followers list
- View following list
- Follow recommendations (suggested users)
- Mutual follow indicator

**Follow Button States:**
- Not following → "Follow"
- Following → "Following" (hover: "Unfollow")
- Mutual follow → "Following" with special badge

---

#### 3.2 Activity Feed (Version 0.7.0)

**Feed Types:**

**Personal Feed:**
- Your recent activity
- Recipes you've added
- Collections you've created
- Recipes you've rated

**Following Feed:**
- Activity from users you follow
- New recipes published
- New collections created
- Popular recipes from network

**Discover Feed:**
- Trending recipes
- Featured collections
- Recommended users
- Community highlights

---

#### 3.3 Favorites & Saves

**Favorite Recipes:**
```typescript
interface Favorite {
  id: string;
  userId: string;
  recipeId: string;
  note: string | null; // Personal note
  createdAt: Date;
}
```

**Features:**
- Heart icon on recipe cards
- Quick access from navbar
- "My Favorites" page
- Add notes to favorites
- Organize favorites into collections

**Recipe History:**
```typescript
interface RecipeView {
  id: string;
  userId: string;
  recipeId: string;
  viewedAt: Date;
}
```

- Recently viewed recipes
- View history page
- "Continue where you left off"
- Clear history option

---

## 4. Discovery Mechanisms

### Overview

Help users discover interesting content and talented home cooks through multiple pathways.

### 4.1 User Discovery

**Browse Users:**
- `/discover/chefs` - Browse all public profiles
- Filters: Location, Specialties, Join Date
- Sort: Followers, Recipes, Recent Activity

**Featured Chefs:**
- Admin-curated list of exceptional cooks
- Rotates weekly/monthly
- Shown on homepage sidebar
- Criteria: Quality, Engagement, Community Contribution

**Search Users:**
- Search by username or display name
- Search by specialty tags
- Autocomplete suggestions
- Recent searches

---

#### 4.2 Collection Discovery

**Browse Collections:**
- `/discover/collections` - Browse public collections
- Filters: Tags, Recipe Count, Followers
- Sort: Popular, Newest, Most Recipes

**Featured Collections:**
- Admin-curated collections
- Seasonal collections (Thanksgiving, Summer BBQ)
- Themed collections (Quick Weeknight Dinners)
- Rotates based on season/occasion

**Collection Search:**
- Semantic search (vector similarity)
- Search by name, description, tags
- Search within collection (find recipe in collections)

---

#### 4.3 Recommendation Engine

**Recommended Users:**
```typescript
interface UserRecommendation {
  userId: string;
  score: number;
  reason: 'similar_taste' | 'popular_in_network' | 'shared_interests' | 'trending';
}
```

**Recommendation Algorithms:**

**Similar Taste:**
- Users who favorited similar recipes
- Users with similar recipe ratings
- Users who follow similar people

**Network-Based:**
- Followers of people you follow
- Users your followers follow
- Mutual connection suggestions

**Interest-Based:**
- Shared specialty tags
- Shared cuisine preferences
- Shared dietary restrictions

**Trending:**
- Users gaining followers quickly
- Users publishing highly-rated recipes
- Users with viral collections

---

#### 4.4 Discovery UI Components

**User Card:**
```tsx
<UserCard
  user={user}
  showFollowButton={true}
  showStats={true}
  showSpecialties={true}
  size="medium"
/>
```

**Featured Section:**
```tsx
<FeaturedSection
  type="chefs" // or "collections"
  title="Featured Home Cooks"
  count={6}
  layout="carousel"
/>
```

**Recommendation Widget:**
```tsx
<RecommendedChefs
  limit={5}
  algorithm="similar_taste"
  showReason={true}
/>
```

---

## Technical Implementation

### Database Schema Changes

**New Tables Required:**

1. **user_profiles** - Extended user information
2. **collections** - Recipe collections
3. **collection_recipes** - Many-to-many: collections ↔ recipes
4. **favorites** - User recipe favorites
5. **follows** - User follow relationships
6. **recipe_views** - Recipe view history
7. **collection_follows** - Collection saves/follows

See `docs/reference/USER_DISCOVERY_DATABASE_SCHEMA.md` for complete schema definitions.

---

### Server Actions

**User Profile Actions:** (`src/app/actions/user-profile.ts`)
```typescript
createUserProfile(data: NewUserProfile)
updateUserProfile(userId: string, data: Partial<UserProfile>)
getUserProfile(username: string)
checkUsernameAvailability(username: string)
getUserStats(userId: string)
```

**Collection Actions:** (`src/app/actions/collections.ts`)
```typescript
createCollection(data: NewCollection)
updateCollection(id: string, data: Partial<Collection>)
deleteCollection(id: string)
addRecipeToCollection(collectionId: string, recipeId: string)
removeRecipeFromCollection(collectionId: string, recipeId: string)
reorderCollectionRecipes(collectionId: string, recipeIds: string[])
getUserCollections(userId: string)
getCollectionById(id: string)
```

**Social Actions:** (`src/app/actions/social.ts`)
```typescript
followUser(targetUserId: string)
unfollowUser(targetUserId: string)
getFollowers(userId: string)
getFollowing(userId: string)
favoriteRecipe(recipeId: string, note?: string)
unfavoriteRecipe(recipeId: string)
getUserFavorites(userId: string)
```

**Discovery Actions:** (`src/app/actions/discovery.ts`)
```typescript
discoverUsers(filters: UserFilters, options: PaginationOptions)
discoverCollections(filters: CollectionFilters, options: PaginationOptions)
getFeaturedUsers(limit: number)
getFeaturedCollections(limit: number)
getRecommendedUsers(algorithm: string, limit: number)
searchUsers(query: string, limit: number)
searchCollections(query: string, limit: number)
```

---

### API Routes

**Profile API:**
```
GET    /api/users/[username]              - Get user profile
PUT    /api/users/[username]              - Update profile (auth)
GET    /api/users/[username]/stats        - Get user stats
GET    /api/users/[username]/recipes      - Get user's recipes
GET    /api/users/[username]/collections  - Get user's collections
```

**Collection API:**
```
GET    /api/collections                   - List collections
POST   /api/collections                   - Create collection (auth)
GET    /api/collections/[id]              - Get collection
PUT    /api/collections/[id]              - Update collection (auth)
DELETE /api/collections/[id]              - Delete collection (auth)
POST   /api/collections/[id]/recipes      - Add recipe (auth)
DELETE /api/collections/[id]/recipes/[recipeId] - Remove recipe (auth)
```

**Social API:**
```
POST   /api/social/follow                 - Follow user (auth)
DELETE /api/social/follow/[userId]        - Unfollow user (auth)
GET    /api/social/followers/[userId]     - Get followers
GET    /api/social/following/[userId]     - Get following
POST   /api/social/favorite               - Favorite recipe (auth)
DELETE /api/social/favorite/[recipeId]    - Unfavorite recipe (auth)
GET    /api/social/favorites              - Get user's favorites (auth)
```

**Discovery API:**
```
GET    /api/discovery/users               - Browse users
GET    /api/discovery/collections         - Browse collections
GET    /api/discovery/featured/users      - Featured users
GET    /api/discovery/featured/collections - Featured collections
GET    /api/discovery/recommended/users   - Recommended users (auth)
```

---

### UI Components

**Component Organization:**

```
src/components/
├── user/
│   ├── UserCard.tsx              - User profile card
│   ├── UserAvatar.tsx            - User avatar with badge
│   ├── UserStats.tsx             - Profile statistics
│   ├── FollowButton.tsx          - Follow/unfollow button
│   ├── UserGrid.tsx              - Grid of user cards
│   └── ProfileEditor.tsx         - Edit profile form
├── collection/
│   ├── CollectionCard.tsx        - Collection display card
│   ├── CollectionGrid.tsx        - Grid of collections
│   ├── CollectionCreator.tsx     - Create collection modal
│   ├── CollectionEditor.tsx      - Edit collection
│   ├── CollectionRecipeList.tsx  - Recipes in collection
│   └── AddToCollectionMenu.tsx   - Quick add dropdown
├── social/
│   ├── FavoriteButton.tsx        - Heart icon to favorite
│   ├── FollowersList.tsx         - List of followers
│   ├── FollowingList.tsx         - List of following
│   └── ActivityFeed.tsx          - User activity feed
└── discovery/
    ├── FeaturedSection.tsx       - Featured users/collections
    ├── RecommendedChefs.tsx      - User recommendations
    ├── TrendingCollections.tsx   - Trending collections
    └── DiscoveryFilters.tsx      - Search/filter UI
```

---

### Authentication & Security

**Authentication Requirements:**

**Public (No Auth):**
- View public profiles
- View public collections
- Browse users/collections
- Search users/collections

**Authenticated Only:**
- Create/edit profile
- Create/edit collections
- Follow/unfollow users
- Favorite recipes
- View private collections (own)
- View following feed

**Authorization Checks:**
- Can only edit own profile
- Can only edit own collections
- Can only delete own collections
- Can only view own private data
- Admin: Can feature users/collections

**Rate Limiting:**
- Follow/unfollow: 50 per hour
- Create collection: 10 per hour
- Favorite recipe: 100 per hour
- Search: 100 per hour

---

## User Experience Flow

### First-Time User Journey

**Day 1: Discovery**
1. User signs up for Joanie's Kitchen
2. Onboarding: "Complete Your Profile" prompt
3. User creates username, adds bio
4. System suggests 5 featured chefs to follow
5. User discovers recipes from followed chefs

**Week 1: Creation**
1. User generates first AI recipe
2. System prompts: "Save this to a collection!"
3. User creates "My Favorites" collection
4. User adds 5 more recipes to collection
5. System: "Your collection has 6 recipes! Make it public to share?"

**Month 1: Engagement**
1. User makes collection public
2. Other users discover and follow collection
3. User gets notification: "Sarah saved your collection!"
4. User discovers Sarah's profile
5. User follows Sarah, discovers new recipes

---

### Power User Journey

**Established User:**
- Has 25+ public recipes
- Maintains 5-10 curated collections
- Follows 50+ other chefs
- 200+ followers
- Actively engages with community

**Daily Workflow:**
1. Check following feed for new recipes
2. Save interesting recipes to collections
3. Add new recipe (original or discovered)
4. Engage with followers (respond to saves)
5. Discover new chefs to follow

---

## Content Moderation

### Moderation Features

**User Reporting:**
- Report inappropriate profiles
- Report spam collections
- Report offensive usernames

**Admin Tools:**
- Feature/unfeature users
- Feature/unfeature collections
- Hide profiles (soft delete)
- Ban users
- Review flagged content

**Automated Moderation:**
- Username profanity filter
- Bio content screening
- Duplicate collection detection
- Spam behavior detection

---

## Analytics & Insights

### User Analytics

**Personal Dashboard:**
- Profile views this week
- Recipe views breakdown
- Collection saves/follows
- Follower growth chart
- Most popular recipes
- Most saved collections

**Admin Analytics:**
- Total users with profiles
- Profile completion rate
- Most followed users
- Trending collections
- User engagement metrics
- Community growth rate

---

## Phased Implementation Plan

### Phase 1: Foundation (Version 0.5.0) - **2 weeks**

**Core Features:**
- [x] Database schema for user_profiles, collections, favorites
- [x] User profile creation & editing
- [x] Username selection & validation
- [x] Collection CRUD operations
- [x] Add/remove recipes to collections
- [x] Public/private collection visibility
- [x] Basic profile page UI
- [x] Collection detail page UI

**Components:**
- ProfileEditor
- CollectionCreator
- CollectionCard
- AddToCollectionMenu

**Estimated Time:** 2 weeks (80 hours)

---

### Phase 2: Social Features (Version 0.5.5) - **1.5 weeks**

**Core Features:**
- [x] Follow/unfollow system
- [x] Followers & following lists
- [x] Favorite recipes (heart icon)
- [x] Recipe view history
- [x] Follow button on profiles
- [x] Favorite button on recipe cards

**Components:**
- FollowButton
- FavoriteButton
- FollowersList
- FollowingList

**Estimated Time:** 1.5 weeks (60 hours)

---

### Phase 3: Discovery (Version 0.6.0) - **2 weeks**

**Core Features:**
- [x] Browse users page
- [x] Browse collections page
- [x] Search users
- [x] Search collections
- [x] Featured users section
- [x] Featured collections section
- [x] User recommendations (basic algorithm)

**Components:**
- UserCard
- UserGrid
- CollectionGrid
- FeaturedSection
- RecommendedChefs
- DiscoveryFilters

**Estimated Time:** 2 weeks (80 hours)

---

### Phase 4: Enhancement (Version 0.7.0) - **1.5 weeks**

**Core Features:**
- [x] Activity feed
- [x] Advanced recommendations
- [x] User badges & achievements
- [x] Collection statistics
- [x] Trending algorithms
- [x] Collection sharing enhancements

**Components:**
- ActivityFeed
- BadgeDisplay
- CollectionStats
- TrendingCollections

**Estimated Time:** 1.5 weeks (60 hours)

---

### Total Implementation: **7 weeks (280 hours)**

**Breakdown by Role:**
- Backend/Database: 100 hours
- Frontend Components: 120 hours
- Testing & QA: 40 hours
- Documentation: 20 hours

---

## Success Metrics

### Engagement Metrics

**Profile Adoption:**
- Target: 80% of users complete profile setup
- Target: 60% upload custom avatar
- Target: 40% add bio

**Collection Engagement:**
- Target: Average user creates 3 collections
- Target: 50% of users have at least 1 public collection
- Target: Average collection has 8 recipes

**Social Engagement:**
- Target: Average user follows 10 others
- Target: Average user has 5 followers
- Target: 30% of public recipes are saved to collections

**Discovery Effectiveness:**
- Target: 40% of users discover recipes via chef profiles
- Target: 25% of users discover recipes via collections
- Target: Featured content drives 20% of engagement

---

## Best Practices

### For Users

**Profile Optimization:**
1. Choose a memorable, recognizable username
2. Write a personal bio (200-300 characters)
3. Add location for local connection
4. Upload a friendly avatar photo
5. List 3-5 specialties/cuisines

**Collection Curation:**
1. Give collections descriptive names
2. Write helpful descriptions
3. Organize recipes logically
4. Keep collections focused (theme/occasion)
5. Update collections regularly

**Community Engagement:**
1. Follow users whose style resonates
2. Save recipes to show appreciation
3. Leave thoughtful ratings/reviews
4. Share your best collections publicly
5. Engage authentically

---

### For Developers

**Performance:**
- Cache user profiles (1 hour TTL)
- Lazy load collection recipes
- Paginate followers/following lists
- Optimize profile statistics queries
- Use database indexes for searches

**Security:**
- Validate all username inputs
- Sanitize bio/description markdown
- Rate limit social actions
- Verify ownership before edits
- Implement CSRF protection

**UX:**
- Show loading states for all async actions
- Provide immediate feedback on follows/favorites
- Use optimistic UI updates where possible
- Handle errors gracefully
- Make social actions reversible

---

## Future Enhancements

### Post-1.0 Features

**Advanced Social:**
- Recipe comments & discussions
- Recipe variations/remixes
- Cook's notes on recipes
- Group collections (collaborative)
- Recipe challenges & contests

**Enhanced Discovery:**
- AI-powered recommendations
- Taste profile matching
- Ingredient-based user matching
- Cooking style similarity
- Seasonal chef recommendations

**Community Features:**
- User groups/communities
- Local chef meetups
- Cooking events calendar
- Recipe exchange programs
- Mentorship programs

**Premium Features:**
- Verified chef badge
- Custom profile themes
- Advanced analytics
- Priority support
- Early feature access

---

## Related Documentation

- **Database Schema:** `docs/reference/USER_DISCOVERY_DATABASE_SCHEMA.md`
- **Roadmap:** `ROADMAP.md` (Version 0.5.0 - 0.7.0)
- **Authentication:** `docs/guides/AUTHENTICATION_REQUIREMENTS.md`
- **API Reference:** Coming soon

---

## Support & Feedback

### Getting Help

**For Users:**
- Help Center: `/help/collections`
- Video Tutorials: `/help/videos`
- Community Forum: `/community`

**For Developers:**
- Technical Docs: `docs/`
- API Reference: `/docs/api`
- GitHub Issues: (repository URL)

### Providing Feedback

**Feature Requests:**
- Submit via `/feedback`
- Vote on existing requests
- Community roadmap input

**Bug Reports:**
- Use GitHub Issues
- Include reproduction steps
- Provide browser/device info

---

**Last Updated:** October 15, 2025
**Version:** 0.5.0
**Status:** Comprehensive specification ready for implementation

---

*"Great recipes are meant to be shared. Great cooks deserve to be discovered."*

**— Joanie's Kitchen Team**
