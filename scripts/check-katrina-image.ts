#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local BEFORE any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function checkKatrinaImage() {
  console.log('Checking Katrina Blair profile image...\n');

  const chef = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'katrina-blair'));

  if (chef.length === 0) {
    console.log('❌ Katrina Blair not found in database');
    return;
  }

  const katrina = chef[0];
  console.log(`Name: ${katrina.name}`);
  console.log(`Slug: ${katrina.slug}`);
  console.log(`Profile Image URL: ${katrina.profile_image_url || '(not set)'}`);
  console.log(`Display Name: ${katrina.display_name || '(not set)'}`);
  console.log(`Bio: ${katrina.bio?.substring(0, 100)}...`);
  console.log(`Specialties: ${katrina.specialties?.join(', ')}`);
  console.log(`Verified: ${katrina.is_verified}`);
  console.log(`\n✅ Profile image ${katrina.profile_image_url ? 'IS' : 'IS NOT'} set`);
}

checkKatrinaImage().catch(console.error);
