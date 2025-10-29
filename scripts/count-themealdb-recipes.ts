#!/usr/bin/env tsx
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function countTheMealDBRecipes() {
  console.log('📊 TheMealDB Recipe Analysis\n');

  // Count recipes by source
  const bySource = await db.execute(sql`
    SELECT
      CASE
        WHEN source LIKE '%TheMealDB%' THEN 'TheMealDB'
        WHEN source LIKE '%epicurious%' THEN 'Epicurious'
        WHEN source LIKE '%seriouseats%' THEN 'Serious Eats'
        WHEN source LIKE '%tasty%' THEN 'Tasty'
        ELSE 'Other/Manual'
      END as source_type,
      COUNT(*) as count
    FROM recipes
    GROUP BY source_type
    ORDER BY count DESC
  `);

  console.log('Recipes by Source:\n');
  bySource.rows.forEach((row: any) => {
    console.log(`  ${row.source_type}: ${row.count}`);
  });

  // Sample TheMealDB recipe to confirm format
  const themealdbSample = await db.execute(sql`
    SELECT id, name, ingredients
    FROM recipes
    WHERE source LIKE '%TheMealDB%'
    LIMIT 5
  `);

  console.log('\n\nTheMealDB Sample Ingredient Formats:\n');
  themealdbSample.rows.forEach((recipe: any, i: number) => {
    try {
      const ingredients = JSON.parse(recipe.ingredients);
      const format = typeof ingredients[0];
      const isObjectFormat = format === 'object' && ingredients[0] !== null;

      console.log(`${i + 1}. ${recipe.name}`);
      console.log(`   Format: ${isObjectFormat ? 'Object {item, quantity}' : 'String array'}`);
      console.log(`   Sample: ${JSON.stringify(ingredients[0])}`);
      console.log('');
    } catch (_error) {
      console.log(`${i + 1}. ${recipe.name} - Parse Error`);
    }
  });

  process.exit(0);
}

countTheMealDBRecipes().catch(console.error);
