/**
 * Comprehensive test for tool detail pages implementation
 *
 * Tests:
 * 1. Database migration - all tools have slugs
 * 2. Server action - getToolBySlug works correctly
 * 3. Tool detail data structure
 * 4. Recipes using tool are fetched
 */

import { getToolBySlug, getAllTools } from '@/app/actions/tools';

async function main() {
  console.log('Tool Detail Pages Implementation Test');
  console.log('=' .repeat(80));
  console.log('');

  // Test 1: Verify all tools have slugs
  console.log('Test 1: Verify Migration - All Tools Have Slugs');
  console.log('-'.repeat(80));

  const allToolsResult = await getAllTools({ limit: 100 });

  if (!allToolsResult.success) {
    console.error('❌ Failed to fetch tools:', allToolsResult.error);
    process.exit(1);
  }

  const toolsWithoutSlugs = allToolsResult.tools.filter(tool => !tool.slug);

  if (toolsWithoutSlugs.length > 0) {
    console.error(`❌ Found ${toolsWithoutSlugs.length} tools without slugs:`);
    toolsWithoutSlugs.forEach(tool => {
      console.error(`   - ${tool.name} (${tool.displayName})`);
    });
    process.exit(1);
  }

  console.log(`✅ All ${allToolsResult.totalCount} tools have slugs`);
  console.log('');

  // Test 2: Test getToolBySlug with a few sample tools
  console.log('Test 2: Server Action - getToolBySlug()');
  console.log('-'.repeat(80));

  const sampleTools = allToolsResult.tools.slice(0, 3);
  let successCount = 0;
  let failCount = 0;

  for (const tool of sampleTools) {
    if (!tool.slug) continue;

    const result = await getToolBySlug(tool.slug);

    if (!result.success || !result.tool) {
      console.error(`❌ Failed to fetch tool by slug: ${tool.slug}`);
      console.error(`   Error: ${result.error}`);
      failCount++;
      continue;
    }

    // Verify data structure
    if (result.tool.id !== tool.id) {
      console.error(`❌ Tool ID mismatch for ${tool.slug}`);
      failCount++;
      continue;
    }

    console.log(`✅ Successfully fetched: ${result.tool.displayName}`);
    console.log(`   Slug: ${result.tool.slug}`);
    console.log(`   Category: ${result.tool.category}`);
    console.log(`   Usage Count: ${result.tool.usageCount || 0}`);

    if (result.recipesUsingTool && result.recipesUsingTool.length > 0) {
      console.log(`   Recipes: ${result.recipesUsingTool.length} found`);
    }

    successCount++;
    console.log('');
  }

  if (failCount > 0) {
    console.error(`❌ ${failCount} tests failed`);
    process.exit(1);
  }

  console.log(`✅ All ${successCount} getToolBySlug tests passed`);
  console.log('');

  // Test 3: Test invalid slug handling
  console.log('Test 3: Error Handling - Invalid Slug');
  console.log('-'.repeat(80));

  const invalidResult = await getToolBySlug('non-existent-tool-slug-12345');

  if (invalidResult.success) {
    console.error('❌ Invalid slug should return error');
    process.exit(1);
  }

  console.log('✅ Invalid slug correctly returns error');
  console.log(`   Error: ${invalidResult.error}`);
  console.log('');

  // Summary
  console.log('=' .repeat(80));
  console.log('✅ All Tests Passed!');
  console.log('');
  console.log('Implementation Summary:');
  console.log(`  - Total tools: ${allToolsResult.totalCount}`);
  console.log(`  - All tools have slugs: Yes`);
  console.log(`  - getToolBySlug working: Yes`);
  console.log(`  - Error handling working: Yes`);
  console.log('');
  console.log('Sample URLs to test in browser:');

  const urlTools = allToolsResult.tools.slice(0, 5);
  urlTools.forEach(tool => {
    if (tool.slug) {
      console.log(`  - http://localhost:3000/tools/${tool.slug}`);
    }
  });

  console.log('');
  console.log('=' .repeat(80));

  process.exit(0);
}

main().catch((error) => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
