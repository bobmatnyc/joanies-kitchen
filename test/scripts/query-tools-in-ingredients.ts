/**
 * Query Tools in Ingredients Table
 *
 * Quick script to count how many tools are in the ingredients table
 * vs how many are in the dedicated tools table.
 */

import { inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';
import { ingredients } from '@/lib/db/ingredients-schema.js';
import { tools } from '@/lib/db/schema.js';

// Tool IDs from src/app/actions/tools.ts
const TOOL_IDS_IN_INGREDIENTS = [
  'bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473', // skewers
  'ac46cc71-0d63-4076-96bc-d53261c68e2a', // bamboo skewers
  '21644114-5795-491c-992e-6bf46ac13f7b', // thermometer
  'd60e504a-1412-424e-af29-98c9e2e1578f', // cookie cutter
  '1519b8c7-7d9d-4661-90ed-fb851e1dad78', // cardboard round
  'a86979ca-295d-4a6e-9d74-6137b35f46c3', // lamb rack
  '1310abfe-1cad-4618-871d-3d9c1400a9a0', // spatula
  '7d16e6c8-bc34-4e7e-86a1-8b228f52cd95', // oven-roasting bag
  '1e415be0-9d94-422c-8c7e-a7e036e8259c', // nonstick cooking spray
  'bb5e796c-9bc7-4e7b-bc29-a276daa48e51', // measuring spoon
  '9f7b5dad-4fdd-4f5f-ba55-9c1cf5a962f3', // muddler
  '6b4ebbbf-9b80-4238-a619-42075377ad74', // muffin liners
  '601c5898-e2dc-4f4d-8823-012599b27e31', // deep-fat thermometer
  '302d198d-f196-4ba5-a3f1-fd80b3218d9c', // plastic storage tub
  '0c4d1a87-f4c7-452e-aea4-9167b4d40025', // tongs
  '1216513e-b7b9-401e-8257-8341b2a77858', // wooden stick
  '2bdaa2f2-82ae-45ab-a3f2-1efbb98097fb', // ramekins
  '5c1d3bf1-4994-410f-bb8a-c45b80c4567c', // cutter
  '540a29c5-1792-4dd9-8859-73cb89812c76', // ramekin
  '763ad899-1991-43d7-8a1f-05806c6044da', // spice grinder
  '10637dd2-d9d6-4a1b-9c0c-1873c40da26d', // oven cooking bag
  '5a23f573-b6ce-4240-bacb-6d0d836285c7', // wooden sticks
  '3978a9c3-c8e0-4377-8512-09cd2312b06a', // wooden spoon
  'f2d67c0f-4f4e-49ca-b978-d0c855dea7b4', // ice pop molds
  'bfa74904-f337-44ed-8756-a6c623bd69e8', // wooden ice pop sticks
  'ac2374d5-3d07-479c-8393-0c71f0c47a5b', // measuring spoons
  '46cceb69-677a-4ef8-aace-32b8b1561d7a', // muddlers
  'b1a5651c-8ca8-4a64-b522-117a9df74c9b', // pastry bag
  '630bb14d-39c6-4f73-ab18-3896baa6010e', // cake stand
  'aef3b08c-8c37-4661-b1f8-ad48701988c9', // wooden dowels
  '6c3db2ec-56f1-44e7-b31f-9f75f83a1c0a', // nonstick vegetable oil spray
];

async function main() {
  console.log('='.repeat(60));
  console.log('Kitchen Tools Migration Analysis');
  console.log('='.repeat(60));
  console.log();

  // Query tools in ingredients table
  console.log('1. Querying tools in ingredients table...');
  const toolsInIngredients = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      display_name: ingredients.display_name,
      category: ingredients.category,
      usage_count: ingredients.usage_count,
    })
    .from(ingredients)
    .where(inArray(ingredients.id, TOOL_IDS_IN_INGREDIENTS))
    .orderBy(sql`${ingredients.usage_count} DESC NULLS LAST`);

  console.log(`   Found ${toolsInIngredients.length} tools in ingredients table`);
  console.log();

  // Query dedicated tools table
  console.log('2. Querying dedicated tools table...');
  const toolsInToolsTable = await db
    .select({
      id: tools.id,
      name: tools.name,
      display_name: tools.display_name,
      category: tools.category,
    })
    .from(tools);

  console.log(`   Found ${toolsInToolsTable.length} tools in tools table`);
  console.log();

  // Top 10 most used tools in ingredients table
  console.log('3. Top 10 most-used tools currently in ingredients table:');
  console.log('-'.repeat(60));
  toolsInIngredients.slice(0, 10).forEach((tool, idx) => {
    console.log(
      `   ${(idx + 1).toString().padStart(2)}. ${tool.display_name.padEnd(30)} (used ${tool.usage_count || 0} times)`
    );
  });
  console.log();

  // Check for recipe_ingredients references
  console.log('4. Checking recipe_ingredients references...');
  const recipeIngredientsRefs = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM recipe_ingredients
    WHERE ingredient_id IN (${sql.join(
      TOOL_IDS_IN_INGREDIENTS.map((id) => sql`${id}`),
      sql`, `
    )})
  `);
  const refCount = Number((recipeIngredientsRefs.rows[0] as any).count);
  console.log(`   Found ${refCount} recipe_ingredients entries referencing tools`);
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Tools in ingredients table:       ${toolsInIngredients.length}`);
  console.log(`Tools in dedicated tools table:   ${toolsInToolsTable.length}`);
  console.log(`Recipe references to migrate:     ${refCount}`);
  console.log();
  console.log('MIGRATION NEEDED: YES');
  console.log(`  ${toolsInIngredients.length} tool entries need to be migrated`);
  console.log(`  ${refCount} recipe_ingredients relationships to update`);
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
