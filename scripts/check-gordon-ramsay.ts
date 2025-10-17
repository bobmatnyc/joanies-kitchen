import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function checkGordonRamsay() {
  console.log('Checking for Gordon Ramsay in database...\n');

  const result = await db.select().from(chefs).where(eq(chefs.slug, 'gordon-ramsay'));

  if (result.length > 0) {
    console.log('✅ Gordon Ramsay found:');
    console.log(JSON.stringify(result[0], null, 2));
  } else {
    console.log('❌ Gordon Ramsay NOT found in database');
    console.log('   You may need to add him manually or import chef data');
  }
}

checkGordonRamsay()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
