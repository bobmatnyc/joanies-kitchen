#!/usr/bin/env tsx
/**
 * Export ingredient names that still use Unsplash URLs
 * Creates a batch file for Stable Diffusion generation
 */

import { db } from '../src/lib/db/index.js';
import { ingredients } from '../src/lib/db/ingredients-schema.js';
import { like } from 'drizzle-orm';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

async function exportUnsplashIngredients() {
  console.log('\n📋 Exporting Ingredients Using Unsplash URLs\n');
  console.log('='.repeat(70));

  // Get all ingredients still using Unsplash URLs
  const unsplashIngredients = await db
    .select({
      name: ingredients.name,
      display_name: ingredients.display_name
    })
    .from(ingredients)
    .where(like(ingredients.image_url, 'https://images.unsplash.com%'))
    .orderBy(ingredients.name);

  console.log(`\nFound ${unsplashIngredients.length} ingredients using Unsplash\n`);

  // Create batch file with ingredient names
  const outputPath = 'tmp/unsplash-ingredients-batch.txt';
  const ingredientNames = unsplashIngredients.map(ing => ing.name).join('\n');

  // Ensure directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  writeFileSync(outputPath, ingredientNames, 'utf-8');

  console.log(`✓ Exported to: ${outputPath}`);
  console.log(`  Total ingredients: ${unsplashIngredients.length}`);
  console.log(`  Format: One ingredient name per line\n`);

  // Show first 20 for preview
  console.log('First 20 ingredients:');
  console.log('-'.repeat(70));
  unsplashIngredients.slice(0, 20).forEach((ing, idx) => {
    console.log(`${(idx + 1).toString().padStart(3)}. ${ing.display_name}`);
  });

  if (unsplashIngredients.length > 20) {
    console.log(`... and ${unsplashIngredients.length - 20} more\n`);
  }

  process.exit(0);
}

exportUnsplashIngredients().catch((error) => {
  console.error('Error exporting ingredients:', error);
  process.exit(1);
});
