#!/usr/bin/env tsx
/**
 * Verify status of Lidia Bastianich's recipes
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

async function main() {
  console.log('\n🔍 Verifying Lidia Bastianich Recipe Status\n');
  console.log('═'.repeat(80));

  // Find Lidia
  const [lidia] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'lidia-bastianich'))
    .limit(1);

  if (!lidia) {
    console.error('❌ Lidia Bastianich not found');
    process.exit(1);
  }

  // Get all recipes
  const recipesResult = await db
    .select({
      recipe: recipes,
    })
    .from(chefRecipes)
    .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(eq(chefRecipes.chef_id, lidia.id));

  const allRecipes = recipesResult.map((r) => r.recipe);

  console.log(`\nTotal Recipes: ${allRecipes.length}\n`);
  console.log('═'.repeat(80));

  // Analyze each recipe
  const stats = {
    withImages: 0,
    withoutImages: 0,
    jsonInstructions: 0,
    numberedInstructions: 0,
    backupExists: 0,
    needsFormatting: 0,
  };

  allRecipes.forEach((recipe) => {
    // Check image status
    const hasImage = recipe.images && recipe.images !== '[]' && recipe.images !== '';
    if (hasImage) {
      stats.withImages++;
    } else {
      stats.withoutImages++;
    }

    // Check instruction status
    const instructions = recipe.instructions || '';
    const hasBackup = !!recipe.instructions_backup;

    if (hasBackup) {
      stats.backupExists++;
    }

    if (instructions.trim().startsWith('[') && instructions.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(instructions);
        if (Array.isArray(parsed)) {
          stats.jsonInstructions++;
        }
      } catch {
        // Not valid JSON
      }
    }

    const numberedSteps = instructions.match(/^\d+\./gm);
    if (numberedSteps && numberedSteps.length >= 3) {
      stats.numberedInstructions++;
    }

    // Detailed output for recipes
    const imageStatus = hasImage ? '✅ HAS IMAGE' : '❌ NO IMAGE';
    let instructionStatus = '❓ UNKNOWN';

    if (hasBackup) {
      instructionStatus = '✅ FORMATTED (backup)';
    } else if (instructions.trim().startsWith('[')) {
      instructionStatus = '✅ JSON ARRAY';
    } else if (numberedSteps && numberedSteps.length >= 3) {
      instructionStatus = '✅ NUMBERED';
    } else {
      instructionStatus = '❌ NEEDS FORMATTING';
      stats.needsFormatting++;
    }

    console.log(`\n${recipe.name}`);
    console.log(`   Image:        ${imageStatus}`);
    console.log(`   Instructions: ${instructionStatus}`);
    console.log(`   Length:       ${instructions.length} chars`);
  });

  console.log('\n═'.repeat(80));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total Recipes:              ${allRecipes.length}`);
  console.log(`\nImages:`);
  console.log(`  ✅ With Images:           ${stats.withImages}`);
  console.log(`  ❌ Without Images:        ${stats.withoutImages}`);
  console.log(`\nInstructions:`);
  console.log(`  ✅ JSON Array Format:     ${stats.jsonInstructions}`);
  console.log(`  ✅ Numbered Steps:        ${stats.numberedInstructions}`);
  console.log(`  ✅ With Backup:           ${stats.backupExists}`);
  console.log(`  ❌ Needs Formatting:      ${stats.needsFormatting}`);
  console.log('═'.repeat(80));

  if (stats.withImages === allRecipes.length && stats.needsFormatting === 0) {
    console.log('\n🎉 ALL RECIPES ARE FULLY IMPROVED! ✅');
  } else {
    console.log('\n⚠️  Some recipes still need work:');
    if (stats.withoutImages > 0) {
      console.log(`   - ${stats.withoutImages} recipes need images`);
    }
    if (stats.needsFormatting > 0) {
      console.log(`   - ${stats.needsFormatting} recipes need instruction formatting`);
    }
  }

  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
