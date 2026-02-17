import { count } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';
import { recipes } from '@/lib/db/schema.js';

async function countRecipes() {
  const result = await db.select({ count: count() }).from(recipes);
  console.log(result[0].count);
  process.exit(0);
}

countRecipes();
