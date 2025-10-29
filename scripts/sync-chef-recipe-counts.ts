#!/usr/bin/env tsx
/**
 * Sync Chef Recipe Counts
 * 
 * Recalculates and updates recipe_count for all chefs based on actual recipes in database
 */
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function syncRecipeCounts() {
  console.log('=== SYNCING CHEF RECIPE COUNTS ===\n');
  
  // Get all chefs
  const allChefs = await db.select().from(chefs);
  console.log(`Found ${allChefs.length} chefs\n`);
  
  let updatedCount = 0;
  let mismatchCount = 0;
  
  for (const chef of allChefs) {
    // Get actual recipe count
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM recipes WHERE chef_id = ${chef.id}`
    );
    
    const actualCount = parseInt(result.rows[0].count as string);
    const storedCount = chef.recipe_count || 0;
    
    if (actualCount !== storedCount) {
      mismatchCount++;
      console.log(`⚠️ ${chef.slug}: ${storedCount} → ${actualCount}`);
      
      // Update the count
      await db.execute(
        sql`UPDATE chefs SET recipe_count = ${actualCount} WHERE id = ${chef.id}`
      );
      updatedCount++;
    }
  }
  
  console.log(`\n✅ Updated ${updatedCount} chefs (${mismatchCount} mismatches found)`);
}

syncRecipeCounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
