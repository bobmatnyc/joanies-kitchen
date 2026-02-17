#!/usr/bin/env tsx

/**
 * Universal Recipe Ingestion Pipeline
 *
 * Reads recipes from data/recipes/incoming/* and ingests into database
 * with AI quality evaluation and embedding generation.
 *
 * Features:
 * - Batch processing with rate limiting
 * - AI quality evaluation (0-5 rating)
 * - Embedding generation for semantic search
 * - Error handling and failed recipe tracking
 * - Progress reporting
 */

import fs from 'node:fs';
import { sql } from 'drizzle-orm';
import { generateEmbedding } from '../@/lib/ai/embeddings';
import { evaluateRecipeQuality } from '../@/lib/ai/recipe-quality-evaluator';
import { db } from '../@/lib/db';
import { recipeEmbeddings, recipes } from '../@/lib/db/schema';
import type { StandardRecipe } from './parsers/food-com-parser';

// System user ID for imported recipes
const SYSTEM_USER_ID = 'system_imported';

interface IngestionResult {
  success: boolean;
  error?: string;
  recipeId?: string;
}

interface IngestionStats {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ recipe: string; error: string }>;
}

/**
 * Converts minutes string to number
 */
function parseMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;

  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Ingests a single recipe into the database
 */
async function ingestRecipe(recipe: StandardRecipe): Promise<IngestionResult> {
  try {
    console.log(`[Ingest] Processing "${recipe.name}"...`);

    // Validate required fields
    if (!recipe.name || !recipe.ingredients || recipe.ingredients.length === 0) {
      return {
        success: false,
        error: 'Missing required fields (name or ingredients)',
      };
    }

    // Check for duplicates by name and source
    const existing = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.name} = ${recipe.name} AND ${recipes.source} = ${recipe.source}`)
      .limit(1);

    if (existing.length > 0) {
      console.log(`[Ingest] ⊘ Skipped "${recipe.name}" (duplicate)`);
      return { success: true, recipeId: existing[0].id };
    }

    // Step 1: Evaluate quality using AI
    let qualityRating = 3.0;
    let qualityReason = 'Quality evaluation skipped';

    try {
      const quality = await evaluateRecipeQuality({
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions || [],
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
      });

      qualityRating = quality.rating;
      qualityReason = quality.reasoning;

      console.log(`[Ingest]   Quality: ${qualityRating}/5.0`);
    } catch (error: any) {
      console.warn(`[Ingest]   Quality evaluation failed:`, error.message);
    }

    // Step 2: Generate embedding for semantic search
    let embeddingVector: number[] | null = null;
    let embeddingText = '';

    try {
      const parts = [
        recipe.name,
        recipe.description,
        recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : '',
        recipe.tags && recipe.tags.length > 0 ? `Tags: ${recipe.tags.join(', ')}` : '',
        `Ingredients: ${recipe.ingredients.slice(0, 10).join(', ')}`,
      ].filter(Boolean);

      embeddingText = parts.join('. ');
      embeddingVector = await generateEmbedding(embeddingText);

      console.log(`[Ingest]   Embedding: ✓ Generated (${embeddingVector.length}d)`);
    } catch (error: any) {
      console.warn(`[Ingest]   Embedding generation failed:`, error.message);
    }

    // Step 3: Insert recipe into database
    const [insertedRecipe] = await db
      .insert(recipes)
      .values({
        userId: SYSTEM_USER_ID,
        name: recipe.name,
        description: recipe.description || null,
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions || []),
        prepTime: parseMinutes(recipe.prepTime),
        cookTime: parseMinutes(recipe.cookTime),
        servings: recipe.servings ? parseInt(recipe.servings, 10) : null,
        difficulty: null, // Not provided by data sources
        cuisine: recipe.cuisine || null,
        tags: recipe.tags && recipe.tags.length > 0 ? JSON.stringify(recipe.tags) : null,
        images: recipe.images && recipe.images.length > 0 ? JSON.stringify(recipe.images) : null,
        isAiGenerated: false,
        isPublic: false, // Start as private for review
        isSystemRecipe: true, // Mark as system/curated recipe
        nutritionInfo: recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
        source: recipe.sourceUrl,
        systemRating: qualityRating.toFixed(1),
        systemRatingReason: qualityReason,
        avgUserRating: recipe.rating ? recipe.rating.toFixed(1) : null,
        totalUserRatings: recipe.reviewCount || 0,
      })
      .returning();

    console.log(`[Ingest]   Recipe ID: ${insertedRecipe.id}`);

    // Step 4: Insert embedding if generated
    if (embeddingVector && insertedRecipe.id) {
      try {
        await db.insert(recipeEmbeddings).values({
          recipeId: insertedRecipe.id,
          embedding: embeddingVector,
          embeddingText,
          modelName: 'all-MiniLM-L6-v2',
        });

        console.log(`[Ingest]   Embedding: ✓ Stored`);
      } catch (error: any) {
        console.warn(`[Ingest]   Embedding storage failed:`, error.message);
        // Don't fail the entire ingestion if embedding storage fails
      }
    }

    console.log(`[Ingest] ✓ Stored "${recipe.name}"`);
    return { success: true, recipeId: insertedRecipe.id };
  } catch (error: any) {
    console.error(`[Ingest] ✗ Failed to store "${recipe.name}":`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Ingests recipes in batches with rate limiting
 */
export async function ingestBatch(
  recipes: StandardRecipe[],
  batchSize = 10,
  delayMs = 500
): Promise<IngestionStats> {
  const stats: IngestionStats = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log(`\n[Ingest] Starting batch ingestion...`);
  console.log(`[Ingest] Total recipes: ${recipes.length}`);
  console.log(`[Ingest] Batch size: ${batchSize}`);
  console.log(`[Ingest] Rate limit: ${delayMs}ms between recipes`);
  console.log('='.repeat(60));

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const batchNum = Math.floor(i / batchSize) + 1;
    const progress = `[${i + 1}/${recipes.length}]`;

    console.log(`\n${progress} Batch ${batchNum} - ${recipe.name}`);

    const result = await ingestRecipe(recipe);

    if (result.success) {
      stats.success++;
    } else {
      stats.failed++;
      stats.errors.push({
        recipe: recipe.name,
        error: result.error || 'Unknown error',
      });
    }

    // Rate limiting delay
    if (i < recipes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Progress update every batch
    if ((i + 1) % batchSize === 0 || i === recipes.length - 1) {
      console.log(`\n${'-'.repeat(60)}`);
      console.log(`Progress: ${i + 1}/${recipes.length} recipes processed`);
      console.log(`Success: ${stats.success} | Failed: ${stats.failed}`);
      console.log('-'.repeat(60));
    }
  }

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('  INGESTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total Recipes: ${recipes.length}`);
  console.log(`✓ Success: ${stats.success}`);
  console.log(`✗ Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (showing first 10):`);
    stats.errors.slice(0, 10).forEach((err) => {
      console.log(`  - ${err.recipe}: ${err.error}`);
    });
  }

  console.log('='.repeat(60));

  return stats;
}

/**
 * Main function to ingest recipes from a JSON file
 */
async function ingestFromFile(filePath: string, batchSize = 10) {
  console.log(`[Ingest] Reading recipes from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[Ingest] File not found: ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const recipes: StandardRecipe[] = JSON.parse(fileContent);

  console.log(`[Ingest] Found ${recipes.length} recipes in file`);

  const stats = await ingestBatch(recipes, batchSize);

  return stats;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: tsx ingest-recipes.ts <json-file> [batch-size]');
    console.log('Example: tsx ingest-recipes.ts data/recipes/incoming/themealdb/recipes.json 10');
    process.exit(1);
  }

  const filePath = args[0];
  const batchSize = args[1] ? parseInt(args[1], 10) : 10;

  ingestFromFile(filePath, batchSize)
    .then((stats) => {
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
