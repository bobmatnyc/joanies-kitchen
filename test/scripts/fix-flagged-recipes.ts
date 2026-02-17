#!/usr/bin/env tsx

import { db } from '@/lib/db/index.js';
import { recipes } from '@/lib/db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface DetailedRecipe {
  id: string;
  name: string;
  category: 'A' | 'B' | 'C' | 'D';
  confidence: string;
  recommendedAction: string;
  source: string;
  extractedIngredients: string[];
  ingredientsCount: number;
  instructionsPreview: string;
  isTutorial: boolean;
}

interface AnalysisData {
  summary: {
    totalRecipes: number;
    byCategory: Record<string, number>;
    byAction: Record<string, number>;
    averageConfidence: string;
  };
  totalRecipes: number;
  categories: {
    categoryA_easy: string[];
    categoryB_medium: string[];
    categoryC_tutorial: string[];
    categoryD_incomplete: string[];
  };
  quickWins: string[];
  manualReview: string[];
  detailedAnalysis: DetailedRecipe[];
}

// Hardcoded ingredient lists for Quick Wins (from manual review)
const QUICK_WIN_INGREDIENTS: Record<string, string[]> = {
  // Parsnip Soup with Collard Greens (163f25de-7d7d-4525-9785-77162b2b7ea3)
  '163f25de-7d7d-4525-9785-77162b2b7ea3': [
    'parsnips',
    'onion',
    'vegetable stock',
    'collard greens',
    'butter',
    'whole milk',
    'parmesan rind',
    'water',
    'bay leaves',
    'peppercorns'
  ],

  // Pickled Vegetables (b7d25ff5-98eb-44a7-8824-04b16e1ba471)
  'b7d25ff5-98eb-44a7-8824-04b16e1ba471': [
    'baby carrots',
    'courgettes',
    'radishes',
    'mangetout',
    'white wine vinegar',
    'caster sugar',
    'vanilla pods',
    'salt',
    'bay leaves'
  ],

  // Yoghurt Panna Cotta with Grapefruit Jelly (dc3a2745-b1fe-439d-b2fc-f22ff3e80e5b)
  'dc3a2745-b1fe-439d-b2fc-f22ff3e80e5b': [
    'leaf gelatine',
    'double cream',
    'caster sugar',
    'vanilla pod',
    'natural yoghurt',
    'pink grapefruit',
    'icing sugar',
    'grenadine',
    'pink peppercorns',
    'water',
    'whole milk',
    'amaro'
  ]
};

async function fixFlaggedRecipes() {
  console.log('🔧 Fixing Flagged Recipes\n');

  // Load analysis
  const analysisPath = path.join(process.cwd(), 'tmp', 'flagged-recipes-analysis.json');
  const analysis: AnalysisData = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

  const report = {
    timestamp: new Date().toISOString(),
    total_processed: 0,
    category_a_fixed: 0,
    category_c_removed: 0,
    category_d_hidden: 0,
    category_b_pending: 0,
    recipes_processed: [] as any[],
    errors: [] as any[],
  };

  // Process each category
  for (const recipe of analysis.detailedAnalysis) {
    console.log(`\nProcessing: ${recipe.name}`);
    console.log(`  ID: ${recipe.id}`);
    console.log(`  Category: ${recipe.category} | Confidence: ${recipe.confidence}`);

    try {
      if (recipe.category === 'A') {
        // Fix Quick Wins - add ingredients
        const ingredients = QUICK_WIN_INGREDIENTS[recipe.id];

        if (!ingredients) {
          console.log(`  ⚠️  WARNING: No manual ingredient list for Quick Win recipe: ${recipe.name}`);
          report.errors.push({
            id: recipe.id,
            name: recipe.name,
            error: 'No manual ingredient list available'
          });
          continue;
        }

        await db.update(recipes)
          .set({
            ingredients: JSON.stringify(ingredients),
            qa_status: 'validated',
            qa_method: 'manual-derivation',
            qa_timestamp: new Date(),
            qa_confidence: recipe.confidence,
            qa_notes: 'Ingredients derived from instructions - manually reviewed and validated',
            qa_fixes_applied: JSON.stringify(['added_ingredients']),
          })
          .where(eq(recipes.id, recipe.id));

        console.log(`  ✅ Fixed: Added ${ingredients.length} ingredients`);
        report.category_a_fixed++;
        report.recipes_processed.push({
          id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          action_taken: 'derive_ingredients',
          ingredients_added: ingredients.length,
          confidence: recipe.confidence
        });

      } else if (recipe.category === 'C') {
        // Remove tutorials - mark as removed (not food recipes)
        await db.update(recipes)
          .set({
            qa_status: 'removed',
            qa_timestamp: new Date(),
            qa_method: 'automated-rules',
            qa_notes: 'Not a cooking recipe - tutorial/DIY content (fabric dye, cleaning powder, mouthwash)',
            qa_fixes_applied: JSON.stringify(['marked_as_non_recipe']),
          })
          .where(eq(recipes.id, recipe.id));

        console.log(`  🚫 Removed: Not a food recipe (${recipe.isTutorial ? 'tutorial' : 'non-cooking content'})`);
        report.category_c_removed++;
        report.recipes_processed.push({
          id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          action_taken: 'mark_as_removed',
          reason: 'non_food_content'
        });

      } else if (recipe.category === 'D') {
        // Hide incomplete recipes - insufficient ingredient data
        await db.update(recipes)
          .set({
            qa_status: 'needs_review',
            qa_timestamp: new Date(),
            qa_method: 'automated-rules',
            qa_notes: 'Insufficient ingredient data - hidden from search until manual review',
            qa_fixes_applied: JSON.stringify(['hidden_from_search']),
          })
          .where(eq(recipes.id, recipe.id));

        console.log(`  ⚠️  Hidden: Insufficient data (${recipe.ingredientsCount} ingredients extracted)`);
        report.category_d_hidden++;
        report.recipes_processed.push({
          id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          action_taken: 'hide_from_search',
          reason: 'insufficient_data',
          ingredients_found: recipe.ingredientsCount
        });

      } else if (recipe.category === 'B') {
        // Category B - Medium complexity, requires manual review
        console.log(`  📋 Pending: Requires manual review (${recipe.ingredientsCount} ingredients extracted)`);
        report.category_b_pending++;
        report.recipes_processed.push({
          id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          action_taken: 'pending_manual_review',
          ingredients_found: recipe.ingredientsCount,
          confidence: recipe.confidence
        });
      }

      report.total_processed++;

    } catch (error) {
      console.error(`  ❌ Error processing recipe: ${error}`);
      report.errors.push({
        id: recipe.id,
        name: recipe.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Save report
  const reportPath = path.join(process.cwd(), 'tmp', 'fix-flagged-recipes-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FLAGGED RECIPES FIX SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total Processed:           ${report.total_processed}`);
  console.log(`  ✅ Fixed (Category A):    ${report.category_a_fixed} recipes`);
  console.log(`  🚫 Removed (Category C):  ${report.category_c_removed} recipes`);
  console.log(`  ⚠️  Hidden (Category D):   ${report.category_d_hidden} recipes`);
  console.log(`  📋 Pending Manual (B):    ${report.category_b_pending} recipes`);
  console.log(`  ❌ Errors:                ${report.errors.length}`);
  console.log('═'.repeat(60));

  if (report.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    report.errors.forEach(err => {
      console.log(`  - ${err.name}: ${err.error}`);
    });
  }

  console.log(`\n✅ Report saved to: ${reportPath}`);

  // Print next steps
  console.log('\n📋 NEXT STEPS:');
  console.log('─'.repeat(60));
  console.log(`1. Review the ${report.category_b_pending} Category B recipes manually`);
  console.log('2. Extract ingredients from source URLs for medium-confidence recipes');
  console.log('3. Update database with manual ingredient lists');
  console.log('4. Run QA verification to confirm fixes');
  console.log('─'.repeat(60));

  return report;
}

fixFlaggedRecipes()
  .then(() => {
    console.log('\n✅ Flagged recipes processing complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
