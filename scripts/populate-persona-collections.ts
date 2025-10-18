#!/usr/bin/env tsx

/**
 * Populate Collections for Synthetic User Personas
 *
 * This script populates recipe collections for synthetic user personas.
 * Instead of generating new recipes, personas add existing recipes to their
 * collections and clone/edit them based on their personalities.
 *
 * Process:
 * 1. Query existing recipes matching persona interests
 * 2. Add 5-10 recipes to each persona's collection (auto-like)
 * 3. Clone 2-3 recipes with persona-specific modifications
 * 4. Log progress and statistics
 */

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes, type NewRecipe } from '@/lib/db/schema';
import {
  collections,
  collectionRecipes,
  favorites,
  userProfiles,
} from '@/lib/db/user-discovery-schema';
import { randomUUID } from 'node:crypto';

// Persona Types
interface PersonaProfile {
  userId: string;
  username: string;
  displayName: string;
  type:
    | 'health_conscious'
    | 'budget_cook'
    | 'quick_easy'
    | 'gourmet'
    | 'plant_based'
    | 'family_style';
  cuisinePreferences: string[];
  dietaryRestrictions: string[];
  maxDifficulty: 'easy' | 'medium' | 'hard';
  maxPrepTime?: number;
  preferredTags: string[];
}

// Define persona modifications based on type
function getPersonaModifications(type: PersonaProfile['type']) {
  const modifications = {
    health_conscious: {
      descriptionSuffix: '(Healthier Version)',
      modifyIngredients: (ingredients: string[]): string[] => {
        // Replace high-fat/sugar ingredients with healthier alternatives
        return ingredients.map((ing) =>
          ing
            .replace(/whole milk/gi, 'low-fat milk')
            .replace(/heavy cream/gi, 'Greek yogurt')
            .replace(/butter/gi, 'olive oil')
            .replace(/sugar/gi, 'honey or stevia')
        );
      },
      addTags: ['healthy', 'low-fat', 'nutritious'],
    },
    budget_cook: {
      descriptionSuffix: '(Budget-Friendly Version)',
      modifyIngredients: (ingredients: string[]): string[] => {
        // Simplify expensive ingredients
        return ingredients.map((ing) =>
          ing
            .replace(/saffron/gi, 'turmeric')
            .replace(/truffle/gi, 'mushroom')
            .replace(/prime/gi, 'choice')
        );
      },
      addTags: ['budget-friendly', 'affordable', 'economical'],
    },
    quick_easy: {
      descriptionSuffix: '(Quick & Easy Version)',
      modifyIngredients: (ingredients: string[]): string[] => {
        // Use pre-prepped ingredients
        return ingredients.map((ing) =>
          ing
            .replace(/fresh.*chopped/gi, 'pre-chopped')
            .replace(/from scratch/gi, 'store-bought')
        );
      },
      reducePrepTime: 0.6, // 40% reduction
      reduceCookTime: 0.7, // 30% reduction
      addTags: ['quick', 'easy', 'weeknight'],
    },
    gourmet: {
      descriptionSuffix: '(Gourmet Version)',
      modifyIngredients: (ingredients: string[]): string[] => {
        // Upgrade to premium ingredients
        return ingredients.map((ing) =>
          ing
            .replace(/regular/gi, 'premium')
            .replace(/standard/gi, 'artisan')
            .replace(/basic/gi, 'specialty')
        );
      },
      addTags: ['gourmet', 'restaurant-quality', 'special-occasion'],
    },
    plant_based: {
      descriptionSuffix: '(Plant-Based Version)',
      modifyIngredients: (ingredients: string[]): string[] => {
        // Replace animal products
        return ingredients.map((ing) =>
          ing
            .replace(/chicken/gi, 'tofu or tempeh')
            .replace(/beef/gi, 'mushrooms or lentils')
            .replace(/pork/gi, 'jackfruit')
            .replace(/milk/gi, 'almond milk')
            .replace(/butter/gi, 'vegan butter')
            .replace(/cheese/gi, 'nutritional yeast')
            .replace(/eggs/gi, 'flax eggs')
        );
      },
      addTags: ['vegan', 'plant-based', 'vegetarian'],
    },
    family_style: {
      descriptionSuffix: '(Family-Sized Version)',
      multiplyServings: 2, // Double the servings
      addTags: ['family-friendly', 'kid-approved', 'crowd-pleaser'],
    },
  };

  return modifications[type];
}

// Find recipes matching persona criteria
async function findMatchingRecipes(persona: PersonaProfile, limit = 20): Promise<any[]> {
  const conditions = [];

  // Must be public
  conditions.push(eq(recipes.is_public, true));

  // Match difficulty level
  const difficultyLevels = {
    easy: ['easy'],
    medium: ['easy', 'medium'],
    hard: ['easy', 'medium', 'hard'],
  };
  conditions.push(inArray(recipes.difficulty, difficultyLevels[persona.maxDifficulty] as any));

  // Match prep time if specified
  if (persona.maxPrepTime) {
    conditions.push(sql`${recipes.prep_time} <= ${persona.maxPrepTime}`);
  }

  // Get recipes
  const matchedRecipes = await db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .orderBy(desc(recipes.created_at))
    .limit(limit * 3); // Get more than needed for filtering

  // Filter by cuisine and tags in application code (since JSON fields are complex to query)
  const filtered = matchedRecipes.filter((recipe) => {
    const recipeTags = recipe.tags ? JSON.parse(recipe.tags) : [];
    const recipeCuisine = recipe.cuisine?.toLowerCase() || '';

    // Check cuisine match
    const cuisineMatch = persona.cuisinePreferences.some((pref) =>
      recipeCuisine.includes(pref.toLowerCase())
    );

    // Check preferred tags match
    const tagMatch = persona.preferredTags.some((pref) =>
      recipeTags.some((tag: string) => tag.toLowerCase().includes(pref.toLowerCase()))
    );

    // Check dietary restrictions (no forbidden tags)
    const noForbiddenTags = persona.dietaryRestrictions.every(
      (restriction) =>
        !recipeTags.some((tag: string) => tag.toLowerCase().includes(restriction.toLowerCase()))
    );

    return (cuisineMatch || tagMatch) && noForbiddenTags;
  });

  return filtered.slice(0, limit);
}

// Add recipe to persona's collection with auto-like
async function addToCollection(
  collectionId: string,
  recipeId: string,
  userId: string,
  position: number
) {
  // Add to collection
  await db.insert(collectionRecipes).values({
    id: randomUUID(),
    collection_id: collectionId,
    recipe_id: recipeId,
    position,
    added_at: new Date(),
  });

  // Auto-favorite (like) the recipe
  try {
    await db.insert(favorites).values({
      id: randomUUID(),
      user_id: userId,
      recipe_id: recipeId,
      created_at: new Date(),
    });

    // Increment recipe like_count
    await db
      .update(recipes)
      .set({
        like_count: sql`${recipes.like_count} + 1`,
        collection_count: sql`${recipes.collection_count} + 1`,
      })
      .where(eq(recipes.id, recipeId));
  } catch (error) {
    // Might already be favorited
    console.log(`  Already favorited recipe ${recipeId}`);
  }

  // Update collection counts
  await db
    .update(collections)
    .set({
      recipe_count: sql`${collections.recipe_count} + 1`,
      last_recipe_added_at: new Date(),
    })
    .where(eq(collections.id, collectionId));
}

// Clone recipe with persona-specific modifications
async function cloneRecipeForPersona(
  originalRecipe: any,
  persona: PersonaProfile
): Promise<string> {
  const mods = getPersonaModifications(persona.type);

  // Parse ingredients and instructions
  const originalIngredients = JSON.parse(originalRecipe.ingredients);
  const originalInstructions = JSON.parse(originalRecipe.instructions);
  const originalTags = originalRecipe.tags ? JSON.parse(originalRecipe.tags) : [];

  // Apply modifications
  const modifiedIngredients = mods.modifyIngredients
    ? mods.modifyIngredients(originalIngredients)
    : originalIngredients;

  const modifiedServings = mods.multiplyServings
    ? (originalRecipe.servings || 4) * mods.multiplyServings
    : originalRecipe.servings;

  const modifiedPrepTime = mods.reducePrepTime
    ? Math.round((originalRecipe.prep_time || 0) * mods.reducePrepTime)
    : originalRecipe.prep_time;

  const modifiedCookTime = mods.reduceCookTime
    ? Math.round((originalRecipe.cook_time || 0) * mods.reduceCookTime)
    : originalRecipe.cook_time;

  const modifiedTags = [...originalTags, ...(mods.addTags || [])];

  // Create cloned recipe
  const clonedRecipeData: NewRecipe = {
    id: randomUUID(),
    user_id: persona.userId,
    name: `${originalRecipe.name} ${mods.descriptionSuffix}`,
    description: `${originalRecipe.description || ''}\n\n${mods.descriptionSuffix} of the original recipe.`,
    ingredients: JSON.stringify(modifiedIngredients),
    instructions: JSON.stringify(originalInstructions),
    tags: JSON.stringify(modifiedTags),
    difficulty: originalRecipe.difficulty,
    cuisine: originalRecipe.cuisine,
    prep_time: modifiedPrepTime,
    cook_time: modifiedCookTime,
    servings: modifiedServings,
    nutrition_info: originalRecipe.nutrition_info,
    source: `Forked from recipe ID: ${originalRecipe.id}`,
    images: originalRecipe.images,
    image_url: originalRecipe.image_url,
    is_public: false, // Private by default
    is_ai_generated: false,
    is_system_recipe: false,
    is_meal_prep_friendly: originalRecipe.is_meal_prep_friendly,
    like_count: 0,
    fork_count: 0,
    collection_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const [clonedRecipe] = await db.insert(recipes).values(clonedRecipeData).returning();

  // Increment original recipe's fork_count
  await db
    .update(recipes)
    .set({
      fork_count: sql`${recipes.fork_count} + 1`,
      like_count: sql`${recipes.like_count} + 1`, // Author gets a like for being cloned
      updated_at: new Date(),
      })
    .where(eq(recipes.id, originalRecipe.id));

  // Auto-favorite original
  try {
    await db.insert(favorites).values({
      id: randomUUID(),
      user_id: persona.userId,
      recipe_id: originalRecipe.id,
      created_at: new Date(),
    });
  } catch {
    // Already favorited
  }

  return clonedRecipe.id;
}

// Main execution
async function main() {
  console.log('🔄 Populating collections for synthetic user personas...\n');

  // Get all synthetic user personas
  const personas = await db
    .select()
    .from(userProfiles)
    .where(sql`${userProfiles.bio} LIKE '%Synthetic%'`);

  if (personas.length === 0) {
    console.log('❌ No synthetic user personas found. Create personas first.');
    return;
  }

  console.log(`📊 Found ${personas.length} synthetic user personas\n`);

  let totalAdded = 0;
  let totalCloned = 0;

  for (const profile of personas) {
    console.log(`\n👤 Processing: ${profile.display_name} (@${profile.username})`);

    // Infer persona type from specialties or bio
    // For now, use a simple mapping (you can enhance this)
    const specialties = (profile.specialties || []) as string[];
    let personaType: PersonaProfile['type'] = 'family_style';

    if (specialties.some((s) => s.toLowerCase().includes('health'))) {
      personaType = 'health_conscious';
    } else if (specialties.some((s) => s.toLowerCase().includes('budget'))) {
      personaType = 'budget_cook';
    } else if (specialties.some((s) => s.toLowerCase().includes('quick'))) {
      personaType = 'quick_easy';
    } else if (specialties.some((s) => s.toLowerCase().includes('gourmet'))) {
      personaType = 'gourmet';
    } else if (specialties.some((s) => s.toLowerCase().includes('vegan'))) {
      personaType = 'plant_based';
    }

    const persona: PersonaProfile = {
      userId: profile.user_id,
      username: profile.username,
      displayName: profile.display_name,
      type: personaType,
      cuisinePreferences: specialties.filter((s) =>
        ['Italian', 'Mexican', 'Asian', 'French', 'Mediterranean'].includes(s)
      ),
      dietaryRestrictions: [],
      maxDifficulty: 'medium',
      preferredTags: specialties.map((s) => s.toLowerCase()),
    };

    console.log(`  Type: ${personaType}`);

    // Create a collection for this persona
    const [collection] = await db
      .insert(collections)
      .values({
        id: randomUUID(),
        user_id: persona.userId,
        name: `My Favorite ${persona.displayName.split(' ')[0]} Recipes`,
        slug: `favorite-${persona.username}-recipes`,
        description: `Curated collection of recipes that match my ${personaType.replace('_', ' ')} style`,
        is_public: true,
        recipe_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    console.log(`  Created collection: "${collection.name}"`);

    // Find matching recipes
    const matchingRecipes = await findMatchingRecipes(persona, 15);
    console.log(`  Found ${matchingRecipes.length} matching recipes`);

    // Add 5-10 recipes to collection
    const numToAdd = Math.min(5 + Math.floor(Math.random() * 6), matchingRecipes.length);
    const recipesToAdd = matchingRecipes.slice(0, numToAdd);

    for (let i = 0; i < recipesToAdd.length; i++) {
      await addToCollection(collection.id, recipesToAdd[i].id, persona.userId, i);
      console.log(`  ✅ Added: ${recipesToAdd[i].name}`);
      totalAdded++;
    }

    // Clone 2-3 recipes with modifications
    const numToClone = Math.min(2 + Math.floor(Math.random() * 2), matchingRecipes.length - numToAdd);
    const recipesToClone = matchingRecipes.slice(numToAdd, numToAdd + numToClone);

    for (const recipe of recipesToClone) {
      const clonedId = await cloneRecipeForPersona(recipe, persona);
      console.log(`  🍴 Cloned: ${recipe.name} → New ID: ${clonedId.slice(0, 8)}...`);
      totalCloned++;

      // Add cloned recipe to collection
      await addToCollection(collection.id, clonedId, persona.userId, numToAdd + totalCloned - 1);
    }

    console.log(`  📚 Collection complete: ${numToAdd} added, ${numToClone} cloned`);
  }

  console.log(`\n✅ Collection population complete!`);
  console.log(`📊 Summary:`);
  console.log(`   Total recipes added to collections: ${totalAdded}`);
  console.log(`   Total recipes cloned with modifications: ${totalCloned}`);
  console.log(`   Total personas processed: ${personas.length}`);
}

main()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
