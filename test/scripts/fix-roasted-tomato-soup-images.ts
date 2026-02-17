import 'dotenv/config';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { put } from '@vercel/blob';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function fixRoastedTomatoSoupImages() {
  console.log('🔍 Finding Roasted Tomato Soup recipe...');

  // Find the recipe by slug
  const recipe = await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, 'roasted-tomato-soup'))
    .limit(1);

  if (!recipe || recipe.length === 0) {
    console.error('❌ Recipe not found with slug: roasted-tomato-soup');
    return;
  }

  const targetRecipe = recipe[0];
  console.log(`✅ Found recipe: ${targetRecipe.name}`);
  console.log(`📋 Recipe ID: ${targetRecipe.id}`);

  // Check current images
  const currentImages = targetRecipe.images ? JSON.parse(targetRecipe.images) : [];
  console.log(`📸 Current images (${currentImages.length}):`, currentImages);

  // Generate new image with DALL-E 3
  console.log('\n🎨 Generating new image with DALL-E 3...');

  const imagePrompt = `Professional food photography of a bowl of roasted tomato soup.
The soup is a vibrant red-orange color with a smooth, velvety texture.
It's garnished with a drizzle of cream, fresh basil leaves, and croutons.
The bowl is white ceramic, placed on a rustic wooden table with soft natural lighting.
High-quality, appetizing, restaurant-quality presentation.
Shot from a slight overhead angle with shallow depth of field.`;

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    });

    const imageUrl = response.data[0].url;
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E 3');
    }

    console.log(`✅ Generated image URL: ${imageUrl}`);

    // Download the image
    console.log('\n⬇️  Downloading generated image...');
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

    // Upload to Vercel Blob
    console.log('☁️  Uploading to Vercel Blob...');
    const filename = `recipe-images/roasted-tomato-soup-${Date.now()}.png`;
    const blobResult = await put(filename, imageBlob, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`✅ Uploaded to Vercel Blob: ${blobResult.url}`);

    // Update recipe with new image
    console.log('\n💾 Updating recipe in database...');
    const newImages = [blobResult.url];

    await db
      .update(recipes)
      .set({
        images: JSON.stringify(newImages),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, targetRecipe.id));

    console.log('✅ Recipe updated successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Old images count: ${currentImages.length}`);
    console.log(`  - New images count: ${newImages.length}`);
    console.log(`  - New image URL: ${blobResult.url}`);
    console.log(`\n🌐 View recipe at: http://localhost:3002/recipes/roasted-tomato-soup`);

  } catch (error) {
    console.error('❌ Error generating or uploading image:', error);
    throw error;
  }
}

// Run the script
fixRoastedTomatoSoupImages()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
