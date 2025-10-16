#!/usr/bin/env tsx
/**
 * Migrate Data from Old Database to New Database
 *
 * Migrates all recipes and related data from ep-bold-credit-adu57qxu to ep-jolly-snow-addxski4
 */

import postgres from 'postgres';

const OLD_DB = 'postgresql://neondb_owner:npg_rH9ODE8FgstI@ep-bold-credit-adu57qxu-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';
const NEW_DB = 'postgresql://neondb_owner:npg_rH9ODE8FgstI@ep-jolly-snow-addxski4-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

async function migrateData() {
  console.log('🔄 Connecting to databases...\n');

  const oldSql = postgres(OLD_DB);
  const newSql = postgres(NEW_DB);

  try {
    // Get recipe count from old database
    console.log('📊 Checking old database...');
    const oldRecipes = await oldSql`SELECT COUNT(*) as count FROM recipes`;
    const oldCount = parseInt(oldRecipes[0].count);
    console.log(`   Found ${oldCount} recipes in old database\n`);

    // Get recipe count from new database
    console.log('📊 Checking new database...');
    const newRecipes = await newSql`SELECT COUNT(*) as count FROM recipes`;
    const newCount = parseInt(newRecipes[0].count);
    console.log(`   Found ${newCount} recipes in new database\n`);

    if (oldCount === 0) {
      console.log('⚠️  No recipes to migrate!');
      return;
    }

    // Fetch all recipes from old database
    console.log('📦 Fetching recipes from old database...');
    const recipes = await oldSql`
      SELECT * FROM recipes
      ORDER BY created_at ASC
    `;
    console.log(`   Fetched ${recipes.length} recipes\n`);

    // Migrate recipes
    console.log('🚀 Migrating recipes to new database...\n');
    let inserted = 0;
    let skipped = 0;

    for (const recipe of recipes) {
      try {
        // Check if recipe already exists in new database
        const existing = await newSql`
          SELECT id FROM recipes WHERE id = ${recipe.id}
        `;

        if (existing.length > 0) {
          console.log(`   ⊘ Skipped "${recipe.name}" (already exists)`);
          skipped++;
          continue;
        }

        // Insert recipe into new database
        await newSql`
          INSERT INTO recipes ${newSql(recipe)}
        `;

        console.log(`   ✓ Migrated "${recipe.name}"`);
        inserted++;
      } catch (error: any) {
        console.error(`   ✗ Failed to migrate "${recipe.name}": ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total recipes in old database: ${oldCount}`);
    console.log(`Total recipes in new database before: ${newCount}`);
    console.log(`Recipes migrated: ${inserted}`);
    console.log(`Recipes skipped (duplicates): ${skipped}`);
    console.log(`Total recipes in new database after: ${newCount + inserted}`);
    console.log('='.repeat(80) + '\n');

    if (inserted > 0) {
      console.log('✅ Migration completed successfully!\n');
    } else {
      console.log('ℹ️  No new recipes to migrate.\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await oldSql.end();
    await newSql.end();
  }
}

migrateData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
