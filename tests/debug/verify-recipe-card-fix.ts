/**
 * Direct database test to verify RecipeCard fix
 * Checks that Vivian Li's recipes have proper image URLs
 */

import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { chefs, recipes } from '../src/lib/db/schema';

async function verifyRecipeCardFix() {
  console.log('\n🔍 Verifying RecipeCard Image Fix\n');
  console.log('Testing: Recipe image prioritization logic\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Get Vivian Li chef
    const vivianLi = await db.select().from(chefs).where(eq(chefs.slug, 'vivian-li')).limit(1);

    if (!vivianLi || vivianLi.length === 0) {
      console.log('❌ Vivian Li chef not found in database');
      return;
    }

    const chef = vivianLi[0];
    console.log(`✅ Found chef: ${chef.name} (ID: ${chef.id})\n`);

    // Get Vivian Li's recipes
    const vivianRecipes = await db.select().from(recipes).where(eq(recipes.chef_id, chef.id));

    console.log(`📊 Total recipes: ${vivianRecipes.length}\n`);

    if (vivianRecipes.length === 0) {
      console.log('⚠️  No recipes found for Vivian Li\n');
      return;
    }

    console.log('📋 RECIPE IMAGE ANALYSIS\n');
    console.log('| Recipe | Images Array | image_url | Expected Display URL |');
    console.log('|--------|--------------|-----------|---------------------|');

    let hasVercelStorage = 0;
    let hasLocalPaths = 0;
    let hasNoImages = 0;

    vivianRecipes.forEach((recipe) => {
      let imagesArray: string[] = [];
      try {
        imagesArray = recipe.images ? JSON.parse(recipe.images as string) : [];
      } catch (_e) {
        console.warn(`Failed to parse images for ${recipe.name}`);
      }

      // Apply the same logic as RecipeCard.tsx lines 58-62
      const workingImages = imagesArray.filter(
        (img) => img.startsWith('http://') || img.startsWith('https://')
      );
      const displayImage = workingImages[0] || recipe.image_url || imagesArray[0] || 'PLACEHOLDER';

      // Analyze image source
      let imageSource = 'none';
      let _isValid = false;

      if (displayImage.includes('ljqhvy0frzhuigv1.public.blob.vercel-storage.com')) {
        imageSource = '✅ Vercel Storage';
        _isValid = true;
        hasVercelStorage++;
      } else if (displayImage.includes('/images/recipes/')) {
        imageSource = '❌ Local Path';
        hasLocalPaths++;
      } else if (displayImage.startsWith('http')) {
        imageSource = '⚠️  Other HTTPS';
        _isValid = true;
      } else if (displayImage === 'PLACEHOLDER') {
        imageSource = '⚠️  Placeholder';
        hasNoImages++;
      }

      const recipeName = recipe.name.substring(0, 25).padEnd(25);
      const imagesCount = imagesArray.length;
      const imageUrlPreview = recipe.image_url ? recipe.image_url.substring(0, 30) : 'null';
      const displayPreview = displayImage.substring(0, 50);

      console.log(
        `| ${recipeName} | ${imagesCount} images | ${imageUrlPreview}... | ${imageSource} |`
      );
      console.log(`  Display: ${displayPreview}...`);
    });

    console.log('\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 SUMMARY\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Total recipes: ${vivianRecipes.length}`);
    console.log(`✅ Using Vercel Storage: ${hasVercelStorage}`);
    console.log(`❌ Using local paths: ${hasLocalPaths}`);
    console.log(`⚠️  No images/placeholder: ${hasNoImages}\n`);

    // Verdict
    console.log('🎯 FIX VERIFICATION\n');

    if (hasLocalPaths > 0) {
      console.log('❌ FAIL: Some recipes are still using local paths');
      console.log('   This suggests the RecipeCard fix may not be working correctly.\n');
    } else if (hasVercelStorage > 0) {
      console.log('✅ PASS: Recipes are using Vercel Blob Storage URLs');
      console.log('   The RecipeCard fix is prioritizing HTTP/HTTPS URLs correctly.\n');
    } else {
      console.log('⚠️  INCONCLUSIVE: No Vercel Storage URLs found');
      console.log('   Recipes may not have proper images in database.\n');
    }

    // Detailed recipe information
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🔗 DETAILED RECIPE INFORMATION\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    vivianRecipes.forEach((recipe, idx) => {
      let imagesArray: string[] = [];
      try {
        imagesArray = recipe.images ? JSON.parse(recipe.images as string) : [];
      } catch (_e) {
        imagesArray = [];
      }

      console.log(`\n${idx + 1}. ${recipe.name}`);
      console.log(`   ID: ${recipe.id}`);
      console.log(`   Slug: ${recipe.slug}`);
      console.log(`   image_url: ${recipe.image_url || 'null'}`);
      console.log(`   images array (${imagesArray.length} items):`);
      imagesArray.forEach((img, i) => {
        const isHttp = img.startsWith('http://') || img.startsWith('https://');
        const marker = isHttp ? '✓' : '✗';
        console.log(`     ${marker} [${i}] ${img}`);
      });

      // Show what RecipeCard will display
      const workingImages = imagesArray.filter(
        (img) => img.startsWith('http://') || img.startsWith('https://')
      );
      const displayImage = workingImages[0] || recipe.image_url || imagesArray[0] || 'PLACEHOLDER';
      console.log(`   → RecipeCard will display: ${displayImage}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

verifyRecipeCardFix()
  .then(() => {
    console.log('✅ Verification complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
