import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

async function checkVivianLiRecipes() {
  console.log('🔍 Checking Vivian Li Recipes and Images\n');

  // Get chef info
  const chefResult = await db.execute(sql`
    SELECT id, name, display_name, slug, profile_image_url
    FROM chefs
    WHERE slug = 'vivian-li'
  `);

  if (chefResult.rows.length === 0) {
    console.log('❌ Chef not found with slug: vivian-li');
    process.exit(1);
  }

  const chef = chefResult.rows[0] as any;
  console.log('=== CHEF INFO ===');
  console.log('ID:', chef.id);
  console.log('Name:', chef.name);
  console.log('Display Name:', chef.display_name);
  console.log('Slug:', chef.slug);
  console.log('Profile Image:', chef.profile_image_url || 'NULL');
  console.log('');

  // Get recipes for this chef
  const recipesResult = await db.execute(sql`
    SELECT
      id,
      name,
      slug,
      image_url,
      images,
      is_public,
      is_ai_generated,
      created_at
    FROM recipes
    WHERE chef_id = ${chef.id}
    ORDER BY created_at DESC
  `);

  console.log('=== RECIPES ===');
  console.log('Total recipes:', recipesResult.rows.length);
  console.log('');

  recipesResult.rows.forEach((recipe: any, index) => {
    console.log(`--- Recipe ${index + 1}: ${recipe.name} ---`);
    console.log('ID:', recipe.id);
    console.log('Slug:', recipe.slug || 'NULL');
    console.log('image_url:', recipe.image_url || 'NULL');
    console.log('images field:', recipe.images || 'NULL');
    console.log('is_public:', recipe.is_public);
    console.log('is_ai_generated:', recipe.is_ai_generated);
    console.log('created_at:', recipe.created_at);
    console.log('');
  });

  // Summary
  const withImageUrl = recipesResult.rows.filter((r: any) => r.image_url).length;
  const withImagesArray = recipesResult.rows.filter(
    (r: any) => r.images && r.images !== '[]'
  ).length;
  const publicRecipes = recipesResult.rows.filter((r: any) => r.is_public).length;

  console.log('=== SUMMARY ===');
  console.log('Recipes with image_url:', withImageUrl);
  console.log('Recipes with images array:', withImagesArray);
  console.log('Public recipes:', publicRecipes);
  console.log('Private recipes:', recipesResult.rows.length - publicRecipes);

  process.exit(0);
}

checkVivianLiRecipes().catch(console.error);
