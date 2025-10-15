import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function testGetSharedRecipes() {
  console.log('\n=== Testing getSharedRecipes() function ===\n');

  try {
    // Direct database query to simulate getSharedRecipes()
    console.log('1. Fetching public recipes...');
    const publicRecipes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.isPublic, true))
      .limit(5);

    console.log(`   ✓ Found ${publicRecipes.length} public recipes`);

    if (publicRecipes.length > 0) {
      console.log('\n2. Sample public recipe:');
      const sample = publicRecipes[0];
      console.log(`   - ID: ${sample.id}`);
      console.log(`   - Name: ${sample.name}`);
      console.log(`   - User ID: ${sample.userId}`);
      console.log(`   - Is Public: ${sample.isPublic}`);
      console.log(`   - Is System Recipe: ${sample.isSystemRecipe}`);
      console.log(`   - Created: ${sample.createdAt}`);
    }

    // Test query without error
    console.log('\n3. Testing complete schema access...');
    const testQuery = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        userId: recipes.userId,
        isPublic: recipes.isPublic,
        isSystemRecipe: recipes.isSystemRecipe,
        images: recipes.images,
      })
      .from(recipes)
      .limit(1);

    console.log('   ✓ All schema columns accessible');

    console.log('\n=== ✓ Schema mismatch RESOLVED ===');
    console.log('- user_id column: EXISTS');
    console.log('- is_public column: EXISTS');
    console.log('- is_system_recipe column: EXISTS');
    console.log('- images column: EXISTS');
    console.log('\ngetSharedRecipes() should now work without errors!');

  } catch (error) {
    console.error('\n✗ Error testing shared recipes:', error);
    throw error;
  }
}

testGetSharedRecipes();
