#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function displayRecipe() {
  const result = await sql`
    SELECT
      r.id, r.name, r.slug, r.description,
      r.ingredients, r.instructions, r.tags,
      r.prep_time, r.cook_time, r.servings, r.difficulty,
      r.cuisine, r.source, r.license, r.system_rating,
      c.name as chef_name, c.slug as chef_slug
    FROM recipes r
    LEFT JOIN chefs c ON r.chef_id = c.id
    WHERE r.slug = 'dan-barbers-braised-short-ribs'
  `;

  if (result.length === 0) {
    console.error('❌ Recipe not found!');
    return;
  }

  const recipe = result[0];
  const ingredients = JSON.parse(recipe.ingredients as string);
  const instructions = JSON.parse(recipe.instructions as string);
  const tags = JSON.parse(recipe.tags as string);

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🍖  ${recipe.name.toUpperCase()}`);
  console.log('═'.repeat(70));

  console.log(`\n👨‍🍳 Chef: ${recipe.chef_name}`);
  console.log(`📝 Attribution: ${recipe.source}`);
  console.log(`⭐ Rating: ${recipe.system_rating}/5.0`);

  console.log(`\n📊 RECIPE INFO`);
  console.log(`   Difficulty: ${recipe.difficulty.toUpperCase()}`);
  console.log(`   Cuisine: ${recipe.cuisine}`);
  console.log(`   Prep Time: ${recipe.prep_time} minutes`);
  console.log(
    `   Cook Time: ${recipe.cook_time} minutes (${Math.floor(recipe.cook_time / 60)} hours)`
  );
  console.log(`   Total Time: ${recipe.prep_time + recipe.cook_time} minutes`);
  console.log(`   Servings: ${recipe.servings}`);
  console.log(`   License: ${recipe.license}`);

  console.log(`\n📖 STORY`);
  console.log(`   ${recipe.description.replace(/\n/g, '\n   ')}`);

  console.log(`\n🥘 INGREDIENTS (${ingredients.length} items)`);
  ingredients.forEach((ing: string, idx: number) => {
    console.log(`   ${(idx + 1).toString().padStart(2)}. ${ing}`);
  });

  console.log(`\n👨‍🍳 INSTRUCTIONS (${instructions.length} steps)`);
  instructions.forEach((step: string, idx: number) => {
    console.log(`\n   STEP ${idx + 1}:`);
    const wrapped = step.match(/.{1,65}(\s|$)/g) || [step];
    wrapped.forEach((line) => console.log(`   ${line.trim()}`));
  });

  console.log(`\n🏷️  TAGS`);
  console.log(`   ${tags.join(' • ')}`);

  console.log(`\n🌐 URLS`);
  console.log(`   Recipe: /recipes/${recipe.slug}`);
  console.log(`   Chef: /chef/${recipe.chef_slug}`);

  console.log(`\n${'═'.repeat(70)}`);
  console.log('✅ Recipe successfully stored in database!\n');
}

displayRecipe()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
