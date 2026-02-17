#!/usr/bin/env tsx
/**
 * Check specific Angel Hair variants
 */

import { db } from './db-with-transactions';
import { ingredients } from '@/lib/db/ingredients-schema';
import { sql, like, or } from 'drizzle-orm';

async function checkAngelHair() {
  console.log('🔍 Checking Angel Hair variants\n');

  // Find all ingredients containing "angel hair"
  const angelHairVariants = await db
    .select({
      name: ingredients.name,
      display_name: ingredients.display_name,
      usage_count: ingredients.usage_count,
      id: ingredients.id,
      category: ingredients.category,
      slug: ingredients.slug,
    })
    .from(ingredients)
    .where(sql`LOWER(${ingredients.name}) LIKE '%angel%hair%'`)
    .orderBy(sql`${ingredients.usage_count} DESC`);

  console.log(`Found ${angelHairVariants.length} Angel Hair variants:\n`);

  angelHairVariants.forEach((ing, idx) => {
    console.log(`${idx + 1}. name: "${ing.name}"`);
    console.log(`   display_name: "${ing.display_name}"`);
    console.log(`   slug: "${ing.slug}"`);
    console.log(`   usage_count: ${ing.usage_count}`);
    console.log(`   category: ${ing.category}`);
    console.log(`   id: ${ing.id}`);
    console.log();
  });

  // Check normalization
  console.log('\nNormalization test:');
  angelHairVariants.forEach((ing) => {
    const normalized = ing.name
      .toLowerCase()
      .replace(/[-_\s]/g, '')
      .replace(/[''`]/g, '');
    console.log(`"${ing.name}" → "${normalized}"`);
  });

  process.exit(0);
}

checkAngelHair().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
