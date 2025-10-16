#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function findJoanie() {
  const allChefs = await db.select().from(chefs);
  console.log('All chefs:');
  allChefs.forEach(chef => {
    console.log(`  ${chef.name} → slug: ${chef.slug}`);
  });

  const joanie = allChefs.find(c => c.name.toLowerCase().includes('joan'));
  console.log('\nJoanie chef:', joanie);
}

findJoanie().then(() => process.exit(0));
