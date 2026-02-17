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

async function analyzeRecipe() {
  console.log("🔍 Fetching Gordon Ramsay recipe...\n");

  const [recipe] = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, RECIPE_ID))
    .limit(1);

  if (!recipe) {
    console.error("❌ Recipe not found!");
    process.exit(1);
  }

  console.log("📋 Recipe Details:");
  console.log("─".repeat(80));
  console.log(`Name: ${recipe.name}`);
  console.log(`Chef: ${recipe.chefId || "N/A"}`);
  console.log(`Source: ${recipe.source || "N/A"}`);
  console.log(`Created: ${recipe.createdAt}`);
  console.log("\n");

  // Parse JSON fields
  const ingredients = typeof recipe.ingredients === "string"
    ? JSON.parse(recipe.ingredients)
    : recipe.ingredients;

  const instructions = typeof recipe.instructions === "string"
    ? JSON.parse(recipe.instructions)
    : recipe.instructions;

  const tags = typeof recipe.tags === "string"
    ? JSON.parse(recipe.tags)
    : recipe.tags;

  // Analyze Description
  console.log("📝 Description:");
  console.log("─".repeat(80));
  console.log(recipe.description || "N/A");
  console.log("\n");

  // Analyze Ingredients
  console.log("🥘 Ingredients Analysis:");
  console.log("─".repeat(80));
  console.log(`Total: ${ingredients?.length || 0}`);

  const ingredientIssues: string[] = [];
  ingredients?.forEach((ing: string, idx: number) => {
    console.log(`${idx + 1}. ${ing}`);

    // Check for formatting issues
    if (ing.match(/^[\d]+\./)) {
      ingredientIssues.push(`Ingredient ${idx + 1} has number prefix: "${ing}"`);
    }
    if (ing.match(/^[•\-\*]/)) {
      ingredientIssues.push(`Ingredient ${idx + 1} has bullet prefix: "${ing}"`);
    }
    if (ing.trim() !== ing) {
      ingredientIssues.push(`Ingredient ${idx + 1} has extra whitespace`);
    }
  });
  console.log("\n");

  // Analyze Instructions
  console.log("👨‍🍳 Instructions Analysis:");
  console.log("─".repeat(80));
  console.log(`Total steps: ${instructions?.length || 0}`);

  const instructionIssues: string[] = [];
  instructions?.forEach((inst: string, idx: number) => {
    console.log(`${idx + 1}. ${inst.substring(0, 100)}${inst.length > 100 ? "..." : ""}`);

    // Check for double numbering
    if (inst.match(/^\d+\./)) {
      instructionIssues.push(`Step ${idx + 1} has number prefix: "${inst.substring(0, 50)}..."`);
    }
    if (inst.trim() !== inst) {
      instructionIssues.push(`Step ${idx + 1} has extra whitespace`);
    }
  });
  console.log("\n");

  // Analyze Tags
  console.log("🏷️  Tags:");
  console.log("─".repeat(80));
  console.log(tags?.join(", ") || "N/A");
  console.log("\n");

  // Analyze Images
  console.log("🖼️  Images:");
  console.log("─".repeat(80));
  const images = typeof recipe.images === "string"
    ? JSON.parse(recipe.images)
    : recipe.images;
  console.log(images?.join("\n") || "No images");
  console.log("\n");

  // Summary of Issues
  console.log("⚠️  Issues Found:");
  console.log("─".repeat(80));

  const allIssues = [...ingredientIssues, ...instructionIssues];

  if (allIssues.length === 0) {
    console.log("✅ No formatting issues detected!");
  } else {
    allIssues.forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue}`);
    });
  }
  console.log("\n");

  return {
    recipe,
    ingredients,
    instructions,
    tags,
    images,
    issues: allIssues,
  };
}

async function fixRecipe() {
  const analysis = await analyzeRecipe();

  if (analysis.issues.length === 0) {
    console.log("✅ No fixes needed!");
    process.exit(0);
  }

  console.log("🔧 Applying Fixes...\n");

  // Fix instructions - remove number prefixes
  const fixedInstructions = analysis.instructions.map((inst: string) =>
    inst.replace(/^\d+\.\s*/, "").trim()
  );

  // Fix ingredients - remove bullet/number prefixes
  const fixedIngredients = analysis.ingredients.map((ing: string) =>
    ing.replace(/^[•\-\*\d]+[\.\)]\s*/, "").trim()
  );

  console.log("📊 Changes Preview:");
  console.log("─".repeat(80));

  // Show instruction changes
  const instructionChanges = analysis.instructions.filter(
    (inst: string, idx: number) => inst !== fixedInstructions[idx]
  );

  if (instructionChanges.length > 0) {
    console.log(`\n✏️  Instruction Changes (${instructionChanges.length}):`);
    instructionChanges.forEach((original: string, idx: number) => {
      const fixedIdx = analysis.instructions.indexOf(original);
      console.log(`\nBefore: "${original.substring(0, 80)}..."`);
      console.log(`After:  "${fixedInstructions[fixedIdx].substring(0, 80)}..."`);
    });
  }

  // Show ingredient changes
  const ingredientChanges = analysis.ingredients.filter(
    (ing: string, idx: number) => ing !== fixedIngredients[idx]
  );

  if (ingredientChanges.length > 0) {
    console.log(`\n✏️  Ingredient Changes (${ingredientChanges.length}):`);
    ingredientChanges.forEach((original: string, idx: number) => {
      const fixedIdx = analysis.ingredients.indexOf(original);
      console.log(`Before: "${original}"`);
      console.log(`After:  "${fixedIngredients[fixedIdx]}"`);
    });
  }

  console.log("\n");

  // Apply the fix
  console.log("💾 Updating database...");

  await db
    .update(schema.recipes)
    .set({
      instructions: JSON.stringify(fixedInstructions),
      ingredients: JSON.stringify(fixedIngredients),
      updatedAt: new Date(),
    })
    .where(eq(schema.recipes.id, RECIPE_ID));

  console.log("✅ Recipe updated successfully!\n");

  // Verify the fix
  console.log("🔍 Verifying changes...");
  const [updatedRecipe] = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, RECIPE_ID))
    .limit(1);

  const verifyInstructions = typeof updatedRecipe.instructions === "string"
    ? JSON.parse(updatedRecipe.instructions)
    : updatedRecipe.instructions;

  const verifyIngredients = typeof updatedRecipe.ingredients === "string"
    ? JSON.parse(updatedRecipe.ingredients)
    : updatedRecipe.ingredients;

  // Check for remaining issues
  const remainingIssues: string[] = [];

  verifyInstructions.forEach((inst: string, idx: number) => {
    if (inst.match(/^\d+\./)) {
      remainingIssues.push(`Step ${idx + 1} still has number prefix`);
    }
  });

  verifyIngredients.forEach((ing: string, idx: number) => {
    if (ing.match(/^[•\-\*\d]+[\.\)]/)) {
      remainingIssues.push(`Ingredient ${idx + 1} still has prefix`);
    }
  });

  if (remainingIssues.length === 0) {
    console.log("✅ All issues resolved!\n");
  } else {
    console.log("⚠️  Some issues remain:");
    remainingIssues.forEach((issue) => console.log(`  - ${issue}`));
    console.log("\n");
  }

  console.log("🎉 Done! View the recipe at:");
  console.log(`   http://localhost:3002/recipes/${RECIPE_ID}\n`);
}

// Run the fix
fixRecipe()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
