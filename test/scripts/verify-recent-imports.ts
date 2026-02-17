/**
 * Verify Recent Recipe Imports
 *
 * Queries the database to check the state of recently imported recipes
 * from the batch import process (last 2 hours)
 *
 * Analyzes:
 * - Total recipes imported
 * - Chef associations
 * - Data completeness (ingredients, instructions, images)
 * - Quality scores
 * - Embedding status
 * - QA status
 */

import { db } from '@/lib/db/index.js';
import { recipes, chefRecipes } from '@/lib/db/schema.js';
import { recipeEmbeddings } from '@/lib/db/schema.js';
import { chefs } from '@/lib/db/chef-schema.js';
import { eq, gte, and, sql, desc, isNull } from 'drizzle-orm';

interface RecipeAnalysis {
  totalCount: number;
  withChefAssociation: number;
  withoutChefAssociation: number;
  withIngredients: number;
  withInstructions: number;
  withImages: number;
  withEmbeddings: number;
  withQAStatus: number;
  avgConfidenceScore: number | null;
  avgSystemRating: number | null;
  qualityIssues: {
    missingIngredients: number;
    missingInstructions: number;
    missingImages: number;
    missingEmbeddings: number;
    lowConfidence: number;
    lowRating: number;
  };
}

async function analyzeRecentImports() {
  console.log('🔍 Analyzing Recently Imported Recipes (Last 2 Hours)\n');
  console.log('='.repeat(70));

  // Calculate timestamp for 2 hours ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  try {
    // 1. Get all recently created recipes
    console.log(`\n📊 Query 1: Fetching recipes created after ${twoHoursAgo.toISOString()}`);
    const recentRecipes = await db
      .select()
      .from(recipes)
      .where(gte(recipes.created_at, twoHoursAgo))
      .orderBy(desc(recipes.created_at));

    console.log(`✅ Found ${recentRecipes.length} recently imported recipes\n`);

    if (recentRecipes.length === 0) {
      console.log('⚠️  No recipes found in the last 2 hours');
      console.log('💡 Try expanding the time window or check if imports completed successfully\n');
      return;
    }

    // 2. Get chef associations for these recipes
    console.log(`📊 Query 2: Fetching chef associations`);
    const recipeIds = recentRecipes.map((r) => r.id);
    const chefAssociations = await db
      .select({
        recipeId: chefRecipes.recipe_id,
        chefId: chefRecipes.chef_id,
        chefName: chefs.name,
        chefSlug: chefs.slug,
        originalUrl: chefRecipes.original_url,
      })
      .from(chefRecipes)
      .leftJoin(chefs, eq(chefRecipes.chef_id, chefs.id))
      .where(sql`${chefRecipes.recipe_id} = ANY(${recipeIds})`);

    console.log(`✅ Found ${chefAssociations.length} chef associations\n`);

    // 3. Get embeddings for these recipes
    console.log(`📊 Query 3: Fetching embeddings`);
    const embeddings = await db
      .select({
        recipeId: recipeEmbeddings.recipe_id,
        modelName: recipeEmbeddings.model_name,
        createdAt: recipeEmbeddings.created_at,
      })
      .from(recipeEmbeddings)
      .where(sql`${recipeEmbeddings.recipe_id} = ANY(${recipeIds})`);

    console.log(`✅ Found ${embeddings.length} embeddings\n`);

    // 4. Analyze data quality
    console.log('='.repeat(70));
    console.log('\n📈 DATA QUALITY ANALYSIS\n');

    const analysis: RecipeAnalysis = {
      totalCount: recentRecipes.length,
      withChefAssociation: chefAssociations.length,
      withoutChefAssociation: recentRecipes.length - chefAssociations.length,
      withIngredients: 0,
      withInstructions: 0,
      withImages: 0,
      withEmbeddings: embeddings.length,
      withQAStatus: 0,
      avgConfidenceScore: null,
      avgSystemRating: null,
      qualityIssues: {
        missingIngredients: 0,
        missingInstructions: 0,
        missingImages: 0,
        missingEmbeddings: 0,
        lowConfidence: 0,
        lowRating: 0,
      },
    };

    const confidenceScores: number[] = [];
    const systemRatings: number[] = [];

    // Create lookup maps
    const embeddingMap = new Map(embeddings.map((e) => [e.recipeId, e]));
    const chefMap = new Map(chefAssociations.map((c) => [c.recipeId, c]));

    // Analyze each recipe
    for (const recipe of recentRecipes) {
      // Check ingredients
      try {
        const ingredients = JSON.parse(recipe.ingredients || '[]');
        if (Array.isArray(ingredients) && ingredients.length > 0) {
          analysis.withIngredients++;
        } else {
          analysis.qualityIssues.missingIngredients++;
        }
      } catch {
        analysis.qualityIssues.missingIngredients++;
      }

      // Check instructions
      try {
        const instructions = JSON.parse(recipe.instructions || '[]');
        if (Array.isArray(instructions) && instructions.length > 0) {
          analysis.withInstructions++;
        } else {
          analysis.qualityIssues.missingInstructions++;
        }
      } catch {
        analysis.qualityIssues.missingInstructions++;
      }

      // Check images
      try {
        const images = JSON.parse(recipe.images || '[]');
        if (Array.isArray(images) && images.length > 0) {
          analysis.withImages++;
        } else {
          analysis.qualityIssues.missingImages++;
        }
      } catch {
        analysis.qualityIssues.missingImages++;
      }

      // Check embeddings
      if (!embeddingMap.has(recipe.id)) {
        analysis.qualityIssues.missingEmbeddings++;
      }

      // Check QA status
      if (recipe.qa_status && recipe.qa_status !== 'pending') {
        analysis.withQAStatus++;
      }

      // Check confidence score
      if (recipe.confidence_score) {
        const score = parseFloat(recipe.confidence_score.toString());
        confidenceScores.push(score);
        if (score < 0.7) {
          analysis.qualityIssues.lowConfidence++;
        }
      }

      // Check system rating
      if (recipe.system_rating) {
        const rating = parseFloat(recipe.system_rating.toString());
        systemRatings.push(rating);
        if (rating < 3.0) {
          analysis.qualityIssues.lowRating++;
        }
      }
    }

    // Calculate averages
    if (confidenceScores.length > 0) {
      analysis.avgConfidenceScore =
        confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
    }
    if (systemRatings.length > 0) {
      analysis.avgSystemRating = systemRatings.reduce((a, b) => a + b, 0) / systemRatings.length;
    }

    // 5. Print comprehensive report
    console.log('📦 IMPORT SUMMARY');
    console.log('-'.repeat(70));
    console.log(`Total Recipes Imported:        ${analysis.totalCount}`);
    console.log(`With Chef Association:         ${analysis.withChefAssociation}`);
    console.log(`Without Chef Association:      ${analysis.withoutChefAssociation}`);
    console.log();

    console.log('📝 CONTENT COMPLETENESS');
    console.log('-'.repeat(70));
    console.log(
      `Recipes with Ingredients:      ${analysis.withIngredients} (${((analysis.withIngredients / analysis.totalCount) * 100).toFixed(1)}%)`
    );
    console.log(
      `Recipes with Instructions:     ${analysis.withInstructions} (${((analysis.withInstructions / analysis.totalCount) * 100).toFixed(1)}%)`
    );
    console.log(
      `Recipes with Images:           ${analysis.withImages} (${((analysis.withImages / analysis.totalCount) * 100).toFixed(1)}%)`
    );
    console.log(
      `Recipes with Embeddings:       ${analysis.withEmbeddings} (${((analysis.withEmbeddings / analysis.totalCount) * 100).toFixed(1)}%)`
    );
    console.log(
      `Recipes with QA Status:        ${analysis.withQAStatus} (${((analysis.withQAStatus / analysis.totalCount) * 100).toFixed(1)}%)`
    );
    console.log();

    console.log('⭐ QUALITY METRICS');
    console.log('-'.repeat(70));
    console.log(
      `Avg Confidence Score:          ${analysis.avgConfidenceScore?.toFixed(3) || 'N/A'}`
    );
    console.log(`Avg System Rating:             ${analysis.avgSystemRating?.toFixed(2) || 'N/A'}`);
    console.log();

    console.log('⚠️  QUALITY ISSUES DETECTED');
    console.log('-'.repeat(70));
    console.log(
      `Missing Ingredients:           ${analysis.qualityIssues.missingIngredients} recipes`
    );
    console.log(
      `Missing Instructions:          ${analysis.qualityIssues.missingInstructions} recipes`
    );
    console.log(`Missing Images:                ${analysis.qualityIssues.missingImages} recipes`);
    console.log(
      `Missing Embeddings:            ${analysis.qualityIssues.missingEmbeddings} recipes`
    );
    console.log(`Low Confidence (<0.7):         ${analysis.qualityIssues.lowConfidence} recipes`);
    console.log(`Low Rating (<3.0):             ${analysis.qualityIssues.lowRating} recipes`);
    console.log();

    // 6. Chef breakdown
    console.log('👨‍🍳 CHEF BREAKDOWN');
    console.log('-'.repeat(70));
    const chefCounts = new Map<string, number>();
    for (const assoc of chefAssociations) {
      const chefName = assoc.chefName || 'Unknown';
      chefCounts.set(chefName, (chefCounts.get(chefName) || 0) + 1);
    }

    const sortedChefs = Array.from(chefCounts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [chefName, count] of sortedChefs) {
      console.log(`  ${chefName.padEnd(35)} ${count} recipes`);
    }
    console.log();

    // 7. Sample recipes for manual inspection
    console.log('🔎 SAMPLE RECIPES (First 5)');
    console.log('-'.repeat(70));
    for (const recipe of recentRecipes.slice(0, 5)) {
      const chef = chefMap.get(recipe.id);
      const hasEmbedding = embeddingMap.has(recipe.id);

      console.log(`\nRecipe: ${recipe.name}`);
      console.log(`  ID: ${recipe.id}`);
      console.log(`  Chef: ${chef?.chefName || 'No chef association'}`);
      console.log(`  Source: ${recipe.source || 'N/A'}`);
      console.log(`  Created: ${recipe.created_at}`);
      console.log(
        `  Ingredients: ${JSON.parse(recipe.ingredients || '[]').length} items`
      );
      console.log(
        `  Instructions: ${JSON.parse(recipe.instructions || '[]').length} steps`
      );
      console.log(`  Images: ${JSON.parse(recipe.images || '[]').length} images`);
      console.log(`  Embedding: ${hasEmbedding ? '✅ Yes' : '❌ No'}`);
      console.log(`  Confidence: ${recipe.confidence_score || 'N/A'}`);
      console.log(`  System Rating: ${recipe.system_rating || 'N/A'}`);
      console.log(`  QA Status: ${recipe.qa_status || 'pending'}`);
    }

    // 8. Recommendations
    console.log('\n' + '='.repeat(70));
    console.log('\n💡 RECOMMENDATIONS FOR CLEANUP\n');

    const recommendations: string[] = [];

    if (analysis.qualityIssues.missingIngredients > 0) {
      recommendations.push(
        `⚠️  ${analysis.qualityIssues.missingIngredients} recipes need ingredient extraction`
      );
    }

    if (analysis.qualityIssues.missingInstructions > 0) {
      recommendations.push(
        `⚠️  ${analysis.qualityIssues.missingInstructions} recipes need instruction extraction`
      );
    }

    if (analysis.qualityIssues.missingEmbeddings > 0) {
      recommendations.push(
        `⚠️  ${analysis.qualityIssues.missingEmbeddings} recipes need embeddings generated`
      );
    }

    if (analysis.qualityIssues.missingImages > 0) {
      recommendations.push(
        `ℹ️  ${analysis.qualityIssues.missingImages} recipes have no images (optional)`
      );
    }

    if (analysis.qualityIssues.lowConfidence > 0) {
      recommendations.push(
        `⚠️  ${analysis.qualityIssues.lowConfidence} recipes have low confidence scores (<0.7)`
      );
    }

    if (analysis.qualityIssues.lowRating > 0) {
      recommendations.push(
        `⚠️  ${analysis.qualityIssues.lowRating} recipes have low quality ratings (<3.0)`
      );
    }

    if (analysis.withoutChefAssociation > 0) {
      recommendations.push(
        `ℹ️  ${analysis.withoutChefAssociation} recipes have no chef association (may be system recipes)`
      );
    }

    if (recommendations.length === 0) {
      console.log('✅ No critical issues detected! All recipes look good.');
    } else {
      for (const rec of recommendations) {
        console.log(rec);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✨ Analysis Complete!\n');

    // 9. Export detailed report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      timeWindow: {
        from: twoHoursAgo.toISOString(),
        to: new Date().toISOString(),
      },
      summary: analysis,
      chefBreakdown: Object.fromEntries(chefCounts),
      recommendations,
      sampleRecipes: recentRecipes.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.name,
        chef: chefMap.get(r.id)?.chefName || null,
        source: r.source,
        ingredientCount: JSON.parse(r.ingredients || '[]').length,
        instructionCount: JSON.parse(r.instructions || '[]').length,
        imageCount: JSON.parse(r.images || '[]').length,
        hasEmbedding: embeddingMap.has(r.id),
        confidenceScore: r.confidence_score,
        systemRating: r.system_rating,
        qaStatus: r.qa_status,
      })),
    };

    const reportPath = `tmp/import-verification-${Date.now()}.json`;
    await import('fs/promises').then((fs) =>
      fs.writeFile(reportPath, JSON.stringify(reportData, null, 2))
    );
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);
  } catch (error) {
    console.error('❌ Error analyzing imports:', error);
    throw error;
  }
}

// Run the analysis
analyzeRecentImports()
  .then(() => {
    console.log('✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
