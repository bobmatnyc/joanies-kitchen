import { db } from '@/lib/db/index.js';
import { ingredients } from '@/lib/db/ingredients-schema.js';
import { sql } from 'drizzle-orm';

async function verifyDistribution() {
  console.log('FINAL INGREDIENT ONTOLOGY DISTRIBUTION');
  console.log('=' .repeat(60));

  // Get distribution by type
  const typeDistribution = await db
    .select({
      type: ingredients.type,
      count: sql<number>`count(*)::int`,
    })
    .from(ingredients)
    .groupBy(ingredients.type)
    .orderBy(sql`count(*) DESC`);

  console.log('\nDistribution by Type:');
  let totalIngredients = 0;
  typeDistribution.forEach(row => {
    console.log(`  ${row.type}: ${row.count}`);
    totalIngredients += row.count;
  });
  console.log(`  TOTAL: ${totalIngredients}`);

  // Get distribution by subtype (top 30)
  const subtypeDistribution = await db
    .select({
      type: ingredients.type,
      subtype: ingredients.subtype,
      count: sql<number>`count(*)::int`,
    })
    .from(ingredients)
    .groupBy(ingredients.type, ingredients.subtype)
    .orderBy(sql`count(*) DESC`)
    .limit(30);

  console.log('\nTop 30 Subtypes:');
  subtypeDistribution.forEach(row => {
    console.log(`  ${row.type}/${row.subtype}: ${row.count}`);
  });

  // Check for remaining other_other
  const otherOtherCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ingredients)
    .where(sql`${ingredients.subtype} = 'other_other'`);

  console.log(`\n✅ Verification complete!`);
  console.log(`   Remaining "other_other": ${otherOtherCount[0]?.count || 0}`);

  process.exit(0);
}

verifyDistribution().catch(console.error);
