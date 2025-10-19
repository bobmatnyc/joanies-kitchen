/**
 * Seed Synthetic Collections and Meals
 *
 * Populates the database with realistic collections and meal plans for synthetic users.
 * This provides demo data and tests the meal pairing system.
 *
 * Usage:
 *   pnpm tsx scripts/seed-synthetic-collections-meals.ts
 *
 * Features:
 * - Creates diverse recipe collections (2-3 per user)
 * - Generates weekly meal plans (1-2 per user)
 * - Uses existing recipes from database
 * - Idempotent (can run multiple times safely)
 */

import 'dotenv/config';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { mealRecipes, meals, recipes, type Meal } from '../src/lib/db/schema';
import {
  type Collection,
  collectionRecipes,
  collections,
  userProfiles,
} from '../src/lib/db/user-discovery-schema';

// ============================================================================
// SYNTHETIC USER PROFILES
// ============================================================================

interface SyntheticUser {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  specialties: string[];
  collectionThemes: string[];
  mealTypes: string[];
}

const SYNTHETIC_USERS: SyntheticUser[] = [
  {
    userId: 'user_synthetic_home_cook',
    username: 'sarah_homecook',
    displayName: 'Sarah Martinez',
    bio: 'Busy mom of 3 who loves quick, healthy weeknight dinners. Meal prep queen!',
    specialties: ['Quick Dinners', 'Meal Prep', 'Kid-Friendly'],
    collectionThemes: ['Quick Weeknight Dinners', 'Kids\' Favorites', 'Healthy Meal Prep'],
    mealTypes: ['dinner', 'lunch'],
  },
  {
    userId: 'user_synthetic_foodie',
    username: 'alex_foodie',
    displayName: 'Alex Chen',
    bio: 'Food enthusiast exploring cuisines from around the world. Love trying new recipes!',
    specialties: ['Asian', 'Italian', 'Mediterranean'],
    collectionThemes: ['Comfort Food Favorites', 'Asian Fusion', 'Italian Classics'],
    mealTypes: ['dinner', 'brunch'],
  },
  {
    userId: 'user_synthetic_baker',
    username: 'emily_baker',
    displayName: 'Emily Rodriguez',
    bio: 'Passionate baker and dessert lover. Weekend cooking enthusiast.',
    specialties: ['Baking', 'Desserts', 'Comfort Food'],
    collectionThemes: ['Special Occasions', 'Weekend Baking', 'Comfort Classics'],
    mealTypes: ['dessert', 'brunch', 'dinner'],
  },
  {
    userId: 'user_synthetic_healthy',
    username: 'mike_fitchef',
    displayName: 'Mike Thompson',
    bio: 'Fitness coach who believes healthy food should taste amazing. Clean eating advocate.',
    specialties: ['Healthy', 'Protein-Rich', 'Low-Carb'],
    collectionThemes: ['Healthy High-Protein', 'Quick Post-Workout Meals', 'Meal Prep Basics'],
    mealTypes: ['breakfast', 'lunch', 'dinner'],
  },
];

// ============================================================================
// COLLECTION TEMPLATES
// ============================================================================

interface CollectionTemplate {
  nameTemplate: string;
  description: string;
  tags: string[];
  isPublic: boolean;
  recipeFilters: {
    cuisines?: string[];
    tags?: string[];
    keywords?: string[];
    difficulty?: ('easy' | 'medium' | 'hard')[];
  };
  minRecipes: number;
  maxRecipes: number;
}

const COLLECTION_TEMPLATES: Record<string, CollectionTemplate> = {
  'Quick Weeknight Dinners': {
    nameTemplate: 'Quick Weeknight Dinners',
    description: 'Fast and easy recipes for busy weeknights, all under 30 minutes.',
    tags: ['quick', 'easy', 'weeknight'],
    isPublic: true,
    recipeFilters: {
      tags: ['quick', 'easy'],
      difficulty: ['easy'],
    },
    minRecipes: 6,
    maxRecipes: 10,
  },
  'Kids\' Favorites': {
    nameTemplate: 'Kids\' Favorites',
    description: 'Kid-approved meals that the whole family will love.',
    tags: ['family', 'kid-friendly', 'favorites'],
    isPublic: true,
    recipeFilters: {
      tags: ['kid-friendly', 'comfort food'],
    },
    minRecipes: 5,
    maxRecipes: 8,
  },
  'Healthy Meal Prep': {
    nameTemplate: 'Healthy Meal Prep',
    description: 'Nutritious recipes perfect for weekly meal planning and prep.',
    tags: ['healthy', 'meal-prep', 'nutritious'],
    isPublic: true,
    recipeFilters: {
      tags: ['healthy', 'meal prep'],
    },
    minRecipes: 5,
    maxRecipes: 10,
  },
  'Comfort Food Favorites': {
    nameTemplate: 'Comfort Food Classics',
    description: 'Hearty, soul-warming dishes that feel like home.',
    tags: ['comfort-food', 'hearty', 'classic'],
    isPublic: true,
    recipeFilters: {
      tags: ['comfort food'],
    },
    minRecipes: 6,
    maxRecipes: 10,
  },
  'Asian Fusion': {
    nameTemplate: 'Asian Fusion Collection',
    description: 'Delicious Asian-inspired recipes from various cuisines.',
    tags: ['asian', 'fusion', 'international'],
    isPublic: true,
    recipeFilters: {
      cuisines: ['Chinese', 'Japanese', 'Thai', 'Korean', 'Vietnamese'],
    },
    minRecipes: 5,
    maxRecipes: 10,
  },
  'Italian Classics': {
    nameTemplate: 'Italian Classics',
    description: 'Traditional Italian recipes passed down through generations.',
    tags: ['italian', 'classic', 'traditional'],
    isPublic: true,
    recipeFilters: {
      cuisines: ['Italian'],
    },
    minRecipes: 5,
    maxRecipes: 10,
  },
  'Special Occasions': {
    nameTemplate: 'Special Occasion Meals',
    description: 'Impressive recipes for holidays, celebrations, and dinner parties.',
    tags: ['special-occasion', 'entertaining', 'impressive'],
    isPublic: true,
    recipeFilters: {
      difficulty: ['medium', 'hard'],
    },
    minRecipes: 5,
    maxRecipes: 8,
  },
  'Weekend Baking': {
    nameTemplate: 'Weekend Baking Projects',
    description: 'Fun baking projects for lazy Saturdays and Sundays.',
    tags: ['baking', 'desserts', 'weekend'],
    isPublic: true,
    recipeFilters: {
      tags: ['baking', 'dessert'],
    },
    minRecipes: 5,
    maxRecipes: 10,
  },
  'Comfort Classics': {
    nameTemplate: 'Comfort Food Classics',
    description: 'Timeless comfort food recipes that never disappoint.',
    tags: ['comfort-food', 'classic', 'traditional'],
    isPublic: false,
    recipeFilters: {
      tags: ['comfort food'],
    },
    minRecipes: 5,
    maxRecipes: 10,
  },
  'Healthy High-Protein': {
    nameTemplate: 'High-Protein Meals',
    description: 'Protein-rich recipes for fitness and muscle building.',
    tags: ['high-protein', 'fitness', 'healthy'],
    isPublic: true,
    recipeFilters: {
      tags: ['healthy', 'protein'],
    },
    minRecipes: 6,
    maxRecipes: 10,
  },
  'Quick Post-Workout Meals': {
    nameTemplate: 'Post-Workout Fuel',
    description: 'Quick, nutritious meals to refuel after exercise.',
    tags: ['post-workout', 'quick', 'healthy'],
    isPublic: true,
    recipeFilters: {
      tags: ['quick', 'healthy'],
      difficulty: ['easy'],
    },
    minRecipes: 5,
    maxRecipes: 8,
  },
  'Meal Prep Basics': {
    nameTemplate: 'Meal Prep Essentials',
    description: 'Foundational recipes for successful weekly meal prepping.',
    tags: ['meal-prep', 'basics', 'batch-cooking'],
    isPublic: true,
    recipeFilters: {
      tags: ['meal prep'],
    },
    minRecipes: 6,
    maxRecipes: 10,
  },
};

// ============================================================================
// MEAL PLAN TEMPLATES
// ============================================================================

interface MealPlanTemplate {
  name: string;
  description: string;
  mealType: string;
  occasion?: string;
  serves: number;
  days: {
    dayName: string;
    meals: {
      courseCategory: 'breakfast' | 'lunch' | 'dinner' | 'appetizer' | 'main' | 'side' | 'dessert';
      recipeQuery: {
        tags?: string[];
        cuisines?: string[];
        keywords?: string[];
      };
    }[];
  }[];
}

const MEAL_PLAN_TEMPLATES: MealPlanTemplate[] = [
  {
    name: 'Healthy Week Meal Plan',
    description: 'A week of balanced, nutritious meals for the whole family',
    mealType: 'dinner',
    serves: 4,
    days: [
      {
        dayName: 'Monday',
        meals: [
          { courseCategory: 'main', recipeQuery: { tags: ['healthy', 'chicken'] } },
          { courseCategory: 'side', recipeQuery: { tags: ['vegetables'] } },
        ],
      },
      {
        dayName: 'Tuesday',
        meals: [
          { courseCategory: 'main', recipeQuery: { tags: ['healthy', 'fish'] } },
          { courseCategory: 'side', recipeQuery: { tags: ['rice'] } },
        ],
      },
      {
        dayName: 'Wednesday',
        meals: [
          { courseCategory: 'main', recipeQuery: { tags: ['healthy', 'vegetarian'] } },
          { courseCategory: 'side', recipeQuery: { tags: ['salad'] } },
        ],
      },
      {
        dayName: 'Thursday',
        meals: [
          { courseCategory: 'main', recipeQuery: { tags: ['healthy', 'beef'] } },
          { courseCategory: 'side', recipeQuery: { tags: ['vegetables'] } },
        ],
      },
      {
        dayName: 'Friday',
        meals: [
          { courseCategory: 'main', recipeQuery: { tags: ['quick', 'easy'] } },
          { courseCategory: 'side', recipeQuery: { tags: ['pasta'] } },
        ],
      },
    ],
  },
  {
    name: 'Quick Weeknight Dinners',
    description: 'Fast and easy dinners for busy weeknights',
    mealType: 'dinner',
    serves: 4,
    days: [
      {
        dayName: 'Monday',
        meals: [{ courseCategory: 'main', recipeQuery: { tags: ['quick', 'easy'] } }],
      },
      {
        dayName: 'Tuesday',
        meals: [{ courseCategory: 'main', recipeQuery: { tags: ['quick', '30-minute'] } }],
      },
      {
        dayName: 'Wednesday',
        meals: [{ courseCategory: 'main', recipeQuery: { tags: ['quick', 'one-pot'] } }],
      },
      {
        dayName: 'Thursday',
        meals: [{ courseCategory: 'main', recipeQuery: { tags: ['quick', 'sheet-pan'] } }],
      },
      {
        dayName: 'Friday',
        meals: [{ courseCategory: 'main', recipeQuery: { tags: ['quick', 'takeout'] } }],
      },
    ],
  },
  {
    name: 'Weekend Brunch Plan',
    description: 'Special brunch recipes for leisurely weekend mornings',
    mealType: 'brunch',
    serves: 4,
    days: [
      {
        dayName: 'Saturday',
        meals: [
          { courseCategory: 'main', recipeQuery: { tags: ['breakfast', 'eggs'] } },
          { courseCategory: 'side', recipeQuery: { tags: ['breakfast', 'pastries'] } },
        ],
      },
      {
        dayName: 'Sunday',
        meals: [
          { courseCategory: 'main', recipeQuery: { tags: ['breakfast', 'pancakes'] } },
          { courseCategory: 'side', recipeQuery: { tags: ['breakfast', 'fruit'] } },
        ],
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensure user profile exists, create if needed
 */
async function ensureUserProfile(user: SyntheticUser): Promise<boolean> {
  try {
    // Check if profile already exists
    const existing = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, user.userId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ℹ User profile already exists: ${user.displayName}`);
      return true;
    }

    // Create user profile
    await db.insert(userProfiles).values({
      user_id: user.userId,
      username: user.username,
      display_name: user.displayName,
      bio: user.bio,
      specialties: user.specialties,
      is_public: true,
    });

    console.log(`  ✓ Created user profile: ${user.displayName}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to create user profile for ${user.displayName}:`, error);
    return false;
  }
}

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Find recipes matching filters
 */
async function findRecipesForCollection(
  filters: CollectionTemplate['recipeFilters'],
  limit: number
): Promise<typeof recipes.$inferSelect[]> {
  const conditions = [eq(recipes.is_public, true)];

  // Build SQL conditions based on filters
  if (filters.cuisines && filters.cuisines.length > 0) {
    conditions.push(inArray(recipes.cuisine, filters.cuisines));
  }

  if (filters.difficulty && filters.difficulty.length > 0) {
    conditions.push(inArray(recipes.difficulty, filters.difficulty));
  }

  // For tags and keywords, we'll filter in memory since they're JSON arrays
  let foundRecipes = await db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .limit(limit * 3); // Get more than needed for filtering

  // Filter by tags if specified
  if (filters.tags && filters.tags.length > 0) {
    foundRecipes = foundRecipes.filter((recipe) => {
      if (!recipe.tags) return false;
      const recipeTags = JSON.parse(recipe.tags) as string[];
      return filters.tags!.some((filterTag) =>
        recipeTags.some((recipeTag) => recipeTag.toLowerCase().includes(filterTag.toLowerCase()))
      );
    });
  }

  // Filter by keywords if specified
  if (filters.keywords && filters.keywords.length > 0) {
    foundRecipes = foundRecipes.filter((recipe) => {
      const searchText = `${recipe.name} ${recipe.description || ''}`.toLowerCase();
      return filters.keywords!.some((keyword) => searchText.includes(keyword.toLowerCase()));
    });
  }

  // Return up to limit
  return foundRecipes.slice(0, limit);
}

/**
 * Create collection for user
 */
async function createCollection(
  userId: string,
  themeName: string,
  template: CollectionTemplate
): Promise<Collection | null> {
  try {
    const slug = generateSlug(template.nameTemplate);

    // Check if collection already exists
    const existing = await db
      .select()
      .from(collections)
      .where(and(eq(collections.user_id, userId), eq(collections.slug, slug)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`    ℹ Collection already exists: ${template.nameTemplate}`);
      return existing[0];
    }

    // Find recipes for this collection
    const recipeCount = Math.floor(
      Math.random() * (template.maxRecipes - template.minRecipes + 1) + template.minRecipes
    );
    const foundRecipes = await findRecipesForCollection(template.recipeFilters, recipeCount);

    if (foundRecipes.length === 0) {
      console.log(`    ⚠ No recipes found for: ${template.nameTemplate}`);
      return null;
    }

    // Create collection
    const [newCollection] = await db
      .insert(collections)
      .values({
        user_id: userId,
        name: template.nameTemplate,
        slug,
        description: template.description,
        is_public: template.isPublic,
        recipe_count: foundRecipes.length,
      })
      .returning();

    // Add recipes to collection
    for (let i = 0; i < foundRecipes.length; i++) {
      await db.insert(collectionRecipes).values({
        collection_id: newCollection.id,
        recipe_id: foundRecipes[i].id,
        position: i,
      });

      // Update recipe's collection count
      await db
        .update(recipes)
        .set({
          collection_count: sql`${recipes.collection_count} + 1`,
        })
        .where(eq(recipes.id, foundRecipes[i].id));
    }

    console.log(
      `    ✓ Created collection: ${template.nameTemplate} (${foundRecipes.length} recipes)`
    );
    return newCollection;
  } catch (error) {
    console.error(`    ✗ Failed to create collection ${template.nameTemplate}:`, error);
    return null;
  }
}

/**
 * Find recipe for meal plan query
 */
async function findRecipeForMeal(query: {
  tags?: string[];
  cuisines?: string[];
  keywords?: string[];
}): Promise<typeof recipes.$inferSelect | null> {
  const conditions = [eq(recipes.is_public, true)];

  if (query.cuisines && query.cuisines.length > 0) {
    conditions.push(inArray(recipes.cuisine, query.cuisines));
  }

  let foundRecipes = await db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .limit(20);

  // Filter by tags
  if (query.tags && query.tags.length > 0) {
    foundRecipes = foundRecipes.filter((recipe) => {
      if (!recipe.tags) return false;
      const recipeTags = JSON.parse(recipe.tags) as string[];
      return query.tags!.some((filterTag) =>
        recipeTags.some((recipeTag) => recipeTag.toLowerCase().includes(filterTag.toLowerCase()))
      );
    });
  }

  // Filter by keywords
  if (query.keywords && query.keywords.length > 0) {
    foundRecipes = foundRecipes.filter((recipe) => {
      const searchText = `${recipe.name} ${recipe.description || ''}`.toLowerCase();
      return query.keywords!.some((keyword) => searchText.includes(keyword.toLowerCase()));
    });
  }

  return foundRecipes.length > 0 ? foundRecipes[Math.floor(Math.random() * foundRecipes.length)] : null;
}

/**
 * Create meal plan for user
 */
async function createMealPlan(userId: string, template: MealPlanTemplate): Promise<Meal | null> {
  try {
    // Check if meal plan already exists
    const existing = await db
      .select()
      .from(meals)
      .where(and(eq(meals.user_id, userId), eq(meals.name, template.name)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`    ℹ Meal plan already exists: ${template.name}`);
      return existing[0];
    }

    // Create meal plan
    const [newMeal] = await db
      .insert(meals)
      .values({
        user_id: userId,
        name: template.name,
        description: template.description,
        meal_type: template.mealType as any,
        occasion: template.occasion,
        serves: template.serves,
        is_public: true,
      })
      .returning();

    let addedRecipes = 0;
    let displayOrder = 0;
    const usedRecipeIds = new Set<string>(); // Track used recipes to avoid duplicates

    // Add recipes for each day
    for (const day of template.days) {
      for (const mealSpec of day.meals) {
        // Get more recipes than needed to find unique ones
        let recipe = await findRecipeForMeal(mealSpec.recipeQuery);

        // Try to find a recipe not already used (up to 3 attempts)
        let attempts = 0;
        while (recipe && usedRecipeIds.has(recipe.id) && attempts < 3) {
          recipe = await findRecipeForMeal(mealSpec.recipeQuery);
          attempts++;
        }

        // Skip if no unique recipe found after 3 attempts
        if (!recipe || usedRecipeIds.has(recipe.id)) {
          continue;
        }

        // Mark recipe as used
        usedRecipeIds.add(recipe.id);

        await db.insert(mealRecipes).values({
          meal_id: newMeal.id,
          recipe_id: recipe.id,
          course_category: mealSpec.courseCategory,
          display_order: displayOrder++,
          preparation_notes: `For ${day.dayName}`,
        });
        addedRecipes++;
      }
    }

    if (addedRecipes === 0) {
      // Delete meal if no recipes added
      await db.delete(meals).where(eq(meals.id, newMeal.id));
      console.log(`    ⚠ No recipes found for meal plan: ${template.name}`);
      return null;
    }

    console.log(`    ✓ Created meal plan: ${template.name} (${addedRecipes} recipes)`);
    return newMeal;
  } catch (error) {
    console.error(`    ✗ Failed to create meal plan ${template.name}:`, error);
    return null;
  }
}

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

async function main() {
  console.log('🌱 Seeding Synthetic Collections and Meal Plans');
  console.log('================================================\n');

  let totalCollections = 0;
  let totalMealPlans = 0;

  // Check if there are any recipes in the database
  const recipeCountResult = await db.select({ count: count() }).from(recipes);
  const recipeCount = recipeCountResult[0]?.count || 0;

  console.log(`📊 Database contains ${recipeCount} recipes\n`);

  if (recipeCount === 0) {
    console.log('⚠️  No recipes found in database. Please seed recipes first.');
    console.log('   Run: pnpm tsx scripts/seed-system-recipes.ts\n');
    return;
  }

  // Process each synthetic user
  for (const user of SYNTHETIC_USERS) {
    console.log(`\n👤 Processing user: ${user.displayName} (@${user.username})`);
    console.log('─'.repeat(60));

    // Ensure user profile exists
    const profileCreated = await ensureUserProfile(user);
    if (!profileCreated) {
      console.log(`  ⚠️  Skipping user ${user.displayName} due to profile creation failure\n`);
      continue;
    }

    // Create collections based on user's themes
    console.log('  📚 Creating collections...');
    for (const themeName of user.collectionThemes) {
      const template = COLLECTION_TEMPLATES[themeName];
      if (template) {
        const collection = await createCollection(user.userId, themeName, template);
        if (collection) totalCollections++;
      }
    }

    // Create meal plans
    console.log('  🍽️  Creating meal plans...');
    const relevantMealPlans = MEAL_PLAN_TEMPLATES.filter((template) =>
      user.mealTypes.includes(template.mealType)
    );

    // Create 1-2 meal plans per user
    const mealPlansToCreate = relevantMealPlans.slice(0, 2);
    for (const template of mealPlansToCreate) {
      const mealPlan = await createMealPlan(user.userId, template);
      if (mealPlan) totalMealPlans++;
    }
  }

  // Print summary
  console.log('\n\n🎉 Seeding Complete!');
  console.log('═'.repeat(60));
  console.log(`✅ Created ${SYNTHETIC_USERS.length} synthetic user profiles`);
  console.log(`✅ Created ${totalCollections} collections`);
  console.log(`✅ Created ${totalMealPlans} meal plans`);
  console.log('\n💡 Tips:');
  console.log('  - Collections are organized by themes (e.g., "Quick Dinners")');
  console.log('  - Meal plans include multiple recipes across several days');
  console.log('  - Run this script again to add more collections/meal plans\n');
}

// ============================================================================
// EXECUTE SCRIPT
// ============================================================================

main()
  .then(() => {
    console.log('✨ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
