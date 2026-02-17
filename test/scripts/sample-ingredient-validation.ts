import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

/**
 * Sample validation to identify potential ingredient-instruction mismatches
 * This demonstrates the QA approach without using LLM
 */

interface IngredientMismatch {
  recipeId: string;
  recipeName: string;
  ingredientsList: string[];
  instructions: string[];
  potentialIssues: string[];
}

async function sampleIngredientValidation() {
  console.log('🔍 SAMPLE INGREDIENT-INSTRUCTION VALIDATION\n');
  console.log('Testing 20 recipes for potential mismatches...\n');

  // Get sample recipes
  const sampleRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ingredients: recipes.ingredients,
      instructions: recipes.instructions,
    })
    .from(recipes)
    .where(
      sql`${recipes.ingredients} IS NOT NULL AND ${recipes.ingredients} != '' AND ${recipes.ingredients} != '[]' AND ${recipes.instructions} IS NOT NULL AND ${recipes.instructions} != '' AND ${recipes.instructions} != '[]'`
    )
    .limit(20);

  const mismatches: IngredientMismatch[] = [];

  for (const recipe of sampleRecipes) {
    try {
      const ingredientsList: string[] = JSON.parse(recipe.ingredients);
      const instructionsList: string[] = JSON.parse(recipe.instructions);

      if (!Array.isArray(ingredientsList) || !Array.isArray(instructionsList)) {
        continue;
      }

      const issues: string[] = [];

      // Combine all instruction text
      const instructionsText = instructionsList.join(' ').toLowerCase();

      // Extract ingredient names (simplified - just take the last word as the ingredient)
      const _ingredientNames = ingredientsList.map((ing) => {
        // Simple extraction: get the main ingredient word
        const cleaned = ing.toLowerCase().replace(/[,()]/g, '');
        const words = cleaned.split(/\s+/);
        // Return last 2-3 words as potential ingredient name
        return words.slice(-3).join(' ');
      });

      // Check for common cooking ingredients mentioned in instructions but not in list
      const commonIngredients = [
        'salt',
        'pepper',
        'water',
        'oil',
        'butter',
        'flour',
        'sugar',
        'egg',
        'eggs',
        'milk',
        'cream',
        'garlic',
        'onion',
        'cheese',
      ];

      for (const commonIng of commonIngredients) {
        // Check if mentioned in instructions
        const mentionedInInstructions =
          instructionsText.includes(` ${commonIng} `) ||
          instructionsText.includes(` ${commonIng},`) ||
          instructionsText.includes(` ${commonIng}.`);

        if (mentionedInInstructions) {
          // Check if in ingredient list
          const inIngredientList = ingredientsList.some((ing) =>
            ing.toLowerCase().includes(commonIng)
          );

          if (!inIngredientList) {
            issues.push(
              `"${commonIng}" mentioned in instructions but not found in ingredient list`
            );
          }
        }
      }

      // Check for very short ingredient lists with long instructions
      if (ingredientsList.length <= 3 && instructionsList.length >= 5) {
        issues.push(
          `Suspiciously short ingredient list (${ingredientsList.length} items) for complex instructions (${instructionsList.length} steps)`
        );
      }

      // Check for empty strings in lists
      if (ingredientsList.some((ing) => !ing.trim())) {
        issues.push('Empty ingredient entries found');
      }

      if (instructionsList.some((inst) => !inst.trim())) {
        issues.push('Empty instruction entries found');
      }

      if (issues.length > 0) {
        mismatches.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          ingredientsList,
          instructions: instructionsList,
          potentialIssues: issues,
        });
      }
    } catch (e) {
      console.error(`Error processing recipe ${recipe.name}:`, e);
    }
  }

  // Report findings
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 VALIDATION RESULTS\n`);
  console.log(`Recipes analyzed: ${sampleRecipes.length}`);
  console.log(`Recipes with potential issues: ${mismatches.length}\n`);

  if (mismatches.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  DETAILED FINDINGS\n');

    mismatches.forEach((mismatch, idx) => {
      console.log(`\n${idx + 1}. Recipe: ${mismatch.recipeName}`);
      console.log(`   ID: ${mismatch.recipeId}`);
      console.log(`   Ingredients (${mismatch.ingredientsList.length}):`);
      mismatch.ingredientsList.slice(0, 3).forEach((ing) => {
        console.log(`     - ${ing.substring(0, 80)}`);
      });
      if (mismatch.ingredientsList.length > 3) {
        console.log(`     ... and ${mismatch.ingredientsList.length - 3} more`);
      }
      console.log(`\n   Issues found:`);
      mismatch.potentialIssues.forEach((issue) => {
        console.log(`     ❌ ${issue}`);
      });
    });
  }

  console.log('\n✅ Sample validation complete!\n');
  console.log('💡 NOTE: This is a simplified rule-based check.');
  console.log('   A full LLM-based validation would be more accurate.\n');

  process.exit(0);
}

sampleIngredientValidation().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
