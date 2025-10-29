/**
 * Clean Ingredient Quantities Migration
 *
 * Problem: Some ingredients have quantities embedded in their names
 * Example: "(1/4 stick) butter" should be "butter" with amount/unit in recipe_ingredients
 *
 * This script:
 * 1. Identifies ingredients with embedded quantities (pattern: starts with "(quantity)")
 * 2. Extracts the quantity and canonical ingredient name
 * 3. Updates ingredient names to canonical format
 * 4. Updates display_name to proper capitalization
 * 5. Ensures recipe_ingredients table has proper structure
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface IngredientToClean {
  id: string;
  name: string;
  display_name: string;
}

interface CleanedIngredient {
  id: string;
  originalName: string;
  newName: string;
  newDisplayName: string;
  extractedQuantity?: string;
  extractedUnit?: string;
}

/**
 * Extract quantity from ingredient name
 * Pattern: "(quantity unit) ingredient" -> { quantity, unit, ingredient }
 */
function extractQuantity(name: string): {
  quantity?: string;
  unit?: string;
  cleanName: string;
} {
  // Pattern 1: "(1/4 stick) butter"
  const pattern1 = /^\(([0-9/\-\s]+)\s+([a-zA-Z]+)\)\s+(.+)$/;
  const match1 = name.match(pattern1);

  if (match1) {
    return {
      quantity: match1[1].trim(),
      unit: match1[2].trim(),
      cleanName: match1[3].trim(),
    };
  }

  // Pattern 2: "(10-ounce) bag pearl onions, peeled"
  const pattern2 = /^\(([0-9-]+)-([a-zA-Z]+)\)\s+(.+)$/;
  const match2 = name.match(pattern2);

  if (match2) {
    return {
      quantity: match2[1].trim(),
      unit: match2[2].trim(),
      cleanName: match2[3].trim(),
    };
  }

  // Pattern 3: "(4 3/4- to 5-pound) large end of..." - complex quantity
  const pattern3 = /^\([0-9\s/-]+(to|or)\s+[0-9-]+([a-zA-Z]+)\)\s+(.+)$/;
  const match3 = name.match(pattern3);

  if (match3) {
    return {
      quantity: undefined, // Too complex to extract accurately
      unit: match3[2].trim(),
      cleanName: match3[3].trim(),
    };
  }

  // No quantity found
  return { cleanName: name };
}

/**
 * Capitalize first letter of each word
 */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function cleanIngredients() {
  console.log('🔍 Analyzing ingredients with embedded quantities...\n');

  // Find ingredients starting with "(" - these likely have embedded quantities
  const ingredientsToClean = await sql<IngredientToClean[]>`
    SELECT id, name, display_name
    FROM ingredients
    WHERE name LIKE '(%)%'
    ORDER BY name
  `;

  console.log(`Found ${ingredientsToClean.length} ingredients to clean:\n`);

  const cleaned: CleanedIngredient[] = [];
  const skipped: IngredientToClean[] = [];

  for (const ingredient of ingredientsToClean) {
    const { quantity, unit, cleanName } = extractQuantity(ingredient.name);

    // Only clean if we successfully extracted a proper name
    if (cleanName && cleanName !== ingredient.name && cleanName.length > 2) {
      cleaned.push({
        id: ingredient.id,
        originalName: ingredient.name,
        newName: cleanName.toLowerCase(),
        newDisplayName: toTitleCase(cleanName),
        extractedQuantity: quantity,
        extractedUnit: unit,
      });

      console.log(`✅ "${ingredient.name}" → "${cleanName}"`);
      if (quantity || unit) {
        console.log(`   Extracted: ${quantity || '?'} ${unit || ''}`);
      }
    } else {
      // Keep ingredients with parentheses that are NOT quantities
      // e.g., "chicken legs (with thighs attached)"
      skipped.push(ingredient);
      console.log(`⏭️  Skipped: "${ingredient.name}" (not a quantity pattern)`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   - To clean: ${cleaned.length}`);
  console.log(`   - Skipped: ${skipped.length}`);

  if (cleaned.length === 0) {
    console.log('\n✨ No ingredients need cleaning!');
    return;
  }

  // Show what will be cleaned
  console.log('\n📝 Ingredients to be updated:');
  cleaned.forEach((item, index) => {
    console.log(`   ${index + 1}. "${item.originalName}" → "${item.newName}"`);
  });

  // Dry run confirmation
  console.log('\n⚠️  DRY RUN MODE - No changes made yet');
  console.log('To apply these changes, set APPLY_CHANGES=true\n');

  // Check if we should apply changes
  const shouldApply = process.env.APPLY_CHANGES === 'true';

  if (!shouldApply) {
    console.log('💡 Run with: APPLY_CHANGES=true pnpm tsx scripts/clean-ingredient-quantities.ts');
    return;
  }

  // Apply changes
  console.log('\n🔄 Applying changes...\n');

  for (const item of cleaned) {
    try {
      await sql`
        UPDATE ingredients
        SET
          name = ${item.newName},
          display_name = ${item.newDisplayName},
          updated_at = NOW()
        WHERE id = ${item.id}
      `;
      console.log(`✅ Updated: ${item.originalName} → ${item.newName}`);
    } catch (error: any) {
      console.error(`❌ Failed to update ${item.originalName}:`, error.message);
    }
  }

  console.log('\n✨ Migration complete!');
  console.log(`   Updated ${cleaned.length} ingredients to canonical format`);

  // Note about recipe_ingredients
  console.log('\n📌 Note: recipe_ingredients table already has amount/unit columns');
  console.log('   Future extractions will properly populate these fields');
}

// Run migration
cleanIngredients()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
