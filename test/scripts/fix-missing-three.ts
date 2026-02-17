#!/usr/bin/env tsx
/**
 * Quick fix: Extract ingredients for 3 missing recipes and add slugs
 * Brings coverage from 99.94% to 100%
 */

import { db } from '@/lib/db/index';
import { recipes } from '@/lib/db/schema';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import { eq, sql } from 'drizzle-orm';

// Simple slug generator
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Remove duplicate hyphens
    .trim();
}

// Simple ingredient extraction (rule-based for speed)
function extractIngredientName(rawIngredient: string): string {
  // Remove quantities at the start (numbers, fractions, measurements)
  let cleaned = rawIngredient
    .replace(/^\d+[\d\s\/\-.]*/g, '') // Remove leading numbers
    .replace(/^(cup|cups|tablespoon|tablespoons|teaspoon|teaspoons|pound|pounds|ounce|ounces|can|bag|bottle|slice|slices|clove|cloves|large|medium|small)\s+/gi, '')
    .replace(/^(frozen|fresh|dried|chopped|diced|minced|sliced|grated|peeled|cooked|uncooked|canned|bottled)\s+/gi, '')
    .trim();

  // Take first significant noun phrase (before comma or parenthesis)
  const match = cleaned.match(/^([^,(]+)/);
  if (match) {
    cleaned = match[1].trim();
  }

  // Clean up common modifiers
  cleaned = cleaned
    .replace(/\s+(such as.*|about.*|\(.*\))$/i, '')
    .trim();

  return cleaned || rawIngredient;
}

async function fixMissingRecipes() {
  const missingIds = [
    'f5d278da-441e-4aa9-a5e6-4ab359574cb3', // Corn and Lobster Chowder
    '9d898b38-e1cc-43de-a9ae-5e1f41e418ab', // Reheating Corn Tortillas
    '672cea29-4100-4d4b-8d7b-74078ac5fb01'  // Braised Veal Breast
  ];

  console.log('🔧 Fixing 3 missing recipes...\n');

  for (const recipeId of missingIds) {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));

    if (!recipe) {
      console.log(`❌ Recipe ${recipeId} not found`);
      continue;
    }

    console.log(`📝 Processing: ${recipe.name}`);

    // Step 1: Generate and update slug if missing
    if (!recipe.slug) {
      const slug = generateSlug(recipe.name);
      await db.update(recipes)
        .set({ slug })
        .where(eq(recipes.id, recipeId));
      console.log(`   ✅ Added slug: ${slug}`);
    }

    // Step 2: Extract ingredients
    let rawIngredients: string[];

    // Handle different ingredient formats
    if (typeof recipe.ingredients === 'string') {
      try {
        rawIngredients = JSON.parse(recipe.ingredients);
      } catch {
        rawIngredients = [recipe.ingredients];
      }
    } else {
      rawIngredients = recipe.ingredients as string[];
    }

    // Skip if no real ingredients
    if (!rawIngredients || rawIngredients.length === 0 || rawIngredients[0] === 'N/A') {
      console.log(`   ⚠️  Skipping - no ingredients (N/A)`);
      console.log('');
      continue;
    }

    console.log(`   📦 Extracting ${rawIngredients.length} ingredients...`);

    let extractedCount = 0;

    for (let i = 0; i < rawIngredients.length; i++) {
      const rawIngredient = rawIngredients[i];
      if (!rawIngredient || rawIngredient.trim() === '') continue;

      const ingredientName = extractIngredientName(rawIngredient);
      const ingredientSlug = generateSlug(ingredientName);

      // Capitalize for display_name
      const displayName = ingredientName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      // Check if ingredient exists by name first (unique constraint on name)
      let [existingIngredient] = await db.select()
        .from(ingredients)
        .where(eq(ingredients.name, ingredientName.toLowerCase()))
        .limit(1);

      if (!existingIngredient) {
        // Create new ingredient
        [existingIngredient] = await db.insert(ingredients)
          .values({
            name: ingredientName.toLowerCase(),
            display_name: displayName,  // Use snake_case as defined in schema
            slug: ingredientSlug,
            category: 'other', // Default category
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        console.log(`   ➕ Created ingredient: ${displayName}`);
      }

      // Link ingredient to recipe
      await db.insert(recipeIngredients)
        .values({
          recipe_id: recipe.id,
          ingredient_id: existingIngredient.id,
          amount: null, // We'll skip detailed parsing for now
          unit: null,
          position: i,  // 0-based position
          createdAt: new Date()
        })
        .onConflictDoNothing();

      extractedCount++;
    }

    console.log(`   ✅ Extracted ${extractedCount} ingredients`);
    console.log('');
  }

  // Final verification
  console.log('🔍 Verifying coverage...');
  const totalRecipes = await db.select({ count: sql`count(*)` }).from(recipes);
  const withIngredients = await db.select({ count: sql`count(DISTINCT recipe_id)` }).from(recipeIngredients);

  const total = Number(totalRecipes[0].count);
  const extracted = Number(withIngredients[0].count);
  const percentage = ((extracted / total) * 100).toFixed(2);

  console.log(`\n✅ FINAL STATUS:`);
  console.log(`   Total recipes: ${total}`);
  console.log(`   With ingredients: ${extracted}`);
  console.log(`   Coverage: ${percentage}%`);

  if (percentage === '100.00') {
    console.log('\n🎉 100% COVERAGE ACHIEVED!');
  }

  process.exit(0);
}

fixMissingRecipes().catch(console.error);
