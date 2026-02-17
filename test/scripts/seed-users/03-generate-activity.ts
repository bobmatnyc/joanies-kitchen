/**
 * Generate Realistic User Activity
 *
 * Creates authentic platform engagement for synthetic users:
 * - Recipe ratings (upvote highly-ranked recipes)
 * - Comments with thoughtful feedback
 * - Recipe favorites
 * - Meal plans
 * - Collections
 *
 * Activity distribution based on user activity level:
 * - Lurkers: 0-5 interactions
 * - Occasional: 5-15 interactions
 * - Regular: 20-50 interactions
 * - Power users: 100+ interactions
 */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { eq, desc, sql } from 'drizzle-orm';
import {
  recipes,
  recipeRatings,
  recipeComments,
  recipeLikes,
} from '@/lib/db/schema';
import {
  userProfiles,
  favorites,
  collections,
  collectionRecipes,
} from '@/lib/db/user-discovery-schema';
import { meals, mealRecipes } from '@/lib/db/meals-schema';
import type { SyntheticUserProfile } from './01-generate-profiles';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROFILES_FILE = 'scripts/seed-users/generated-profiles.json';

// Activity counts by level
const ACTIVITY_RANGES = {
  lurker: { min: 0, max: 5 },
  occasional: { min: 5, max: 15 },
  regular: { min: 20, max: 50 },
  power: { min: 100, max: 250 },
};

// Activity type distribution (percentages)
const ACTIVITY_DISTRIBUTION = {
  rating: 0.40,      // 40% - rate recipes
  comment: 0.25,     // 25% - comment on recipes
  like: 0.15,        // 15% - like recipes
  favorite: 0.10,    // 10% - favorite recipes
  collection: 0.05,  // 5% - add to collections
  meal: 0.05,        // 5% - create meal plans
};

// Comment templates (imported from profile generation)
const COMMENT_TEMPLATES = [
  'This recipe is amazing! Made it exactly as written and it turned out perfectly. My family loved it!',
  'Absolutely delicious! This is going in my regular rotation. Thanks for sharing!',
  'Perfect! Made this for dinner tonight and everyone asked for seconds. Will definitely make again!',
  'Outstanding recipe! The flavors were incredible. This is a keeper!',
  'Wow, just wow! Best version of this dish I\'ve ever made. Thank you!',
  'Great recipe! I added a bit of garlic and it was perfect.',
  'Made this with a few tweaks - used honey instead of sugar. Turned out great!',
  'Good recipe. I cut the salt in half and it was still plenty flavorful.',
  'Delicious! I doubled the spices for extra flavor. Highly recommend!',
  'Really good! I substituted vegetable broth and it worked beautifully.',
  'Excellent recipe! Note: my oven runs hot so I reduced temp by 25°F.',
  'Perfect! Just needed an extra 10 minutes of cooking time in my oven.',
  'Great recipe. Cut the cooking time by 5 minutes and it was perfect.',
  'Made this but reduced cooking time slightly - turned out great!',
  'Perfect! ⭐⭐⭐⭐⭐',
  'So good! Made it twice this week already.',
  'Delicious!',
  'Easy and tasty! Exactly what I was looking for.',
  'Amazing! Will be making this regularly.',
  'Yum! The whole family enjoyed this.',
  'Good recipe overall. A bit too salty for my taste but I\'ll adjust next time.',
  'Pretty good! I think it could use a bit more seasoning.',
  'Decent recipe. Turned out well but not quite what I expected.',
  'Good, but I prefer more spice. Will add extra next time.',
  'Made this for a dinner party and it was a huge hit! Easy to follow instructions and great results.',
  'This has become my go-to recipe! I\'ve made it at least a dozen times.',
  'Fantastic recipe! Very forgiving - I\'ve made small substitutions each time and it always works.',
  'Love this recipe! Clear instructions and common ingredients. Perfect for weeknight dinners.',
  'First time making this dish and it turned out great! Very easy to follow.',
  'As a beginner cook, I appreciated how clear the instructions were. Turned out perfect!',
  'Easy recipe for someone like me who doesn\'t cook much. Came out great!',
  'Made this for Thanksgiving and it was perfect! Will be my new go-to.',
  'Great for meal prep! I make a big batch on Sundays.',
  'Perfect for potlucks - always gets compliments!',
  'Made this for Christmas dinner. Everyone raved about it!',
];

const COLLECTION_NAMES = [
  'Weeknight Favorites', 'Sunday Dinners', 'Holiday Recipes', 'Quick Meals',
  'Comfort Food', 'Healthy Options', 'Family Favorites', 'Date Night',
  'Meal Prep', 'Party Food', 'Summer Grilling', 'Cozy Winter Meals',
  'Breakfast Ideas', 'Desserts', 'Vegetarian', 'One-Pot Wonders',
];

const MEAL_NAMES = [
  'Weekly Meal Plan', 'This Week\'s Dinners', 'Meal Prep Sunday',
  'Family Dinners', 'Quick Weeknight Meals', 'Weekend Cooking',
  'Healthy Week', 'Comfort Food Week', 'Budget Meals',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomChoice<T>(array: T[]): T {
  return array[randomInt(array.length)];
}

function getActivityCount(activityLevel: string): number {
  const range = ACTIVITY_RANGES[activityLevel as keyof typeof ACTIVITY_RANGES];
  return range.min + randomInt(range.max - range.min + 1);
}

function generateRating(): number {
  // Rating distribution: mostly 4-5 stars, some 3 stars, rare 1-2 stars
  const rand = Math.random();
  if (rand < 0.50) return 5; // 50% - 5 stars
  if (rand < 0.80) return 4; // 30% - 4 stars
  if (rand < 0.95) return 3; // 15% - 3 stars
  if (rand < 0.98) return 2; // 3% - 2 stars
  return 1; // 2% - 1 star
}

function generateComment(rating: number): string | null {
  // Not all ratings include comments (60% have comments)
  if (Math.random() > 0.60) return null;

  // Filter comments based on rating
  if (rating >= 4) {
    // Positive comments for 4-5 star ratings
    const positiveComments = COMMENT_TEMPLATES.filter(
      c => !c.includes('too salty') && !c.includes('not quite')
    );
    return randomChoice(positiveComments);
  } else if (rating === 3) {
    // Neutral/constructive comments for 3 star ratings
    const neutralComments = [
      'Good recipe overall. A bit too salty for my taste but I\'ll adjust next time.',
      'Pretty good! I think it could use a bit more seasoning.',
      'Decent recipe. Turned out well but not quite what I expected.',
      'Good, but I prefer more spice. Will add extra next time.',
    ];
    return randomChoice(neutralComments);
  } else {
    // Critical but constructive for 1-2 star ratings
    const criticalComments = [
      'Recipe needs some work. Following the directions didn\'t work for me.',
      'Not what I expected. Might try again with modifications.',
    ];
    return randomChoice(criticalComments);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// ACTIVITY GENERATION
// ============================================================================

async function generateUserActivity(
  profile: SyntheticUserProfile,
  topRecipes: any[],
  allRecipes: any[]
) {
  const activityCount = getActivityCount(profile.synthetic_activity_level);

  // Skip if lurker with 0 activities
  if (activityCount === 0) return;

  const activities: string[] = [];

  // Determine activity mix based on distribution
  for (let i = 0; i < activityCount; i++) {
    const rand = Math.random();
    let cumulative = 0;

    for (const [type, percentage] of Object.entries(ACTIVITY_DISTRIBUTION)) {
      cumulative += percentage;
      if (rand < cumulative) {
        activities.push(type);
        break;
      }
    }
  }

  const stats = {
    ratings: 0,
    comments: 0,
    likes: 0,
    favorites: 0,
    collections: 0,
    meals: 0,
  };

  // Generate each activity
  for (const activityType of activities) {
    try {
      switch (activityType) {
        case 'rating':
          await generateRatingActivity(profile, topRecipes);
          stats.ratings++;
          break;

        case 'comment':
          await generateCommentActivity(profile, topRecipes);
          stats.comments++;
          break;

        case 'like':
          await generateLikeActivity(profile, topRecipes);
          stats.likes++;
          break;

        case 'favorite':
          await generateFavoriteActivity(profile, topRecipes);
          stats.favorites++;
          break;

        case 'collection':
          await generateCollectionActivity(profile, allRecipes);
          stats.collections++;
          break;

        case 'meal':
          await generateMealActivity(profile, allRecipes);
          stats.meals++;
          break;
      }
    } catch (error) {
      // Ignore duplicate constraint errors (user already interacted with this recipe)
      if (!(error instanceof Error && error.message.includes('duplicate'))) {
        console.error(`Error generating ${activityType} for ${profile.username}:`, error);
      }
    }
  }

  return stats;
}

async function generateRatingActivity(profile: SyntheticUserProfile, recipes: any[]) {
  const recipe = randomChoice(recipes);
  const rating = generateRating();
  const comment = generateComment(rating);

  // Create timestamp (random time between user creation and now)
  const createdAt = new Date(
    profile.created_at.getTime() + Math.random() * (Date.now() - profile.created_at.getTime())
  );

  await db.insert(recipeRatings).values({
    recipe_id: recipe.id,
    user_id: profile.user_id,
    rating,
    review: comment,
    created_at: createdAt,
    updated_at: createdAt,
  });
}

async function generateCommentActivity(profile: SyntheticUserProfile, recipes: any[]) {
  const recipe = randomChoice(recipes);
  const comment = randomChoice(COMMENT_TEMPLATES);

  const createdAt = new Date(
    profile.created_at.getTime() + Math.random() * (Date.now() - profile.created_at.getTime())
  );

  await db.insert(recipeComments).values({
    recipe_id: recipe.id,
    user_id: profile.user_id,
    content: comment,
    created_at: createdAt,
    updated_at: createdAt,
  });
}

async function generateLikeActivity(profile: SyntheticUserProfile, recipes: any[]) {
  const recipe = randomChoice(recipes);

  const createdAt = new Date(
    profile.created_at.getTime() + Math.random() * (Date.now() - profile.created_at.getTime())
  );

  await db.insert(recipeLikes).values({
    recipe_id: recipe.id,
    user_id: profile.user_id,
    created_at: createdAt,
  });
}

async function generateFavoriteActivity(profile: SyntheticUserProfile, recipes: any[]) {
  const recipe = randomChoice(recipes);

  const createdAt = new Date(
    profile.created_at.getTime() + Math.random() * (Date.now() - profile.created_at.getTime())
  );

  await db.insert(favorites).values({
    user_id: profile.user_id,
    recipe_id: recipe.id,
    created_at: createdAt,
  });
}

async function generateCollectionActivity(profile: SyntheticUserProfile, recipes: any[]) {
  // Check if user already has collections
  const existingCollections = await db
    .select()
    .from(collections)
    .where(eq(collections.user_id, profile.user_id))
    .limit(1);

  let collection;

  if (existingCollections.length === 0) {
    // Create new collection
    const name = randomChoice(COLLECTION_NAMES);
    const slug = slugify(name);

    const createdAt = new Date(
      profile.created_at.getTime() + Math.random() * (Date.now() - profile.created_at.getTime())
    );

    [collection] = await db
      .insert(collections)
      .values({
        user_id: profile.user_id,
        name,
        slug,
        is_public: Math.random() < 0.7, // 70% public
        created_at: createdAt,
        updated_at: createdAt,
      })
      .returning();
  } else {
    collection = existingCollections[0];
  }

  // Add random recipe to collection
  const recipe = randomChoice(recipes);

  await db.insert(collectionRecipes).values({
    collection_id: collection.id,
    recipe_id: recipe.id,
    added_at: new Date(),
  });
}

async function generateMealActivity(profile: SyntheticUserProfile, recipes: any[]) {
  const name = randomChoice(MEAL_NAMES);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - randomInt(30)); // Within last 30 days

  const createdAt = new Date(
    profile.created_at.getTime() + Math.random() * (Date.now() - profile.created_at.getTime())
  );

  // Create meal
  const [meal] = await db
    .insert(meals)
    .values({
      user_id: profile.user_id,
      name,
      date: startDate,
      meal_type: randomChoice(['breakfast', 'lunch', 'dinner']),
      created_at: createdAt,
      updated_at: createdAt,
    })
    .returning();

  // Add 2-4 recipes to meal
  const recipeCount = 2 + randomInt(3);
  const selectedRecipes = [];
  for (let i = 0; i < recipeCount && i < recipes.length; i++) {
    selectedRecipes.push(recipes[randomInt(recipes.length)]);
  }

  for (const recipe of selectedRecipes) {
    await db.insert(mealRecipes).values({
      meal_id: meal.id,
      recipe_id: recipe.id,
      added_at: createdAt,
    });
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🎬 Starting activity generation...\n');

  // Load profiles
  console.log('📥 Loading user profiles...');
  const fileContent = readFileSync(PROFILES_FILE, 'utf-8');
  const profiles: SyntheticUserProfile[] = JSON.parse(fileContent);
  console.log(`✅ Loaded ${profiles.length} profiles\n`);

  // Get top recipes (high ratings) for most activity
  console.log('📊 Fetching top-rated recipes...');
  const topRecipes = await db
    .select()
    .from(recipes)
    .where(eq(recipes.is_public, true))
    .orderBy(desc(recipes.system_rating), desc(recipes.avg_user_rating))
    .limit(100);

  console.log(`✅ Found ${topRecipes.length} top recipes\n`);

  // Get all public recipes for variety
  console.log('📚 Fetching all public recipes...');
  const allRecipes = await db
    .select()
    .from(recipes)
    .where(eq(recipes.is_public, true))
    .limit(500);

  console.log(`✅ Found ${allRecipes.length} total recipes\n`);

  if (topRecipes.length === 0) {
    console.error('❌ No recipes found! Please populate recipes first.');
    process.exit(1);
  }

  // Generate activity for each user
  console.log('🔄 Generating user activity...\n');

  let processedCount = 0;
  const totalStats = {
    ratings: 0,
    comments: 0,
    likes: 0,
    favorites: 0,
    collections: 0,
    meals: 0,
  };

  for (const profile of profiles) {
    const stats = await generateUserActivity(profile, topRecipes, allRecipes);

    if (stats) {
      totalStats.ratings += stats.ratings;
      totalStats.comments += stats.comments;
      totalStats.likes += stats.likes;
      totalStats.favorites += stats.favorites;
      totalStats.collections += stats.collections;
      totalStats.meals += stats.meals;
    }

    processedCount++;

    if (processedCount % 100 === 0) {
      console.log(`   ✅ Processed ${processedCount}/${profiles.length} users...`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 ACTIVITY GENERATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`👥 Users processed: ${processedCount}`);
  console.log(`⭐ Ratings created: ${totalStats.ratings}`);
  console.log(`💬 Comments created: ${totalStats.comments}`);
  console.log(`👍 Likes created: ${totalStats.likes}`);
  console.log(`❤️ Favorites created: ${totalStats.favorites}`);
  console.log(`📁 Collections created: ${totalStats.collections}`);
  console.log(`🍽️ Meals created: ${totalStats.meals}`);
  console.log('\n✨ Activity generation complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
