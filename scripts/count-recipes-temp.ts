import { count } from 'drizzle-orm';
import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';

async function countRecipes() {
  const result = await db.select({ count: count() }).from(recipes);
  console.log(result[0].count);
  process.exit(0);
}

countRecipes();
