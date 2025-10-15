import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { sql, desc, asc } from 'drizzle-orm';

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate recipes...\n');

  // Get all recipes
  const allRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      source: recipes.source,
      systemRating: recipes.systemRating,
      createdAt: recipes.createdAt,
    })
    .from(recipes)
    .orderBy(asc(recipes.name));

  console.log(`📊 Total recipes in database: ${allRecipes.length}\n`);

  // Group by normalized name
  const nameGroups = new Map<string, typeof allRecipes>();

  for (const recipe of allRecipes) {
    const normalizedName = recipe.name.toLowerCase().trim();
    if (!nameGroups.has(normalizedName)) {
      nameGroups.set(normalizedName, []);
    }
    nameGroups.get(normalizedName)!.push(recipe);
  }

  // Find duplicates
  const duplicateGroups = Array.from(nameGroups.entries())
    .filter(([_, recipes]) => recipes.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (duplicateGroups.length > 0) {
    console.log(`❌ Found ${duplicateGroups.length} duplicate recipe names:\n`);

    let totalDuplicates = 0;

    for (const [normalizedName, dupes] of duplicateGroups.slice(0, 20)) {
      totalDuplicates += dupes.length - 1;

      console.log(`📝 "${dupes[0].name}" (${dupes.length} copies)`);
      console.log(`   IDs: ${dupes.slice(0, 3).map(r => r.id.substring(0, 8)).join(', ')}${dupes.length > 3 ? '...' : ''}`);

      const ratings = dupes.map(r => r.systemRating).filter(r => r !== null);
      if (ratings.length > 0) {
        console.log(`   Ratings: ${ratings.slice(0, 5).map(r => parseFloat(r!).toFixed(1)).join(', ')}${ratings.length > 5 ? '...' : ''}`);
      }

      const sources = dupes.map(r => r.source).filter(s => s && s !== '');
      if (sources.length > 0) {
        console.log(`   Sources: ${sources.slice(0, 2).map(s => s!.substring(0, 60)).join(' | ')}${sources.length > 2 ? '...' : ''}`);
      }

      console.log('');
    }

    if (duplicateGroups.length > 20) {
      console.log(`   ... and ${duplicateGroups.length - 20} more duplicate groups\n`);
    }

    console.log(`   Total duplicate recipes: ${totalDuplicates}\n`);
  } else {
    console.log('✅ No duplicate recipe names found\n');
  }

  // Group by source URL
  const sourceGroups = new Map<string, typeof allRecipes>();

  for (const recipe of allRecipes) {
    if (recipe.source && recipe.source !== '') {
      if (!sourceGroups.has(recipe.source)) {
        sourceGroups.set(recipe.source, []);
      }
      sourceGroups.get(recipe.source)!.push(recipe);
    }
  }

  const duplicateSourceGroups = Array.from(sourceGroups.entries())
    .filter(([_, recipes]) => recipes.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (duplicateSourceGroups.length > 0) {
    console.log(`❌ Found ${duplicateSourceGroups.length} duplicate source URLs:\n`);

    let totalSourceDuplicates = 0;

    for (const [source, dupes] of duplicateSourceGroups.slice(0, 10)) {
      totalSourceDuplicates += dupes.length - 1;

      console.log(`🔗 ${source.substring(0, 80)}... (${dupes.length} copies)`);
      console.log(`   Names: ${dupes.slice(0, 2).map(r => r.name).join(', ')}${dupes.length > 2 ? '...' : ''}`);
      console.log(`   IDs: ${dupes.slice(0, 3).map(r => r.id.substring(0, 8)).join(', ')}${dupes.length > 3 ? '...' : ''}`);
      console.log('');
    }

    if (duplicateSourceGroups.length > 10) {
      console.log(`   ... and ${duplicateSourceGroups.length - 10} more duplicate source URLs\n`);
    }

    console.log(`   Total duplicate recipes by source: ${totalSourceDuplicates}\n`);
  } else {
    console.log('✅ No duplicate source URLs found\n');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total recipes: ${allRecipes.length}`);
  console.log(`Duplicate groups (by name): ${duplicateGroups.length}`);
  console.log(`Duplicate groups (by source): ${duplicateSourceGroups.length}`);

  const estimatedDuplicates = Math.max(
    duplicateGroups.reduce((sum, [_, dupes]) => sum + (dupes.length - 1), 0),
    duplicateSourceGroups.reduce((sum, [_, dupes]) => sum + (dupes.length - 1), 0)
  );

  const uniqueRecipes = allRecipes.length - estimatedDuplicates;

  console.log(`Estimated duplicate recipes: ~${estimatedDuplicates} (${((estimatedDuplicates / allRecipes.length) * 100).toFixed(1)}%)`);
  console.log(`Estimated unique recipes: ~${uniqueRecipes} (${((uniqueRecipes / allRecipes.length) * 100).toFixed(1)}%)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (duplicateGroups.length > 0) {
    console.log('💡 To remove duplicates, run: pnpm run db:dedupe');
    console.log('   This will keep the recipe with the highest rating and oldest created date.\n');
  }

  process.exit(0);
}

checkDuplicates().catch((error) => {
  console.error('Error checking duplicates:', error);
  process.exit(1);
});
