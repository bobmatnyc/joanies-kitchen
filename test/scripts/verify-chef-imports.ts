/**
 * Verify Chef Recipe Imports
 *
 * Analyzes chef-associated recipes imported in the last 7 days
 * Specifically checks the batch import that occurred Oct 23-24
 */

import { db } from '@/lib/db/index.js';
import { recipes, recipeEmbeddings } from '@/lib/db/schema.js';
import { chefs, chefRecipes } from '@/lib/db/chef-schema.js';
import { eq, gte, and, sql, desc, isNull, ne } from 'drizzle-orm';
import fs from 'fs/promises';

async function analyzeChefImports() {
  console.log('🔍 Analyzing Chef Recipe Imports (Last 7 Days)\n');
  console.log('='.repeat(80));

  // Calculate timestamp for 7 days ago
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // 1. Get recent recipes with chef associations
    console.log(`\n📊 Fetching recipes created after ${sevenDaysAgo.toISOString()}`);

    const recentWithChefs = await db
      .select({
        recipe: recipes,
        chefId: chefRecipes.chef_id,
        chefName: chefs.name,
        chefSlug: chefs.slug,
        originalUrl: chefRecipes.original_url,
        scrapedAt: chefRecipes.scraped_at,
      })
      .from(recipes)
      .innerJoin(chefRecipes, eq(recipes.id, chefRecipes.recipe_id))
      .leftJoin(chefs, eq(chefRecipes.chef_id, chefs.id))
      .where(gte(recipes.created_at, sevenDaysAgo))
      .orderBy(desc(recipes.created_at));

    console.log(`✅ Found ${recentWithChefs.length} chef-attributed recipes\n`);

    if (recentWithChefs.length === 0) {
      console.log('⚠️  No chef recipes found in the last 7 days');
      return;
    }

    // 2. Get embeddings
    console.log(`📊 Fetching embeddings for these recipes`);
    const recipeIds = recentWithChefs.map((r) => r.recipe.id);
    const embeddings = await db
      .select({
        recipeId: recipeEmbeddings.recipe_id,
        modelName: recipeEmbeddings.model_name,
      })
      .from(recipeEmbeddings)
      .where(sql`${recipeEmbeddings.recipe_id} = ANY(ARRAY[${sql.join(recipeIds.map(id => sql`${id}`), sql`, `)}])`);

    console.log(`✅ Found ${embeddings.length} embeddings\n`);

    // 3. Analyze data quality
    console.log('='.repeat(80));
    console.log('\n📈 DATA QUALITY ANALYSIS\n');

    const analysis = {
      totalRecipes: recentWithChefs.length,
      withIngredients: 0,
      withInstructions: 0,
      withImages: 0,
      withEmbeddings: embeddings.length,
      withQAStatus: 0,
      issues: {
        missingIngredients: 0,
        missingInstructions: 0,
        fewIngredients: 0, // <3 ingredients
        fewInstructions: 0, // <3 steps
        missingImages: 0,
        missingEmbeddings: 0,
        lowConfidence: 0,
        lowRating: 0,
        missingDescription: 0,
      },
      qualityScores: {
        avgConfidence: 0,
        avgRating: 0,
        minConfidence: 1,
        maxConfidence: 0,
        minRating: 5,
        maxRating: 0,
      },
    };

    const embeddingMap = new Map(embeddings.map((e) => [e.recipeId, true]));
    const confidenceScores: number[] = [];
    const ratings: number[] = [];

    // Analyze each recipe
    for (const row of recentWithChefs) {
      const recipe = row.recipe;

      // Check ingredients
      try {
        const ingredients = JSON.parse(recipe.ingredients || '[]');
        if (Array.isArray(ingredients) && ingredients.length > 0) {
          analysis.withIngredients++;
          if (ingredients.length < 3) {
            analysis.issues.fewIngredients++;
          }
        } else {
          analysis.issues.missingIngredients++;
        }
      } catch {
        analysis.issues.missingIngredients++;
      }

      // Check instructions
      try {
        const instructions = JSON.parse(recipe.instructions || '[]');
        if (Array.isArray(instructions) && instructions.length > 0) {
          analysis.withInstructions++;
          if (instructions.length < 3) {
            analysis.issues.fewInstructions++;
          }
        } else {
          analysis.issues.missingInstructions++;
        }
      } catch {
        analysis.issues.missingInstructions++;
      }

      // Check images
      try {
        const images = JSON.parse(recipe.images || '[]');
        if (Array.isArray(images) && images.length > 0) {
          analysis.withImages++;
        } else {
          analysis.issues.missingImages++;
        }
      } catch {
        analysis.issues.missingImages++;
      }

      // Check description
      if (!recipe.description || recipe.description.length < 20) {
        analysis.issues.missingDescription++;
      }

      // Check embeddings
      if (!embeddingMap.has(recipe.id)) {
        analysis.issues.missingEmbeddings++;
      }

      // Check QA status
      if (recipe.qa_status && recipe.qa_status !== 'pending') {
        analysis.withQAStatus++;
      }

      // Check confidence score
      if (recipe.confidence_score) {
        const score = parseFloat(recipe.confidence_score.toString());
        confidenceScores.push(score);
        analysis.qualityScores.minConfidence = Math.min(
          analysis.qualityScores.minConfidence,
          score
        );
        analysis.qualityScores.maxConfidence = Math.max(
          analysis.qualityScores.maxConfidence,
          score
        );
        if (score < 0.7) {
          analysis.issues.lowConfidence++;
        }
      }

      // Check system rating
      if (recipe.system_rating) {
        const rating = parseFloat(recipe.system_rating.toString());
        ratings.push(rating);
        analysis.qualityScores.minRating = Math.min(analysis.qualityScores.minRating, rating);
        analysis.qualityScores.maxRating = Math.max(analysis.qualityScores.maxRating, rating);
        if (rating < 3.0) {
          analysis.issues.lowRating++;
        }
      }
    }

    // Calculate averages
    if (confidenceScores.length > 0) {
      analysis.qualityScores.avgConfidence =
        confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
    }
    if (ratings.length > 0) {
      analysis.qualityScores.avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    }

    // 4. Print comprehensive report
    console.log('📦 IMPORT SUMMARY');
    console.log('-'.repeat(80));
    console.log(`Total Chef Recipes:            ${analysis.totalRecipes}`);
    console.log(`Date Range:                    ${sevenDaysAgo.toLocaleDateString()} - Today`);
    console.log();

    console.log('📝 CONTENT COMPLETENESS');
    console.log('-'.repeat(80));
    console.log(
      `✓ With Ingredients:            ${analysis.withIngredients} (${((analysis.withIngredients / analysis.totalRecipes) * 100).toFixed(1)}%)`
    );
    console.log(
      `✓ With Instructions:           ${analysis.withInstructions} (${((analysis.withInstructions / analysis.totalRecipes) * 100).toFixed(1)}%)`
    );
    console.log(
      `✓ With Images:                 ${analysis.withImages} (${((analysis.withImages / analysis.totalRecipes) * 100).toFixed(1)}%)`
    );
    console.log(
      `✓ With Embeddings:             ${analysis.withEmbeddings} (${((analysis.withEmbeddings / analysis.totalRecipes) * 100).toFixed(1)}%)`
    );
    console.log(
      `✓ With QA Status:              ${analysis.withQAStatus} (${((analysis.withQAStatus / analysis.totalRecipes) * 100).toFixed(1)}%)`
    );
    console.log();

    console.log('⭐ QUALITY METRICS');
    console.log('-'.repeat(80));
    console.log(
      `Confidence Score:              ${analysis.qualityScores.avgConfidence.toFixed(3)} (avg) | ${analysis.qualityScores.minConfidence.toFixed(3)} (min) | ${analysis.qualityScores.maxConfidence.toFixed(3)} (max)`
    );
    console.log(
      `System Rating:                 ${analysis.qualityScores.avgRating.toFixed(2)}/5 (avg) | ${analysis.qualityScores.minRating.toFixed(1)} (min) | ${analysis.qualityScores.maxRating.toFixed(1)} (max)`
    );
    console.log();

    console.log('⚠️  ISSUES DETECTED');
    console.log('-'.repeat(80));
    console.log(
      `Missing Ingredients:           ${analysis.issues.missingIngredients} recipes ${analysis.issues.missingIngredients > 0 ? '⚠️' : '✓'}`
    );
    console.log(
      `Missing Instructions:          ${analysis.issues.missingInstructions} recipes ${analysis.issues.missingInstructions > 0 ? '⚠️' : '✓'}`
    );
    console.log(
      `Few Ingredients (<3):          ${analysis.issues.fewIngredients} recipes ${analysis.issues.fewIngredients > 0 ? 'ℹ️' : '✓'}`
    );
    console.log(
      `Few Instructions (<3):         ${analysis.issues.fewInstructions} recipes ${analysis.issues.fewInstructions > 0 ? 'ℹ️' : '✓'}`
    );
    console.log(
      `Missing Description:           ${analysis.issues.missingDescription} recipes ${analysis.issues.missingDescription > 0 ? 'ℹ️' : '✓'}`
    );
    console.log(
      `Missing Images:                ${analysis.issues.missingImages} recipes ${analysis.issues.missingImages > 0 ? 'ℹ️' : '✓'}`
    );
    console.log(
      `Missing Embeddings:            ${analysis.issues.missingEmbeddings} recipes ${analysis.issues.missingEmbeddings > 0 ? '⚠️' : '✓'}`
    );
    console.log(
      `Low Confidence (<0.7):         ${analysis.issues.lowConfidence} recipes ${analysis.issues.lowConfidence > 0 ? '⚠️' : '✓'}`
    );
    console.log(
      `Low Rating (<3.0):             ${analysis.issues.lowRating} recipes ${analysis.issues.lowRating > 0 ? '⚠️' : '✓'}`
    );
    console.log();

    // 5. Chef breakdown
    console.log('👨‍🍳 RECIPES BY CHEF');
    console.log('-'.repeat(80));
    const chefCounts = new Map<string, number>();
    for (const row of recentWithChefs) {
      const chefName = row.chefName || 'Unknown';
      chefCounts.set(chefName, (chefCounts.get(chefName) || 0) + 1);
    }

    const sortedChefs = Array.from(chefCounts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [chefName, count] of sortedChefs) {
      console.log(`  ${chefName.padEnd(40)} ${count.toString().padStart(3)} recipes`);
    }
    console.log();

    // 6. Import timeline
    console.log('📆 IMPORT TIMELINE');
    console.log('-'.repeat(80));
    const byDate = new Map<string, number>();
    for (const row of recentWithChefs) {
      const date = new Date(row.recipe.created_at).toLocaleDateString();
      byDate.set(date, (byDate.get(date) || 0) + 1);
    }

    const sortedDates = Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    for (const [date, count] of sortedDates) {
      console.log(`  ${date.padEnd(20)} ${count} recipes`);
    }
    console.log();

    // 7. Sample problem recipes
    console.log('🔎 SAMPLE PROBLEM RECIPES (First 5 with issues)');
    console.log('-'.repeat(80));

    let problemCount = 0;
    for (const row of recentWithChefs) {
      if (problemCount >= 5) break;

      const recipe = row.recipe;
      const issues: string[] = [];

      try {
        const ingredients = JSON.parse(recipe.ingredients || '[]');
        if (!Array.isArray(ingredients) || ingredients.length === 0) {
          issues.push('No ingredients');
        } else if (ingredients.length < 3) {
          issues.push(`Only ${ingredients.length} ingredients`);
        }
      } catch {
        issues.push('Invalid ingredient JSON');
      }

      try {
        const instructions = JSON.parse(recipe.instructions || '[]');
        if (!Array.isArray(instructions) || instructions.length === 0) {
          issues.push('No instructions');
        } else if (instructions.length < 3) {
          issues.push(`Only ${instructions.length} steps`);
        }
      } catch {
        issues.push('Invalid instruction JSON');
      }

      if (!embeddingMap.has(recipe.id)) {
        issues.push('No embedding');
      }

      if (issues.length > 0) {
        problemCount++;
        console.log(`\n#${problemCount}: ${recipe.name}`);
        console.log(`  Chef: ${row.chefName || 'Unknown'}`);
        console.log(`  ID: ${recipe.id}`);
        console.log(`  Source: ${row.originalUrl || recipe.source || 'N/A'}`);
        console.log(`  Issues: ${issues.join(', ')}`);
        console.log(`  Confidence: ${recipe.confidence_score || 'N/A'}`);
        console.log(`  Rating: ${recipe.system_rating || 'N/A'}`);
      }
    }

    if (problemCount === 0) {
      console.log('✅ No problem recipes found!');
    }

    // 8. Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('\n💡 CLEANUP RECOMMENDATIONS\n');

    const recommendations: string[] = [];

    if (analysis.issues.missingIngredients > 0) {
      recommendations.push(
        `🔴 CRITICAL: ${analysis.issues.missingIngredients} recipes need ingredient extraction (database integrity)`
      );
    }

    if (analysis.issues.missingInstructions > 0) {
      recommendations.push(
        `🔴 CRITICAL: ${analysis.issues.missingInstructions} recipes need instruction extraction (database integrity)`
      );
    }

    if (analysis.issues.missingEmbeddings > 0) {
      recommendations.push(
        `🟡 HIGH: ${analysis.issues.missingEmbeddings} recipes need embeddings (search functionality)`
      );
    }

    if (analysis.issues.fewIngredients > 0) {
      recommendations.push(
        `🟢 MEDIUM: ${analysis.issues.fewIngredients} recipes have <3 ingredients (may be incomplete)`
      );
    }

    if (analysis.issues.fewInstructions > 0) {
      recommendations.push(
        `🟢 MEDIUM: ${analysis.issues.fewInstructions} recipes have <3 steps (may be incomplete)`
      );
    }

    if (analysis.issues.missingDescription > 0) {
      recommendations.push(
        `🟢 MEDIUM: ${analysis.issues.missingDescription} recipes have short/missing descriptions`
      );
    }

    if (analysis.issues.missingImages > 0) {
      recommendations.push(
        `⚪ LOW: ${analysis.issues.missingImages} recipes have no images (optional enhancement)`
      );
    }

    if (analysis.issues.lowConfidence > 0) {
      recommendations.push(
        `🟡 HIGH: ${analysis.issues.lowConfidence} recipes have low confidence scores - review quality`
      );
    }

    if (analysis.issues.lowRating > 0) {
      recommendations.push(
        `🟡 HIGH: ${analysis.issues.lowRating} recipes have low quality ratings - review content`
      );
    }

    if (recommendations.length === 0) {
      console.log('✅ NO ISSUES! All ${analysis.totalRecipes} recipes are in excellent shape.');
      console.log('✅ All recipes have ingredients, instructions, and embeddings.');
    } else {
      for (const rec of recommendations) {
        console.log(rec);
      }

      console.log('\n📋 SUGGESTED PROCESSING ORDER:');
      console.log('1. Fix critical issues (missing ingredients/instructions)');
      console.log('2. Generate missing embeddings');
      console.log('3. Review low quality recipes');
      console.log('4. Enhance with descriptions/images');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✨ Analysis Complete!\n');

    // 9. Export detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      timeWindow: {
        from: sevenDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
      summary: analysis,
      chefBreakdown: Object.fromEntries(chefCounts),
      timeline: Object.fromEntries(byDate),
      recommendations,
      sampleProblems: recentWithChefs
        .slice(0, 10)
        .map((row) => ({
          id: row.recipe.id,
          name: row.recipe.name,
          chef: row.chefName,
          source: row.originalUrl || row.recipe.source,
          created: row.recipe.created_at,
          ingredientCount: JSON.parse(row.recipe.ingredients || '[]').length,
          instructionCount: JSON.parse(row.recipe.instructions || '[]').length,
          imageCount: JSON.parse(row.recipe.images || '[]').length,
          hasEmbedding: embeddingMap.has(row.recipe.id),
          confidence: row.recipe.confidence_score,
          rating: row.recipe.system_rating,
          qaStatus: row.recipe.qa_status,
        })),
    };

    const reportPath = `tmp/chef-import-analysis-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);
  } catch (error) {
    console.error('❌ Error analyzing imports:', error);
    throw error;
  }
}

// Run the analysis
analyzeChefImports()
  .then(() => {
    console.log('✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
