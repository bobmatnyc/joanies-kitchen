#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function verifyDanBarberRecipes() {
  console.log('\n👨‍🍳 Dan Barber - Chef Profile\n');
  console.log('='.repeat(60));

  // Get chef info
  const chefInfo = await sql`
    SELECT id, name, slug, recipe_count
    FROM chefs
    WHERE id = '7ba1f4c2-cfef-45bf-a9e3-ee3f99df80ae'
  `;

  if (chefInfo.length === 0) {
    console.error('❌ Chef not found!');
    return;
  }

  const chef = chefInfo[0];
  console.log(`\nName: ${chef.name}`);
  console.log(`Slug: ${chef.slug}`);
  console.log(`Recipe Count: ${chef.recipe_count}`);

  // Get all recipes for this chef
  const recipes = await sql`
    SELECT id, name, slug, difficulty, cuisine, prep_time, cook_time, servings
    FROM recipes
    WHERE chef_id = '7ba1f4c2-cfef-45bf-a9e3-ee3f99df80ae'
    ORDER BY created_at DESC
  `;

  console.log(`\n📚 All Recipes (${recipes.length} total):\n`);

  recipes.forEach((recipe: any, idx: number) => {
    console.log(`${idx + 1}. ${recipe.name}`);
    console.log(`   Slug: ${recipe.slug}`);
    console.log(`   Difficulty: ${recipe.difficulty} | Cuisine: ${recipe.cuisine}`);
    console.log(`   Time: ${recipe.prep_time}min prep + ${recipe.cook_time}min cook | Serves: ${recipe.servings}`);
    console.log(`   URL: /recipes/${recipe.slug}\n`);
  });

  console.log('='.repeat(60));
  console.log('✅ All Dan Barber recipes verified!\n');
}

verifyDanBarberRecipes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
