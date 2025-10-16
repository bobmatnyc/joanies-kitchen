/**
 * Example Usage of Embedding Utilities
 *
 * This file demonstrates how to use the embedding generation
 * and database functions in your application.
 *
 * DO NOT import this file in production code - it's for reference only.
 */

import {
  generateEmbedding,
  generateRecipeEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  buildRecipeEmbeddingText,
} from './embeddings';

import {
  saveRecipeEmbedding,
  getRecipeEmbedding,
  findSimilarRecipes,
  getRecipesNeedingEmbedding,
  batchSaveRecipeEmbeddings,
} from '@/lib/db/embeddings';

import { Recipe } from '@/lib/db/schema';

// ============================================================================
// EXAMPLE 1: Generate and save embedding for a single recipe
// ============================================================================

export async function embedSingleRecipe(recipe: Recipe) {
  try {
    // Generate embedding
    const result = await generateRecipeEmbedding(recipe);

    console.log(`Generated embedding for "${recipe.name}"`);
    console.log(`Embedding text: ${result.embeddingText.substring(0, 100)}...`);
    console.log(`Vector dimensions: ${result.embedding.length}`);

    // Save to database
    await saveRecipeEmbedding(
      recipe.id,
      result.embedding,
      result.embeddingText,
      result.modelName
    );

    console.log('✓ Embedding saved to database');

    return result;
  } catch (error) {
    console.error('Failed to embed recipe:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: Batch process multiple recipes
// ============================================================================

export async function embedMultipleRecipes(recipes: Recipe[]) {
  try {
    console.log(`Embedding ${recipes.length} recipes...`);

    // Generate all embeddings
    const results = [];
    for (const recipe of recipes) {
      const result = await generateRecipeEmbedding(recipe);
      results.push({
        recipeId: recipe.id,
        embedding: result.embedding,
        embeddingText: result.embeddingText,
        modelName: result.modelName,
      });
    }

    // Batch save to database
    await batchSaveRecipeEmbeddings(results);

    console.log(`✓ Successfully embedded ${results.length} recipes`);

    return results;
  } catch (error) {
    console.error('Batch embedding failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 3: Search for similar recipes
// ============================================================================

export async function searchSimilarRecipes(searchQuery: string, limit = 10) {
  try {
    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(searchQuery);

    // Find similar recipes in database
    const similar = await findSimilarRecipes(
      queryEmbedding,
      limit,
      0.3 // Minimum 30% similarity
    );

    // Format results
    const results = similar.map((result: any) => ({
      recipeId: result.recipeId,
      recipeName: result.recipe_name,
      similarity: result.similarity,
      matchPercentage: Math.round(result.similarity * 100),
    }));

    console.log(`Found ${results.length} similar recipes for "${searchQuery}"`);
    results.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.recipeName} (${r.matchPercentage}% match)`);
    });

    return results;
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 4: Find and embed recipes that need embeddings
// ============================================================================

export async function generateMissingEmbeddings() {
  try {
    // Find recipes without embeddings
    const recipes = await getRecipesNeedingEmbedding();

    if (recipes.length === 0) {
      console.log('All recipes already have embeddings!');
      return;
    }

    console.log(`Found ${recipes.length} recipes needing embeddings`);

    // Process in batches of 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
      const batch = recipes.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

      await embedMultipleRecipes(batch as Recipe[]);

      // Add delay to avoid rate limiting
      if (i + BATCH_SIZE < recipes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('✓ All missing embeddings generated');
  } catch (error) {
    console.error('Failed to generate missing embeddings:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 5: Compare two recipes for similarity
// ============================================================================

export async function compareRecipes(recipeId1: string, recipeId2: string) {
  try {
    // Get embeddings from database
    const embedding1 = await getRecipeEmbedding(recipeId1);
    const embedding2 = await getRecipeEmbedding(recipeId2);

    if (!embedding1 || !embedding2) {
      throw new Error('One or both recipes do not have embeddings');
    }

    // Calculate similarity
    const similarity = cosineSimilarity(
      embedding1.embedding,
      embedding2.embedding
    );

    console.log(`Similarity between recipes: ${(similarity * 100).toFixed(1)}%`);

    if (similarity > 0.8) {
      console.log('→ Very similar recipes (possible duplicates)');
    } else if (similarity > 0.6) {
      console.log('→ Similar recipes (related)');
    } else if (similarity > 0.4) {
      console.log('→ Somewhat similar');
    } else {
      console.log('→ Not very similar');
    }

    return similarity;
  } catch (error) {
    console.error('Comparison failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 6: Build custom embedding text
// ============================================================================

export function customRecipeText(recipe: Recipe): string {
  // You can customize how recipe text is built
  const text = buildRecipeEmbeddingText(recipe);

  // Add custom fields or transformations
  // Example: add preparation time weight
  if (recipe.prep_time && recipe.prep_time < 30) {
    return `${text}. Quick recipe`;
  }

  return text;
}

// ============================================================================
// EXAMPLE 7: Semantic search API route
// ============================================================================

/**
 * Example API route implementation for semantic recipe search
 *
 * File: src/app/api/recipes/search/semantic/route.ts
 */
export async function semanticSearchAPIExample(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || query.trim().length === 0) {
      return Response.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const results = await searchSimilarRecipes(query, 20);

    return Response.json({
      query,
      results,
      count: results.length,
    });

  } catch (error: any) {
    console.error('Semantic search API error:', error);
    return Response.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXAMPLE 8: Background job for embedding generation
// ============================================================================

/**
 * Example background job that could be triggered by cron or webhook
 */
export async function backgroundEmbeddingJob() {
  console.log('Starting background embedding job...');

  try {
    // Find recipes needing embeddings
    const recipes = await getRecipesNeedingEmbedding();

    if (recipes.length === 0) {
      console.log('No recipes need embeddings');
      return { success: true, processed: 0 };
    }

    console.log(`Processing ${recipes.length} recipes...`);

    let processed = 0;
    let failed = 0;

    // Process with rate limiting
    for (const recipe of recipes) {
      try {
        await embedSingleRecipe(recipe as Recipe);
        processed++;

        // Log progress every 10 recipes
        if (processed % 10 === 0) {
          console.log(`Progress: ${processed}/${recipes.length}`);
        }

        // Rate limiting: 1 request per second
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to embed recipe ${recipe.id}:`, error);
        failed++;
      }
    }

    console.log(`✓ Job complete: ${processed} processed, ${failed} failed`);

    return {
      success: true,
      processed,
      failed,
      total: recipes.length,
    };

  } catch (error) {
    console.error('Background job failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// EXAMPLE 9: Recipe recommendation system
// ============================================================================

export async function getRecommendationsForRecipe(
  recipeId: string,
  limit = 5
) {
  try {
    // Get the recipe's embedding
    const embedding = await getRecipeEmbedding(recipeId);

    if (!embedding) {
      throw new Error('Recipe embedding not found');
    }

    // Find similar recipes (excluding the recipe itself)
    const similar = await findSimilarRecipes(
      embedding.embedding,
      limit + 1, // Get one extra in case the recipe itself is included
      0.5 // Higher threshold for recommendations
    );

    // Filter out the original recipe and format results
    const recommendations = similar
      .filter((r: any) => r.recipeId !== recipeId)
      .slice(0, limit)
      .map((r: any) => ({
        recipeId: r.recipeId,
        name: r.recipe_name,
        similarity: r.similarity,
        reason: getSimilarityReason(r.similarity),
      }));

    return recommendations;

  } catch (error) {
    console.error('Failed to get recommendations:', error);
    throw error;
  }
}

function getSimilarityReason(similarity: number): string {
  if (similarity > 0.8) return 'Very similar ingredients and cooking style';
  if (similarity > 0.7) return 'Similar cooking method and flavor profile';
  if (similarity > 0.6) return 'Related cuisine and ingredients';
  if (similarity > 0.5) return 'Similar category';
  return 'You might also like';
}
