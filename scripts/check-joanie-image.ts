#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { eq } from 'drizzle-orm';

async function check() {
  const [joanie] = await db.select().from(chefs).where(eq(chefs.slug, 'joanie')).limit(1);
  console.log('Joanie image_url:', joanie?.image_url);
  process.exit(0);
}

check();
