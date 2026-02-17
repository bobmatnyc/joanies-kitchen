#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function verifyRecipe() {
  const result = await sql`
    SELECT
      r.id, r.name, r.slug, r.chef_id, r.servings, r.prep_time, r.cook_time,
      r.difficulty, r.cuisine, r.is_public, r.is_system_recipe, r.license,
      r.source, r.system_rating, c.name as chef_name
    FROM recipes r
    LEFT JOIN chefs c ON r.chef_id = c.id
    WHERE r.slug = 'dan-barbers-braised-short-ribs'
  `;

  console.log('\n✅ Recipe Verification:\n');
  console.log(JSON.stringify(result[0], null, 2));

  console.log('\n📊 Chef Recipe Count:');
  const chefCount = await sql`
    SELECT name, slug, recipe_count
    FROM chefs
    WHERE id = '7ba1f4c2-cfef-45bf-a9e3-ee3f99df80ae'
  `;
  console.log(JSON.stringify(chefCount[0], null, 2));
}

verifyRecipe()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
