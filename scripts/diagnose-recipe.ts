import { neonConfig, Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../src/lib/db/schema';

// Load environment variables
config({ path: '.env.local' });

// Configure WebSocket for local development
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const RECIPE_ID = '42ccee10-794c-4594-91be-925b1aa1e6ba';
const GORDON_CHEF_ID = '0bb87cd1-af5e-4cce-9172-3a078e42f00b';

async function diagnoseRecipe() {
  console.log('🔍 Diagnosing Recipe...\n');

  const [recipe] = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, RECIPE_ID))
    .limit(1);

  if (!recipe) {
    console.error('❌ Recipe not found!');
    process.exit(1);
  }

  console.log('📋 Recipe Status:');
  console.log('─'.repeat(80));
  console.log(`Name: ${recipe.name}`);
  console.log(`Chef ID: ${recipe.chef_id || 'NULL ⚠️'}`);
  console.log(`Source: ${recipe.source || 'N/A'}`);
  console.log(`Is System Recipe: ${recipe.is_system_recipe}`);
  console.log(`Is Public: ${recipe.is_public}`);
  console.log('\n');

  // Parse fields
  const ingredients =
    typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : recipe.ingredients;

  const instructions =
    typeof recipe.instructions === 'string' ? JSON.parse(recipe.instructions) : recipe.instructions;

  console.log('🔍 Content Analysis:');
  console.log('─'.repeat(80));
  console.log(`Ingredients count: ${ingredients?.length || 0}`);
  console.log(`Instructions count: ${instructions?.length || 0}`);
  console.log(`Description length: ${recipe.description?.length || 0} chars`);
  console.log('\n');

  console.log('📝 Full Content:');
  console.log('─'.repeat(80));
  console.log('\nDescription:');
  console.log(recipe.description);
  console.log('\nIngredients:');
  ingredients?.forEach((ing: string, idx: number) => {
    console.log(`  ${idx + 1}. ${ing}`);
  });
  console.log('\nInstructions:');
  instructions?.forEach((inst: string, idx: number) => {
    console.log(`  ${idx + 1}. ${inst}`);
  });
  console.log('\n');

  // Check if this is a placeholder
  const isPlaceholder =
    recipe.source?.includes('Placeholder') ||
    recipe.description?.includes('placeholder') ||
    ingredients?.some((ing: string) => ing.toLowerCase().includes('placeholder'));

  if (isPlaceholder) {
    console.log('⚠️  ISSUE IDENTIFIED:');
    console.log('─'.repeat(80));
    console.log('This is a PLACEHOLDER recipe that needs real content!');
    console.log('\nRecommended Actions:');
    console.log(`1. Link to Gordon Ramsay chef (chef_id = ${GORDON_CHEF_ID})`);
    console.log('2. Replace with real recipe content');
    console.log('3. Update source to actual source URL');
    console.log('4. Add proper ingredients and instructions');
    console.log('\n');

    // Offer to link to chef
    console.log('🔧 Fix Available:');
    console.log('─'.repeat(80));
    console.log('Would link recipe to Gordon Ramsay chef');
    console.log('This would make it show up on his chef page');
    console.log(`\nTo apply fix, set chef_id to: ${GORDON_CHEF_ID}`);
  } else {
    console.log('✅ Content appears valid (not a placeholder)');
  }
}

diagnoseRecipe()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
