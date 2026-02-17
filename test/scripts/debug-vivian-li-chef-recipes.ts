import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

async function checkVivianLiChefRecipes() {
  console.log('🔍 Checking Vivian Li Chef-Recipe Associations\n');

  // Get chef info
  const chefResult = await db.execute(sql`
    SELECT id, name, display_name, slug
    FROM chefs
    WHERE slug = 'vivian-li'
  `);

  if (chefResult.rows.length === 0) {
    console.log('❌ Chef not found with slug: vivian-li');
    process.exit(1);
  }

  const chef = chefResult.rows[0] as any;
  console.log('=== CHEF INFO ===');
  console.log('Chef ID:', chef.id);
  console.log('Name:', chef.name);
  console.log('');

  // Check chef_recipes junction table
  const chefRecipesResult = await db.execute(sql`
    SELECT
      cr.chef_id,
      cr.recipe_id,
      r.name as recipe_name,
      r.chef_id as recipe_chef_id
    FROM chef_recipes cr
    LEFT JOIN recipes r ON cr.recipe_id = r.id
    WHERE cr.chef_id = ${chef.id}
  `);

  console.log('=== CHEF_RECIPES TABLE ===');
  console.log('Entries in chef_recipes table:', chefRecipesResult.rows.length);
  chefRecipesResult.rows.forEach((row: any) => {
    console.log('- Recipe:', row.recipe_name);
    console.log('  recipe_id:', row.recipe_id);
    console.log('  chef_id in chef_recipes:', row.chef_id);
    console.log('  chef_id in recipes table:', row.recipe_chef_id);
    console.log('');
  });

  // Check recipes table directly
  const recipesResult = await db.execute(sql`
    SELECT
      id,
      name,
      chef_id,
      is_public
    FROM recipes
    WHERE chef_id = ${chef.id}
  `);

  console.log('=== RECIPES TABLE (chef_id column) ===');
  console.log('Recipes with chef_id =', chef.id, ':', recipesResult.rows.length);
  recipesResult.rows.forEach((row: any) => {
    console.log('- Recipe:', row.name);
    console.log('  id:', row.id);
    console.log('  chef_id:', row.chef_id);
    console.log('  is_public:', row.is_public);
    console.log('');
  });

  process.exit(0);
}

checkVivianLiChefRecipes().catch(console.error);
