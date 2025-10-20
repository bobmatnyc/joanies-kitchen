/**
 * Week 3: Content Curation - Recipe Audit and Enrichment
 *
 * This script:
 * 1. Analyzes all 4,643 recipes for resourcefulness characteristics
 * 2. Calculates resourcefulness_score (1-5 scale) based on:
 *    - Ingredient complexity and availability
 *    - Substitution potential
 *    - Waste reduction characteristics
 * 3. Adds waste_reduction_tags to recipes
 * 4. Generates scrap_utilization_notes and environmental_notes
 *
 * Run with: npx tsx scripts/week3-content-curation.ts --execute
 */

import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

// Waste reduction tag types from ROADMAP.md
type WasteReductionTag =
  | 'waste_reduction'     // Uses aging ingredients, scraps, leftovers
  | 'flexible'            // Accepts substitutions easily
  | 'one_pot'            // Minimal cleanup
  | 'seasonal'           // Uses seasonal produce
  | 'resourceful'        // Embodies Joanie's approach
  | 'scrap_utilization'; // Explicitly uses scraps/peels/stems

interface ResourcefulnessAnalysis {
  score: number;
  tags: WasteReductionTag[];
  scrapNotes: string | null;
  environmentalNotes: string | null;
}

// Common pantry staples - recipes using mostly these score higher
const COMMON_STAPLES = [
  'salt', 'pepper', 'oil', 'olive oil', 'vegetable oil', 'butter',
  'flour', 'sugar', 'eggs', 'milk', 'onion', 'garlic',
  'rice', 'pasta', 'bread', 'tomato', 'potato', 'carrot',
  'chicken', 'beef', 'pork', 'fish', 'beans', 'lentils',
  'cheese', 'yogurt', 'soy sauce', 'vinegar', 'lemon',
  'herbs', 'spices', 'broth', 'stock'
];

// Keywords indicating flexibility/substitution tolerance
const FLEXIBLE_KEYWORDS = [
  'or', 'substitute', 'alternative', 'optional', 'any',
  'whatever you have', 'leftovers', 'scraps', 'your choice'
];

// Keywords indicating waste reduction
const WASTE_KEYWORDS = [
  'wilting', 'leftover', 'scrap', 'peel', 'stem', 'top',
  'aging', 'old', 'excess', 'extra', 'compost', 'save',
  'bones', 'carcass', 'ends', 'trimmings'
];

// One-pot indicators
const ONE_POT_KEYWORDS = [
  'one pot', 'one-pot', 'single pot', 'sheet pan',
  'one pan', 'one-pan', 'slow cooker', 'instant pot',
  'dutch oven', 'casserole', 'skillet'
];

// Seasonal indicators
const SEASONAL_KEYWORDS = [
  'seasonal', 'fresh', 'local', 'farm', 'garden',
  'summer', 'winter', 'spring', 'fall', 'autumn',
  'harvest', 'farmers market'
];

/**
 * Parse ingredients from JSON string
 */
function parseIngredients(ingredientsJson: string | null): string[] {
  if (!ingredientsJson) return [];
  try {
    const parsed = JSON.parse(ingredientsJson);
    if (Array.isArray(parsed)) {
      return parsed.map(i => typeof i === 'string' ? i : i.ingredient || '');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Check if ingredient is a common staple
 */
function isCommonStaple(ingredient: string): boolean {
  const lower = ingredient.toLowerCase();
  return COMMON_STAPLES.some(staple => lower.includes(staple));
}

/**
 * Check if text contains flexibility indicators
 */
function hasFlexibilityIndicators(text: string): boolean {
  const lower = text.toLowerCase();
  return FLEXIBLE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check if text contains waste-reduction indicators
 */
function hasWasteReductionIndicators(text: string): boolean {
  const lower = text.toLowerCase();
  return WASTE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check if recipe is one-pot
 */
function isOnePot(instructions: string, name: string): boolean {
  const combined = `${name} ${instructions}`.toLowerCase();
  return ONE_POT_KEYWORDS.some(keyword => combined.includes(keyword));
}

/**
 * Check if recipe emphasizes seasonal ingredients
 */
function isSeasonal(description: string, name: string): boolean {
  const combined = `${name} ${description}`.toLowerCase();
  return SEASONAL_KEYWORDS.some(keyword => combined.includes(keyword));
}

/**
 * Extract scrap utilization notes from instructions/description
 */
function extractScrapNotes(instructions: string, description: string): string | null {
  const combined = `${instructions} ${description}`.toLowerCase();

  const scrapPhrases: string[] = [];

  if (combined.includes('save') && (combined.includes('bones') || combined.includes('carcass'))) {
    scrapPhrases.push('Save bones/carcass for stock');
  }
  if (combined.includes('peel') || combined.includes('peels')) {
    if (combined.includes('save') || combined.includes('use')) {
      scrapPhrases.push('Vegetable peels can be used for stock or composted');
    }
  }
  if (combined.includes('stem') || combined.includes('tops')) {
    if (combined.includes('herb') || combined.includes('carrot') || combined.includes('beet')) {
      scrapPhrases.push('Herb stems and vegetable tops are edible and flavorful');
    }
  }
  if (combined.includes('leftover')) {
    scrapPhrases.push('Perfect way to use leftovers');
  }

  return scrapPhrases.length > 0 ? scrapPhrases.join('. ') + '.' : null;
}

/**
 * Generate environmental notes based on recipe characteristics
 */
function generateEnvironmentalNotes(
  tags: WasteReductionTag[],
  ingredientCount: number,
  stapleCount: number
): string | null {
  const notes: string[] = [];

  if (tags.includes('seasonal')) {
    notes.push('Seasonal ingredients reduce carbon footprint from transportation');
  }
  if (tags.includes('one_pot')) {
    notes.push('One-pot cooking reduces water and energy use');
  }
  if (tags.includes('waste_reduction') || tags.includes('scrap_utilization')) {
    notes.push('Minimizes food waste in preparation');
  }
  if (stapleCount / ingredientCount > 0.7) {
    notes.push('Uses common pantry staples, reducing need for specialty shopping trips');
  }

  return notes.length > 0 ? notes.join('. ') + '.' : null;
}

/**
 * Analyze recipe and calculate resourcefulness score
 *
 * Scoring criteria (from ROADMAP.md):
 * 5 stars: Common staples, many substitutions, forgiving, scrap use, one-pot
 * 4 stars: Mostly common, some substitutions, standard techniques
 * 3 stars: Mix common/specialty, moderate substitutions, standard complexity
 * 2 stars: Several specialty items, limited substitutions, specific techniques
 * 1 star: Expensive/rare ingredients, no substitutions, precision-dependent
 */
function analyzeRecipe(recipe: any): ResourcefulnessAnalysis {
  let score = 3; // Start at baseline
  const tags: WasteReductionTag[] = [];

  // Parse recipe data
  const ingredients = parseIngredients(recipe.ingredients);
  const ingredientCount = ingredients.length;
  const stapleCount = ingredients.filter(isCommonStaple).length;
  const stapleRatio = ingredientCount > 0 ? stapleCount / ingredientCount : 0;

  const fullText = `${recipe.name || ''} ${recipe.description || ''} ${recipe.instructions || ''}`;
  const hasFlexibility = hasFlexibilityIndicators(fullText);
  const hasWasteReduction = hasWasteReductionIndicators(fullText);
  const isOnePotRecipe = isOnePot(recipe.instructions || '', recipe.name || '');
  const isSeasonalRecipe = isSeasonal(recipe.description || '', recipe.name || '');

  // Calculate score based on characteristics

  // High ratio of common staples (+1 to +2)
  if (stapleRatio >= 0.8) {
    score += 2;
  } else if (stapleRatio >= 0.6) {
    score += 1;
  } else if (stapleRatio < 0.4) {
    score -= 1; // Many specialty ingredients
  }

  // Flexibility indicators (+1)
  if (hasFlexibility) {
    score += 1;
    tags.push('flexible');
  }

  // Waste reduction indicators (+1)
  if (hasWasteReduction) {
    score += 1;
    tags.push('waste_reduction');
    if (fullText.toLowerCase().includes('scrap') || fullText.toLowerCase().includes('peel')) {
      tags.push('scrap_utilization');
    }
  }

  // One-pot cooking (+1)
  if (isOnePotRecipe) {
    score += 1;
    tags.push('one_pot');
  }

  // Seasonal emphasis (+0.5)
  if (isSeasonalRecipe) {
    tags.push('seasonal');
  }

  // Difficulty adjustment
  if (recipe.difficulty === 'easy') {
    score += 0.5;
  } else if (recipe.difficulty === 'hard') {
    score -= 0.5;
  }

  // Many ingredients suggests complexity (-0.5 if >15 ingredients)
  if (ingredientCount > 15) {
    score -= 0.5;
  }

  // Clamp score to 1-5 range
  score = Math.max(1, Math.min(5, Math.round(score)));

  // Add overall "resourceful" tag for high scores
  if (score >= 4 && tags.length >= 2) {
    tags.push('resourceful');
  }

  // Generate notes
  const scrapNotes = hasWasteReduction ? extractScrapNotes(recipe.instructions || '', recipe.description || '') : null;
  const environmentalNotes = tags.length > 0 ? generateEnvironmentalNotes(tags, ingredientCount, stapleCount) : null;

  return {
    score,
    tags: [...new Set(tags)], // Remove duplicates
    scrapNotes,
    environmentalNotes
  };
}

/**
 * Main execution
 */
async function main() {
  const dryRun = !process.argv.includes('--execute');

  console.log('🌱 Week 3: Content Curation - Recipe Audit\n');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '✍️  EXECUTE (will update database)'}\n`);

  // Fetch all recipes
  console.log('📊 Fetching recipes...');
  const allRecipes = await db.select().from(recipes);
  console.log(`Found ${allRecipes.length} recipes\n`);

  // Analyze recipes
  console.log('🔬 Analyzing recipes...');
  const analyzed = allRecipes.map(recipe => ({
    id: recipe.id,
    name: recipe.name,
    analysis: analyzeRecipe(recipe)
  }));

  // Generate statistics
  const scoreDistribution = analyzed.reduce((acc, { analysis }) => {
    acc[analysis.score] = (acc[analysis.score] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const tagDistribution = analyzed.reduce((acc, { analysis }) => {
    analysis.tags.forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📈 Resourcefulness Score Distribution:');
  for (let i = 5; i >= 1; i--) {
    const count = scoreDistribution[i] || 0;
    const stars = '⭐'.repeat(i);
    const bar = '█'.repeat(Math.round(count / 50));
    console.log(`  ${stars} (${i}): ${count.toString().padStart(4)} ${bar}`);
  }

  console.log('\n🏷️  Waste-Reduction Tag Distribution:');
  Object.entries(tagDistribution)
    .sort(([, a], [, b]) => b - a)
    .forEach(([tag, count]) => {
      console.log(`  ${tag.padEnd(20)}: ${count.toString().padStart(4)}`);
    });

  const withScrapNotes = analyzed.filter(a => a.analysis.scrapNotes).length;
  const withEnvironmentalNotes = analyzed.filter(a => a.analysis.environmentalNotes).length;

  console.log(`\n📝 Generated Content:`);
  console.log(`  Scrap utilization notes: ${withScrapNotes.toString().padStart(4)}`);
  console.log(`  Environmental notes:     ${withEnvironmentalNotes.toString().padStart(4)}`);

  // Show sample high-scoring recipes
  const topRecipes = analyzed
    .filter(a => a.analysis.score >= 4)
    .slice(0, 10);

  console.log(`\n✨ Sample High-Scoring Recipes (Top 10 of ${analyzed.filter(a => a.analysis.score >= 4).length}):`);
  topRecipes.forEach(({ name, analysis }, i) => {
    const stars = '⭐'.repeat(analysis.score);
    const tags = analysis.tags.join(', ');
    console.log(`  ${(i + 1).toString().padStart(2)}. ${stars} ${name}`);
    console.log(`      Tags: ${tags}`);
  });

  if (dryRun) {
    console.log('\n🔍 DRY RUN complete - no database changes made');
    console.log('Run with --execute flag to apply changes to database');
    return;
  }

  // Execute database updates
  console.log('\n✍️  Updating database...');
  let updated = 0;
  let errors = 0;

  for (const { id, analysis } of analyzed) {
    try {
      await db
        .update(recipes)
        .set({
          resourcefulness_score: analysis.score,
          waste_reduction_tags: JSON.stringify(analysis.tags),
          scrap_utilization_notes: analysis.scrapNotes,
          environmental_notes: analysis.environmentalNotes,
        })
        .where(eq(recipes.id, id));

      updated++;

      if (updated % 100 === 0) {
        console.log(`  Updated ${updated}/${analyzed.length} recipes...`);
      }
    } catch (error) {
      errors++;
      console.error(`  Error updating recipe ${id}:`, error);
    }
  }

  console.log(`\n✅ Update complete!`);
  console.log(`   Successfully updated: ${updated}`);
  console.log(`   Errors: ${errors}`);

  // Show final distribution of scores >= 4 (for homepage)
  const homepageReady = analyzed.filter(a => a.analysis.score >= 4).length;
  console.log(`\n🏠 Homepage-ready recipes (score >= 4): ${homepageReady}`);
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}
