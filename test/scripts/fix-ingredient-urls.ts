#!/usr/bin/env tsx

import fs from 'fs';
import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { eq, sql } from 'drizzle-orm';

interface MappingAnalysis {
  name: string;
  currentUrl: string;
  potentialMatches: {
    filename: string;
    blobUrl: string;
    similarity: number;
  }[];
}

async function fixIngredientUrls() {
  // Read the mapping analysis
  const analysisPath = '/Users/masa/Projects/joanies-kitchen/tmp/ingredient-mapping-analysis.json';
  const analysis: MappingAnalysis[] = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

  console.log('🔧 Starting automatic URL fix for 52 ingredients\n');

  let successCount = 0;
  let errorCount = 0;
  const updates: { name: string; oldUrl: string; newUrl: string }[] = [];

  try {
    for (const item of analysis) {
      // Only process perfect matches (100% similarity)
      if (item.potentialMatches.length === 0 || item.potentialMatches[0].similarity !== 100) {
        console.log(`⚠️  Skipping ${item.name} - no perfect match`);
        errorCount++;
        continue;
      }

      const newBlobUrl = item.potentialMatches[0].blobUrl;

      // Update the ingredient image_url in database
      const result = await db
        .update(ingredients)
        .set({ image_url: newBlobUrl })
        .where(eq(ingredients.image_url, item.currentUrl));

      updates.push({
        name: item.name,
        oldUrl: item.currentUrl,
        newUrl: newBlobUrl
      });
      successCount++;
      console.log(`✅ ${item.name}`);
      console.log(`   ${item.currentUrl}`);
      console.log(`   → ${newBlobUrl}`);
      console.log('');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Successfully updated: ${successCount} ingredients`);
    console.log(`❌ Errors/Skipped:       ${errorCount} ingredients`);
    console.log('');

    // Save update log
    const logPath = '/Users/masa/Projects/joanies-kitchen/tmp/ingredient-url-fix-log.json';
    fs.writeFileSync(logPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      successCount,
      errorCount,
      updates
    }, null, 2));

    console.log(`💾 Update log saved to: ${logPath}`);

    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    const remainingBroken = await db
      .select({ count: sql<number>`count(*)` })
      .from(ingredients)
      .where(sql`${ingredients.image_url} LIKE '/images/ingredients/%'`);

    const count = remainingBroken[0]?.count || 0;
    console.log(`Remaining broken URLs: ${count}`);

    if (count === 0) {
      console.log('🎉 All ingredient URLs successfully migrated to Blob storage!');
    } else {
      console.log(`⚠️  ${count} broken URLs still remain`);
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }

  process.exit(0);
}

fixIngredientUrls();
