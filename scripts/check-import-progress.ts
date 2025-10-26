#!/usr/bin/env tsx
import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkProgress() {
  const totalRecipes = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipes);

  const recentRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      source: recipes.source,
      created_at: recipes.created_at,
    })
    .from(recipes)
    .orderBy(sql`${recipes.created_at} DESC`)
    .limit(10);

  console.log(`\n📊 Total recipes in database: ${totalRecipes[0].count}`);
  console.log(`\n✅ Most recent 10 imports:`);
  console.log('─'.repeat(80));

  recentRecipes.forEach((r, i) => {
    const url = new URL(r.source || '');
    const domain = url.hostname;
    console.log(`${i + 1}. ${r.name}`);
    console.log(`   ${domain}`);
    console.log(`   ${r.created_at?.toLocaleString()}`);
  });

  console.log('─'.repeat(80));
}

checkProgress().catch(console.error);
