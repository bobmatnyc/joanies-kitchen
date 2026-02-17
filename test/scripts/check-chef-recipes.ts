import { db } from '@/lib/db/index.js';
import { chefs, recipes } from '@/lib/db/schema.js';
import { sql, eq, isNull } from 'drizzle-orm';

async function checkChefRecipes() {
  console.log('🔍 Analyzing Chef-Recipe Assignments\n');

  // Get all chefs
  const allChefs = await db.select().from(chefs);
  console.log(`📊 Total Chefs: ${allChefs.length}\n`);

  // Get recipes with chef assignments
  const recipesWithChefs = await db
    .select({
      chefId: recipes.chef_id,
      count: sql<number>`count(*)::int`,
    })
    .from(recipes)
    .where(sql`${recipes.chef_id} IS NOT NULL`)
    .groupBy(recipes.chef_id);

  // Get recipes without chef assignments
  const recipesWithoutChef = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(recipes)
    .where(isNull(recipes.chef_id));

  console.log('📋 Chef Assignment Summary:');
  console.log('─'.repeat(60));

  // Create a map of chef assignments
  const chefRecipeMap = new Map(
    recipesWithChefs.map(r => [r.chefId, r.count])
  );

  // Check each chef
  for (const chef of allChefs) {
    const recipeCount = chefRecipeMap.get(chef.id) || 0;
    const status = recipeCount > 0 ? '✅' : '❌';
    console.log(`${status} ${chef.name.padEnd(30)} ${recipeCount.toString().padStart(5)} recipes`);
  }

  console.log('─'.repeat(60));
  console.log(`❌ Recipes without chef: ${recipesWithoutChef[0]?.count || 0}\n`);

  // Get chefs with no recipes
  const chefsWithoutRecipes = allChefs.filter(
    chef => !chefRecipeMap.has(chef.id)
  );

  if (chefsWithoutRecipes.length > 0) {
    console.log('\n🚨 Chefs Needing Recipe Assignments:');
    console.log('─'.repeat(60));
    for (const chef of chefsWithoutRecipes) {
      console.log(`   • ${chef.name} (ID: ${chef.id})`);
    }
  }

  process.exit(0);
}

checkChefRecipes().catch(console.error);
