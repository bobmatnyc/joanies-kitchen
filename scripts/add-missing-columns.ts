import postgres from 'postgres';

const NEW_DB =
  'postgresql://neondb_owner:npg_rH9ODE8FgstI@ep-jolly-snow-addxski4-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

async function addMissingColumns() {
  console.log('Connecting to ep-jolly-snow-addxski4...\n');
  const sql = postgres(NEW_DB);

  const columns = [
    { name: 'search_query', type: 'text' },
    { name: 'discovery_date', type: 'timestamp with time zone' },
    { name: 'confidence_score', type: 'numeric(3, 2)' },
    { name: 'validation_model', type: 'text' },
    { name: 'embedding_model', type: 'text' },
    { name: 'discovery_week', type: 'integer' },
    { name: 'discovery_year', type: 'integer' },
    { name: 'published_date', type: 'timestamp' },
    { name: 'system_rating', type: 'numeric(2, 1)' },
    { name: 'system_rating_reason', type: 'text' },
    { name: 'avg_user_rating', type: 'numeric(2, 1)' },
    { name: 'total_user_ratings', type: 'integer DEFAULT 0' },
  ];

  try {
    for (const column of columns) {
      try {
        console.log(`Adding column: ${column.name}...`);
        await sql.unsafe(`ALTER TABLE recipes ADD COLUMN ${column.name} ${column.type}`);
        console.log(`  ✓ Added ${column.name}`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`  ⊘ ${column.name} already exists`);
        } else {
          console.error(`  ✗ Error adding ${column.name}: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Column addition complete!');

    // Verify columns were added
    console.log('\n📊 Verifying columns...');
    const result = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      AND column_name IN (
        'search_query', 'discovery_date', 'confidence_score',
        'validation_model', 'embedding_model', 'discovery_week',
        'discovery_year', 'published_date', 'system_rating',
        'system_rating_reason', 'avg_user_rating', 'total_user_ratings'
      )
      ORDER BY column_name
    `;

    console.log(`Found ${result.length}/12 columns:`);
    result.forEach((row) => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
    });
  } catch (error) {
    console.error('\n❌ Failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

addMissingColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
