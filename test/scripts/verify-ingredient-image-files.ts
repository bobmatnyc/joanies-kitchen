#!/usr/bin/env tsx
/**
 * Verify that ingredient image URLs in database point to actual files
 */

import { db } from '@/lib/db/index.js';
import { ingredients } from '@/lib/db/ingredients-schema.js';
import { existsSync } from 'fs';
import { join } from 'path';

async function verifyImageFiles() {
  const allIngredients = await db.select({
    id: ingredients.id,
    name: ingredients.name,
    display_name: ingredients.display_name,
    image_url: ingredients.image_url
  }).from(ingredients).limit(100); // Sample first 100

  let missing = 0;
  let found = 0;

  console.log('\n🔍 Verifying ingredient image files (first 100):\n');

  for (const ingredient of allIngredients) {
    if (ingredient.image_url) {
      // Convert URL to file path
      const filePath = join(process.cwd(), 'public', ingredient.image_url);

      if (!existsSync(filePath)) {
        console.log(`❌ Missing: ${ingredient.display_name} → ${ingredient.image_url}`);
        missing++;
      } else {
        found++;
      }
    }
  }

  console.log(`\n📊 Summary (first 100):`);
  console.log(`   Found: ${found}`);
  console.log(`   Missing: ${missing}`);
  console.log(`   Missing rate: ${((missing / allIngredients.length) * 100).toFixed(1)}%\n`);

  process.exit(0);
}

verifyImageFiles().catch(console.error);
