/**
 * Test script to verify Top 50 categorization works correctly
 */

import { or, sql } from 'drizzle-orm';
import { desc } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';

// Category detection based on tags (same as in the generation script)
function determineCategory(tags: string | null): string {
  if (!tags) return 'generic';

  try {
    const tagArray = JSON.parse(tags);
    const normalizedTags = tagArray.map((t: string) => t.toLowerCase());

    if (normalizedTags.some((t: string) => ['beef', 'steak', 'roast'].some((k) => t.includes(k))))
      return 'beef';
    if (normalizedTags.some((t: string) => ['chicken', 'poultry'].some((k) => t.includes(k))))
      return 'chicken';
    if (normalizedTags.some((t: string) => t.includes('lamb'))) return 'lamb';
    if (normalizedTags.some((t: string) => ['pasta', 'noodles', 'spaghetti', 'lasagna'].some((k) => t.includes(k))))
      return 'pasta';
    if (normalizedTags.some((t: string) => ['seafood', 'fish', 'salmon', 'shrimp'].some((k) => t.includes(k))))
      return 'seafood';
    if (normalizedTags.some((t: string) => ['pork', 'bacon', 'ham'].some((k) => t.includes(k))))
      return 'pork';
    if (normalizedTags.some((t: string) => ['vegetables', 'vegetable', 'veggie'].some((k) => t.includes(k))))
      return 'vegetables';
    if (normalizedTags.some((t: string) => t.includes('salad'))) return 'salad';
    if (normalizedTags.some((t: string) => ['rice', 'quinoa', 'grain'].some((k) => t.includes(k))))
      return 'grains';
    if (normalizedTags.some((t: string) => t.includes('potato'))) return 'potatoes';
    if (normalizedTags.some((t: string) => ['bread', 'roll', 'biscuit'].some((k) => t.includes(k))))
      return 'bread';
    if (normalizedTags.some((t: string) => ['cake', 'cupcake'].some((k) => t.includes(k))))
      return 'cakes';
    if (normalizedTags.some((t: string) => t.includes('cookie'))) return 'cookies';
    if (normalizedTags.some((t: string) => ['pie', 'tart'].some((k) => t.includes(k)))) return 'pies';
    if (normalizedTags.some((t: string) => ['pudding', 'custard', 'mousse'].some((k) => t.includes(k))))
      return 'puddings';
    if (normalizedTags.some((t: string) => ['ice cream', 'sorbet', 'frozen'].some((k) => t.includes(k))))
      return 'frozen';

    return 'generic';
  } catch (error) {
    return 'generic';
  }
}

async function main() {
  console.log('=== Top 50 Recipe Categorization Test ===\n');

  // Get Top 50 recipes
  const topRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      tags: recipes.tags,
      images: recipes.images,
      system_rating: recipes.system_rating,
      avg_user_rating: recipes.avg_user_rating,
    })
    .from(recipes)
    .where(
      or(
        sql`${recipes.system_rating} IS NOT NULL`,
        sql`${recipes.avg_user_rating} IS NOT NULL`
      )
    )
    .orderBy(
      desc(
        sql`COALESCE(
          (COALESCE(${recipes.system_rating}, 0) + COALESCE(${recipes.avg_user_rating}, 0)) /
          NULLIF(
            (CASE WHEN ${recipes.system_rating} IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN ${recipes.avg_user_rating} IS NOT NULL THEN 1 ELSE 0 END),
            0
          ),
          COALESCE(${recipes.system_rating}, ${recipes.avg_user_rating}, 0)
        )`
      )
    )
    .limit(50);

  console.log(`Total Top 50 recipes: ${topRecipes.length}\n`);

  // Categorize recipes
  const categoryCounts: Record<string, number> = {};
  const categoryExamples: Record<string, string[]> = {};
  let recipesWithImages = 0;
  let recipesWithoutImages = 0;

  topRecipes.forEach((recipe) => {
    const category = determineCategory(recipe.tags);

    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    if (!categoryExamples[category]) {
      categoryExamples[category] = [];
    }
    if (categoryExamples[category].length < 3) {
      categoryExamples[category].push(recipe.name);
    }

    // Check image status
    if (!recipe.images) {
      recipesWithoutImages++;
    } else {
      try {
        const images = JSON.parse(recipe.images);
        if (!Array.isArray(images) || images.length === 0) {
          recipesWithoutImages++;
        } else {
          recipesWithImages++;
        }
      } catch {
        recipesWithoutImages++;
      }
    }
  });

  // Display categorization results
  console.log('Category Distribution:');
  console.log('─'.repeat(80));

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  for (const [category, count] of sortedCategories) {
    const percentage = ((count / topRecipes.length) * 100).toFixed(1);
    console.log(`\n${category.toUpperCase()}: ${count} recipes (${percentage}%)`);
    console.log(`Examples: ${categoryExamples[category].join(', ')}`);
  }

  // Display image status
  console.log('\n' + '─'.repeat(80));
  console.log('\nImage Status:');
  console.log(`✅ With images: ${recipesWithImages}`);
  console.log(`❌ Without images: ${recipesWithoutImages}`);

  // Cost estimate
  const costPerImage = 0.04;
  const estimatedCost = recipesWithoutImages * costPerImage;
  console.log(`\n💰 Estimated cost to generate missing images: $${estimatedCost.toFixed(2)} USD`);
  console.log(`   (DALL-E 3 standard quality: $0.04 per image)`);

  console.log('\n' + '─'.repeat(80));
}

main()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
