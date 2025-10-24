#!/usr/bin/env tsx

import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';
import { inArray } from 'drizzle-orm';

async function verifyFixes() {
  console.log('🔍 Verifying Flagged Recipe Fixes\n');

  // Category A - Fixed recipes
  const categoryA = [
    '163f25de-7d7d-4525-9785-77162b2b7ea3',
    'b7d25ff5-98eb-44a7-8824-04b16e1ba471',
    'dc3a2745-b1fe-439d-b2fc-f22ff3e80e5b'
  ];

  const fixed = await db.select({
    id: recipes.id,
    name: recipes.name,
    qa_status: recipes.qa_status,
    qa_method: recipes.qa_method,
    qa_confidence: recipes.qa_confidence,
    ingredients_json: recipes.ingredients
  }).from(recipes).where(inArray(recipes.id, categoryA));

  console.log('Category A - Fixed Recipes (should have validated status):');
  console.log('═'.repeat(80));
  for (const r of fixed) {
    const ingredientsArray = JSON.parse(r.ingredients_json || '[]');
    console.log(`${r.name}`);
    console.log(`  ✅ Status: ${r.qa_status}`);
    console.log(`  📋 Method: ${r.qa_method}`);
    console.log(`  🎯 Confidence: ${r.qa_confidence}`);
    console.log(`  🥘 Ingredients: ${ingredientsArray.length}`);
    console.log(`  📝 Sample: ${ingredientsArray.slice(0, 3).join(', ')}...`);
    console.log();
  }

  // Category C - Removed recipes
  const categoryC = [
    'd3f48984-d93f-4586-b440-5aaf78e18f32',
    '83355000-59ec-46ed-80bd-94c823e302e3',
    'b81ac1f7-8a60-4e1f-9c9e-91b1794b4230'
  ];

  const removed = await db.select({
    name: recipes.name,
    qa_status: recipes.qa_status,
    qa_method: recipes.qa_method,
    qa_notes: recipes.qa_notes
  }).from(recipes).where(inArray(recipes.id, categoryC));

  console.log('Category C - Removed Recipes (should have removed status):');
  console.log('═'.repeat(80));
  for (const r of removed) {
    console.log(`${r.name}`);
    console.log(`  🚫 Status: ${r.qa_status}`);
    console.log(`  📋 Method: ${r.qa_method}`);
    console.log(`  💬 Notes: ${r.qa_notes?.substring(0, 70)}...`);
    console.log();
  }

  // Category D - Hidden recipes
  const categoryD = [
    '08a1aae2-ec03-4fca-9aa9-b851ec83261a',
    'ea38e499-5239-4415-be04-f8c027682b1f',
    '800b6153-db4e-40ef-a123-1dceb30c621b'
  ];

  const hidden = await db.select({
    name: recipes.name,
    qa_status: recipes.qa_status,
    qa_method: recipes.qa_method,
    qa_notes: recipes.qa_notes
  }).from(recipes).where(inArray(recipes.id, categoryD));

  console.log('Category D - Hidden Recipes (should have needs_review status):');
  console.log('═'.repeat(80));
  for (const r of hidden) {
    console.log(`${r.name}`);
    console.log(`  ⚠️  Status: ${r.qa_status}`);
    console.log(`  📋 Method: ${r.qa_method}`);
    console.log(`  💬 Notes: ${r.qa_notes?.substring(0, 70)}...`);
    console.log();
  }

  console.log('═'.repeat(80));
  console.log('✅ Verification complete');
  console.log(`  Fixed: ${fixed.length} recipes`);
  console.log(`  Removed: ${removed.length} recipes`);
  console.log(`  Hidden: ${hidden.length} recipes`);
  console.log(`  Total: ${fixed.length + removed.length + hidden.length} recipes verified`);
}

verifyFixes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
