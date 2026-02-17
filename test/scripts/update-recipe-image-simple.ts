import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

// Get recipe ID and new image URL from command line
const recipeId = process.argv[2];
const newImageUrl = process.argv[3];

if (!recipeId || !newImageUrl) {
  console.error('❌ Usage: npx tsx scripts/update-recipe-image-simple.ts <recipe-id> <image-url>');
  console.error('');
  console.error('Example:');
  console.error(
    '  npx tsx scripts/update-recipe-image-simple.ts abc123 "https://images.unsplash.com/..."'
  );
  process.exit(1);
}

async function updateRecipeImage() {
  try {
    console.log(`🔍 Fetching recipe: ${recipeId}`);

    // Fetch the recipe
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (!recipe) {
      console.error(`❌ Recipe not found: ${recipeId}`);
      process.exit(1);
    }

    console.log(`✓ Found recipe: "${recipe.name}"`);

    // Get current image
    let currentImages: string[] = [];
    if (recipe.images) {
      try {
        currentImages = JSON.parse(recipe.images);
      } catch (_e) {
        console.warn('⚠️ Could not parse existing images JSON');
      }
    }
    console.log(`  Current image: ${currentImages.length > 0 ? currentImages[0] : 'None'}`);
    console.log(`  New image: ${newImageUrl}`);

    // Update recipe with new image
    console.log('');
    console.log(`💾 Updating recipe in database...`);

    const newImages = JSON.stringify([newImageUrl]);

    await db
      .update(recipes)
      .set({
        images: newImages,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    console.log('✅ Recipe image updated successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  Recipe: ${recipe.name}`);
    console.log(`  Old Image: ${currentImages.length > 0 ? currentImages[0] : 'None'}`);
    console.log(`  New Image: ${newImageUrl}`);
  } catch (error) {
    console.error('❌ Error updating recipe image:', error);
    throw error;
  }
}

// Run the update
updateRecipeImage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
