import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

async function checkChefRecipes() {
  console.log('🔍 Analyzing Chef-Recipe Assignments\n');

  // Get all chefs and their recipe counts
  const results = await db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.slug,
      COUNT(r.id)::int as recipe_count
    FROM chefs c
    LEFT JOIN recipes r ON r.chef_id = c.id
    GROUP BY c.id, c.name, c.slug
    ORDER BY recipe_count DESC, c.name ASC
  `);

  console.log('📋 Chef Assignment Summary:');
  console.log('─'.repeat(70));

  let chefsWithRecipes = 0;
  let chefsWithoutRecipes = 0;
  const chefsNeedingRecipes = [];

  for (const row of results.rows as any[]) {
    const status = row.recipe_count > 0 ? '✅' : '❌';
    const name = String(row.name).padEnd(35);
    const count = String(row.recipe_count).padStart(5);
    console.log(`${status} ${name} ${count} recipes`);

    if (row.recipe_count > 0) {
      chefsWithRecipes++;
    } else {
      chefsWithoutRecipes++;
      chefsNeedingRecipes.push(row);
    }
  }

  console.log('─'.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Chefs with recipes: ${chefsWithRecipes}`);
  console.log(`   ❌ Chefs without recipes: ${chefsWithoutRecipes}`);
  console.log(`   📚 Total chefs: ${results.rows.length}`);

  if (chefsNeedingRecipes.length > 0) {
    console.log(`\n🚨 ${chefsNeedingRecipes.length} Chefs Needing Recipe Assignments:`);
    console.log('─'.repeat(70));
    for (const chef of chefsNeedingRecipes) {
      console.log(`   • ${chef.name} (slug: ${chef.slug})`);
    }
  }

  process.exit(0);
}

checkChefRecipes().catch(console.error);
