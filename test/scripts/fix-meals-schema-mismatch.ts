import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

interface ColumnChange {
  table: string;
  action: 'ADD' | 'RENAME';
  columnName: string;
  columnType?: string;
  oldName?: string;
  description: string;
}

const COLUMN_CHANGES: ColumnChange[] = [
  // meals table fixes
  {
    table: 'meals',
    action: 'ADD',
    columnName: 'meal_type',
    columnType: 'text',
    description: 'Add meal_type column (breakfast, lunch, dinner, etc.)',
  },
  {
    table: 'meals',
    action: 'ADD',
    columnName: 'is_template',
    columnType: 'boolean DEFAULT false',
    description: 'Add is_template column for meal templates',
  },
  {
    table: 'meals',
    action: 'ADD',
    columnName: 'is_public',
    columnType: 'boolean DEFAULT false',
    description: 'Add is_public column for sharing meals',
  },
  {
    table: 'meals',
    action: 'ADD',
    columnName: 'estimated_cost_per_serving',
    columnType: 'numeric(10, 2)',
    description: 'Add estimated_cost_per_serving column',
  },
  {
    table: 'meals',
    action: 'ADD',
    columnName: 'price_estimation_date',
    columnType: 'timestamp with time zone',
    description: 'Add price_estimation_date column',
  },
  {
    table: 'meals',
    action: 'ADD',
    columnName: 'price_estimation_confidence',
    columnType: 'numeric(3, 2)',
    description: 'Add price_estimation_confidence column (0.00-1.00)',
  },
  {
    table: 'meals',
    action: 'ADD',
    columnName: 'total_prep_time',
    columnType: 'integer',
    description: 'Add total_prep_time column (in minutes)',
  },
  {
    table: 'meals',
    action: 'ADD',
    columnName: 'total_cook_time',
    columnType: 'integer',
    description: 'Add total_cook_time column (in minutes)',
  },

  // meal_recipes table fixes
  {
    table: 'meal_recipes',
    action: 'ADD',
    columnName: 'preparation_notes',
    columnType: 'text',
    description: 'Add preparation_notes column',
  },

  // shopping_lists table fixes
  {
    table: 'shopping_lists',
    action: 'ADD',
    columnName: 'estimated_total_cost',
    columnType: 'numeric(10, 2)',
    description: 'Add estimated_total_cost column',
  },
  {
    table: 'shopping_lists',
    action: 'ADD',
    columnName: 'estimated_cost_breakdown',
    columnType: 'text',
    description: 'Add estimated_cost_breakdown column (JSON)',
  },
];

interface ColumnRename {
  table: string;
  oldName: string;
  newName: string;
  description: string;
}

const COLUMN_RENAMES: ColumnRename[] = [
  // meals table renames
  {
    table: 'meals',
    oldName: 'servings',
    newName: 'serves',
    description: 'Rename servings to serves',
  },
  {
    table: 'meals',
    oldName: 'estimated_cost',
    newName: 'estimated_total_cost',
    description: 'Rename estimated_cost to estimated_total_cost',
  },

  // meal_recipes table renames
  {
    table: 'meal_recipes',
    oldName: 'course_type',
    newName: 'course_category',
    description: 'Rename course_type to course_category',
  },
  {
    table: 'meal_recipes',
    oldName: 'servings_override',
    newName: 'serving_multiplier',
    description: 'Rename servings_override to serving_multiplier',
  },
];

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

async function fixMealsSchema() {
  console.log('🔧 Fixing Meals Feature Schema Mismatches\n');
  console.log('Database:', DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown');
  console.log('─'.repeat(80));

  const sql = postgres(DATABASE_URL!);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  try {
    // Phase 1: Add missing columns
    console.log('\n📦 Phase 1: Adding Missing Columns\n');

    for (const change of COLUMN_CHANGES) {
      try {
        const exists = await checkColumnExists(sql, change.table, change.columnName);

        if (exists) {
          console.log(`⊘ ${change.table}.${change.columnName} - Already exists (skipped)`);
          skipCount++;
          continue;
        }

        console.log(`➕ ${change.table}.${change.columnName} - Adding...`);
        await sql.unsafe(
          `ALTER TABLE ${change.table} ADD COLUMN ${change.columnName} ${change.columnType}`
        );
        console.log(`   ✓ Success: ${change.description}`);
        successCount++;
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Phase 2: Rename columns
    console.log('\n🔄 Phase 2: Renaming Columns\n');

    for (const rename of COLUMN_RENAMES) {
      try {
        const oldExists = await checkColumnExists(sql, rename.table, rename.oldName);
        const newExists = await checkColumnExists(sql, rename.table, rename.newName);

        if (!oldExists && newExists) {
          console.log(
            `⊘ ${rename.table}.${rename.oldName} → ${rename.newName} - Already renamed (skipped)`
          );
          skipCount++;
          continue;
        }

        if (!oldExists && !newExists) {
          console.log(
            `⚠️  ${rename.table}.${rename.oldName} → ${rename.newName} - Neither column exists (skipped)`
          );
          skipCount++;
          continue;
        }

        if (oldExists && newExists) {
          console.log(
            `⚠️  ${rename.table}.${rename.oldName} → ${rename.newName} - Both columns exist (manual fix needed)`
          );
          errorCount++;
          continue;
        }

        console.log(`🔄 ${rename.table}.${rename.oldName} → ${rename.newName} - Renaming...`);
        await sql.unsafe(
          `ALTER TABLE ${rename.table} RENAME COLUMN ${rename.oldName} TO ${rename.newName}`
        );
        console.log(`   ✓ Success: ${rename.description}`);
        successCount++;
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Phase 3: Fix data type for serving_multiplier
    console.log('\n🔧 Phase 3: Fixing Data Types\n');

    try {
      const exists = await checkColumnExists(sql, 'meal_recipes', 'serving_multiplier');

      if (exists) {
        console.log('🔧 meal_recipes.serving_multiplier - Updating data type to numeric(4, 2)...');

        // Check current data type
        const typeCheck = await sql`
          SELECT data_type, numeric_precision, numeric_scale
          FROM information_schema.columns
          WHERE table_name = 'meal_recipes'
          AND column_name = 'serving_multiplier'
        `;

        const currentType = typeCheck[0];
        if (
          currentType.data_type === 'numeric' &&
          currentType.numeric_precision === 4 &&
          currentType.numeric_scale === 2
        ) {
          console.log('   ⊘ Already correct type (skipped)');
          skipCount++;
        } else {
          await sql.unsafe(`
            ALTER TABLE meal_recipes
            ALTER COLUMN serving_multiplier TYPE numeric(4, 2)
            USING serving_multiplier::numeric(4, 2)
          `);
          console.log('   ✓ Success: Updated to numeric(4, 2)');
          successCount++;
        }
      } else {
        console.log('   ⚠️  Column serving_multiplier does not exist (skipped)');
        skipCount++;
      }
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      errorCount++;
    }

    // Summary
    console.log(`\n${'═'.repeat(80)}`);
    console.log('📊 Migration Summary');
    console.log('═'.repeat(80));
    console.log(`✓ Successful changes:  ${successCount}`);
    console.log(`⊘ Skipped (existing):  ${skipCount}`);
    console.log(`✗ Errors encountered:  ${errorCount}`);
    console.log('═'.repeat(80));

    if (errorCount > 0) {
      console.log('\n⚠️  Migration completed with errors. Please review the output above.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('\n💡 Next step: Run verification script to confirm changes');
      console.log('   pnpm tsx scripts/verify-meals-schema.ts');
    }
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run migration
fixMealsSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
