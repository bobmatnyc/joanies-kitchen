import * as readline from 'node:readline';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

interface RollbackAction {
  description: string;
  action: () => Promise<void>;
}

async function confirmRollback(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  WARNING: This will reverse the schema migration. Continue? (yes/no): ',
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      }
    );
  });
}

async function checkColumnExists(
  sql: postgres.Sql,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = ${tableName}
      AND column_name = ${columnName}
    ) as exists
  `;
  return result[0]?.exists || false;
}

async function rollbackMealsSchema() {
  console.log('🔄 Rollback Meals Feature Schema Migration\n');
  console.log('Database:', DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown');
  console.log('═'.repeat(80));
  console.log('⚠️  WARNING: This script will reverse the changes made by the migration.');
  console.log('═'.repeat(80));

  const confirmed = await confirmRollback();

  if (!confirmed) {
    console.log('\n❌ Rollback cancelled by user.');
    process.exit(0);
  }

  const sql = postgres(DATABASE_URL!);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  try {
    console.log('\n🔄 Starting rollback process...\n');

    // Phase 1: Revert column renames (reverse order)
    console.log('📦 Phase 1: Reverting Column Renames\n');

    const renameActions: { table: string; from: string; to: string; description: string }[] = [
      {
        table: 'meal_recipes',
        from: 'serving_multiplier',
        to: 'servings_override',
        description: 'Revert serving_multiplier → servings_override',
      },
      {
        table: 'meal_recipes',
        from: 'course_category',
        to: 'course_type',
        description: 'Revert course_category → course_type',
      },
      {
        table: 'meals',
        from: 'estimated_total_cost',
        to: 'estimated_cost',
        description: 'Revert estimated_total_cost → estimated_cost',
      },
      {
        table: 'meals',
        from: 'serves',
        to: 'servings',
        description: 'Revert serves → servings',
      },
    ];

    for (const rename of renameActions) {
      try {
        const fromExists = await checkColumnExists(sql, rename.table, rename.from);
        const toExists = await checkColumnExists(sql, rename.table, rename.to);

        if (!fromExists && toExists) {
          console.log(
            `⊘ ${rename.table}.${rename.from} → ${rename.to} - Already reverted (skipped)`
          );
          skipCount++;
          continue;
        }

        if (!fromExists && !toExists) {
          console.log(
            `⚠️  ${rename.table}.${rename.from} → ${rename.to} - Neither column exists (skipped)`
          );
          skipCount++;
          continue;
        }

        if (fromExists && toExists) {
          console.log(
            `⚠️  ${rename.table}.${rename.from} → ${rename.to} - Both columns exist (manual fix needed)`
          );
          errorCount++;
          continue;
        }

        console.log(`🔄 ${rename.table}.${rename.from} → ${rename.to} - Reverting...`);
        await sql.unsafe(
          `ALTER TABLE ${rename.table} RENAME COLUMN ${rename.from} TO ${rename.to}`
        );
        console.log(`   ✓ Success: ${rename.description}`);
        successCount++;
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Phase 2: Drop added columns
    console.log('\n📦 Phase 2: Dropping Added Columns\n');

    const columnsToRemove = [
      { table: 'meals', column: 'meal_type', description: 'Remove meal_type column' },
      { table: 'meals', column: 'is_template', description: 'Remove is_template column' },
      { table: 'meals', column: 'is_public', description: 'Remove is_public column' },
      {
        table: 'meals',
        column: 'estimated_cost_per_serving',
        description: 'Remove estimated_cost_per_serving column',
      },
      {
        table: 'meals',
        column: 'price_estimation_date',
        description: 'Remove price_estimation_date column',
      },
      {
        table: 'meals',
        column: 'price_estimation_confidence',
        description: 'Remove price_estimation_confidence column',
      },
      { table: 'meals', column: 'total_prep_time', description: 'Remove total_prep_time column' },
      { table: 'meals', column: 'total_cook_time', description: 'Remove total_cook_time column' },
      {
        table: 'meal_recipes',
        column: 'preparation_notes',
        description: 'Remove preparation_notes column',
      },
      {
        table: 'shopping_lists',
        column: 'estimated_total_cost',
        description: 'Remove estimated_total_cost column',
      },
      {
        table: 'shopping_lists',
        column: 'estimated_cost_breakdown',
        description: 'Remove estimated_cost_breakdown column',
      },
    ];

    for (const col of columnsToRemove) {
      try {
        const exists = await checkColumnExists(sql, col.table, col.column);

        if (!exists) {
          console.log(`⊘ ${col.table}.${col.column} - Already removed (skipped)`);
          skipCount++;
          continue;
        }

        console.log(`➖ ${col.table}.${col.column} - Dropping...`);
        await sql.unsafe(`ALTER TABLE ${col.table} DROP COLUMN ${col.column}`);
        console.log(`   ✓ Success: ${col.description}`);
        successCount++;
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log(`\n${'═'.repeat(80)}`);
    console.log('📊 Rollback Summary');
    console.log('═'.repeat(80));
    console.log(`✓ Successfully reverted:  ${successCount}`);
    console.log(`⊘ Skipped (not needed):   ${skipCount}`);
    console.log(`✗ Errors encountered:     ${errorCount}`);
    console.log('═'.repeat(80));

    if (errorCount > 0) {
      console.log('\n⚠️  Rollback completed with errors. Please review the output above.');
      console.log('\n💡 You may need to manually fix some issues before re-running the migration.');
      process.exit(1);
    } else {
      console.log('\n✅ Rollback completed successfully!');
      console.log('\n💡 The database schema has been reverted to its pre-migration state.');
      console.log('   You can now re-run the migration if needed:');
      console.log('   pnpm tsx scripts/fix-meals-schema-mismatch.ts');
    }
  } catch (error) {
    console.error('\n❌ Fatal error during rollback:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run rollback
rollbackMealsSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
