import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

interface ExpectedColumn {
  table: string;
  column: string;
  dataType: string;
  isNullable: 'YES' | 'NO';
  columnDefault?: string;
}

// Expected schema based on src/lib/db/meals-schema.ts
const EXPECTED_SCHEMA: ExpectedColumn[] = [
  // meals table
  { table: 'meals', column: 'id', dataType: 'uuid', isNullable: 'NO' },
  { table: 'meals', column: 'user_id', dataType: 'text', isNullable: 'NO' },
  { table: 'meals', column: 'name', dataType: 'text', isNullable: 'NO' },
  { table: 'meals', column: 'description', dataType: 'text', isNullable: 'YES' },
  { table: 'meals', column: 'meal_type', dataType: 'text', isNullable: 'YES' },
  { table: 'meals', column: 'occasion', dataType: 'text', isNullable: 'YES' },
  { table: 'meals', column: 'serves', dataType: 'integer', isNullable: 'NO' },
  { table: 'meals', column: 'estimated_total_cost', dataType: 'numeric', isNullable: 'YES' },
  { table: 'meals', column: 'estimated_cost_per_serving', dataType: 'numeric', isNullable: 'YES' },
  {
    table: 'meals',
    column: 'price_estimation_date',
    dataType: 'timestamp with time zone',
    isNullable: 'YES',
  },
  { table: 'meals', column: 'price_estimation_confidence', dataType: 'numeric', isNullable: 'YES' },
  { table: 'meals', column: 'is_template', dataType: 'boolean', isNullable: 'YES' },
  { table: 'meals', column: 'is_public', dataType: 'boolean', isNullable: 'YES' },
  { table: 'meals', column: 'total_prep_time', dataType: 'integer', isNullable: 'YES' },
  { table: 'meals', column: 'total_cook_time', dataType: 'integer', isNullable: 'YES' },
  { table: 'meals', column: 'created_at', dataType: 'timestamp with time zone', isNullable: 'YES' },
  { table: 'meals', column: 'updated_at', dataType: 'timestamp with time zone', isNullable: 'YES' },

  // meal_recipes table
  { table: 'meal_recipes', column: 'id', dataType: 'uuid', isNullable: 'NO' },
  { table: 'meal_recipes', column: 'meal_id', dataType: 'uuid', isNullable: 'NO' },
  { table: 'meal_recipes', column: 'recipe_id', dataType: 'text', isNullable: 'NO' },
  { table: 'meal_recipes', column: 'course_category', dataType: 'text', isNullable: 'NO' },
  { table: 'meal_recipes', column: 'display_order', dataType: 'integer', isNullable: 'NO' },
  { table: 'meal_recipes', column: 'serving_multiplier', dataType: 'numeric', isNullable: 'NO' },
  { table: 'meal_recipes', column: 'preparation_notes', dataType: 'text', isNullable: 'YES' },
  {
    table: 'meal_recipes',
    column: 'created_at',
    dataType: 'timestamp with time zone',
    isNullable: 'YES',
  },

  // shopping_lists table
  { table: 'shopping_lists', column: 'id', dataType: 'uuid', isNullable: 'NO' },
  { table: 'shopping_lists', column: 'user_id', dataType: 'text', isNullable: 'NO' },
  { table: 'shopping_lists', column: 'meal_id', dataType: 'uuid', isNullable: 'YES' },
  { table: 'shopping_lists', column: 'name', dataType: 'text', isNullable: 'NO' },
  { table: 'shopping_lists', column: 'notes', dataType: 'text', isNullable: 'YES' },
  { table: 'shopping_lists', column: 'items', dataType: 'text', isNullable: 'NO' },
  {
    table: 'shopping_lists',
    column: 'estimated_total_cost',
    dataType: 'numeric',
    isNullable: 'YES',
  },
  {
    table: 'shopping_lists',
    column: 'estimated_cost_breakdown',
    dataType: 'text',
    isNullable: 'YES',
  },
  { table: 'shopping_lists', column: 'status', dataType: 'text', isNullable: 'NO' },
  {
    table: 'shopping_lists',
    column: 'completed_at',
    dataType: 'timestamp with time zone',
    isNullable: 'YES',
  },
  {
    table: 'shopping_lists',
    column: 'created_at',
    dataType: 'timestamp with time zone',
    isNullable: 'YES',
  },
  {
    table: 'shopping_lists',
    column: 'updated_at',
    dataType: 'timestamp with time zone',
    isNullable: 'YES',
  },

  // meal_templates table
  { table: 'meal_templates', column: 'id', dataType: 'uuid', isNullable: 'NO' },
  { table: 'meal_templates', column: 'name', dataType: 'text', isNullable: 'NO' },
  { table: 'meal_templates', column: 'description', dataType: 'text', isNullable: 'YES' },
  { table: 'meal_templates', column: 'meal_type', dataType: 'text', isNullable: 'YES' },
  { table: 'meal_templates', column: 'occasion', dataType: 'text', isNullable: 'YES' },
  { table: 'meal_templates', column: 'template_structure', dataType: 'text', isNullable: 'NO' },
  { table: 'meal_templates', column: 'default_serves', dataType: 'integer', isNullable: 'NO' },
  { table: 'meal_templates', column: 'is_system', dataType: 'boolean', isNullable: 'YES' },
  { table: 'meal_templates', column: 'created_by', dataType: 'text', isNullable: 'YES' },
  { table: 'meal_templates', column: 'times_used', dataType: 'integer', isNullable: 'YES' },
  {
    table: 'meal_templates',
    column: 'created_at',
    dataType: 'timestamp with time zone',
    isNullable: 'YES',
  },
  {
    table: 'meal_templates',
    column: 'updated_at',
    dataType: 'timestamp with time zone',
    isNullable: 'YES',
  },
];

interface ActualColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
}

interface SchemaDiff {
  type: 'missing' | 'extra' | 'type_mismatch' | 'nullable_mismatch';
  table: string;
  column: string;
  expected?: string;
  actual?: string;
  details?: string;
}

async function verifyMealsSchema() {
  console.log('🔍 Verifying Meals Feature Database Schema\n');
  console.log('Database:', DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown');
  console.log('─'.repeat(80));

  const sql = postgres(DATABASE_URL);

  try {
    // Fetch actual schema for meals-related tables
    console.log('\n📥 Fetching current database schema...\n');

    const actualColumns: ActualColumn[] = await sql`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name IN ('meals', 'meal_recipes', 'shopping_lists', 'meal_templates')
      ORDER BY table_name, ordinal_position
    `;

    console.log(`Found ${actualColumns.length} columns across 4 tables\n`);

    // Compare expected vs actual
    const differences: SchemaDiff[] = [];
    const matches: ExpectedColumn[] = [];

    // Check for missing or mismatched columns
    for (const expected of EXPECTED_SCHEMA) {
      const actual = actualColumns.find(
        (col) => col.table_name === expected.table && col.column_name === expected.column
      );

      if (!actual) {
        differences.push({
          type: 'missing',
          table: expected.table,
          column: expected.column,
          expected: `${expected.dataType} (${expected.isNullable})`,
          details: 'Column does not exist in database',
        });
      } else {
        // Normalize data types for comparison
        const actualType = normalizeDataType(actual.data_type);
        const expectedType = normalizeDataType(expected.dataType);

        if (actualType !== expectedType) {
          differences.push({
            type: 'type_mismatch',
            table: expected.table,
            column: expected.column,
            expected: expected.dataType,
            actual: actual.data_type,
            details: `Expected ${expected.dataType}, found ${actual.data_type}`,
          });
        } else if (actual.is_nullable !== expected.isNullable) {
          differences.push({
            type: 'nullable_mismatch',
            table: expected.table,
            column: expected.column,
            expected: expected.isNullable,
            actual: actual.is_nullable,
            details: `Expected nullable=${expected.isNullable}, found ${actual.is_nullable}`,
          });
        } else {
          matches.push(expected);
        }
      }
    }

    // Check for extra columns not in schema
    for (const actual of actualColumns) {
      const expected = EXPECTED_SCHEMA.find(
        (col) => col.table === actual.table_name && col.column === actual.column_name
      );

      if (!expected) {
        differences.push({
          type: 'extra',
          table: actual.table_name,
          column: actual.column_name,
          actual: actual.data_type,
          details: 'Column exists but not defined in schema',
        });
      }
    }

    // Print results
    console.log('═'.repeat(80));
    console.log('📊 Verification Results');
    console.log('═'.repeat(80));
    console.log(`✓ Matching columns:    ${matches.length}/${EXPECTED_SCHEMA.length}`);
    console.log(`✗ Schema differences:  ${differences.length}`);
    console.log('═'.repeat(80));

    if (differences.length === 0) {
      console.log('\n✅ Perfect match! Database schema matches expected structure.\n');
      return { success: true, differences: [] };
    }

    // Group differences by type
    const missing = differences.filter((d) => d.type === 'missing');
    const extra = differences.filter((d) => d.type === 'extra');
    const typeMismatches = differences.filter((d) => d.type === 'type_mismatch');
    const nullableMismatches = differences.filter((d) => d.type === 'nullable_mismatch');

    if (missing.length > 0) {
      console.log('\n❌ Missing Columns:');
      for (const diff of missing) {
        console.log(`   ${diff.table}.${diff.column}`);
        console.log(`      Expected: ${diff.expected}`);
      }
    }

    if (typeMismatches.length > 0) {
      console.log('\n⚠️  Type Mismatches:');
      for (const diff of typeMismatches) {
        console.log(`   ${diff.table}.${diff.column}`);
        console.log(`      Expected: ${diff.expected}`);
        console.log(`      Actual:   ${diff.actual}`);
      }
    }

    if (nullableMismatches.length > 0) {
      console.log('\n⚠️  Nullable Mismatches:');
      for (const diff of nullableMismatches) {
        console.log(`   ${diff.table}.${diff.column}`);
        console.log(`      Expected: ${diff.expected}`);
        console.log(`      Actual:   ${diff.actual}`);
      }
    }

    if (extra.length > 0) {
      console.log('\n💡 Extra Columns (not in schema):');
      for (const diff of extra) {
        console.log(`   ${diff.table}.${diff.column} (${diff.actual})`);
      }
    }

    console.log(`\n${'─'.repeat(80)}`);
    console.log('💡 Recommendations:');
    if (missing.length > 0) {
      console.log('   • Run migration script: pnpm tsx scripts/fix-meals-schema-mismatch.ts');
    }
    if (typeMismatches.length > 0 || nullableMismatches.length > 0) {
      console.log('   • Review type/nullable mismatches manually');
    }
    if (extra.length > 0) {
      console.log('   • Extra columns are safe to ignore unless causing issues');
    }
    console.log(`${'─'.repeat(80)}\n`);

    return { success: false, differences };
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

function normalizeDataType(dataType: string): string {
  // Normalize data types for comparison
  const normalized = dataType.toLowerCase().trim();

  // Handle timestamp variants
  if (normalized.includes('timestamp')) {
    return 'timestamp with time zone';
  }

  // Handle numeric/decimal variants
  if (normalized === 'numeric' || normalized === 'decimal') {
    return 'numeric';
  }

  return normalized;
}

// Print detailed table breakdown
async function printTableBreakdown() {
  const sql = postgres(DATABASE_URL!);

  try {
    console.log('\n📋 Detailed Table Breakdown\n');

    const tables = ['meals', 'meal_recipes', 'shopping_lists', 'meal_templates'];

    for (const table of tables) {
      const columns = await sql`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = ${table}
        ORDER BY ordinal_position
      `;

      console.log(`\n${table.toUpperCase()} (${columns.length} columns):`);
      console.log('─'.repeat(80));

      for (const col of columns) {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(
          `  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(25)} ${nullable}${defaultVal}`
        );
      }
    }
  } finally {
    await sql.end();
  }
}

// Run verification
verifyMealsSchema()
  .then(async (result) => {
    // Print detailed breakdown if verbose flag is set
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      await printTableBreakdown();
    }

    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
