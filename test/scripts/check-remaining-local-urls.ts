#!/usr/bin/env tsx

/**
 * Check Remaining Local URLs
 *
 * Identifies ingredients that still have local URLs after migration.
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';

async function checkRemainingLocalUrls() {
  console.log('🔍 Checking Ingredients with Remaining Local URLs\n');

  try {
    // Get ingredients with local URLs
    const localUrlIngredients = await db
      .select({
        id: ingredients.id,
        name: ingredients.display_name,
        url: ingredients.image_url
      })
      .from(ingredients)
      .where(sql`${ingredients.image_url} LIKE '/images/%' OR ${ingredients.image_url} LIKE 'public/images/%'`)
      .orderBy(ingredients.display_name);

    console.log(`Found ${localUrlIngredients.length} ingredients with local URLs:\n`);

    localUrlIngredients.forEach((ing, idx) => {
      console.log(`${idx + 1}. ${ing.name}`);
      console.log(`   URL: ${ing.url}\n`);
    });

    // Analyze patterns
    const patterns = localUrlIngredients.reduce((acc, ing) => {
      const urlPath = ing.url || '';
      if (urlPath.includes('/sweeteners/')) acc.sweeteners++;
      else if (urlPath.includes('/spices/')) acc.spices++;
      else if (urlPath.includes('/vegetables/')) acc.vegetables++;
      else if (urlPath.includes('/fruits/')) acc.fruits++;
      else if (urlPath.includes('/proteins/')) acc.proteins++;
      else if (urlPath.includes('/dairy/')) acc.dairy++;
      else acc.other++;
      return acc;
    }, { sweeteners: 0, spices: 0, vegetables: 0, fruits: 0, proteins: 0, dairy: 0, other: 0 });

    console.log('📊 URL Pattern Analysis:');
    Object.entries(patterns).forEach(([category, count]) => {
      if (count > 0) console.log(`   ${category}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkRemainingLocalUrls();
