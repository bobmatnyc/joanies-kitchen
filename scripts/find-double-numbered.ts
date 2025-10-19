#!/usr/bin/env tsx
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { isNotNull } from 'drizzle-orm';

async function findDoubleNumbered() {
  console.log('Searching for recipes with double numbering...\n');

  // Get recipes with chef_id (chef recipes)
  const chefRecipes = await db.select().from(recipes)
    .where(isNotNull(recipes.chef_id))
    .limit(50);

  console.log(`Found ${chefRecipes.length} chef recipes to check\n`);

  let foundCount = 0;

  for (const recipe of chefRecipes) {
    try {
      const instructions = JSON.parse(recipe.instructions);

      // Check for different double numbering patterns
      for (let i = 0; i < instructions.length; i++) {
        const inst = instructions[i];

        // Pattern 1: "1.\n1. Text"
        if (/^\d+\.\s*\n\s*\d+\.\s+/.test(inst)) {
          foundCount++;
          console.log(`\n✓ Found Pattern 1 in: ${recipe.name}`);
          console.log(`  ID: ${recipe.id}`);
          console.log(`  Step ${i + 1}:`, JSON.stringify(inst.substring(0, 100)));
          break;
        }

        // Pattern 2: "1. \n1. Text" (with space after first number)
        if (/^\d+\.\s+\n\s*\d+\.\s+/.test(inst)) {
          foundCount++;
          console.log(`\n✓ Found Pattern 2 in: ${recipe.name}`);
          console.log(`  ID: ${recipe.id}`);
          console.log(`  Step ${i + 1}:`, JSON.stringify(inst.substring(0, 100)));
          break;
        }
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }

  console.log(`\n\nTotal recipes with double numbering: ${foundCount}\n`);

  // Also check Nancy Silverton recipes specifically
  console.log('Checking Nancy Silverton recipes specifically...\n');
  const nancyRecipes = await db.select().from(recipes)
    .where(isNotNull(recipes.chef_id))
    .limit(200); // Get more to find Nancy's

  for (const recipe of nancyRecipes) {
    if (recipe.source?.includes('Nancy') || recipe.name.includes('Nancy')) {
      console.log(`Found Nancy recipe: ${recipe.name}`);
      try {
        const instructions = JSON.parse(recipe.instructions);
        console.log('First instruction:', JSON.stringify(instructions[0]?.substring(0, 150)));
      } catch (e) {
        console.log('  (Invalid JSON)');
      }
    }
  }
}

findDoubleNumbered().then(() => process.exit(0)).catch(console.error);
