#!/usr/bin/env tsx
/**
 * Link Tool Images to Database
 * Populates imageUrl field for all tools based on existing files
 */

import { db } from '../src/lib/db/index.js';
import { tools } from '../src/lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { join } from 'path';

async function linkToolImages() {
  console.log('\n🔗 Linking Tool Images to Database\n');
  console.log('='.repeat(70));

  const allTools = await db.select().from(tools).orderBy(tools.name);

  console.log(`\nTotal tools: ${allTools.length}\n`);

  let linked = 0;
  let skipped = 0;
  let missing = 0;

  for (const tool of allTools) {
    // Convert tool name to filename format (replace hyphens with underscores)
    const filename = `${tool.name.replace(/-/g, '_')}.png`;
    const imageUrl = `/images/tools/${filename}`;
    const filePath = join(process.cwd(), 'public', 'images', 'tools', filename);

    // Check if file exists
    if (!existsSync(filePath)) {
      console.log(`❌ ${tool.name.padEnd(35)} → File not found: ${filename}`);
      missing++;
      continue;
    }

    // Update database
    try {
      await db
        .update(tools)
        .set({ image_url: imageUrl })
        .where(eq(tools.id, tool.id));

      console.log(`✅ ${tool.name.padEnd(35)} → ${imageUrl}`);
      linked++;
    } catch (error) {
      console.log(`⚠️  ${tool.name.padEnd(35)} → Update failed: ${error}`);
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   Successfully linked: ${linked}/${allTools.length}`);
  console.log(`   Missing files: ${missing}/${allTools.length}`);
  console.log(`   Failed updates: ${skipped}/${allTools.length}`);
  console.log(`   Coverage: ${((linked / allTools.length) * 100).toFixed(1)}%\n`);

  if (linked === allTools.length) {
    console.log('✅ All tool images successfully linked to database!\n');
  }

  process.exit(0);
}

linkToolImages().catch((error) => {
  console.error('Error linking tool images:', error);
  process.exit(1);
});
