#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { eq, or } from 'drizzle-orm';

async function main() {
  const results = await db
    .select({
      slug: chefs.slug,
      name: chefs.name,
      profile_image_url: chefs.profile_image_url,
    })
    .from(chefs)
    .where(or(eq(chefs.slug, 'shannon-martinez'), eq(chefs.slug, 'vivian-li')));

  console.log('Chef Image Verification:');
  console.log('========================\n');

  results.forEach((chef) => {
    console.log(`${chef.name} (${chef.slug})`);
    console.log(`  Profile Image: ${chef.profile_image_url || 'NOT SET'}`);
    console.log('');
  });

  process.exit(0);
}

main();
