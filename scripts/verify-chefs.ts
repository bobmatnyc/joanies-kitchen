#!/usr/bin/env tsx

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function verifyChefs() {
  console.log('🧑‍🍳 CHEF PROFILES IN DATABASE\n');

  const result = await db.query.chefs.findMany({
    orderBy: (chefs, { asc }) => [asc(chefs.name)],
  });

  console.log(`Total chefs: ${result.length}\n`);
  console.log('=' .repeat(60));

  result.forEach((chef, i) => {
    console.log(`\n${i + 1}. ${chef.name}`);
    console.log(`   Slug: ${chef.slug}`);
    console.log(`   URL: /chef/${chef.slug}`);
    console.log(`   Specialties: ${chef.specialties?.join(', ') || 'none'}`);
    console.log(`   Website: ${chef.website || 'N/A'}`);
    console.log(`   Verified: ${chef.is_verified ? '✅' : '❌'}`);
    console.log(`   Active: ${chef.is_active ? '✅' : '❌'}`);
    console.log(`   Recipe Count: ${chef.recipe_count}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Verification complete!');
  console.log('\nNext steps:');
  console.log('  1. Visit http://localhost:3004/discover/chefs');
  console.log('  2. Check individual chef pages:');
  console.log('     - http://localhost:3004/chef/gordon-ramsay');
  console.log('     - http://localhost:3004/chef/ina-garten');
  console.log('     - http://localhost:3004/chef/yotam-ottolenghi');
  console.log('     - etc.');
}

verifyChefs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
