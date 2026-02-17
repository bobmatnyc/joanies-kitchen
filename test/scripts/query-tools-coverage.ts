#!/usr/bin/env tsx

import * as fs from 'node:fs';
import * as path from 'node:path';
import { db } from '@/lib/db/index.js';
import { tools } from '@/lib/db/schema.js';

async function analyzeToolsCoverage() {
  try {
    // Get all tools from database
    const allTools = await db
      .select({
        name: tools.name,
        display_name: tools.display_name,
        category: tools.category,
        type: tools.type,
        subtype: tools.subtype,
        is_essential: tools.is_essential,
      })
      .from(tools);

    console.log(`\n📊 TOOLS DATABASE ANALYSIS\n`);
    console.log(`Total tools in database: ${allTools.length}`);

    // Check existing images
    const imagesDir = path.join(process.cwd(), 'public/images/tools');
    let existingImages: string[] = [];

    try {
      const files = fs.readdirSync(imagesDir);
      existingImages = files.filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', ''));

      console.log(`Existing tool images: ${existingImages.length}`);
    } catch (_err) {
      console.log('Images directory not accessible');
    }

    // Match tools to images (handle both hyphen and underscore naming)
    const toolsWithImages: string[] = [];
    const toolsWithoutImages: string[] = [];

    for (const tool of allTools) {
      // Convert DB name (hyphens) to image name (underscores)
      const imageName = tool.name.toLowerCase().replace(/-/g, '_');
      if (existingImages.includes(imageName)) {
        toolsWithImages.push(tool.name);
      } else {
        toolsWithoutImages.push(tool.name);
      }
    }

    console.log(`\n✅ Tools WITH images: ${toolsWithImages.length}`);
    console.log(`❌ Tools WITHOUT images: ${toolsWithoutImages.length}`);
    console.log(`📈 Coverage: ${((toolsWithImages.length / allTools.length) * 100).toFixed(1)}%`);

    // List tools needing images
    if (toolsWithoutImages.length > 0) {
      console.log(`\n🔧 TOOLS NEEDING IMAGES:\n`);

      // Group by category
      const byCategory: Record<string, string[]> = {};
      for (const tool of allTools) {
        if (toolsWithoutImages.includes(tool.name)) {
          const cat = tool.category || 'other';
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push(`${tool.display_name} (${tool.name})`);
        }
      }

      for (const [category, toolList] of Object.entries(byCategory)) {
        console.log(`\n${category.toUpperCase()}:`);
        toolList.forEach((t) => console.log(`  - ${t}`));
      }
    }

    // Check for orphaned images
    const orphanedImages = existingImages.filter(
      (img) => !allTools.some((t) => t.name.toLowerCase().replace(/-/g, '_') === img)
    );

    if (orphanedImages.length > 0) {
      console.log(`\n⚠️  ORPHANED IMAGES (no matching database record):`);
      orphanedImages.forEach((img) => console.log(`  - ${img}`));
    }

    console.log(`\n`);
    process.exit(0);
  } catch (error) {
    console.error('Error analyzing tools coverage:', error);
    process.exit(1);
  }
}

analyzeToolsCoverage();
