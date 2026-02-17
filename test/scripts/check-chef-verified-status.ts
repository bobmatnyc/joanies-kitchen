#!/usr/bin/env tsx

import { db } from '@/lib/db';

async function checkVerifiedStatus() {
  console.log('🔍 Checking chef verified status...\n');

  const result = await db.query.chefs.findMany({
    orderBy: (chefs, { asc }) => [asc(chefs.name)],
  });

  console.log(`Total chefs: ${result.length}\n`);

  result.forEach((chef) => {
    console.log(`${chef.name}:`);
    console.log(`  is_verified: ${chef.is_verified}`);
    console.log(`  is_active: ${chef.is_active}`);
    console.log();
  });
}

checkVerifiedStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
