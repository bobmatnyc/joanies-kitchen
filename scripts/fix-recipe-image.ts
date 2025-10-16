import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';

// Get recipe ID from command line
const recipeId = process.argv[2];
const useUnsplash = process.argv.includes('--unsplash');

if (!recipeId) {
  console.error('❌ Usage: npx tsx scripts/fix-recipe-image.ts <recipe-id> [--unsplash]');
  console.error('   --unsplash: Use Unsplash API instead of AI generation (faster, free)');
  process.exit(1);
}

async function getUnsplashImage(recipeName: string, cuisine: string | null): Promise<string> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    throw new Error('UNSPLASH_ACCESS_KEY not found in environment. Get one at https://unsplash.com/developers');
  }

  // Create search query from recipe name and cuisine
  const searchTerms = [recipeName];
  if (cuisine) {
    searchTerms.push(cuisine);
  }
  searchTerms.push('food', 'recipe');

  const query = searchTerms.join(' ');
  console.log(`🔍 Searching Unsplash for: "${query}"`);

  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
    {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error('No images found on Unsplash for this recipe');
  }

  const imageUrl = data.results[0].urls.regular;
  console.log(`✓ Found Unsplash image`);

  return imageUrl;
}

async function downloadAndUploadImage(imageUrl: string, recipeName: string): Promise<string> {
  console.log(`📥 Downloading generated image...`);

  // Download the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const blob = new Blob([imageBuffer], { type: 'image/png' });

  // Create a safe filename
  const safeRecipeName = recipeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  const filename = `recipes/ai/${safeRecipeName}-${Date.now()}.png`;

  console.log(`☁️ Uploading to Vercel Blob: ${filename}`);

  // Upload to Vercel Blob
  const blobResult = await put(filename, blob, {
    access: 'public',
    contentType: 'image/png',
  });

  return blobResult.url;
}

async function fixRecipeImage() {
  try {
    console.log(`🔍 Fetching recipe: ${recipeId}`);

    // Fetch the recipe
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);

    if (!recipe) {
      console.error(`❌ Recipe not found: ${recipeId}`);
      process.exit(1);
    }

    console.log(`✓ Found recipe: "${recipe.name}"`);
    console.log(`  Cuisine: ${recipe.cuisine || 'Not specified'}`);

    // Get current image
    let currentImages: string[] = [];
    if (recipe.images) {
      try {
        currentImages = JSON.parse(recipe.images);
      } catch (e) {
        console.warn('⚠️ Could not parse existing images JSON');
      }
    }
    console.log(`  Current image(s): ${currentImages.length > 0 ? currentImages[0] : 'None'}`);

    // Get image (Unsplash or AI)
    console.log('');
    const generatedImageUrl = useUnsplash
      ? await getUnsplashImage(recipe.name, recipe.cuisine)
      : await getUnsplashImage(recipe.name, recipe.cuisine); // Default to Unsplash since AI not working
    console.log(`✓ Image retrieved successfully`);

    // Download and upload to Vercel Blob
    console.log('');
    const blobUrl = await downloadAndUploadImage(generatedImageUrl, recipe.name);
    console.log(`✓ Uploaded to Blob: ${blobUrl}`);

    // Update recipe with new image
    console.log('');
    console.log(`💾 Updating recipe in database...`);

    const newImages = JSON.stringify([blobUrl]);

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
    console.log(`  New Image: ${blobUrl}`);
  } catch (error) {
    console.error('❌ Error fixing recipe image:', error);
    throw error;
  }
}

// Run the fix
fixRecipeImage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
