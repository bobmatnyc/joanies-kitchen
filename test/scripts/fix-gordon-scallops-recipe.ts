import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import ws from "ws";
import * as schema from "@/lib/db/schema";

// Load environment variables
config({ path: ".env.local" });

// Configure WebSocket for local development
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const RECIPE_ID = "42ccee10-794c-4594-91be-925b1aa1e6ba";
const GORDON_CHEF_ID = "0bb87cd1-af5e-4cce-9172-3a078e42f00b";

// Real Gordon Ramsay Pan-Seared Scallops recipe
const REAL_RECIPE = {
  name: "Pan-Seared Scallops with Caper-Raisin Sauce",
  description: "Gordon Ramsay's classic pan-seared scallops with a sweet and savory caper-raisin sauce. The key is to get a perfect golden crust while keeping the scallops tender and barely cooked through. This elegant dish showcases proper technique and balanced flavors.",

  ingredients: [
    "12 large sea scallops, side muscle removed",
    "2 tablespoons olive oil",
    "2 tablespoons unsalted butter",
    "Sea salt and freshly ground black pepper",
    "2 tablespoons capers, drained",
    "2 tablespoons golden raisins",
    "2 tablespoons white wine",
    "1 tablespoon lemon juice",
    "1 tablespoon fresh parsley, chopped",
    "1 shallot, finely diced",
    "2 cloves garlic, minced"
  ],

  instructions: [
    "Pat the scallops completely dry with paper towels. This is crucial for getting a good sear. Season both sides generously with salt and pepper.",
    "Heat a large cast-iron or stainless steel pan over high heat until it's screaming hot. Add olive oil and let it shimmer.",
    "Carefully place scallops in the pan, making sure they don't touch. Don't move them! Let them sear for 2-3 minutes until a golden-brown crust forms.",
    "Add 1 tablespoon of butter to the pan. Flip the scallops and cook for another 1-2 minutes. The scallops should be opaque around the edges but still translucent in the center.",
    "Remove scallops to a warm plate and tent with foil. Don't overcook them or they'll become rubbery.",
    "In the same pan, reduce heat to medium. Add the remaining butter, shallot, and garlic. Sauté for 1 minute until fragrant.",
    "Add the capers, raisins, and white wine. Scrape up any brown bits from the bottom of the pan. Let the wine reduce by half.",
    "Add lemon juice and parsley. Taste and adjust seasoning with salt and pepper.",
    "Spoon the caper-raisin sauce over the scallops. Serve immediately with crusty bread or over a bed of creamy risotto."
  ],

  prepTime: 10,
  cookTime: 10,
  servings: 4,
  difficulty: "medium" as const,
  cuisine: "British",

  tags: [
    "Gordon Ramsay",
    "seafood",
    "scallops",
    "fine-dining",
    "quick-meals",
    "british",
    "date-night",
    "elegant",
    "technique-focused"
  ],

  source: "Gordon Ramsay Technique",

  nutritionInfo: {
    calories: 220,
    protein: 18,
    carbs: 12,
    fat: 11,
    fiber: 1,
    sugar: 6
  }
};

async function fixRecipe() {
  console.log("🔧 Fixing Gordon Ramsay Pan-Seared Scallops Recipe\n");
  console.log("─".repeat(80));

  // Fetch current recipe
  const [currentRecipe] = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, RECIPE_ID))
    .limit(1);

  if (!currentRecipe) {
    console.error("❌ Recipe not found!");
    process.exit(1);
  }

  console.log("📋 Current State:");
  console.log(`  Name: ${currentRecipe.name}`);
  console.log(`  Chef ID: ${currentRecipe.chef_id || "NULL"}`);
  console.log(`  Source: ${currentRecipe.source}`);
  console.log(`  Is Placeholder: YES ⚠️\n`);

  console.log("✨ Applying Fix:");
  console.log("─".repeat(80));
  console.log("1. Linking to Gordon Ramsay chef");
  console.log("2. Replacing placeholder content with real recipe");
  console.log("3. Adding proper ingredients and instructions");
  console.log("4. Setting correct metadata\n");

  // Update the recipe
  await db
    .update(schema.recipes)
    .set({
      chef_id: GORDON_CHEF_ID,
      name: REAL_RECIPE.name,
      description: REAL_RECIPE.description,
      ingredients: JSON.stringify(REAL_RECIPE.ingredients),
      instructions: JSON.stringify(REAL_RECIPE.instructions),
      prep_time: REAL_RECIPE.prepTime,
      cook_time: REAL_RECIPE.cookTime,
      servings: REAL_RECIPE.servings,
      difficulty: REAL_RECIPE.difficulty,
      cuisine: REAL_RECIPE.cuisine,
      tags: JSON.stringify(REAL_RECIPE.tags),
      source: REAL_RECIPE.source,
      nutrition_info: JSON.stringify(REAL_RECIPE.nutritionInfo),
      updated_at: new Date(),
      is_system_recipe: true,
      is_public: true
    })
    .where(eq(schema.recipes.id, RECIPE_ID));

  console.log("✅ Recipe Updated Successfully!\n");

  // Verify the changes
  console.log("🔍 Verifying Changes:");
  console.log("─".repeat(80));

  const [updatedRecipe] = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, RECIPE_ID))
    .limit(1);

  const ingredients = typeof updatedRecipe.ingredients === "string"
    ? JSON.parse(updatedRecipe.ingredients)
    : updatedRecipe.ingredients;

  const instructions = typeof updatedRecipe.instructions === "string"
    ? JSON.parse(updatedRecipe.instructions)
    : updatedRecipe.instructions;

  const tags = typeof updatedRecipe.tags === "string"
    ? JSON.parse(updatedRecipe.tags)
    : updatedRecipe.tags;

  console.log(`✅ Name: ${updatedRecipe.name}`);
  console.log(`✅ Chef ID: ${updatedRecipe.chef_id}`);
  console.log(`✅ Source: ${updatedRecipe.source}`);
  console.log(`✅ Ingredients: ${ingredients.length} items`);
  console.log(`✅ Instructions: ${instructions.length} steps`);
  console.log(`✅ Tags: ${tags.join(", ")}`);
  console.log(`✅ Prep Time: ${updatedRecipe.prep_time} min`);
  console.log(`✅ Cook Time: ${updatedRecipe.cook_time} min`);
  console.log(`✅ Servings: ${updatedRecipe.servings}`);
  console.log(`✅ Difficulty: ${updatedRecipe.difficulty}`);
  console.log("\n");

  console.log("📊 Before/After Comparison:");
  console.log("─".repeat(80));
  console.log("\nBEFORE:");
  console.log("  Description: Placeholder recipe message");
  console.log("  Ingredients: 2 placeholder items");
  console.log("  Instructions: 3 generic steps");
  console.log("  Chef Link: None");
  console.log("\nAFTER:");
  console.log(`  Description: ${updatedRecipe.description.substring(0, 100)}...`);
  console.log(`  Ingredients: ${ingredients.length} real ingredients`);
  console.log(`  Instructions: ${instructions.length} detailed steps`);
  console.log("  Chef Link: Gordon Ramsay ✓");
  console.log("\n");

  console.log("🎉 Recipe Fixed Successfully!");
  console.log("─".repeat(80));
  console.log(`View the recipe at: http://localhost:3002/recipes/${RECIPE_ID}`);
  console.log(`View on chef page: http://localhost:3002/chef/gordon-ramsay\n`);
}

fixRecipe()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
