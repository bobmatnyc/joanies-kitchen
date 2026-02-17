import { db } from '@/lib/db';
import { recipes, recipeIngredients, ingredients } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

async function analyzeIngredientRelationships() {
  console.log('🔗 Analyzing recipe-ingredient relationships...\n');

  // Get count of recipes with normalized ingredients
  const recipesWithNormalizedIngredients = await db
    .select({
      recipe_count: sql<number>`COUNT(DISTINCT ${recipeIngredients.recipe_id})`,
    })
    .from(recipeIngredients);

  console.log(
    `📊 Recipes with normalized ingredients in recipeIngredients table: ${recipesWithNormalizedIngredients[0].recipe_count}`
  );

  // Get total recipe count
  const totalRecipes = await db.select({ count: sql<number>`count(*)` }).from(recipes);
  console.log(`📊 Total recipes in database: ${totalRecipes[0].count}`);

  const coverage =
    (Number(recipesWithNormalizedIngredients[0].recipe_count) / Number(totalRecipes[0].count)) * 100;
  console.log(`📊 Coverage: ${coverage.toFixed(2)}%\n`);

  // Get a sample recipe with both formats
  console.log('📋 Sample recipe with both JSON and normalized ingredients:\n');

  const sampleRecipeWithIngredients = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ingredients_json: recipes.ingredients,
    })
    .from(recipes)
    .innerJoin(recipeIngredients, eq(recipes.id, recipeIngredients.recipe_id))
    .limit(1);

  if (sampleRecipeWithIngredients.length > 0) {
    const recipeId = sampleRecipeWithIngredients[0].id;
    console.log(`Recipe: ${sampleRecipeWithIngredients[0].name}`);
    console.log(`ID: ${recipeId}\n`);

    // Get JSON ingredients
    console.log('🥗 JSON Ingredients (from recipes.ingredients field):');
    try {
      const jsonIngredients = JSON.parse(sampleRecipeWithIngredients[0].ingredients_json);
      jsonIngredients.slice(0, 5).forEach((ing: string, idx: number) => {
        console.log(`  ${idx + 1}. ${ing}`);
      });
      if (jsonIngredients.length > 5) {
        console.log(`  ... and ${jsonIngredients.length - 5} more`);
      }
    } catch (e) {
      console.log(`  ❌ Error parsing: ${e}`);
    }

    // Get normalized ingredients
    console.log('\n🥗 Normalized Ingredients (from recipeIngredients + ingredients tables):');
    const normalizedIngredients = await db
      .select({
        amount: recipeIngredients.amount,
        unit: recipeIngredients.unit,
        ingredient_name: ingredients.display_name,
        preparation: recipeIngredients.preparation,
        is_optional: recipeIngredients.is_optional,
        position: recipeIngredients.position,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(recipeIngredients.ingredient_id, ingredients.id))
      .where(eq(recipeIngredients.recipe_id, recipeId))
      .orderBy(recipeIngredients.position);

    normalizedIngredients.forEach((ing, idx) => {
      const optional = ing.is_optional ? ' (optional)' : '';
      console.log(
        `  ${idx + 1}. ${ing.amount || ''} ${ing.unit || ''} ${ing.ingredient_name}${ing.preparation ? `, ${ing.preparation}` : ''}${optional}`
      );
    });
  }

  // Check for recipes that ONLY have JSON ingredients (not normalized)
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RECIPES WITHOUT NORMALIZED INGREDIENTS\n');

  const recipesWithoutNormalized = await db.execute(sql`
    SELECT COUNT(*)
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    WHERE ri.recipe_id IS NULL
      AND r.ingredients IS NOT NULL
      AND r.ingredients != ''
      AND r.ingredients != '[]'
  `);

  console.log(`❌ Recipes with JSON ingredients but NO normalized data: ${recipesWithoutNormalized.rows[0].count}`);

  // Check if there are recipes with ONLY normalized ingredients (no JSON)
  const recipesWithoutJSON = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(recipes)
    .where(
      sql`(${recipes.ingredients} IS NULL OR ${recipes.ingredients} = '' OR ${recipes.ingredients} = '[]')`
    );

  console.log(`⚠️  Recipes with NO JSON ingredients: ${recipesWithoutJSON[0].count}`);

  // Get total ingredient count
  const totalIngredients = await db.select({ count: sql<number>`count(*)` }).from(ingredients);
  console.log(`\n📊 Total normalized ingredients in database: ${totalIngredients[0].count}`);

  console.log('\n✅ Relationship analysis complete!\n');
  process.exit(0);
}

analyzeIngredientRelationships().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
