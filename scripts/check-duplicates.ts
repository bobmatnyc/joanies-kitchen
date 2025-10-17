import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

interface DuplicateGroup {
  name: string;
  count: number;
  ids: string[];
  ratings: (number | null)[];
  sources: (string | null)[];
}

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate recipes...\n');

  // Find duplicates by exact name match
  const duplicatesByName = await db.execute(sql`
    SELECT
      LOWER(TRIM(name)) as normalized_name,
      COUNT(*) as count,
      ARRAY_AGG(id) as ids,
      ARRAY_AGG(system_rating) as ratings,
      ARRAY_AGG(source) as sources,
      ARRAY_AGG(name) as original_names
    FROM recipes
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  // Find duplicates by source URL (excluding nulls)
  const duplicatesBySource = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as count,
      ARRAY_AGG(id) as ids,
      ARRAY_AGG(name) as names,
      ARRAY_AGG(system_rating) as ratings
    FROM recipes
    WHERE source IS NOT NULL AND source != ''
    GROUP BY source
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  // Get total recipe count
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as total FROM recipes
  `);
  const totalRecipes = (totalResult.rows[0] as any).total;

  console.log(`📊 Total recipes in database: ${totalRecipes}\n`);

  // Report duplicates by name
  if (duplicatesByName.rows.length > 0) {
    console.log(`❌ Found ${duplicatesByName.rows.length} duplicate recipe names:\n`);

    let totalDuplicateRecipes = 0;

    for (const row of duplicatesByName.rows as any[]) {
      const count = parseInt(row.count, 10);
      totalDuplicateRecipes += count - 1; // -1 because one is the original

      // Parse arrays if they're strings
      const ids = Array.isArray(row.ids) ? row.ids : JSON.parse(row.ids || '[]');
      const ratings = Array.isArray(row.ratings) ? row.ratings : JSON.parse(row.ratings || '[]');
      const sources = Array.isArray(row.sources) ? row.sources : JSON.parse(row.sources || '[]');
      const names = Array.isArray(row.original_names)
        ? row.original_names
        : JSON.parse(row.original_names || '[]');

      console.log(`📝 "${names[0]}" (${count} copies)`);
      console.log(`   IDs: ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''}`);

      if (ratings && ratings.length > 0) {
        console.log(
          `   Ratings: ${ratings
            .slice(0, 5)
            .map((r: any) => (r ? parseFloat(r).toFixed(1) : 'N/A'))
            .join(', ')}${ratings.length > 5 ? '...' : ''}`
        );
      }

      if (sources && sources.length > 0) {
        console.log(
          `   Sources: ${sources
            .slice(0, 2)
            .map((s: any) => (s ? s.substring(0, 50) : 'None'))
            .join(' | ')}${sources.length > 2 ? '...' : ''}`
        );
      }
      console.log('');
    }

    console.log(`   Total duplicate recipes by name: ${totalDuplicateRecipes}\n`);
  } else {
    console.log('✅ No duplicate recipe names found\n');
  }

  // Report duplicates by source
  if (duplicatesBySource.rows.length > 0) {
    console.log(`❌ Found ${duplicatesBySource.rows.length} duplicate source URLs:\n`);

    let totalDuplicateSources = 0;

    for (const row of duplicatesBySource.rows as any[]) {
      const count = parseInt(row.count, 10);
      totalDuplicateSources += count - 1;

      // Parse arrays if they're strings
      const ids = Array.isArray(row.ids) ? row.ids : JSON.parse(row.ids || '[]');
      const names = Array.isArray(row.names) ? row.names : JSON.parse(row.names || '[]');
      const ratings = Array.isArray(row.ratings) ? row.ratings : JSON.parse(row.ratings || '[]');

      console.log(`🔗 ${row.source.substring(0, 80)}... (${count} copies)`);
      console.log(`   Names: ${names.slice(0, 2).join(', ')}${names.length > 2 ? '...' : ''}`);
      console.log(`   IDs: ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''}`);

      if (ratings && ratings.length > 0) {
        console.log(
          `   Ratings: ${ratings
            .slice(0, 3)
            .map((r: any) => (r ? parseFloat(r).toFixed(1) : 'N/A'))
            .join(', ')}`
        );
      }
      console.log('');
    }

    console.log(`   Total duplicate recipes by source: ${totalDuplicateSources}\n`);
  } else {
    console.log('✅ No duplicate source URLs found\n');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total recipes: ${totalRecipes}`);
  console.log(`Duplicate groups (by name): ${duplicatesByName.rows.length}`);
  console.log(`Duplicate groups (by source): ${duplicatesBySource.rows.length}`);

  const estimatedDuplicates = Math.max(
    duplicatesByName.rows.reduce((sum: number, row: any) => sum + (parseInt(row.count, 10) - 1), 0),
    duplicatesBySource.rows.reduce(
      (sum: number, row: any) => sum + (parseInt(row.count, 10) - 1),
      0
    )
  );

  console.log(`Estimated duplicate recipes: ~${estimatedDuplicates}`);
  console.log(`Estimated unique recipes: ~${totalRecipes - estimatedDuplicates}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (duplicatesByName.rows.length > 0 || duplicatesBySource.rows.length > 0) {
    console.log('💡 To remove duplicates, run: pnpm run db:dedupe');
    console.log('   This will keep the recipe with the highest rating and delete the rest.\n');
  }

  process.exit(0);
}

checkDuplicates().catch((error) => {
  console.error('Error checking duplicates:', error);
  process.exit(1);
});
