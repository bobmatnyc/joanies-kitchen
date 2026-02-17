/**
 * Generate Ingredient Placeholder Images
 *
 * This script generates placeholder image URLs for ingredients based on their category.
 * Uses Unsplash's API to get food photography for each category.
 *
 * Categories map to Unsplash collections:
 * - vegetables -> vegetables, produce
 * - fruits -> fruits, berries
 * - proteins -> meat, fish, eggs
 * - dairy -> dairy, cheese, milk
 * - grains -> grains, bread, pasta
 * - spices -> spices, herbs
 * - etc.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Category to Unsplash search query mapping
 * Using specific food photography that looks good
 */
const CATEGORY_IMAGE_MAPPING: Record<string, string> = {
  vegetables: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400', // Fresh vegetables
  fruits: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400', // Colorful fruits
  proteins: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400', // Mixed proteins
  dairy: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400', // Dairy products
  grains: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', // Grains and bread
  spices: 'https://images.unsplash.com/photo-1596040033229-a0b63fd92c73?w=400', // Spices
  herbs: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', // Fresh herbs
  condiments: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400', // Condiments
  oils: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', // Oils
  sweeteners: 'https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=400', // Sugar/honey
  nuts: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400', // Nuts
  seafood: 'https://images.unsplash.com/photo-1559737558-2f5a2d60f3a3?w=400', // Seafood
  meat: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400', // Meat
  poultry: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400', // Chicken
  cheeses: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400', // Cheese
  beverages: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400', // Beverages
  other: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400', // Generic food
};

/**
 * Get appropriate placeholder image for a category
 */
function getPlaceholderForCategory(category: string | null): string | null {
  if (!category) return CATEGORY_IMAGE_MAPPING.other;

  // Exact match
  if (CATEGORY_IMAGE_MAPPING[category]) {
    return CATEGORY_IMAGE_MAPPING[category];
  }

  // Fuzzy matching for similar categories
  const normalized = category.toLowerCase();

  if (normalized.includes('vegetable')) return CATEGORY_IMAGE_MAPPING.vegetables;
  if (normalized.includes('fruit')) return CATEGORY_IMAGE_MAPPING.fruits;
  if (normalized.includes('protein') || normalized.includes('meat'))
    return CATEGORY_IMAGE_MAPPING.proteins;
  if (normalized.includes('dairy') || normalized.includes('cheese'))
    return CATEGORY_IMAGE_MAPPING.dairy;
  if (normalized.includes('grain') || normalized.includes('flour'))
    return CATEGORY_IMAGE_MAPPING.grains;
  if (normalized.includes('spice') || normalized.includes('seasoning'))
    return CATEGORY_IMAGE_MAPPING.spices;
  if (normalized.includes('herb')) return CATEGORY_IMAGE_MAPPING.herbs;
  if (normalized.includes('oil')) return CATEGORY_IMAGE_MAPPING.oils;
  if (normalized.includes('sweet') || normalized.includes('sugar'))
    return CATEGORY_IMAGE_MAPPING.sweeteners;
  if (normalized.includes('nut')) return CATEGORY_IMAGE_MAPPING.nuts;
  if (normalized.includes('seafood') || normalized.includes('fish'))
    return CATEGORY_IMAGE_MAPPING.seafood;
  if (normalized.includes('drink') || normalized.includes('beverage'))
    return CATEGORY_IMAGE_MAPPING.beverages;

  // Default fallback
  return CATEGORY_IMAGE_MAPPING.other;
}

async function generatePlaceholderImages() {
  console.log('🎨 Generating placeholder images for ingredients...\n');

  // Get all ingredients without images
  const ingredients = await sql`
    SELECT id, name, display_name, category, image_url
    FROM ingredients
    WHERE image_url IS NULL
    ORDER BY usage_count DESC
  `;

  console.log(`Found ${ingredients.length} ingredients without images\n`);

  if (ingredients.length === 0) {
    console.log('✨ All ingredients already have images!');
    return;
  }

  // Dry run - show what would be done
  console.log('📝 Preview of image assignments:\n');

  const updates = ingredients.slice(0, 20).map((ing: any) => ({
    id: ing.id,
    name: ing.display_name,
    category: ing.category,
    imageUrl: getPlaceholderForCategory(ing.category),
  }));

  updates.forEach((u, i) => {
    console.log(`${i + 1}. ${u.name} (${u.category || 'no category'})`);
    console.log(`   → ${u.imageUrl}\n`);
  });

  console.log(`... and ${ingredients.length - 20} more\n`);
  console.log('⚠️  DRY RUN MODE - No changes made yet');
  console.log('To apply these changes, set APPLY_CHANGES=true\n');

  // Check if we should apply changes
  const shouldApply = process.env.APPLY_CHANGES === 'true';

  if (!shouldApply) {
    console.log(
      '💡 Run with: APPLY_CHANGES=true pnpm tsx scripts/generate-ingredient-placeholder-images.ts'
    );
    return;
  }

  // Apply changes - update all ingredients using batch CASE statement
  console.log('🔄 Applying placeholder images in batch...\n');

  // Group ingredients by target image URL for efficient batch update
  const imageGroups = new Map<string, string[]>();

  for (const ing of ingredients) {
    const imageUrl = getPlaceholderForCategory(ing.category);
    if (!imageUrl) continue;

    if (!imageGroups.has(imageUrl)) {
      imageGroups.set(imageUrl, []);
    }
    imageGroups.get(imageUrl)?.push(ing.id);
  }

  console.log(`Grouped ${ingredients.length} ingredients into ${imageGroups.size} image batches\n`);

  let updated = 0;
  let batchNum = 0;

  for (const [imageUrl, ids] of imageGroups.entries()) {
    batchNum++;
    try {
      // Update all ingredients with this image URL in one query
      await sql`
        UPDATE ingredients
        SET image_url = ${imageUrl}, updated_at = NOW()
        WHERE id = ANY(${ids})
      `;

      updated += ids.length;
      console.log(`✅ Batch ${batchNum}/${imageGroups.size}: Updated ${ids.length} ingredients`);
    } catch (error: any) {
      console.error(`❌ Failed batch ${batchNum}:`, error.message);
    }
  }

  console.log('\n✨ Migration complete!');
  console.log(`   Updated: ${updated} ingredients in ${imageGroups.size} batches`);
  console.log(`\n📌 Note: These are placeholder images based on category`);
  console.log('   For production, consider using AI-generated images or proper stock photos');
}

// Run migration
generatePlaceholderImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
