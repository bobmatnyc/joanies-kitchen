#!/usr/bin/env tsx
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

const RECIPE_SLUG = 'pomegranate-peach-barbecue-sauce';

async function verify() {
  const [recipe] = await db
    .select({
      name: recipes.name,
      slug: recipes.slug,
      images: recipes.images,
      image_url: recipes.image_url,
    })
    .from(recipes)
    .where(eq(recipes.slug, RECIPE_SLUG))
    .limit(1);

  if (!recipe) {
    console.error('Recipe not found');
    process.exit(1);
  }

  console.log('\n✓ Recipe found:', recipe.name);
  console.log('\nImages:');
  console.log(recipe.images);
  console.log('\nImage URL (deprecated field):');
  console.log(recipe.image_url);
  console.log('\nParsed images array:');
  const images = JSON.parse(recipe.images || '[]');
  images.forEach((img: string, i: number) => {
    console.log(`  [${i}] ${img}`);
  });

  process.exit(0);
}

verify();
