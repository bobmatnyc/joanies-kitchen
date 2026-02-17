#!/usr/bin/env tsx

/**
 * Import Serious Eats Top 50 recipes into database
 *
 * Reads transformed JSON from Python scraper and inserts into recipes table
 *
 * Usage:
 *   npx tsx scripts/import-serious-eats-recipes.ts
 *
 * Prerequisites:
 *   - Python scraper has run successfully
 *   - data/recipes/incoming/serious-eats/top50-transformed.json exists
 *   - Database connection configured in .env.local
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

const TRANSFORMED_FILE = resolve(
  process.cwd(),
  'data/recipes/incoming/serious-eats/top50-transformed.json'
);

interface TransformedRecipe {
  id: string;
  user_id: string;
  chef_id: string | null;
  name: string;
  description: string | null;
  ingredients: string; // JSON string
  instructions: string;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  cuisine: string | null;
  tags: string; // JSON string
  image_url: string | null;
  images: string; // JSON string
  is_ai_generated: boolean;
  is_public: boolean;
  is_system_recipe: boolean;
  nutrition_info: string | null;
  model_used: string | null;
  source: string;
  created_at?: string;
  updated_at?: string;
  _metadata?: any;
  _validation_issues?: string[];
}

async function main() {
  console.log('='.repeat(70));
  console.log('IMPORTING SERIOUS EATS TOP 50 RECIPES');
  console.log('='.repeat(70));

  // Load transformed recipes
  console.log(`\nReading from: ${TRANSFORMED_FILE}`);
  let transformedRecipes: TransformedRecipe[];

  try {
    const fileContent = readFileSync(TRANSFORMED_FILE, 'utf-8');
    transformedRecipes = JSON.parse(fileContent);
    console.log(`✅ Loaded ${transformedRecipes.length} recipes`);
  } catch (error) {
    console.error(`❌ Failed to read transformed recipes file:`);
    console.error(error);
    console.log('\n💡 Run the Python scraper first:');
    console.log('   python scripts/ingest-serious-eats-top50.py');
    process.exit(1);
  }

  // Validate recipes
  console.log('\n📊 Validating recipes...');
  const recipesWithIssues = transformedRecipes.filter(
    (r) => r._validation_issues && r._validation_issues.length > 0
  );

  if (recipesWithIssues.length > 0) {
    console.log(`\n⚠️  ${recipesWithIssues.length} recipes have validation issues:`);
    recipesWithIssues.forEach((r) => {
      console.log(`   - ${r.name}: ${r._validation_issues?.join(', ')}`);
    });
    console.log('\nContinuing with import (issues logged)...');
  }

  // Prepare for database insertion
  const dbRecords = transformedRecipes.map((recipe) => {
    // Remove metadata fields (not in schema) and timestamp fields (database handles these)
    const {
      _metadata,
      _validation_issues,
      created_at,
      updated_at,
      discovery_date,
      published_date,
      ...dbRecord
    } = recipe as any;

    // Database will handle timestamps automatically
    // discovery_date and published_date are set by the database or can be null
    return dbRecord;
  });

  console.log(`\n📥 Inserting ${dbRecords.length} recipes into database...`);

  try {
    // Insert in batches of 10 to avoid overwhelming the database
    const BATCH_SIZE = 10;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < dbRecords.length; i += BATCH_SIZE) {
      const batch = dbRecords.slice(i, i + BATCH_SIZE);

      try {
        await db.insert(recipes).values(batch);
        inserted += batch.length;
        console.log(
          `   ✅ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${inserted}/${dbRecords.length})`
        );
      } catch (error: any) {
        errors += batch.length;
        console.error(`   ❌ Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`);
        console.error(`      ${error.message}`);

        // Try inserting individually to identify problematic recipe
        for (const recipe of batch) {
          try {
            await db.insert(recipes).values([recipe]);
            inserted++;
            console.log(`      ✅ Inserted: ${recipe.name}`);
          } catch (recipeError: any) {
            errors++;
            console.error(`      ❌ Failed: ${recipe.name}`);
            console.error(`         ${recipeError.message}`);
          }
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n✅ Successfully inserted: ${inserted}/${dbRecords.length}`);

    if (errors > 0) {
      console.log(`❌ Failed to insert: ${errors}/${dbRecords.length}`);
    }

    // Statistics
    console.log('\n📊 Recipe Statistics:');
    console.log(
      `   - With images: ${
        dbRecords.filter((r) => {
          try {
            const imgs = JSON.parse(r.images);
            return imgs && imgs.length > 0;
          } catch {
            return false;
          }
        }).length
      }`
    );
    console.log(`   - With prep time: ${dbRecords.filter((r) => r.prep_time).length}`);
    console.log(`   - With cook time: ${dbRecords.filter((r) => r.cook_time).length}`);
    console.log(`   - With servings: ${dbRecords.filter((r) => r.servings).length}`);

    // Category breakdown
    const categoryCount = new Map<string, number>();
    transformedRecipes.forEach((r) => {
      const category = r._metadata?.category || 'Unknown';
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    });

    console.log('\n📋 By Category:');
    Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`   - ${category}: ${count}`);
      });

    // Author breakdown
    const authorCount = new Map<string, number>();
    transformedRecipes.forEach((r) => {
      const author = r._metadata?.author || 'Unknown';
      authorCount.set(author, (authorCount.get(author) || 0) + 1);
    });

    console.log('\n👨‍🍳 By Author:');
    Array.from(authorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([author, count]) => {
        console.log(`   - ${author}: ${count}`);
      });

    console.log('\n✅ Import complete!');
    console.log('\n📍 Next steps:');
    console.log('   1. Verify recipes in database: pnpm db:studio');
    console.log('   2. Filter by is_system_recipe = true');
    console.log('   3. Check recipe images and data quality');
    console.log('   4. Test recipe display on /discover page');

    process.exit(inserted === dbRecords.length ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Database import failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
