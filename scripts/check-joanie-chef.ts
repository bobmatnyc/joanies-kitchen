#!/usr/bin/env tsx
import { db } from '../src/lib/db/index';
import { chefs } from '../src/lib/db/chef-schema';
import { like, or } from 'drizzle-orm';

async function checkJoanieChef() {
  console.log('🔍 Checking for Joanie chef profile...\n');

  const joanie = await db
    .select()
    .from(chefs)
    .where(or(
      like(chefs.name, '%Joanie%'),
      like(chefs.name, '%Perez%')
    ))
    .limit(5);

  if (joanie.length > 0) {
    console.log('✅ Joanie chef profiles found:');
    joanie.forEach(c => {
      console.log(`\nID: ${c.id}`);
      console.log(`Name: ${c.name}`);
      console.log(`Slug: ${c.slug}`);
      console.log(`Bio: ${c.bio?.substring(0, 100)}...`);
    });
    return joanie[0];
  } else {
    console.log('❌ No Joanie chef profile found');
    console.log('Need to create one');
    return null;
  }
}

checkJoanieChef()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
