#!/usr/bin/env tsx
/**
 * Quick check of chef profile image status
 */
import 'dotenv/config';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { isNull, or, eq } from 'drizzle-orm';

async function main() {
  console.log('\n📊 Chef Profile Image Status\n');
  console.log('='.repeat(70));

  const allChefs = await db
    .select({
      slug: chefs.slug,
      name: chefs.name,
      displayName: chefs.display_name,
      profileImageUrl: chefs.profile_image_url,
    })
    .from(chefs)
    .orderBy(chefs.name);

  const withImages = allChefs.filter(c => c.profileImageUrl && c.profileImageUrl.trim() !== '');
  const withoutImages = allChefs.filter(c => !c.profileImageUrl || c.profileImageUrl.trim() === '');

  console.log(`Total chefs: ${allChefs.length}`);
  console.log(`With images: ${withImages.length}`);
  console.log(`Without images: ${withoutImages.length}`);
  console.log('='.repeat(70));

  if (withoutImages.length > 0) {
    console.log('\n❌ Chefs WITHOUT profile images:');
    withoutImages.forEach(c => {
      console.log(`   - ${c.name} (${c.slug})`);
    });
  }

  if (withImages.length > 0) {
    console.log('\n✅ Chefs WITH profile images:');
    withImages.forEach(c => {
      console.log(`   - ${c.name} (${c.slug}) → ${c.profileImageUrl}`);
    });
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

main().catch(console.error);
