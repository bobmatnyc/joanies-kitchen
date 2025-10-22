/**
 * Ingredient Database Quality Analysis Script
 *
 * Performs comprehensive semantic quality analysis of the consolidated ingredient database.
 * Evaluates:
 * - Category distribution and coherence
 * - Naming conventions and consistency
 * - Semantic accuracy
 * - Image generation readiness
 * - Data quality issues
 */

import { eq, sql, desc, isNull, and, or } from 'drizzle-orm';
import { db, cleanup } from './db-with-transactions';
import { ingredients, recipeIngredients, INGREDIENT_CATEGORIES } from '../src/lib/db/ingredients-schema';

// ============================================================================
// ANALYSIS CONFIGURATION
// ============================================================================

const SAMPLE_SIZE = 50; // Number of random ingredients to validate semantically
const MIN_CATEGORY_SIZE = 10; // Flag categories with fewer items
const MAX_CATEGORY_SIZE = 500; // Flag categories with more items

// Known problematic patterns
const PROBLEMATIC_PATTERNS = {
  brandNames: /^(mccormick|kraft|heinz|nestle|kellogg|pillsbury|reynolds|glad|ziploc|pam)/i,
  numbers: /\d+/,
  specialChars: /[^a-z0-9\s\-'(),./]/i,
  multiItem: /(and|or|mix|blend|combination)/i,
  vague: /^(spice|seasoning|vegetable|herb|sauce|powder|liquid|ingredient)s?$/i,
  cookware: /(pan|pot|bowl|plate|dish|cup|spoon|knife|fork|tool|utensil)/i,
};

// Ingredients that should NOT have images generated (abstract/generic)
const UNSUITABLE_FOR_IMAGES = [
  'spice',
  'seasoning',
  'vegetable',
  'herb',
  'sauce',
  'powder',
  'liquid',
  'oil',
  'fat',
  'ingredient',
  'to taste',
  'as needed',
  'optional',
];

// ============================================================================
// TYPES
// ============================================================================

interface CategoryStats {
  category: string | null;
  count: number;
  sampleIngredients: string[];
}

interface NamingIssue {
  type: string;
  count: number;
  examples: Array<{
    id: string;
    name: string;
    display_name: string;
    issue: string;
  }>;
}

interface SemanticIssue {
  type: string;
  count: number;
  examples: Array<{
    id: string;
    name: string;
    category: string | null;
    reason: string;
  }>;
}

interface ImageStats {
  totalIngredients: number;
  hasImages: number;
  missingImages: number;
  unsuitable: number;
  multiItem: number;
  readyForGeneration: number;
}

interface QualityIssue {
  type: string;
  count: number;
  examples: Array<{
    id: string;
    name: string;
    issue: string;
  }>;
}

interface AnalysisReport {
  totalIngredients: number;
  categoryDistribution: CategoryStats[];
  namingIssues: NamingIssue[];
  semanticIssues: SemanticIssue[];
  imageStats: ImageStats;
  qualityIssues: QualityIssue[];
  recommendation: 'PROCEED' | 'FIX_ISSUES_FIRST';
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Get total ingredient count
 */
async function getTotalCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(ingredients);
  return result[0]?.count || 0;
}

/**
 * Analyze category distribution
 */
async function analyzeCategoryDistribution(): Promise<CategoryStats[]> {
  console.log('📊 Analyzing category distribution...');

  const categoryGroups = await db
    .select({
      category: ingredients.category,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(ingredients)
    .groupBy(ingredients.category)
    .orderBy(desc(sql`COUNT(*)`));

  const stats: CategoryStats[] = [];

  for (const group of categoryGroups) {
    // Get sample ingredients for this category
    const samples = await db
      .select({ name: ingredients.name })
      .from(ingredients)
      .where(
        group.category
          ? eq(ingredients.category, group.category)
          : isNull(ingredients.category)
      )
      .limit(5);

    stats.push({
      category: group.category,
      count: group.count,
      sampleIngredients: samples.map(s => s.name),
    });
  }

  return stats;
}

/**
 * Check for naming convention issues
 */
async function analyzeNamingConventions(): Promise<NamingIssue[]> {
  console.log('✍️  Analyzing naming conventions...');

  const issues: NamingIssue[] = [];

  // Get all ingredients for pattern analysis
  const allIngredients = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      display_name: ingredients.display_name,
    })
    .from(ingredients);

  // Check for inconsistent capitalization
  const capitalizationIssues = allIngredients.filter(ing => {
    const expectedDisplay = ing.name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return ing.display_name !== expectedDisplay &&
           ing.display_name.toLowerCase() !== ing.name;
  });

  if (capitalizationIssues.length > 0) {
    issues.push({
      type: 'Inconsistent Capitalization',
      count: capitalizationIssues.length,
      examples: capitalizationIssues.slice(0, 5).map(ing => ({
        id: ing.id,
        name: ing.name,
        display_name: ing.display_name,
        issue: `Expected: ${ing.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
      })),
    });
  }

  // Check for brand names
  const brandNameIssues = allIngredients.filter(ing =>
    PROBLEMATIC_PATTERNS.brandNames.test(ing.name)
  );

  if (brandNameIssues.length > 0) {
    issues.push({
      type: 'Brand Names',
      count: brandNameIssues.length,
      examples: brandNameIssues.slice(0, 5).map(ing => ({
        id: ing.id,
        name: ing.name,
        display_name: ing.display_name,
        issue: 'Contains brand name - should be generic',
      })),
    });
  }

  // Check for numbers
  const numberIssues = allIngredients.filter(ing =>
    PROBLEMATIC_PATTERNS.numbers.test(ing.name)
  );

  if (numberIssues.length > 0) {
    issues.push({
      type: 'Contains Numbers',
      count: numberIssues.length,
      examples: numberIssues.slice(0, 5).map(ing => ({
        id: ing.id,
        name: ing.name,
        display_name: ing.display_name,
        issue: 'Ingredient name contains numbers',
      })),
    });
  }

  // Check for vague/generic names
  const vagueIssues = allIngredients.filter(ing =>
    PROBLEMATIC_PATTERNS.vague.test(ing.name)
  );

  if (vagueIssues.length > 0) {
    issues.push({
      type: 'Vague/Generic Names',
      count: vagueIssues.length,
      examples: vagueIssues.slice(0, 5).map(ing => ({
        id: ing.id,
        name: ing.name,
        display_name: ing.display_name,
        issue: 'Name is too generic/vague',
      })),
    });
  }

  return issues;
}

/**
 * Check semantic coherence with category sampling
 */
async function analyzeSemanticCoherence(): Promise<SemanticIssue[]> {
  console.log('🔍 Analyzing semantic coherence...');

  const issues: SemanticIssue[] = [];

  // Get random sample for manual validation
  const randomSample = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      category: ingredients.category,
    })
    .from(ingredients)
    .orderBy(sql`RANDOM()`)
    .limit(SAMPLE_SIZE);

  // Check for miscategorized items
  const miscategorized = randomSample.filter(ing => {
    const name = ing.name.toLowerCase();
    const category = ing.category?.toLowerCase();

    // Check for cookware in food categories
    if (PROBLEMATIC_PATTERNS.cookware.test(name)) {
      return true;
    }

    // Check category coherence
    if (category === 'vegetables') {
      return !(name.includes('lettuce') || name.includes('tomato') ||
               name.includes('onion') || name.includes('pepper') ||
               name.includes('carrot') || name.includes('celery') ||
               name.includes('cabbage') || name.includes('broccoli') ||
               name.includes('spinach') || name.includes('kale') ||
               name.includes('cucumber') || name.includes('zucchini') ||
               name.includes('squash') || name.includes('bean') ||
               name.includes('pea') || name.includes('corn') ||
               name.includes('potato') || name.includes('mushroom') ||
               name.includes('eggplant') || name.includes('radish') ||
               name.includes('turnip') || name.includes('beet') ||
               name.includes('asparagus') || name.includes('artichoke') ||
               name.includes('avocado') || name.includes('green'));
    }

    if (category === 'fruits') {
      return !(name.includes('apple') || name.includes('banana') ||
               name.includes('orange') || name.includes('lemon') ||
               name.includes('lime') || name.includes('berry') ||
               name.includes('grape') || name.includes('melon') ||
               name.includes('peach') || name.includes('pear') ||
               name.includes('cherry') || name.includes('plum') ||
               name.includes('mango') || name.includes('pineapple') ||
               name.includes('kiwi') || name.includes('fig') ||
               name.includes('date') || name.includes('raisin') ||
               name.includes('coconut'));
    }

    return false;
  });

  if (miscategorized.length > 0) {
    issues.push({
      type: 'Potentially Miscategorized',
      count: miscategorized.length,
      examples: miscategorized.slice(0, 10).map(ing => ({
        id: ing.id,
        name: ing.name,
        category: ing.category,
        reason: PROBLEMATIC_PATTERNS.cookware.test(ing.name)
          ? 'Appears to be cookware, not food'
          : 'Category may not match ingredient type',
      })),
    });
  }

  // Check for duplicate meanings (same base ingredient, different forms)
  const potentialDuplicates = await findPotentialDuplicates();
  if (potentialDuplicates.length > 0) {
    issues.push({
      type: 'Potential Semantic Duplicates',
      count: potentialDuplicates.length,
      examples: potentialDuplicates.slice(0, 10),
    });
  }

  return issues;
}

/**
 * Find potential duplicate meanings
 */
async function findPotentialDuplicates(): Promise<Array<{
  id: string;
  name: string;
  category: string | null;
  reason: string;
}>> {
  const duplicates: Array<{
    id: string;
    name: string;
    category: string | null;
    reason: string;
  }> = [];

  // Common duplicate patterns
  const patterns = [
    { base: 'onion', variants: ['yellow onion', 'white onion', 'sweet onion'] },
    { base: 'tomato', variants: ['roma tomato', 'cherry tomato', 'grape tomato'] },
    { base: 'pepper', variants: ['bell pepper', 'sweet pepper'] },
  ];

  for (const pattern of patterns) {
    const found = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        category: ingredients.category,
      })
      .from(ingredients)
      .where(
        or(
          eq(ingredients.name, pattern.base),
          ...pattern.variants.map(v => eq(ingredients.name, v))
        )
      );

    if (found.length > 1) {
      duplicates.push({
        id: found[0].id,
        name: found.map(f => f.name).join(', '),
        category: found[0].category,
        reason: `Multiple forms of '${pattern.base}' exist`,
      });
    }
  }

  return duplicates;
}

/**
 * Analyze image generation readiness
 */
async function analyzeImageReadiness(): Promise<ImageStats> {
  console.log('🖼️  Analyzing image generation readiness...');

  const total = await getTotalCount();

  // Count ingredients with images
  const withImages = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(ingredients)
    .where(sql`${ingredients.image_url} IS NOT NULL AND ${ingredients.image_url} != ''`);

  const hasImages = withImages[0]?.count || 0;

  // Find unsuitable ingredients (too generic/abstract)
  const unsuitableResults = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
    })
    .from(ingredients)
    .where(
      or(
        ...UNSUITABLE_FOR_IMAGES.map(term =>
          sql`${ingredients.name} ILIKE ${`%${term}%`}`
        )
      )
    );

  const unsuitable = unsuitableResults.length;

  // Find multi-item ingredients
  const multiItemResults = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
    })
    .from(ingredients)
    .where(
      or(
        sql`${ingredients.name} ILIKE '%and%'`,
        sql`${ingredients.name} ILIKE '%or%'`,
        sql`${ingredients.name} ILIKE '%mix%'`,
        sql`${ingredients.name} ILIKE '%blend%'`
      )
    );

  const multiItem = multiItemResults.length;

  // Calculate ready for generation
  const readyForGeneration = total - hasImages - unsuitable - multiItem;

  return {
    totalIngredients: total,
    hasImages,
    missingImages: total - hasImages,
    unsuitable,
    multiItem,
    readyForGeneration: Math.max(0, readyForGeneration),
  };
}

/**
 * Check for data quality issues
 */
async function analyzeDataQuality(): Promise<QualityIssue[]> {
  console.log('🔬 Analyzing data quality...');

  const issues: QualityIssue[] = [];

  // Check for null/empty display names
  const nullDisplayNames = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      display_name: ingredients.display_name,
    })
    .from(ingredients)
    .where(
      or(
        isNull(ingredients.display_name),
        eq(ingredients.display_name, '')
      )
    );

  if (nullDisplayNames.length > 0) {
    issues.push({
      type: 'Null/Empty Display Names',
      count: nullDisplayNames.length,
      examples: nullDisplayNames.slice(0, 5).map(ing => ({
        id: ing.id,
        name: ing.name,
        issue: `display_name is ${ing.display_name === null ? 'null' : 'empty'}`,
      })),
    });
  }

  // Check for orphaned ingredients (0 usage, not common)
  const orphaned = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      usage_count: ingredients.usage_count,
    })
    .from(ingredients)
    .where(
      and(
        eq(ingredients.usage_count, 0),
        eq(ingredients.is_common, false)
      )
    );

  if (orphaned.length > 0) {
    issues.push({
      type: 'Orphaned Ingredients (0 usage)',
      count: orphaned.length,
      examples: orphaned.slice(0, 5).map(ing => ({
        id: ing.id,
        name: ing.name,
        issue: 'Not used in any recipes and not marked as common',
      })),
    });
  }

  // Check for malformed aliases
  const allIngredients = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      aliases: ingredients.aliases,
    })
    .from(ingredients)
    .where(sql`${ingredients.aliases} IS NOT NULL`);

  const malformedAliases = allIngredients.filter(ing => {
    try {
      if (ing.aliases) {
        const parsed = JSON.parse(ing.aliases);
        return !Array.isArray(parsed);
      }
      return false;
    } catch {
      return true;
    }
  });

  if (malformedAliases.length > 0) {
    issues.push({
      type: 'Malformed Aliases',
      count: malformedAliases.length,
      examples: malformedAliases.slice(0, 5).map(ing => ({
        id: ing.id,
        name: ing.name,
        issue: `aliases field is not valid JSON array: ${ing.aliases?.slice(0, 50)}...`,
      })),
    });
  }

  return issues;
}

/**
 * Generate final recommendation
 */
function generateRecommendation(report: AnalysisReport): 'PROCEED' | 'FIX_ISSUES_FIRST' {
  const criticalIssues = [
    ...report.qualityIssues.filter(i =>
      i.type === 'Null/Empty Display Names' || i.type === 'Malformed Aliases'
    ),
    ...report.semanticIssues.filter(i =>
      i.type === 'Potentially Miscategorized'
    ),
  ];

  const totalCritical = criticalIssues.reduce((sum, issue) => sum + issue.count, 0);

  // Allow up to 1% critical issues
  const criticalThreshold = report.totalIngredients * 0.01;

  return totalCritical <= criticalThreshold ? 'PROCEED' : 'FIX_ISSUES_FIRST';
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Format and print the analysis report
 */
function printReport(report: AnalysisReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('INGREDIENT DATABASE QUALITY REPORT');
  console.log('='.repeat(80));
  console.log(`\nTotal Ingredients: ${report.totalIngredients.toLocaleString()}`);

  // Category Distribution
  console.log('\n' + '-'.repeat(80));
  console.log('CATEGORY DISTRIBUTION:');
  console.log('-'.repeat(80));

  for (const cat of report.categoryDistribution) {
    const category = cat.category || '(null)';
    const flag = cat.count < MIN_CATEGORY_SIZE ? ' ⚠️  SMALL' :
                 cat.count > MAX_CATEGORY_SIZE ? ' ⚠️  LARGE' : '';
    console.log(`  ${category}: ${cat.count}${flag}`);
    if (cat.sampleIngredients.length > 0) {
      console.log(`    Examples: ${cat.sampleIngredients.join(', ')}`);
    }
  }

  // Naming Issues
  console.log('\n' + '-'.repeat(80));
  console.log('NAMING ISSUES:');
  console.log('-'.repeat(80));

  if (report.namingIssues.length === 0) {
    console.log('  ✅ No naming issues found');
  } else {
    for (const issue of report.namingIssues) {
      console.log(`  ${issue.type}: ${issue.count} items`);
      if (issue.examples.length > 0) {
        console.log('    Examples:');
        for (const ex of issue.examples) {
          console.log(`      - ${ex.name} (${ex.display_name}): ${ex.issue}`);
        }
      }
    }
  }

  // Semantic Coherence
  console.log('\n' + '-'.repeat(80));
  console.log('SEMANTIC COHERENCE:');
  console.log('-'.repeat(80));
  console.log(`  Sample size: ${SAMPLE_SIZE} random ingredients\n`);

  if (report.semanticIssues.length === 0) {
    console.log('  ✅ No semantic issues found in sample');
  } else {
    for (const issue of report.semanticIssues) {
      console.log(`  ${issue.type}: ${issue.count} items`);
      if (issue.examples.length > 0) {
        console.log('    Examples:');
        for (const ex of issue.examples) {
          console.log(`      - ${ex.name} [${ex.category || 'null'}]: ${ex.reason}`);
        }
      }
    }
  }

  // Image Generation Readiness
  console.log('\n' + '-'.repeat(80));
  console.log('IMAGE GENERATION READINESS:');
  console.log('-'.repeat(80));
  console.log(`  Total ingredients: ${report.imageStats.totalIngredients.toLocaleString()}`);
  console.log(`  Already has images: ${report.imageStats.hasImages.toLocaleString()}`);
  console.log(`  Missing images: ${report.imageStats.missingImages.toLocaleString()}`);
  console.log(`  Unsuitable for generation: ${report.imageStats.unsuitable.toLocaleString()} (abstract/generic)`);
  console.log(`  Multi-item ingredients: ${report.imageStats.multiItem.toLocaleString()}`);
  console.log(`  Ready for generation: ${report.imageStats.readyForGeneration.toLocaleString()}`);

  const readyPercentage = (report.imageStats.readyForGeneration / report.imageStats.totalIngredients * 100).toFixed(1);
  console.log(`\n  📸 ${readyPercentage}% of ingredients are ready for image generation`);

  // Data Quality
  console.log('\n' + '-'.repeat(80));
  console.log('DATA QUALITY:');
  console.log('-'.repeat(80));

  if (report.qualityIssues.length === 0) {
    console.log('  ✅ No data quality issues found');
  } else {
    for (const issue of report.qualityIssues) {
      const severity = issue.type.includes('Null') || issue.type.includes('Malformed')
        ? '🔴' : '🟡';
      console.log(`  ${severity} ${issue.type}: ${issue.count} items`);
      if (issue.examples.length > 0) {
        console.log('    Examples:');
        for (const ex of issue.examples) {
          console.log(`      - ${ex.name}: ${ex.issue}`);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log('='.repeat(80));

  const totalIssues =
    report.namingIssues.reduce((sum, i) => sum + i.count, 0) +
    report.semanticIssues.reduce((sum, i) => sum + i.count, 0) +
    report.qualityIssues.reduce((sum, i) => sum + i.count, 0);

  const issuePercentage = (totalIssues / report.totalIngredients * 100).toFixed(2);

  console.log(`  Total issues found: ${totalIssues} (${issuePercentage}% of database)`);
  console.log(`  Categories: ${report.categoryDistribution.length}`);
  console.log(`  Image coverage: ${report.imageStats.hasImages} / ${report.imageStats.totalIngredients} (${(report.imageStats.hasImages / report.imageStats.totalIngredients * 100).toFixed(1)}%)`);

  // Recommendation
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATION:');
  console.log('='.repeat(80));

  if (report.recommendation === 'PROCEED') {
    console.log('  ✅ PROCEED - Database quality is acceptable for image generation');
    console.log('     Minor issues can be fixed incrementally.');
  } else {
    console.log('  ❌ FIX ISSUES FIRST - Critical issues must be resolved');
    console.log('     Focus on null/empty fields and malformed data.');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('🚀 Starting ingredient database quality analysis...\n');

    const totalIngredients = await getTotalCount();
    console.log(`📦 Found ${totalIngredients.toLocaleString()} ingredients in database\n`);

    // Run all analyses
    const [
      categoryDistribution,
      namingIssues,
      semanticIssues,
      imageStats,
      qualityIssues,
    ] = await Promise.all([
      analyzeCategoryDistribution(),
      analyzeNamingConventions(),
      analyzeSemanticCoherence(),
      analyzeImageReadiness(),
      analyzeDataQuality(),
    ]);

    const report: AnalysisReport = {
      totalIngredients,
      categoryDistribution,
      namingIssues,
      semanticIssues,
      imageStats,
      qualityIssues,
      recommendation: 'PROCEED', // Will be calculated
    };

    // Generate final recommendation
    report.recommendation = generateRecommendation(report);

    // Print report
    printReport(report);

    console.log('✅ Analysis complete!');
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  } finally {
    await cleanup();
  }
}

main();
