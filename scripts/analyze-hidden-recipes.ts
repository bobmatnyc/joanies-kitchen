import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { eq, or, isNull } from 'drizzle-orm';
import * as fs from 'fs';

/**
 * Analyze all 214 hidden recipes (missing instructions)
 * Categorize into A/B/C/D for processing
 */

interface RecipeAnalysis {
  id: string;
  name: string;
  source: string | null;
  ingredients: string;
  instructions: string | null;
  ingredientCount: number;
  instructionCount: number;
  hasIngredients: boolean;
  hasInstructions: boolean;
  category: 'A' | 'B' | 'C' | 'D';
  confidence: number;
  recommendedAction: string;
  reasoning: string;
}

async function analyzeHiddenRecipes() {
  console.log('🔍 Analyzing 214 Hidden Recipes (Missing Instructions)\n');
  console.log('='.repeat(70));

  // Fetch all recipes with qa_status = 'needs_review' (hidden from search)
  const hiddenRecipes = await db
    .select()
    .from(recipes)
    .where(eq(recipes.qa_status, 'needs_review'));

  console.log(`Found ${hiddenRecipes.length} hidden recipes\n`);

  const analyses: RecipeAnalysis[] = [];

  for (const recipe of hiddenRecipes) {
    const ingredientArray = recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
    const instructionArray = recipe.instructions ? JSON.parse(recipe.instructions) : [];

    // Categorization logic
    let category: 'A' | 'B' | 'C' | 'D' = 'D';
    let confidence = 0.0;
    let recommendedAction = '';
    let reasoning = '';

    const hasIngredients = Array.isArray(ingredientArray) && ingredientArray.length > 0;
    const hasInstructions = Array.isArray(instructionArray) && instructionArray.length > 0;
    const ingredientCount = hasIngredients ? ingredientArray.length : 0;
    const instructionCount = hasInstructions ? instructionArray.length : 0;

    // Check for tutorial/non-recipe patterns
    const isTutorial =
      recipe.name?.toLowerCase().includes('how to') ||
      recipe.name?.toLowerCase().includes('diy') ||
      recipe.name?.toLowerCase().includes('guide to') ||
      recipe.source?.includes('tutorial') ||
      false;

    if (isTutorial) {
      // Category C - Tutorial/Non-Recipe
      category = 'C';
      confidence = 0.0;
      recommendedAction = 'Remove from database';
      reasoning = 'Tutorial/DIY content, not a food recipe';
    } else if (hasIngredients && !hasInstructions) {
      // Has ingredients but no instructions - might be salvageable
      if (ingredientCount >= 5) {
        // Category B - Manual review (enough ingredients to work with)
        category = 'B';
        confidence = 0.5;
        recommendedAction = 'Visit source URL and extract instructions';
        reasoning = `Has ${ingredientCount} ingredients but missing instructions - may be recoverable`;
      } else {
        // Category D - Incomplete (not enough data)
        category = 'D';
        confidence = 0.1;
        recommendedAction = 'Remove or hide permanently';
        reasoning = `Only ${ingredientCount} ingredients, no instructions - insufficient data`;
      }
    } else if (!hasIngredients && !hasInstructions) {
      // No ingredients, no instructions
      category = 'D';
      confidence = 0.0;
      recommendedAction = 'Remove from database';
      reasoning = 'No ingredients or instructions - completely empty';
    } else if (hasIngredients && hasInstructions) {
      // Both present - shouldn't be hidden (data quality issue)
      category = 'A';
      confidence = 0.9;
      recommendedAction = 'Unhide and validate';
      reasoning = 'Has both ingredients and instructions - should not be hidden';
    } else {
      // Edge cases
      category = 'D';
      confidence = 0.1;
      recommendedAction = 'Review manually';
      reasoning = 'Unexpected state - requires manual review';
    }

    analyses.push({
      id: recipe.id,
      name: recipe.name,
      source: recipe.source,
      ingredients: recipe.ingredients || '[]',
      instructions: recipe.instructions || '',
      ingredientCount,
      instructionCount,
      hasIngredients,
      hasInstructions,
      category,
      confidence,
      recommendedAction,
      reasoning,
    });
  }

  // Group by category
  const byCategory = {
    A: analyses.filter((a) => a.category === 'A'),
    B: analyses.filter((a) => a.category === 'B'),
    C: analyses.filter((a) => a.category === 'C'),
    D: analyses.filter((a) => a.category === 'D'),
  };

  // Display summary
  console.log('📊 CATEGORIZATION SUMMARY\n');
  console.log(`Category A (Quick Wins/Unhide): ${byCategory.A.length}`);
  console.log(`Category B (Manual Review): ${byCategory.B.length}`);
  console.log(`Category C (Tutorials/Non-Recipes): ${byCategory.C.length}`);
  console.log(`Category D (Incomplete/Remove): ${byCategory.D.length}`);
  console.log();

  // Display sample from each category
  console.log('='.repeat(70));
  console.log('📋 CATEGORY BREAKDOWN\n');

  for (const [cat, items] of Object.entries(byCategory)) {
    if (items.length > 0) {
      console.log(`\n### CATEGORY ${cat} (${items.length} recipes)`);
      console.log(`Action: ${items[0].recommendedAction}\n`);

      // Show first 5 examples
      const samples = items.slice(0, 5);
      samples.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.name}`);
        console.log(`   Ingredients: ${item.ingredientCount}, Instructions: ${item.instructionCount}`);
        console.log(`   Reasoning: ${item.reasoning}`);
        console.log(`   Confidence: ${item.confidence}`);
        if (items.length > 5 && idx === 4) {
          console.log(`   ... and ${items.length - 5} more`);
        }
      });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📈 RECOMMENDED ACTIONS\n');
  console.log(`✅ Category A: Unhide ${byCategory.A.length} recipes (have both ingredients & instructions)`);
  console.log(`📋 Category B: Extract instructions for ${byCategory.B.length} recipes (manual source review)`);
  console.log(`🚫 Category C: Remove ${byCategory.C.length} non-recipe tutorials`);
  console.log(`⚠️  Category D: Remove ${byCategory.D.length} incomplete recipes`);

  // Save analysis
  const report = {
    timestamp: new Date().toISOString(),
    totalAnalyzed: hiddenRecipes.length,
    categoryCounts: {
      A: byCategory.A.length,
      B: byCategory.B.length,
      C: byCategory.C.length,
      D: byCategory.D.length,
    },
    recipes: analyses,
    byCategory: {
      categoryA: byCategory.A.map(a => ({ id: a.id, name: a.name, ingredientCount: a.ingredientCount, instructionCount: a.instructionCount })),
      categoryB: byCategory.B.map(a => ({ id: a.id, name: a.name, ingredientCount: a.ingredientCount, source: a.source })),
      categoryC: byCategory.C.map(a => ({ id: a.id, name: a.name, reasoning: a.reasoning })),
      categoryD: byCategory.D.map(a => ({ id: a.id, name: a.name, reasoning: a.reasoning })),
    },
  };

  fs.writeFileSync('tmp/hidden-recipes-analysis.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Full analysis saved to: tmp/hidden-recipes-analysis.json');
}

analyzeHiddenRecipes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
