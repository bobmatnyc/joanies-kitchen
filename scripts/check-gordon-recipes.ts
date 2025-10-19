import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import ws from "ws";
import * as schema from "../src/lib/db/schema";

// Load environment variables
config({ path: ".env.local" });

// Configure WebSocket for local development
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function checkGordonRecipes() {
  console.log("🔍 Fetching all Gordon Ramsay recipes...\n");

  const gordonRecipes = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.chef_id, "0bb87cd1-af5e-4cce-9172-3a078e42f00b"));

  console.log(`Found ${gordonRecipes.length} recipes:\n`);

  gordonRecipes.forEach((recipe, idx) => {
    console.log(`${idx + 1}. ${recipe.name}`);
    console.log(`   ID: ${recipe.id}`);
    console.log(`   Source: ${recipe.source || "N/A"}`);
    console.log(`   Description: ${recipe.description?.substring(0, 100)}...`);
    console.log(`   Is Placeholder: ${recipe.source?.includes("Placeholder") ? "YES ⚠️" : "NO"}`);
    console.log("");
  });

  // Check for the specific recipe
  const targetRecipe = gordonRecipes.find(r => r.id === "42ccee10-794c-4594-91be-925b1aa1e6ba");

  if (targetRecipe) {
    console.log("📍 Target Recipe Found:");
    console.log("─".repeat(80));
    console.log(JSON.stringify(targetRecipe, null, 2));
  }
}

checkGordonRecipes()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
