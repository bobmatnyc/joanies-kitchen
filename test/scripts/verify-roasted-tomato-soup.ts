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
  console.log(`\nImages (${r.images?.length || 0}):`);

  if (r.images && r.images.length > 0) {
    r.images.forEach((img, idx) => {
      console.log(`  ${idx + 1}. ${img}`);

      // Check if it's a valid URL
      if (img.includes('example.com')) {
        console.log('     ❌ BROKEN - Contains example.com');
      } else if (img.includes('vercel-storage.com')) {
        console.log('     ✅ VALID - Vercel Blob storage');
      } else if (img.startsWith('http')) {
        console.log('     ⚠️  WARNING - External URL');
      } else {
        console.log('     ❌ INVALID - Not a URL');
      }
    });
  } else {
    console.log('  No images found');
  }

  console.log('\n' + '='.repeat(80));

  const hasExampleDotCom = r.images?.some((img) => img.includes('example.com'));
  if (hasExampleDotCom) {
    console.log('STATUS: ❌ FAILED - Recipe still has example.com images');
    process.exit(1);
  } else {
    console.log('STATUS: ✅ SUCCESS - No broken images found');
    console.log('Fix is still in place!');
  }

  process.exit(0);
}

verifyFix().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
