import * as fs from 'node:fs';
import * as path from 'node:path';
import postgres from 'postgres';

const NEW_DB =
  'postgresql://neondb_owner:npg_rH9ODE8FgstI@ep-jolly-snow-addxski4-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

async function applySchema() {
  console.log('Connecting to new database (ep-jolly-snow-addxski4)...');
  const sql = postgres(NEW_DB);

  try {
    console.log('Reading SQL script...');
    const sqlScript = fs.readFileSync(
      path.join(process.cwd(), 'scripts/production-schema-update.sql'),
      'utf-8'
    );

    console.log('Applying schema changes...\n');

    // Split by statement separator and execute each
    const statements = sqlScript.split(';').filter((s) => s.trim() && !s.trim().startsWith('--'));

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed || trimmed.startsWith('SELECT')) continue; // Skip SELECT statements

      try {
        await sql.unsafe(trimmed);
        console.log('  ✓ Executed statement');
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log('  ⊘ Skipped (already exists)');
        } else {
          console.error(`  ✗ Error: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Schema application complete!');
  } catch (error) {
    console.error('\n❌ Failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

applySchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
