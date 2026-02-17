#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

async function verifyChefs() {
  const targetChefs = [
    'alton-brown',
    'bren-smith',
    'cristina-scarpaleggia',
    'dan-barber',
    'david-zilber',
    'ina-garten',
    'jeremy-fox',
    'kirsten-christopher-shockey',
    'tamar-adler',
    'nik-sharma'
  ];

  console.log('=== VERIFYING CHEF RECIPES ===\n');

  for (const slug of targetChefs) {
    const chef = await db.select().from(chefs).where(eq(chefs.slug, slug)).limit(1);

    if (chef.length === 0) {
      console.log(`❌ ${slug}: CHEF NOT FOUND`);
      continue;
    }

    const chefData = chef[0];
    const actualRecipes = await db.execute(
      sql`SELECT COUNT(*) as count FROM recipes WHERE chef_id = ${chefData.id}`
    );

    const actual = actualRecipes.rows[0].count;
    const stored = chefData.recipe_count || 0;

    if (actual !== stored) {
      console.log(`⚠️ ${slug}: recipe_count=${stored}, actual=${actual} (MISMATCH!)`);
    } else if (actual === 0) {
      console.log(`❌ ${slug}: No recipes (${actual})`);
    } else {
      console.log(`✓ ${slug}: ${actual} recipes`);
    }
  }
}

verifyChefs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
