#!/usr/bin/env tsx
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';

async function getUserIds() {
  const users = await db
    .select({
      user_id: recipes.user_id,
      count: sql<number>`count(*)::int`,
    })
    .from(recipes)
    .groupBy(recipes.user_id)
    .limit(10);

  console.log('User IDs in database:');
  users.forEach((u) => console.log(`${u.user_id}: ${u.count} recipes`));
}

getUserIds()
  .then(() => process.exit(0))
  .catch(console.error);
