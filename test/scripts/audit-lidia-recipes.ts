#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { eq, like, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

/**
 * LIDIA BASTIANICH RECIPE CONTENT AUDIT SCRIPT
 *
 * Analyzes all Lidia Bastianich recipes for content quality:
 * - Recipe completeness (ingredients, instructions, times)
 * - Content quality (descriptions, formatting)
 * - Data integrity (valid JSON, proper types)
 * - Image coverage
 * - Tag consistency
 *
 * Generates detailed quality report with actionable recommendations.
 */

interface QualityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
}

interface RecipeAudit {
  id: string;
  name: string;
  qualityScore: number;
  issues: QualityIssue[];
  strengths: string[];
}

interface AuditSummary {
  totalRecipes: number;
  averageQualityScore: number;
  criticalIssues: number;
  highPriorityIssues: number;
  mediumPriorityIssues: number;
  lowPriorityIssues: number;
  recipesWithImages: number;
  recipesByCategory: Record<string, number>;
  commonIssues: Record<string, number>;
}

// Quality thresholds
const QUALITY_THRESHOLDS = {
  MIN_DESCRIPTION_LENGTH: 50,
  MIN_INGREDIENTS_COUNT: 3,
  MIN_INSTRUCTIONS_LENGTH: 100,
  IDEAL_DESCRIPTION_LENGTH: 150,
  IDEAL_PREP_TIME: 15,
  IDEAL_COOK_TIME: 30,
};

function analyzeRecipeQuality(recipe: any): RecipeAudit {
  const issues: QualityIssue[] = [];
  const strengths: string[] = [];
  let qualityScore = 100;

  // 1. Name Quality
  if (!recipe.name || recipe.name.trim().length === 0) {
    issues.push({
      severity: 'critical',
      category: 'Name',
      issue: 'Recipe has no name',
      recommendation: 'Add a descriptive recipe name',
    });
    qualityScore -= 20;
  } else {
    if (recipe.name !== recipe.name.trim()) {
      issues.push({
        severity: 'low',
        category: 'Name',
        issue: 'Recipe name has trailing/leading whitespace',
        recommendation: 'Trim whitespace from name',
      });
      qualityScore -= 2;
    }

    // Check for ALL CAPS (should be title case)
    if (recipe.name === recipe.name.toUpperCase() && recipe.name.length > 5) {
      issues.push({
        severity: 'medium',
        category: 'Name',
        issue: 'Recipe name is in ALL CAPS',
        recommendation: 'Convert to proper title case',
      });
      qualityScore -= 5;
    } else {
      strengths.push('Properly formatted recipe name');
    }
  }

  // 2. Description Quality
  if (!recipe.description || recipe.description.trim().length === 0) {
    issues.push({
      severity: 'high',
      category: 'Description',
      issue: 'Missing recipe description',
      recommendation: "Add a warm, engaging description in Lidia's voice",
    });
    qualityScore -= 15;
  } else {
    const descLength = recipe.description.trim().length;

    if (descLength < QUALITY_THRESHOLDS.MIN_DESCRIPTION_LENGTH) {
      issues.push({
        severity: 'medium',
        category: 'Description',
        issue: `Description too short (${descLength} chars)`,
        recommendation: `Expand to at least ${QUALITY_THRESHOLDS.MIN_DESCRIPTION_LENGTH} characters`,
      });
      qualityScore -= 8;
    } else if (descLength < QUALITY_THRESHOLDS.IDEAL_DESCRIPTION_LENGTH) {
      issues.push({
        severity: 'low',
        category: 'Description',
        issue: `Description could be more detailed (${descLength} chars)`,
        recommendation: `Consider expanding to ${QUALITY_THRESHOLDS.IDEAL_DESCRIPTION_LENGTH}+ characters`,
      });
      qualityScore -= 3;
    } else {
      strengths.push('Comprehensive description');
    }

    // Check for Lidia's voice markers
    const hasItalianHeritage = /\b(italian|nonna|tradition|family|sicilian|roman|venetian)\b/i.test(
      recipe.description
    );
    if (hasItalianHeritage) {
      strengths.push('Description captures Italian heritage');
    }
  }

  // 3. Ingredients Analysis
  let ingredients: any[] = [];
  try {
    ingredients =
      typeof recipe.ingredients === 'string'
        ? JSON.parse(recipe.ingredients)
        : recipe.ingredients || [];

    if (!Array.isArray(ingredients)) {
      ingredients = [];
      throw new Error('Ingredients is not an array');
    }
  } catch (_e) {
    issues.push({
      severity: 'critical',
      category: 'Ingredients',
      issue: 'Invalid ingredients JSON format',
      recommendation: 'Fix ingredients data structure to valid JSON array',
    });
    qualityScore -= 20;
  }

  if (ingredients.length === 0) {
    issues.push({
      severity: 'critical',
      category: 'Ingredients',
      issue: 'No ingredients listed',
      recommendation: 'Add complete ingredients list with amounts',
    });
    qualityScore -= 20;
  } else if (ingredients.length < QUALITY_THRESHOLDS.MIN_INGREDIENTS_COUNT) {
    issues.push({
      severity: 'high',
      category: 'Ingredients',
      issue: `Only ${ingredients.length} ingredient(s)`,
      recommendation: 'Verify ingredients list is complete',
    });
    qualityScore -= 10;
  } else {
    strengths.push(`Complete ingredients list (${ingredients.length} items)`);
  }

  // Check ingredient formatting
  const poorlyFormattedIngredients = ingredients.filter((ing: any) => {
    const ingStr = typeof ing === 'string' ? ing : ing?.name || '';
    return ingStr.length < 3 || !ingStr.trim();
  });

  if (poorlyFormattedIngredients.length > 0) {
    issues.push({
      severity: 'medium',
      category: 'Ingredients',
      issue: `${poorlyFormattedIngredients.length} ingredient(s) poorly formatted`,
      recommendation: 'Review and improve ingredient descriptions',
    });
    qualityScore -= 5;
  }

  // 4. Instructions Analysis
  const instructions = recipe.instructions || '';
  const instructionsLength = instructions.trim().length;

  if (instructionsLength === 0) {
    issues.push({
      severity: 'critical',
      category: 'Instructions',
      issue: 'No cooking instructions',
      recommendation: 'Add detailed step-by-step instructions',
    });
    qualityScore -= 20;
  } else if (instructionsLength < QUALITY_THRESHOLDS.MIN_INSTRUCTIONS_LENGTH) {
    issues.push({
      severity: 'high',
      category: 'Instructions',
      issue: `Instructions too brief (${instructionsLength} chars)`,
      recommendation: 'Expand with more detailed cooking steps',
    });
    qualityScore -= 10;
  } else {
    strengths.push('Detailed cooking instructions');
  }

  // Check for numbered steps
  const hasNumberedSteps = /^\s*\d+[.)]\s/m.test(instructions);
  if (!hasNumberedSteps && instructionsLength > 0) {
    issues.push({
      severity: 'low',
      category: 'Instructions',
      issue: 'Instructions not numbered/structured',
      recommendation: 'Format as numbered steps for clarity',
    });
    qualityScore -= 3;
  }

  // 5. Time Information
  if (!recipe.prepTime || recipe.prepTime === 0) {
    issues.push({
      severity: 'medium',
      category: 'Times',
      issue: 'Missing prep time',
      recommendation: 'Add estimated prep time in minutes',
    });
    qualityScore -= 5;
  }

  if (!recipe.cookTime || recipe.cookTime === 0) {
    issues.push({
      severity: 'medium',
      category: 'Times',
      issue: 'Missing cook time',
      recommendation: 'Add estimated cook time in minutes',
    });
    qualityScore -= 5;
  }

  if (recipe.prepTime && recipe.cookTime) {
    strengths.push('Complete time information');
  }

  // 6. Servings
  if (!recipe.servings || recipe.servings === 0) {
    issues.push({
      severity: 'medium',
      category: 'Servings',
      issue: 'Missing servings information',
      recommendation: 'Add serving size (e.g., 4-6 servings)',
    });
    qualityScore -= 5;
  }

  // 7. Images
  let images: any[] = [];
  try {
    images = typeof recipe.images === 'string' ? JSON.parse(recipe.images) : recipe.images || [];
  } catch (_e) {
    images = [];
  }

  if (images.length === 0) {
    issues.push({
      severity: 'high',
      category: 'Images',
      issue: 'No recipe image',
      recommendation: 'Generate AI image or add photo',
    });
    qualityScore -= 10;
  } else {
    strengths.push(`Recipe has ${images.length} image(s)`);
  }

  // 8. Tags
  let tags: any[] = [];
  try {
    tags = typeof recipe.tags === 'string' ? JSON.parse(recipe.tags) : recipe.tags || [];
  } catch (_e) {
    tags = [];
  }

  if (tags.length === 0) {
    issues.push({
      severity: 'low',
      category: 'Tags',
      issue: 'No tags assigned',
      recommendation: 'Add relevant tags (course, dietary, region)',
    });
    qualityScore -= 3;
  } else if (tags.length < 2) {
    issues.push({
      severity: 'low',
      category: 'Tags',
      issue: 'Limited tags (only 1)',
      recommendation: 'Add more descriptive tags',
    });
    qualityScore -= 2;
  }

  // 9. Cuisine
  if (recipe.cuisine !== 'Italian') {
    issues.push({
      severity: 'medium',
      category: 'Cuisine',
      issue: `Cuisine set to "${recipe.cuisine}" instead of "Italian"`,
      recommendation: 'Change cuisine to "Italian"',
    });
    qualityScore -= 5;
  }

  // 10. Source Attribution
  if (!recipe.source) {
    issues.push({
      severity: 'low',
      category: 'Source',
      issue: 'No source URL',
      recommendation: 'Add original recipe URL if available',
    });
    qualityScore -= 2;
  }

  // Ensure score doesn't go below 0
  qualityScore = Math.max(0, qualityScore);

  return {
    id: recipe.id,
    name: recipe.name || 'UNNAMED RECIPE',
    qualityScore,
    issues,
    strengths,
  };
}

function generateAuditReport(audits: RecipeAudit[]): AuditSummary {
  const summary: AuditSummary = {
    totalRecipes: audits.length,
    averageQualityScore: 0,
    criticalIssues: 0,
    highPriorityIssues: 0,
    mediumPriorityIssues: 0,
    lowPriorityIssues: 0,
    recipesWithImages: 0,
    recipesByCategory: {},
    commonIssues: {},
  };

  let totalScore = 0;

  for (const audit of audits) {
    totalScore += audit.qualityScore;

    for (const issue of audit.issues) {
      const issueKey = `${issue.category}: ${issue.issue}`;
      summary.commonIssues[issueKey] = (summary.commonIssues[issueKey] || 0) + 1;

      switch (issue.severity) {
        case 'critical':
          summary.criticalIssues++;
          break;
        case 'high':
          summary.highPriorityIssues++;
          break;
        case 'medium':
          summary.mediumPriorityIssues++;
          break;
        case 'low':
          summary.lowPriorityIssues++;
          break;
      }
    }

    const hasImages = audit.strengths.some((s) => s.includes('image'));
    if (hasImages) {
      summary.recipesWithImages++;
    }
  }

  summary.averageQualityScore = totalScore / audits.length;

  return summary;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📊 LIDIA BASTIANICH RECIPE CONTENT QUALITY AUDIT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Step 1: Find Lidia Bastianich
  console.log('🔍 Step 1: Finding Lidia Bastianich in database...\n');

  const [chef] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1);

  if (!chef) {
    console.error('❌ Error: Lidia Bastianich not found in database');
    console.error('   Run: npx tsx scripts/import-chefs.ts');
    process.exit(1);
  }

  console.log('✅ Found: Lidia Bastianich');
  console.log(`   Chef ID: ${chef.id}`);
  console.log(`   Slug: ${chef.slug}\n`);

  // Step 2: Query all Lidia's recipes (by tags/source since chef_id may not be linked yet)
  console.log('🔍 Step 2: Querying all Lidia Bastianich recipes...\n');

  const lidiaRecipes = await db
    .select()
    .from(recipes)
    .where(or(like(recipes.tags, '%Lidia%'), like(recipes.source, '%lidia%')))
    .orderBy(recipes.name);

  console.log(`📚 Found ${lidiaRecipes.length} recipes\n`);

  if (lidiaRecipes.length === 0) {
    console.error('❌ No recipes found for Lidia Bastianich');
    console.error('   Expected recipes with "Lidia" in tags or "lidia" in source URL');
    process.exit(1);
  }

  // Check if chef_id needs to be linked
  const unlinkedCount = lidiaRecipes.filter((r) => !r.chef_id).length;
  if (unlinkedCount > 0) {
    console.log(`⚠️  Note: ${unlinkedCount}/${lidiaRecipes.length} recipes have NULL chef_id`);
    console.log(`   Run linking script to associate recipes with chef profile\n`);
  }

  // Step 3: Audit each recipe
  console.log('🔍 Step 3: Analyzing recipe quality...\n');

  const audits: RecipeAudit[] = [];

  for (const recipe of lidiaRecipes) {
    const audit = analyzeRecipeQuality(recipe);
    audits.push(audit);
  }

  // Step 4: Generate summary
  const summary = generateAuditReport(audits);

  // Step 5: Display Results
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📊 AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`Total Recipes: ${summary.totalRecipes}`);
  console.log(`Average Quality Score: ${summary.averageQualityScore.toFixed(1)}/100\n`);

  console.log('Issues by Severity:');
  console.log(`  🔴 Critical: ${summary.criticalIssues}`);
  console.log(`  🟡 High:     ${summary.highPriorityIssues}`);
  console.log(`  🟠 Medium:   ${summary.mediumPriorityIssues}`);
  console.log(`  ⚪ Low:      ${summary.lowPriorityIssues}\n`);

  console.log(
    `Images: ${summary.recipesWithImages}/${summary.totalRecipes} recipes (${((summary.recipesWithImages / summary.totalRecipes) * 100).toFixed(1)}%)\n`
  );

  // Most Common Issues
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 MOST COMMON ISSUES');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const sortedIssues = Object.entries(summary.commonIssues)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  for (const [issue, count] of sortedIssues) {
    console.log(`${count.toString().padStart(3)} recipes: ${issue}`);
  }
  console.log();

  // Top Quality Recipes
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('⭐ TOP QUALITY RECIPES (Score ≥ 90)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const topRecipes = audits
    .filter((a) => a.qualityScore >= 90)
    .sort((a, b) => b.qualityScore - a.qualityScore);

  if (topRecipes.length === 0) {
    console.log('   No recipes scored 90 or above\n');
  } else {
    for (const recipe of topRecipes) {
      console.log(`✅ ${recipe.qualityScore}/100 - ${recipe.name}`);
      console.log(`   Strengths: ${recipe.strengths.join(', ')}`);
      console.log();
    }
  }

  // Recipes Needing Attention
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('⚠️  RECIPES NEEDING ATTENTION (Score < 70)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const problemRecipes = audits
    .filter((a) => a.qualityScore < 70)
    .sort((a, b) => a.qualityScore - b.qualityScore);

  if (problemRecipes.length === 0) {
    console.log('   All recipes scored 70 or above! 🎉\n');
  } else {
    for (const recipe of problemRecipes.slice(0, 10)) {
      console.log(`❌ ${recipe.qualityScore}/100 - ${recipe.name}`);
      console.log(`   ID: ${recipe.id}`);

      const criticalIssues = recipe.issues.filter(
        (i) => i.severity === 'critical' || i.severity === 'high'
      );
      if (criticalIssues.length > 0) {
        console.log('   Critical/High Priority Issues:');
        for (const issue of criticalIssues) {
          console.log(`     • ${issue.category}: ${issue.issue}`);
          console.log(`       → ${issue.recommendation}`);
        }
      }
      console.log();
    }

    if (problemRecipes.length > 10) {
      console.log(`   ... and ${problemRecipes.length - 10} more recipes\n`);
    }
  }

  // Step 6: Generate detailed JSON report
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('💾 GENERATING DETAILED REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(process.cwd(), 'tmp', `lidia-audit-${timestamp}.json`);

  // Ensure tmp directory exists
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const detailedReport = {
    timestamp: new Date().toISOString(),
    chef: {
      id: chef.id,
      name: 'Lidia Bastianich',
      slug: chef.slug,
    },
    summary,
    recipes: audits,
  };

  fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));

  console.log(`✅ Detailed report saved: ${reportPath}\n`);

  // Summary recommendations
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('Next Steps:');
  console.log('1. Review recipes with quality score < 70');
  console.log('2. Fix critical issues (missing ingredients, instructions)');
  console.log('3. Add missing prep/cook times where possible');
  console.log("4. Enhance descriptions to capture Lidia's voice");
  console.log('5. Generate images for recipes without photos');
  console.log('6. Run fix script: npx tsx scripts/fix-lidia-content.ts\n');

  console.log('✅ Audit completed!\n');
}

main().catch(console.error);
