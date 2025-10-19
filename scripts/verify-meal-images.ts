#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('\n📸 Verifying Generated Images');
  console.log('═'.repeat(80));

  const recipesToCheck = [
    'Mozzarella-Topped Peppers with Tomatoes and Garlic',
    'Bibimbap',
    'Spinach Noodle Casserole',
    'Asian Pear and Watercress Salad with Sesame Dressing',
  ];

  for (const recipeName of recipesToCheck) {
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.name, recipeName.trim()))
      .limit(1);

    if (recipe) {
      console.log(`\n✓ ${recipe.name}`);

      if (recipe.images) {
        try {
          const images = JSON.parse(recipe.images);
          console.log(`  Images (${images.length}):`);
          images.forEach((url: string, i: number) => {
            console.log(`    ${i + 1}. ${url}`);
          });
        } catch (e) {
          console.log(`  ⚠️  Error parsing images: ${e}`);
        }
      } else {
        console.log(`  ⚠️  No images field`);
      }
    } else {
      console.log(`\n✗ ${recipeName} - NOT FOUND`);
    }
  }

  console.log('\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
