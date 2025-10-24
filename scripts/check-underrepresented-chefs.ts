import { db } from '../src/lib/db/index.js';
import { chefs, recipes } from '../src/lib/db/schema.js';
import { sql, eq } from 'drizzle-orm';

async function checkUnderrepresentedChefs() {
  const result = await db
    .select({
      slug: chefs.slug,
      name: chefs.name,
      recipeCount: sql<number>`count(${recipes.id})`.as('recipe_count')
    })
    .from(chefs)
    .leftJoin(recipes, eq(chefs.id, recipes.chef_id))
    .groupBy(chefs.id, chefs.slug, chefs.name)
    .orderBy(sql`count(${recipes.id}) ASC`)
    .limit(30);

  console.log('\n📊 Chefs with fewest recipes (underrepresented):');
  console.log('='.repeat(60));
  result.forEach((chef, i) => {
    const count = Number(chef.recipeCount);
    console.log(`${(i+1).toString().padStart(2, '0')}. ${chef.name.padEnd(35, ' ')} | ${count.toString().padStart(3, ' ')} recipes`);
  });
  console.log('='.repeat(60));

  process.exit(0);
}

checkUnderrepresentedChefs();
