#!/usr/bin/env tsx

/**
 * Extract Tools List for Image Generation
 *
 * Queries the tools table and exports tool display names to tmp/tools-names-only.txt
 * for use with the Stable Diffusion image generation pipeline.
 *
 * Usage:
 *   pnpm tsx scripts/extract-tools-list.ts
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { tools } from '../src/lib/db/schema';
import { asc } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

async function extractToolsList() {
  console.log('🔧 Extracting tools list from database...\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Ensure tmp directory exists
    const tmpDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    // Query all tools ordered by display_name
    const allTools = await db
      .select({
        name: tools.name,
        display_name: tools.display_name,
        category: tools.category,
      })
      .from(tools)
      .orderBy(asc(tools.display_name));

    console.log(`✅ Found ${allTools.length} tools in database`);

    // Extract just the display names (human-readable format for image generation)
    const toolNames = allTools.map(tool => tool.display_name);

    // Write to file (one tool per line)
    const outputPath = path.join(tmpDir, 'tools-names-only.txt');
    fs.writeFileSync(outputPath, toolNames.join('\n') + '\n', 'utf-8');

    console.log(`\n📝 Wrote ${toolNames.length} tool names to: ${outputPath}`);
    console.log('\nFirst 5 tools:');
    toolNames.slice(0, 5).forEach((name, idx) => {
      console.log(`  ${idx + 1}. ${name}`);
    });

    if (toolNames.length > 5) {
      console.log(`  ... and ${toolNames.length - 5} more`);
    }

    console.log('\n✅ Extraction complete! Ready for image generation.');
    console.log(`\n💡 Next step: Start image generation with:`);
    console.log(`   source venv-image-gen/bin/activate`);
    console.log(`   nohup python scripts/image-gen/ingredient_image_generator.py > tmp/tool-generation.log 2>&1 &`);

  } catch (error) {
    console.error('❌ Error extracting tools list:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run extraction
extractToolsList().catch(console.error);
