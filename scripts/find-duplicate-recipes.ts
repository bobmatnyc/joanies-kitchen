#!/usr/bin/env tsx
/**
 * Duplicate Recipe Detection Script
 *
 * Finds recipes with matching titles and descriptions, then ranks them
 * by quality to determine which copy to keep.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  images: string | null;
  ingredients: string | null;
  instructions: string | null;
  chef_id: string | null;
  created_at: Date;
  is_public: boolean;
  source: string | null;
  source_id: string | null;
}

// Normalize text for comparison
function normalize(text: string | null): string {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Calculate quality score for a recipe
function calculateQualityScore(recipe: Recipe): number {
  let score = 0;

  // Image quality (prefer Vercel Blob over external)
  if (recipe.image_url?.includes('vercel-storage.com') || recipe.image_url?.includes('blob.vercel-app.com')) {
    score += 20;
  } else if (recipe.image_url) {
    score += 10;
  }

  // Additional images
  if (recipe.images) {
    try {
      const imgs = JSON.parse(recipe.images);
      score += Math.min(imgs.length * 5, 15);
    } catch (e) {}
  }

  // Description quality
  if (recipe.description && recipe.description.length > 50) {
    score += 15;
  } else if (recipe.description) {
    score += 5;
  }

  // Ingredients completeness
  if (recipe.ingredients) {
    try {
      const ing = JSON.parse(recipe.ingredients);
      score += Math.min(ing.length * 2, 20);
    } catch (e) {}
  }

  // Instructions completeness
  if (recipe.instructions) {
    try {
      const inst = JSON.parse(recipe.instructions);
      score += Math.min(inst.length * 2, 20);
    } catch (e) {}
  }

  // Has chef association
  if (recipe.chef_id) {
    score += 10;
  }

  // Has source or source_id
  if (recipe.source || recipe.source_id) {
    score += 5;
  }

  // Is public
  if (recipe.is_public) {
    score += 5;
  }

  return score;
}

async function main() {
  console.log('🔍 Finding duplicate recipes based on title and description...\n');

  // Get all recipes
  const recipes = await sql`
    SELECT
      id, name, description, image_url, images, ingredients,
      instructions, chef_id, created_at, is_public, source, source_id
    FROM recipes
    ORDER BY name
  ` as Recipe[];

  console.log(`Total recipes: ${recipes.length}\n`);

  // Group by normalized name and description
  const groups = new Map<string, Recipe[]>();

  for (const recipe of recipes) {
    const key = `${normalize(recipe.name)}|||${normalize(recipe.description)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(recipe);
  }

  // Find duplicates (groups with more than one recipe)
  const duplicates = Array.from(groups.entries())
    .filter(([_, recipes]) => recipes.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Found ${duplicates.length} duplicate groups\n`);
  console.log('='.repeat(80));

  let totalDuplicateRecipes = 0;
  const deleteIds: string[] = [];

  for (const [key, recipeGroup] of duplicates) {
    const [name] = key.split('|||');
    console.log(`\n📋 ${name.substring(0, 60)}${name.length > 60 ? '...' : ''}`);
    console.log(`   Duplicates: ${recipeGroup.length} copies\n`);

    totalDuplicateRecipes += recipeGroup.length - 1;

    // Calculate quality scores
    const withScores = recipeGroup.map(recipe => ({
      recipe,
      score: calculateQualityScore(recipe),
    })).sort((a, b) => b.score - a.score);

    // Show all copies with scores
    withScores.forEach((item, index) => {
      const { recipe, score } = item;
      const isKeep = index === 0;
      const icon = isKeep ? '✅ KEEP' : '❌ DELETE';

      if (!isKeep) {
        deleteIds.push(recipe.id);
      }

      console.log(`   ${icon} [Score: ${score}]`);
      console.log(`       ID: ${recipe.id}`);
      console.log(`       Created: ${recipe.created_at.toISOString().split('T')[0]}`);
      console.log(`       Image: ${recipe.image_url ? (recipe.image_url.includes('vercel') ? 'Vercel Blob' : 'External') : 'None'}`);
      console.log(`       Chef: ${recipe.chef_id ? 'Yes' : 'No'}`);
      console.log(`       Public: ${recipe.is_public ? 'Yes' : 'No'}`);
      console.log(`       Source: ${recipe.source || recipe.source_id ? 'Yes' : 'No'}`);

      if (!isKeep) {
        console.log(`       ⚠️  Will be deleted`);
      }
      console.log();
    });
  }

  console.log('='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total duplicate groups: ${duplicates.length}`);
  console.log(`   Total recipes to delete: ${totalDuplicateRecipes}`);
  console.log(`   Total recipes to keep: ${duplicates.length}`);
  console.log(`   Space saved: ${totalDuplicateRecipes} recipes\n`);

  // Save delete IDs to file
  if (deleteIds.length > 0) {
    const fs = require('fs');
    fs.writeFileSync('/tmp/duplicate-recipe-ids.json', JSON.stringify(deleteIds, null, 2));
    console.log(`✅ Saved ${deleteIds.length} duplicate IDs to /tmp/duplicate-recipe-ids.json`);
    console.log(`\nTo delete these duplicates, run: npx tsx scripts/delete-duplicate-recipes.ts`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
