#!/usr/bin/env tsx
/**
 * Fix Double Numbered Instructions Script
 *
 * Fixes recipe instructions that have double numbering pattern:
 * "1.\n1. Step text" -> "1. Step text"
 *
 * This affects primarily chef recipes imported from external sources.
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

interface FixReport {
  totalRecipes: number;
  affectedRecipes: number;
  fixedRecipes: number;
  errors: Array<{ recipeId: string; error: string }>;
  samples: Array<{
    recipeId: string;
    name: string;
    before: string[];
    after: string[];
  }>;
}

/**
 * Check if an instruction starts with a number (which causes double numbering on frontend)
 */
function hasNumberPrefix(instruction: string): boolean {
  // Pattern: starts with "number." or "number. " (with optional trailing space)
  // Examples: "1.", "1. ", "2. ", "10. "
  const pattern = /^\d+\.\s*/;
  return pattern.test(instruction.trim());
}

/**
 * Remove number prefix from a single instruction
 */
function removeNumberPrefix(instruction: string): string {
  // Remove leading "number. " or "number." pattern
  // "1. Step text" -> "Step text"
  // "10. Step text" -> "Step text"
  const pattern = /^\d+\.\s*/;
  return instruction.trim().replace(pattern, '').trim();
}

/**
 * Fix instructions array for a recipe by removing number prefixes
 */
function fixInstructions(instructions: string[]): {
  fixed: string[];
  wasModified: boolean;
} {
  let wasModified = false;
  const fixed = instructions.map(instruction => {
    if (hasNumberPrefix(instruction)) {
      wasModified = true;
      return removeNumberPrefix(instruction);
    }
    return instruction;
  });

  return { fixed, wasModified };
}

/**
 * Validate that instructions don't have number prefixes (they should start with text)
 */
function validateNoNumberPrefixes(instructions: string[]): boolean {
  for (let i = 0; i < instructions.length; i++) {
    if (hasNumberPrefix(instructions[i])) {
      console.warn(`Warning: Instruction ${i + 1} still has number prefix: "${instructions[i].substring(0, 50)}..."`);
      return false;
    }
  }
  return true;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const maxSamples = 5;

  console.log('🔍 Double Numbered Instructions Fix Script');
  console.log('==========================================\n');

  if (dryRun) {
    console.log('📋 Running in DRY RUN mode (use --execute to apply fixes)\n');
  } else {
    console.log('✅ Running in EXECUTE mode (will apply fixes)\n');
  }

  const report: FixReport = {
    totalRecipes: 0,
    affectedRecipes: 0,
    fixedRecipes: 0,
    errors: [],
    samples: [],
  };

  try {
    // Fetch all recipes
    console.log('📊 Fetching recipes from database...');
    const allRecipes = await db.select().from(recipes);
    report.totalRecipes = allRecipes.length;
    console.log(`Found ${report.totalRecipes} total recipes\n`);

    // Process each recipe
    for (const recipe of allRecipes) {
      try {
        // Parse instructions
        let instructions: string[];
        try {
          instructions = JSON.parse(recipe.instructions);
        } catch (parseError) {
          console.warn(`⚠️  Skipping recipe ${recipe.id} (${recipe.name}): Invalid JSON in instructions`);
          report.errors.push({
            recipeId: recipe.id,
            error: 'Invalid JSON in instructions',
          });
          continue;
        }

        // Check if any instructions have number prefixes
        const hasIssues = instructions.some(hasNumberPrefix);

        if (!hasIssues) {
          continue;
        }

        report.affectedRecipes++;

        // Fix the instructions
        const { fixed, wasModified } = fixInstructions(instructions);

        if (!wasModified) {
          console.warn(`⚠️  Recipe ${recipe.id} marked as affected but no changes made`);
          continue;
        }

        // Validate that number prefixes were removed
        const isClean = validateNoNumberPrefixes(fixed);
        if (!isClean) {
          console.warn(`⚠️  Warning: Some instructions still have number prefixes in recipe ${recipe.id} (${recipe.name})`);
        }

        // Store sample (limit to maxSamples)
        if (report.samples.length < maxSamples) {
          report.samples.push({
            recipeId: recipe.id,
            name: recipe.name,
            before: instructions,
            after: fixed,
          });
        }

        // Apply fix if in execute mode
        if (!dryRun) {
          await db
            .update(recipes)
            .set({
              instructions: JSON.stringify(fixed),
              updated_at: new Date(),
            })
            .where(sql`${recipes.id} = ${recipe.id}`);

          report.fixedRecipes++;
          console.log(`✅ Fixed: ${recipe.name} (${recipe.id})`);
        } else {
          console.log(`📝 Would fix: ${recipe.name} (${recipe.id})`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing recipe ${recipe.id}:`, errorMessage);
        report.errors.push({
          recipeId: recipe.id,
          error: errorMessage,
        });
      }
    }

    // Print report
    console.log('\n==========================================');
    console.log('📈 EXECUTION REPORT');
    console.log('==========================================\n');

    console.log(`Total Recipes Scanned: ${report.totalRecipes}`);
    console.log(`Affected Recipes Found: ${report.affectedRecipes}`);

    if (dryRun) {
      console.log(`Recipes That Would Be Fixed: ${report.affectedRecipes}`);
    } else {
      console.log(`Recipes Successfully Fixed: ${report.fixedRecipes}`);
    }

    console.log(`Errors Encountered: ${report.errors.length}\n`);

    // Show samples
    if (report.samples.length > 0) {
      console.log('==========================================');
      console.log('📝 SAMPLE FIXES (Before/After)');
      console.log('==========================================\n');

      for (const sample of report.samples) {
        console.log(`Recipe: ${sample.name}`);
        console.log(`ID: ${sample.recipeId}\n`);

        // Show first 3 affected instructions
        const affectedInstructions = sample.before
          .map((instruction, index) => ({ instruction, index }))
          .filter(({ instruction }) => hasNumberPrefix(instruction))
          .slice(0, 3);

        for (const { instruction, index } of affectedInstructions) {
          console.log(`Step ${index + 1}:`);
          console.log('  BEFORE:', JSON.stringify(instruction));
          console.log('  AFTER: ', JSON.stringify(sample.after[index]));
          console.log('');
        }

        console.log('---\n');
      }
    }

    // Show errors
    if (report.errors.length > 0) {
      console.log('==========================================');
      console.log('❌ ERRORS');
      console.log('==========================================\n');

      for (const error of report.errors) {
        console.log(`Recipe ID: ${error.recipeId}`);
        console.log(`Error: ${error.error}\n`);
      }
    }

    // Final message
    console.log('==========================================');
    if (dryRun) {
      console.log('\n💡 To apply these fixes, run with --execute flag:');
      console.log('   pnpm tsx scripts/fix-double-numbered-instructions.ts --execute\n');
    } else {
      console.log('\n✅ All fixes have been applied!\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Execute
main()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
