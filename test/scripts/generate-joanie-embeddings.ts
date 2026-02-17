#!/usr/bin/env tsx

/**
 * Generate embeddings for Joanie's Sunday Lunch recipes
 *
 * This script generates embeddings for the 3 recipes we just created.
 */

import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { db } from '@/lib/db';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';
import { recipes } from '@/lib/db/schema';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RECIPE_NAMES = [
  'Resourceful Chickpea & Vegetable Soup',
  'Asian-Inspired Chicken & Cauliflower Rice Bowl',
  'Garden Green Salad with Dill Mustard Dressing',
];

async function main() {
  console.log("🔧 Generating embeddings for Joanie's Sunday Lunch recipes\n");

  for (const recipeName of RECIPE_NAMES) {
    try {
      console.log(`\nProcessing: ${recipeName}...`);

      // Find recipe by name
      const recipe = await db.query.recipes.findFirst({
        where: eq(recipes.name, recipeName),
      });

      if (!recipe) {
        console.error(`❌ Recipe not found: ${recipeName}`);
        continue;
      }

      console.log(`  Found recipe ID: ${recipe.id}`);

      // Generate embedding
      console.log('  Generating embedding...');
      const result = await generateRecipeEmbedding(recipe);

      // Save to database
      console.log('  Saving to database...');
      await saveRecipeEmbedding(
        recipe.id,
        result.embedding,
        result.embeddingText,
        result.modelName
      );

      console.log(`✅ Successfully generated embedding for: ${recipeName}`);
      console.log(`   Embedding dimension: ${result.embedding.length}`);
      console.log(`   Model: ${result.modelName}`);

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Failed to generate embedding for ${recipeName}:`);
      console.error(error);
    }
  }

  console.log('\n✅ Embedding generation complete!');
}

main();
