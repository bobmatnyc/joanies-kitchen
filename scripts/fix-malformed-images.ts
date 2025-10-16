import { db } from "../src/lib/db";
import { recipes } from "../src/lib/db/schema";
import { sql } from "drizzle-orm";

/**
 * Fix malformed images field caused by image generation script
 * Converts PostgreSQL set notation {...} to proper JSON array [...]
 */
async function fixMalformedImages() {
  console.log("🔧 Fixing malformed images field in database...\n");

  try {
    // Get all recipes with malformed images (set notation instead of JSON array)
    const allRecipes = await db.select().from(recipes);

    const malformedRecipes: Array<{ id: string; name: string; images: string }> = [];
    const fixedRecipes: Array<{ id: string; name: string; before: string; after: string }> = [];

    // Find malformed records
    for (const recipe of allRecipes) {
      if (recipe.images) {
        try {
          JSON.parse(recipe.images as string);
        } catch (error) {
          malformedRecipes.push({
            id: recipe.id,
            name: recipe.name,
            images: recipe.images as string,
          });
        }
      }
    }

    console.log(`📊 Found ${malformedRecipes.length} recipes with malformed images field\n`);

    if (malformedRecipes.length === 0) {
      console.log("✅ No malformed records found! Database is clean.\n");
      return;
    }

    // Fix each malformed record
    for (const [index, recipe] of malformedRecipes.entries()) {
      const beforeValue = recipe.images;

      // Convert PostgreSQL set notation {...} to JSON array [...]
      // Example: {"/ai-recipe-images/name.png"} -> ["/ai-recipe-images/name.png"]
      const fixedValue = beforeValue.replace(/^\{/, "[").replace(/\}$/, "]");

      // Verify the fixed value is valid JSON
      try {
        JSON.parse(fixedValue);
      } catch (error) {
        console.error(`❌ Failed to fix recipe ${recipe.id}: Invalid JSON after conversion`);
        console.error(`   Before: ${beforeValue}`);
        console.error(`   After: ${fixedValue}`);
        continue;
      }

      // Update the database
      await db
        .update(recipes)
        .set({ images: fixedValue })
        .where(sql`id = ${recipe.id}`);

      fixedRecipes.push({
        id: recipe.id,
        name: recipe.name,
        before: beforeValue,
        after: fixedValue,
      });

      console.log(`✅ [${index + 1}/${malformedRecipes.length}] Fixed: ${recipe.name}`);
      console.log(`   Before: ${beforeValue.substring(0, 80)}`);
      console.log(`   After:  ${fixedValue.substring(0, 80)}\n`);
    }

    // Summary
    console.log("\n============================================================");
    console.log("📊 FIX SUMMARY");
    console.log("============================================================\n");
    console.log(`✅ Fixed: ${fixedRecipes.length} recipes`);
    console.log(`❌ Failed: ${malformedRecipes.length - fixedRecipes.length} recipes\n`);

    // Verify all fixes
    console.log("🔍 Verifying fixes...\n");
    let verificationPassed = 0;
    let verificationFailed = 0;

    for (const fixed of fixedRecipes) {
      const [updated] = await db
        .select()
        .from(recipes)
        .where(sql`id = ${fixed.id}`)
        .limit(1);

      if (updated?.images) {
        try {
          JSON.parse(updated.images as string);
          verificationPassed++;
        } catch (error) {
          console.error(`❌ Verification failed for ${fixed.name}`);
          verificationFailed++;
        }
      }
    }

    console.log(`✅ Verification passed: ${verificationPassed}/${fixedRecipes.length}`);
    if (verificationFailed > 0) {
      console.log(`❌ Verification failed: ${verificationFailed}/${fixedRecipes.length}`);
    }
    console.log("");

  } catch (error) {
    console.error("❌ Error fixing malformed images:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixMalformedImages();
