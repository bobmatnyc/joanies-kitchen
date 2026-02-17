#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function analyzeFormats() {
  console.log('🔍 Recipe Format Analysis\n');
  console.log('=' .repeat(80) + '\n');

  // Get sample recipes from different sources
  const samples = await db.execute(sql`
    SELECT id, name, source, ingredients
    FROM recipes
    WHERE ingredients IS NOT NULL
    AND ingredients != ''
    ORDER BY RANDOM()
    LIMIT 20
  `);

  const formats: Record<string, number> = {
    'Array of Objects (TheMealDB)': 0,
    'Array of Strings (Tasty/Epicurious)': 0,
    'Malformed/Other': 0,
  };

  const examplesByFormat: Record<string, any[]> = {
    'Array of Objects (TheMealDB)': [],
    'Array of Strings (Tasty/Epicurious)': [],
    'Malformed/Other': [],
  };

  samples.rows.forEach((recipe: any) => {
    try {
      const ingredients = JSON.parse(recipe.ingredients);

      if (Array.isArray(ingredients)) {
        if (ingredients.length > 0) {
          const first = ingredients[0];

          if (typeof first === 'object' && first !== null) {
            // TheMealDB format: {item: "", quantity: ""}
            formats['Array of Objects (TheMealDB)']++;
            if (examplesByFormat['Array of Objects (TheMealDB)'].length < 3) {
              examplesByFormat['Array of Objects (TheMealDB)'].push({
                name: recipe.name,
                source: recipe.source,
                sample: ingredients.slice(0, 3),
              });
            }
          } else if (typeof first === 'string') {
            // Standard format: ["2 cups flour", "1 cup sugar"]
            formats['Array of Strings (Tasty/Epicurious)']++;
            if (examplesByFormat['Array of Strings (Tasty/Epicurious)'].length < 3) {
              examplesByFormat['Array of Strings (Tasty/Epicurious)'].push({
                name: recipe.name,
                source: recipe.source,
                sample: ingredients.slice(0, 3),
              });
            }
          }
        }
      } else {
        formats['Malformed/Other']++;
        if (examplesByFormat['Malformed/Other'].length < 3) {
          examplesByFormat['Malformed/Other'].push({
            name: recipe.name,
            source: recipe.source,
            sample: recipe.ingredients.substring(0, 200),
          });
        }
      }
    } catch (error) {
      formats['Malformed/Other']++;
      if (examplesByFormat['Malformed/Other'].length < 3) {
        examplesByFormat['Malformed/Other'].push({
          name: recipe.name,
          source: recipe.source,
          error: 'JSON parse error',
          sample: recipe.ingredients.substring(0, 200),
        });
      }
    }
  });

  console.log('📊 Format Distribution:\n');
  Object.entries(formats).forEach(([format, count]) => {
    console.log(`  ${format}: ${count} recipes`);
  });

  console.log('\n\n📝 Example Data by Format:\n');

  Object.entries(examplesByFormat).forEach(([format, examples]) => {
    if (examples.length > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`${format}`);
      console.log('='.repeat(80));

      examples.forEach((example, i) => {
        console.log(`\n${i + 1}. ${example.name}`);
        console.log(`   Source: ${example.source || 'N/A'}`);
        console.log(`   Data:`);
        if (example.sample) {
          console.log(JSON.stringify(example.sample, null, 4));
        }
        if (example.error) {
          console.log(`   Error: ${example.error}`);
        }
      });
    }
  });

  // Check if extraction script handles both formats
  console.log('\n\n🔧 Extraction Script Analysis:\n');
  console.log('Checking how extraction script handles different formats...\n');

  // Check TheMealDB format handling
  const themealdbSample = await db.execute(sql`
    SELECT id, name, ingredients
    FROM recipes
    WHERE source LIKE '%TheMealDB%'
    LIMIT 1
  `);

  if (themealdbSample.rows.length > 0) {
    const recipe = themealdbSample.rows[0] as any;
    const ingredients = JSON.parse(recipe.ingredients);

    console.log('TheMealDB Recipe Sample:');
    console.log(`Name: ${recipe.name}`);
    console.log(`Ingredient Format: ${JSON.stringify(ingredients[0])}`);
    console.log('');
    console.log('⚠️  ISSUE: TheMealDB uses {item, quantity} format');
    console.log('   Current script expects: Array of strings');
    console.log('   This format needs conversion BEFORE LLM extraction');
  }

  process.exit(0);
}

analyzeFormats().catch(console.error);
