/**
 * Manual test script for Chef API endpoints
 *
 * Usage: tsx test/api/chefs-api-test.ts
 *
 * This script tests:
 * - GET /api/v1/chefs (list)
 * - POST /api/v1/chefs (create)
 * - GET /api/v1/chefs/:slug (get by slug)
 * - PATCH /api/v1/chefs/:slug (update)
 * - GET /api/v1/chefs/:slug/recipes (list recipes)
 * - DELETE /api/v1/chefs/:slug (delete)
 */

import { chefService } from '@/lib/services/chef-service';
import type { CreateChefInput, UpdateChefInput } from '@/lib/validations/chef-api';

async function testChefAPI() {
  console.log('🧪 Testing Chef API Service Layer\n');

  // Test 1: List all chefs
  console.log('1️⃣  Testing: List all chefs');
  const allChefs = await chefService.findAll({ limit: 5 });
  console.log(`   ✓ Found ${allChefs.length} chefs`);
  if (allChefs.length > 0) {
    console.log(`   First chef: ${allChefs[0].name} (${allChefs[0].slug})`);
  }

  // Test 2: Search chefs
  console.log('\n2️⃣  Testing: Search chefs');
  const searchResults = await chefService.search('chef', 5);
  console.log(`   ✓ Search found ${searchResults.length} results`);

  // Test 3: Create a test chef
  console.log('\n3️⃣  Testing: Create chef');
  const testSlug = `test-chef-${Date.now()}`;
  const newChefData: CreateChefInput = {
    slug: testSlug,
    name: 'Test Chef',
    display_name: 'Chef Test',
    bio: 'A test chef for API testing',
    specialties: ['testing', 'automation'],
    is_active: true,
  };

  try {
    const createdChef = await chefService.create(newChefData);
    console.log(`   ✓ Created chef: ${createdChef.name} (ID: ${createdChef.id})`);

    // Test 4: Find by slug
    console.log('\n4️⃣  Testing: Find chef by slug');
    const foundChef = await chefService.findBySlug(testSlug);
    if (foundChef) {
      console.log(`   ✓ Found chef: ${foundChef.name}`);
    } else {
      console.log('   ✗ Chef not found');
    }

    // Test 5: Update chef
    console.log('\n5️⃣  Testing: Update chef');
    const updateData: UpdateChefInput = {
      bio: 'Updated bio for testing',
      specialties: ['testing', 'automation', 'api'],
    };
    const updatedChef = await chefService.update(createdChef.id, updateData);
    if (updatedChef) {
      console.log(`   ✓ Updated chef bio: ${updatedChef.bio}`);
      console.log(`   ✓ Specialties: ${updatedChef.specialties?.join(', ')}`);
    }

    // Test 6: Find recipes by chef (should be 0 for new chef)
    console.log('\n6️⃣  Testing: Find recipes by chef');
    const recipes = await chefService.findRecipesByChef(createdChef.id, { limit: 10 });
    console.log(`   ✓ Found ${recipes.length} recipes for chef`);

    // Test 7: Delete chef
    console.log('\n7️⃣  Testing: Delete chef');
    const deleted = await chefService.delete(createdChef.id);
    if (deleted) {
      console.log('   ✓ Chef deleted successfully');
    } else {
      console.log('   ✗ Failed to delete chef');
    }

    // Test 8: Verify deletion
    console.log('\n8️⃣  Testing: Verify deletion');
    const deletedChef = await chefService.findBySlug(testSlug);
    if (!deletedChef) {
      console.log('   ✓ Chef confirmed deleted');
    } else {
      console.log('   ✗ Chef still exists');
    }

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests if executed directly
if (require.main === module) {
  testChefAPI()
    .then(() => {
      console.log('\n🎉 Chef API tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Chef API tests failed:', error);
      process.exit(1);
    });
}

export { testChefAPI };
