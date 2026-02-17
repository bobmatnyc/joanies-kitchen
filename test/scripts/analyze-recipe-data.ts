import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function analyzeRecipeData() {
  console.log('🔍 Analyzing recipe database structure...\n');

  // Get total recipe count
  const totalCount = await db.select({ count: sql<number>`count(*)` }).from(recipes);
  console.log(`📊 Total recipes: ${totalCount[0].count}\n`);

  // Get sample recipes with ingredients and instructions
  console.log('📋 Sampling 10 recipes for structure analysis:\n');
  const sampleRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ingredients: recipes.ingredients,
      instructions: recipes.instructions,
      ing_length: sql<number>`LENGTH(${recipes.ingredients}::text)`,
      inst_length: sql<number>`LENGTH(${recipes.instructions}::text)`,
      is_system_recipe: recipes.is_system_recipe,
      source: recipes.source,
    })
    .from(recipes)
    .limit(10);

  for (const recipe of sampleRecipes) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📖 Recipe: ${recipe.name}`);
    console.log(`ID: ${recipe.id}`);
    console.log(`Source: ${recipe.source || 'N/A'}`);
    console.log(`System Recipe: ${recipe.is_system_recipe}`);
    console.log(`\n📏 Data Lengths:`);
    console.log(`  - Ingredients: ${recipe.ing_length} chars`);
    console.log(`  - Instructions: ${recipe.inst_length} chars`);

    // Parse and analyze ingredients
    try {
      const ingredients = JSON.parse(recipe.ingredients);
      console.log(`\n🥗 Ingredients (${Array.isArray(ingredients) ? ingredients.length : 'NOT ARRAY'}):`);
      if (Array.isArray(ingredients)) {
        ingredients.slice(0, 3).forEach((ing: any, idx: number) => {
          console.log(`  ${idx + 1}. ${typeof ing === 'string' ? ing : JSON.stringify(ing)}`);
        });
        if (ingredients.length > 3) {
          console.log(`  ... and ${ingredients.length - 3} more`);
        }
      } else {
        console.log(`  ⚠️  NOT AN ARRAY: ${JSON.stringify(ingredients).substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`\n❌ Ingredients parsing ERROR: ${e}`);
      console.log(`Raw data: ${recipe.ingredients.substring(0, 200)}`);
    }

    // Parse and analyze instructions
    try {
      const instructions = JSON.parse(recipe.instructions);
      console.log(`\n📝 Instructions (${Array.isArray(instructions) ? instructions.length : 'NOT ARRAY'}):`);
      if (Array.isArray(instructions)) {
        instructions.slice(0, 2).forEach((inst: any, idx: number) => {
          const text = typeof inst === 'string' ? inst : JSON.stringify(inst);
          console.log(`  ${idx + 1}. ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);
        });
        if (instructions.length > 2) {
          console.log(`  ... and ${instructions.length - 2} more steps`);
        }
      } else {
        console.log(`  ⚠️  NOT AN ARRAY: ${JSON.stringify(instructions).substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`\n❌ Instructions parsing ERROR: ${e}`);
      console.log(`Raw data: ${recipe.instructions.substring(0, 200)}`);
    }
  }

  // Check for potential data quality issues
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 DATA QUALITY ANALYSIS\n');

  // Count recipes with missing ingredients
  const missingIngredients = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipes)
    .where(sql`${recipes.ingredients} IS NULL OR ${recipes.ingredients} = '' OR ${recipes.ingredients} = '[]'`);
  console.log(`❌ Recipes with missing/empty ingredients: ${missingIngredients[0].count}`);

  // Count recipes with missing instructions
  const missingInstructions = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipes)
    .where(
      sql`${recipes.instructions} IS NULL OR ${recipes.instructions} = '' OR ${recipes.instructions} = '[]'`
    );
  console.log(`❌ Recipes with missing/empty instructions: ${missingInstructions[0].count}`);

  // Get distribution of ingredient list sizes
  console.log('\n📊 Ingredient List Size Distribution:');
  const ingDistribution = await db.execute(sql`
    SELECT
      jsonb_array_length(ingredients::jsonb) as ing_count,
      COUNT(*) as recipe_count
    FROM recipes
    WHERE ingredients IS NOT NULL
      AND ingredients != ''
      AND ingredients != '[]'
    GROUP BY ing_count
    ORDER BY ing_count
    LIMIT 20
  `);
  console.log(ingDistribution.rows);

  // Get distribution of instruction list sizes
  console.log('\n📊 Instruction Step Count Distribution:');
  const instDistribution = await db.execute(sql`
    SELECT
      jsonb_array_length(instructions::jsonb) as step_count,
      COUNT(*) as recipe_count
    FROM recipes
    WHERE instructions IS NOT NULL
      AND instructions != ''
      AND instructions != '[]'
    GROUP BY step_count
    ORDER BY step_count
    LIMIT 20
  `);
  console.log(instDistribution.rows);

  console.log('\n✅ Analysis complete!\n');
  process.exit(0);
}

analyzeRecipeData().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
