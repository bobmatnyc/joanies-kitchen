import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

interface MalformedRecord {
  recipeId: string;
  recipeName: string;
  field: 'tags' | 'images';
  value: string;
  error: string;
}

async function findMalformedJson() {
  console.log('🔍 Scanning database for recipes with malformed JSON...\n');

  try {
    // Fetch all recipes
    const allRecipes = await db.select().from(recipes);
    console.log(`📊 Total recipes to scan: ${allRecipes.length}\n`);

    const malformedRecords: MalformedRecord[] = [];
    let validTags = 0;
    let validImages = 0;
    let nullTags = 0;
    let nullImages = 0;

    for (const recipe of allRecipes) {
      // Check tags field
      if (recipe.tags) {
        try {
          JSON.parse(recipe.tags as string);
          validTags++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          malformedRecords.push({
            recipeId: recipe.id,
            recipeName: recipe.name,
            field: 'tags',
            value: recipe.tags as string,
            error: errorMessage,
          });
        }
      } else {
        nullTags++;
      }

      // Check images field
      if (recipe.images) {
        try {
          JSON.parse(recipe.images as string);
          validImages++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          malformedRecords.push({
            recipeId: recipe.id,
            recipeName: recipe.name,
            field: 'images',
            value: recipe.images as string,
            error: errorMessage,
          });
        }
      } else {
        nullImages++;
      }
    }

    // Print summary statistics
    console.log('📈 Summary Statistics:');
    console.log(`   Valid tags: ${validTags}`);
    console.log(`   Valid images: ${validImages}`);
    console.log(`   Null tags: ${nullTags}`);
    console.log(`   Null images: ${nullImages}`);
    console.log(`   Malformed records: ${malformedRecords.length}\n`);

    if (malformedRecords.length === 0) {
      console.log('✅ No malformed JSON found! All records are valid.\n');
      return;
    }

    // Print malformed records (first 10)
    console.log('❌ Malformed JSON Records:\n');
    const recordsToShow = Math.min(10, malformedRecords.length);

    for (let i = 0; i < recordsToShow; i++) {
      const record = malformedRecords[i];
      console.log(`${i + 1}. Recipe: "${record.recipeName}" (ID: ${record.recipeId})`);
      console.log(`   Field: ${record.field}`);
      console.log(`   Error: ${record.error}`);
      console.log(
        `   Value: ${record.value.substring(0, 200)}${record.value.length > 200 ? '...' : ''}`
      );
      console.log('');
    }

    if (malformedRecords.length > recordsToShow) {
      console.log(`... and ${malformedRecords.length - recordsToShow} more malformed records.\n`);
    }

    // Group by field
    const malformedTags = malformedRecords.filter((r) => r.field === 'tags');
    const malformedImages = malformedRecords.filter((r) => r.field === 'images');

    console.log('📊 Breakdown by field:');
    console.log(`   Malformed tags: ${malformedTags.length}`);
    console.log(`   Malformed images: ${malformedImages.length}\n`);

    // Group by error type
    const errorTypes = new Map<string, number>();
    for (const record of malformedRecords) {
      const errorKey = record.error.split(' at position')[0]; // Group similar errors
      errorTypes.set(errorKey, (errorTypes.get(errorKey) || 0) + 1);
    }

    console.log('📊 Breakdown by error type:');
    for (const [errorType, count] of errorTypes.entries()) {
      console.log(`   ${errorType}: ${count}`);
    }
    console.log('');

    // Export full list to file
    const fs = await import('node:fs');
    const reportPath = '/Users/masa/Projects/recipe-manager/tmp/malformed-json-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(malformedRecords, null, 2));
    console.log(`📄 Full report exported to: ${reportPath}\n`);
  } catch (error) {
    console.error('❌ Error scanning database:', error);
    process.exit(1);
  }

  process.exit(0);
}

findMalformedJson();
