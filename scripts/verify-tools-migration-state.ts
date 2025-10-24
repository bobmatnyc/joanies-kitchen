#!/usr/bin/env tsx
/**
 * Verify Tools Migration State
 *
 * Quick diagnostic script to check current state before/after migration.
 *
 * USAGE:
 *   pnpm tsx scripts/verify-tools-migration-state.ts
 */

import { db, cleanup } from './db-with-transactions.js';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema.js';
import { tools, recipeTools } from '../src/lib/db/schema.js';
import { inArray, sql } from 'drizzle-orm';

const TOOL_IDS = [
  'bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473', 'ac46cc71-0d63-4076-96bc-d53261c68e2a',
  '21644114-5795-491c-992e-6bf46ac13f7b', 'd60e504a-1412-424e-af29-98c9e2e1578f',
  '1519b8c7-7d9d-4661-90ed-fb851e1dad78', 'a86979ca-295d-4a6e-9d74-6137b35f46c3',
  '1310abfe-1cad-4618-871d-3d9c1400a9a0', '7d16e6c8-bc34-4e7e-86a1-8b228f52cd95',
  '1e415be0-9d94-422c-8c7e-a7e036e8259c', 'bb5e796c-9bc7-4e7b-bc29-a276daa48e51',
  '9f7b5dad-4fdd-4f5f-ba55-9c1cf5a962f3', '6b4ebbbf-9b80-4238-a619-42075377ad74',
  '601c5898-e2dc-4f4d-8823-012599b27e31', '302d198d-f196-4ba5-a3f1-fd80b3218d9c',
  '0c4d1a87-f4c7-452e-aea4-9167b4d40025', '1216513e-b7b9-401e-8257-8341b2a77858',
  '2bdaa2f2-82ae-45ab-a3f2-1efbb98097fb', '5c1d3bf1-4994-410f-bb8a-c45b80c4567c',
  '540a29c5-1792-4dd9-8859-73cb89812c76', '763ad899-1991-43d7-8a1f-05806c6044da',
  '10637dd2-d9d6-4a1b-9c0c-1873c40da26d', '5a23f573-b6ce-4240-bacb-6d0d836285c7',
  '3978a9c3-c8e0-4377-8512-09cd2312b06a', 'f2d67c0f-4f4e-49ca-b978-d0c855dea7b4',
  'bfa74904-f337-44ed-8756-a6c623bd69e8', 'ac2374d5-3d07-479c-8393-0c71f0c47a5b',
  '46cceb69-677a-4ef8-aace-32b8b1561d7a', 'b1a5651c-8ca8-4a64-b522-117a9df74c9b',
  '630bb14d-39c6-4f73-ab18-3896baa6010e', 'aef3b08c-8c37-4661-b1f8-ad48701988c9',
  '6c3db2ec-56f1-44e7-b31f-9f75f83a1c0a',
];

async function verifyState() {
  console.log('🔍 Tools Migration State Verification');
  console.log('━'.repeat(80));
  console.log('');

  // Check tools in ingredients table
  const toolsInIngredients = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(ingredients)
    .where(inArray(ingredients.id, TOOL_IDS));

  const toolsInIngredientsCount = Number(toolsInIngredients[0]?.count || 0);

  console.log('📦 Tools in ingredients table:');
  console.log(`   Count: ${toolsInIngredientsCount} / 31 expected`);
  if (toolsInIngredientsCount === 31) {
    console.log('   ✅ All tools present - ready for migration');
  } else if (toolsInIngredientsCount === 0) {
    console.log('   ✅ No tools present - migration completed');
  } else {
    console.log(`   ⚠️  Partial state - ${toolsInIngredientsCount} tools found`);
  }
  console.log('');

  // Check recipe_ingredients references
  const recipeIngredientsRefs = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.ingredient_id, TOOL_IDS));

  const recipeIngredientsCount = Number(recipeIngredientsRefs[0]?.count || 0);

  console.log('📋 Recipe references to tools (recipe_ingredients):');
  console.log(`   Count: ${recipeIngredientsCount} / 65 expected`);
  if (recipeIngredientsCount === 65) {
    console.log('   ✅ All references present - ready for migration');
  } else if (recipeIngredientsCount === 0) {
    console.log('   ✅ No references present - migration completed');
  } else {
    console.log(`   ⚠️  Partial state - ${recipeIngredientsCount} references found`);
  }
  console.log('');

  // Check tools table
  const toolsTableCount = await db.select({ count: sql<number>`COUNT(*)` }).from(tools);
  const toolsCount = Number(toolsTableCount[0]?.count || 0);

  console.log('🔧 Tools in dedicated tools table:');
  console.log(`   Count: ${toolsCount}`);
  if (toolsCount === 0) {
    console.log('   ℹ️  Empty - migration not yet run');
  } else if (toolsCount >= 23) {
    console.log('   ✅ Migration completed (expected ~23 canonical tools)');
  } else {
    console.log(`   ⚠️  Partial migration - only ${toolsCount} tools found`);
  }
  console.log('');

  // Check recipe_tools table
  const recipeToolsCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(recipeTools);
  const rtCount = Number(recipeToolsCount[0]?.count || 0);

  console.log('📋 Recipe tool references (recipe_tools):');
  console.log(`   Count: ${rtCount}`);
  if (rtCount === 0) {
    console.log('   ℹ️  Empty - migration not yet run');
  } else if (rtCount >= 65) {
    console.log('   ✅ Migration completed (expected 65 references)');
  } else {
    console.log(`   ⚠️  Partial migration - only ${rtCount} references found`);
  }
  console.log('');

  // Determine migration status
  console.log('━'.repeat(80));
  console.log('📊 Migration Status:');
  console.log('━'.repeat(80));

  if (toolsInIngredientsCount === 31 && recipeIngredientsCount === 65 && toolsCount === 0) {
    console.log('✅ PRE-MIGRATION STATE');
    console.log('   Tools are in ingredients table, ready to migrate');
    console.log('');
    console.log('   Next step: Run migration script');
    console.log('   Command: pnpm tsx scripts/migrate-tools-to-dedicated-table.ts');
  } else if (toolsInIngredientsCount === 0 && recipeIngredientsCount === 0 && toolsCount >= 23) {
    console.log('✅ POST-MIGRATION STATE');
    console.log('   Migration completed successfully');
    console.log('   Tools are in dedicated tables');
    console.log('');
    console.log('   Next steps:');
    console.log('   1. Update src/app/actions/tools.ts to query tools table');
    console.log('   2. Remove hardcoded TOOL_IDS constants');
    console.log('   3. Test /tools page functionality');
  } else {
    console.log('⚠️  INCONSISTENT STATE');
    console.log('   Database is in an unexpected state');
    console.log('');
    console.log('   Possible causes:');
    console.log('   - Migration partially completed');
    console.log('   - Manual database changes');
    console.log('   - Script error during migration');
    console.log('');
    console.log('   Recommended action: Review database state manually');
  }

  console.log('━'.repeat(80));
}

async function main() {
  try {
    await verifyState();
    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

main();
