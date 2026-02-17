#!/usr/bin/env tsx

import { db } from '@/lib/db/index.js';
import { recipes } from '@/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function verifyFix() {
  console.log('Verifying Roasted Tomato Soup image fix...\n');

  const recipe = await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, 'roasted-tomato-soup'))
    .limit(1);

  if (recipe.length === 0) {
    console.log('Recipe not found!');
    process.exit(1);
  }

  const r = recipe[0];
  console.log('Recipe Details:');
  console.log('='.repeat(80));
  console.log(`ID: ${r.id}`);
  console.log(`Name: ${r.name}`);
  console.log(`Slug: ${r.slug}`);
  console.log(`Updated At: ${r.updatedAt}`);

  // Parse images if it's a string
  let images = r.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch (e) {
      console.log('Failed to parse images JSON');
    }
  }

  console.log(`\nImages (${images?.length || 0}):`);
  console.log(JSON.stringify(images, null, 2));

  console.log('\n' + '='.repeat(80));

  if (images && Array.isArray(images)) {
    const hasExampleDotCom = images.some((img) =>
      typeof img === 'string' && img.includes('example.com')
    );

    if (hasExampleDotCom) {
      console.log('STATUS: ❌ FAILED - Recipe still has example.com images');
      process.exit(1);
    } else {
      console.log('STATUS: ✅ SUCCESS - No broken images found');
      console.log('Fix is still in place!');
    }
  } else {
    console.log('STATUS: ⚠️  WARNING - No valid images array');
  }

  process.exit(0);
}

verifyFix().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
