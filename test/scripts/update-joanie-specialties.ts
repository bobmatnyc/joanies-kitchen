import { db } from '@/lib/db/index.js';
import { chefs } from '@/lib/db/chef-schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Updating Joanie\'s specialties to include sustainability focus...\n');

  // Update Joanie's specialties to explicitly include zero-waste and sustainability
  const result = await db
    .update(chefs)
    .set({
      specialties: ['seasonal', 'garden-to-table', 'improvisation', 'zero-waste', 'sustainability'],
    })
    .where(eq(chefs.slug, 'joanie'))
    .returning();

  if (result.length > 0) {
    console.log('✅ Successfully updated Joanie\'s specialties:');
    console.log(`   ${result[0].specialties?.join(', ')}`);
  } else {
    console.log('❌ Joanie not found or update failed');
  }

  process.exit(0);
}

main().catch(console.error);
