#!/usr/bin/env node

/**
 * Query ingredients from database for image generation
 *
 * Usage:
 *   ts-node scripts/image-gen/query_ingredients.ts --limit 10
 *   ts-node scripts/image-gen/query_ingredients.ts --no-images
 *   ts-node scripts/image-gen/query_ingredients.ts --category vegetables
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { neon } from '@neondatabase/serverless';
// Load environment variables
import dotenv from 'dotenv';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { ingredients } from '@/lib/db/schema';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

const sql_client = neon(connectionString);
const db = drizzle(sql_client);

interface QueryOptions {
  limit?: number;
  noImages?: boolean;
  category?: string;
  outputFile?: string;
}

async function queryIngredients(options: QueryOptions = {}) {
  console.log('='.repeat(60));
  console.log('Ingredient Image Generation Query');
  console.log('='.repeat(60));
  console.log();

  const {
    limit = 10,
    noImages = false,
    category,
    outputFile = 'tmp/ingredient-batch.txt',
  } = options;

  // Build query conditions
  const conditions = [];

  if (noImages) {
    conditions.push(isNull(ingredients.image_url));
  }

  if (category) {
    conditions.push(eq(ingredients.category, category));
  }

  // Query ingredients
  console.log('Query parameters:');
  console.log(`  Limit: ${limit}`);
  console.log(`  No images only: ${noImages}`);
  console.log(`  Category filter: ${category || 'none'}`);
  console.log();

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select({
      id: ingredients.id,
      name: ingredients.display_name,
      slug: ingredients.slug,
      category: ingredients.category,
      image_url: ingredients.image_url,
      usage_count: sql<number>`COALESCE((
        SELECT COUNT(DISTINCT recipe_id)
        FROM recipe_ingredients
        WHERE ingredient_id = ${ingredients.id}
      ), 0)`.as('usage_count'),
    })
    .from(ingredients)
    .where(whereClause)
    .orderBy(desc(sql`usage_count`))
    .limit(limit);

  console.log(`✓ Found ${results.length} ingredients`);
  console.log();

  // Display results
  console.log('Top ingredients:');
  console.log('-'.repeat(60));

  results.forEach((ing, index) => {
    const hasImage = ing.image_url ? '✓' : '✗';
    console.log(`${index + 1}. ${ing.name}`);
    console.log(`   Category: ${ing.category || 'uncategorized'}`);
    console.log(`   Used in: ${ing.usage_count} recipes`);
    console.log(`   Has image: ${hasImage} ${ing.image_url || ''}`);
    console.log();
  });

  // Write to batch file
  const outputPath = path.resolve(process.cwd(), outputFile);
  const outputDir = path.dirname(outputPath);

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const batchContent = results.map((ing) => ing.name).join('\n');
  fs.writeFileSync(outputPath, batchContent, 'utf-8');

  console.log('='.repeat(60));
  console.log('✓ Batch file created!');
  console.log('='.repeat(60));
  console.log();
  console.log(`Output file: ${outputPath}`);
  console.log(`Ingredients: ${results.length}`);
  console.log();
  console.log('Next steps:');
  console.log();
  console.log('1. Review the ingredient list:');
  console.log(`   cat ${outputFile}`);
  console.log();
  console.log('2. Generate images:');
  console.log(`   make image-batch FILE=${outputFile}`);
  console.log();
  console.log('   Or directly:');
  console.log(`   source venv-image-gen/bin/activate`);
  console.log(`   python scripts/image-gen/recipe_image_generator.py \\`);
  console.log(`     --batch ${outputFile} \\`);
  console.log(`     --output-dir tmp/ingredient-images`);
  console.log();

  return results;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: QueryOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--no-images') {
      options.noImages = true;
    } else if (arg === '--category' && args[i + 1]) {
      options.category = args[i + 1];
      i++;
    } else if (arg === '--output' && args[i + 1]) {
      options.outputFile = args[i + 1];
      i++;
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    await queryIngredients(options);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
