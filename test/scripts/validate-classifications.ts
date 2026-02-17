/**
 * Validation Script: Check Classification Quality
 *
 * Validates the quality and coverage of recipe instruction classifications.
 *
 * Run with: pnpm tsx scripts/validate-classifications.ts
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { InstructionMetadata } from '@/types/instruction-metadata';

async function validateClassifications() {
  console.log('🔍 Recipe Instruction Classification Validation\n');
  console.log('═══════════════════════════════════════════\n');

  // 1. Coverage Statistics
  console.log('📊 COVERAGE STATISTICS\n');

  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total_recipes,
      COUNT(instruction_metadata) as classified_recipes,
      COUNT(*) FILTER (WHERE instruction_metadata IS NOT NULL) * 100.0 / COUNT(*) as coverage_pct
    FROM recipes
    WHERE instructions IS NOT NULL;
  `);

  const totalRecipes = Number(stats.rows[0].total_recipes);
  const classifiedRecipes = Number(stats.rows[0].classified_recipes);
  const coveragePct = Number(stats.rows[0].coverage_pct);

  console.log(`Total Recipes:          ${totalRecipes}`);
  console.log(`Classified Recipes:     ${classifiedRecipes}`);
  console.log(`Coverage:               ${coveragePct.toFixed(2)}%`);
  console.log(`Unclassified:           ${totalRecipes - classifiedRecipes}`);
  console.log('');

  if (classifiedRecipes === 0) {
    console.log('⚠️  No recipes have been classified yet.\n');
    console.log('Run: pnpm tsx scripts/classify-all-recipes.ts\n');
    return;
  }

  // 2. Quality Metrics
  console.log('═══════════════════════════════════════════');
  console.log('🎯 QUALITY METRICS\n');

  const confidence = await db.execute(sql`
    SELECT
      AVG((metadata->>'confidence')::numeric) as avg_confidence,
      MIN((metadata->>'confidence')::numeric) as min_confidence,
      MAX((metadata->>'confidence')::numeric) as max_confidence
    FROM recipes,
         jsonb_array_elements(instruction_metadata::jsonb) metadata
    WHERE instruction_metadata IS NOT NULL;
  `);

  const avgConfidence = Number(confidence.rows[0].avg_confidence);
  const minConfidence = Number(confidence.rows[0].min_confidence);
  const maxConfidence = Number(confidence.rows[0].max_confidence);

  console.log(`Average Confidence:     ${(avgConfidence * 100).toFixed(2)}%`);
  console.log(`Min Confidence:         ${(minConfidence * 100).toFixed(2)}%`);
  console.log(`Max Confidence:         ${(maxConfidence * 100).toFixed(2)}%`);
  console.log('');

  // 3. Low Confidence Recipes
  console.log('═══════════════════════════════════════════');
  console.log('⚠️  LOW CONFIDENCE RECIPES (<80%)\n');

  const lowConfidenceQuery = await db.execute(sql`
    SELECT id, name, instruction_metadata
    FROM recipes
    WHERE instruction_metadata IS NOT NULL
    ORDER BY id
    LIMIT 1000;
  `);

  const lowConfidenceRecipes: Array<{ name: string; avgConf: number }> = [];

  for (const row of lowConfidenceQuery.rows) {
    try {
      const metadata = JSON.parse((row as any).instruction_metadata) as InstructionMetadata[];
      const avgConf = metadata.reduce((sum, m) => sum + m.confidence, 0) / metadata.length;

      if (avgConf < 0.8) {
        lowConfidenceRecipes.push({
          name: (row as any).name,
          avgConf,
        });
      }
    } catch (_error) {
      console.error(`Error parsing metadata for recipe: ${(row as any).name}`);
    }
  }

  if (lowConfidenceRecipes.length > 0) {
    console.log(`Found ${lowConfidenceRecipes.length} recipes with low confidence:\n`);
    lowConfidenceRecipes.slice(0, 10).forEach((recipe) => {
      console.log(`  - ${recipe.name} (${(recipe.avgConf * 100).toFixed(1)}%)`);
    });
    if (lowConfidenceRecipes.length > 10) {
      console.log(`  ... and ${lowConfidenceRecipes.length - 10} more`);
    }
    console.log('');
  } else {
    console.log('✅ No low confidence recipes found\n');
  }

  // 4. Missing Classifications
  console.log('═══════════════════════════════════════════');
  console.log('📋 MISSING CLASSIFICATIONS\n');

  const missing = await db.execute(sql`
    SELECT COUNT(*) as missing_count
    FROM recipes
    WHERE instructions IS NOT NULL
    AND instruction_metadata IS NULL;
  `);

  const missingCount = Number(missing.rows[0].missing_count);
  console.log(`Recipes without classifications: ${missingCount}`);
  console.log('');

  // 5. Model Distribution
  console.log('═══════════════════════════════════════════');
  console.log('🤖 MODEL DISTRIBUTION\n');

  const modelDist = await db.execute(sql`
    SELECT
      instruction_metadata_model as model,
      COUNT(*) as count
    FROM recipes
    WHERE instruction_metadata_model IS NOT NULL
    GROUP BY instruction_metadata_model
    ORDER BY count DESC;
  `);

  console.log('Models used:');
  modelDist.rows.forEach((row: any) => {
    console.log(`  ${row.model}: ${row.count} recipes`);
  });
  console.log('');

  // 6. Overall Health Check
  console.log('═══════════════════════════════════════════');
  console.log('✅ HEALTH CHECK\n');

  const checks = [
    { name: 'Coverage > 0%', pass: coveragePct > 0, critical: true },
    { name: 'Coverage > 50%', pass: coveragePct > 50, critical: false },
    { name: 'Coverage > 95%', pass: coveragePct > 95, critical: false },
    { name: 'Avg Confidence > 85%', pass: avgConfidence > 0.85, critical: true },
    { name: 'Avg Confidence > 90%', pass: avgConfidence > 0.9, critical: false },
    {
      name: 'Low confidence recipes < 5%',
      pass: lowConfidenceRecipes.length / classifiedRecipes < 0.05,
      critical: false,
    },
  ];

  checks.forEach((check) => {
    const icon = check.pass ? '✅' : check.critical ? '❌' : '⚠️';
    console.log(`${icon} ${check.name}`);
  });

  const criticalFailed = checks.filter((c) => c.critical && !c.pass).length;
  const allPassed = checks.every((c) => c.pass);

  console.log('');

  if (criticalFailed > 0) {
    console.log('❌ CRITICAL ISSUES DETECTED');
    console.log('   Some essential quality checks failed.');
  } else if (allPassed) {
    console.log('✅ ALL CHECKS PASSED');
    console.log('   Classification system is healthy!');
  } else {
    console.log('⚠️  SOME WARNINGS');
    console.log('   Classification system is functional but could be improved.');
  }

  console.log('');
  console.log('═══════════════════════════════════════════\n');

  if (missingCount > 0) {
    console.log('💡 Next Steps:');
    console.log(`   Run: pnpm tsx scripts/classify-all-recipes.ts`);
    console.log(`   This will classify the remaining ${missingCount} recipes.\n`);
  }

  console.log('✅ Validation complete!\n');
}

validateClassifications()
  .then(() => {
    console.log('Validation completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Validation failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  });
