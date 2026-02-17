#!/usr/bin/env tsx
/**
 * Check Tool Images in Database
 * Verifies if tools table has imageUrl populated
 */

import { db } from '@/lib/db/index.js';
import { tools } from '@/lib/db/schema.js';

async function checkToolImages() {
  console.log('\n🔍 Checking Tool Images in Database\n');
  console.log('='.repeat(70));

  const allTools = await db.select().from(tools).orderBy(tools.name);

  console.log(`\nTotal tools: ${allTools.length}\n`);

  let withImages = 0;
  let withoutImages = 0;

  console.log('Tool Image Status:');
  console.log('-'.repeat(70));

  allTools.forEach((tool, index) => {
    const hasImage = tool.image_url && tool.image_url.trim() !== '';
    if (hasImage) {
      withImages++;
      console.log(`${index + 1}. ✅ ${tool.name.padEnd(35)} → ${tool.image_url}`);
    } else {
      withoutImages++;
      console.log(`${index + 1}. ❌ ${tool.name.padEnd(35)} → NO IMAGE`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   Tools with images: ${withImages}/${allTools.length}`);
  console.log(`   Tools without images: ${withoutImages}/${allTools.length}`);
  console.log(`   Coverage: ${((withImages / allTools.length) * 100).toFixed(1)}%\n`);

  if (withoutImages > 0) {
    console.log('⚠️  Some tools are missing image_url in the database');
    console.log('   File images exist in public/images/tools/ but need to be linked in DB\n');
  } else {
    console.log('✅ All tool images are linked in the database!\n');
  }

  process.exit(0);
}

checkToolImages().catch((error) => {
  console.error('Error checking tool images:', error);
  process.exit(1);
});
