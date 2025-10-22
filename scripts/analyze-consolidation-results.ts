/**
 * Analyze Consolidation Results
 *
 * Compare rule-based vs semantic consolidation results
 */

import * as fs from 'fs';
import * as path from 'path';

const tmpDir = path.join(process.cwd(), 'tmp');
const decisionsPath = path.join(tmpDir, 'semantic-consolidation-decisions.json');
const duplicatesPath = path.join(tmpDir, 'potential-duplicates.json');

const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf-8'));
const duplicates = JSON.parse(fs.readFileSync(duplicatesPath, 'utf-8'));

console.log('📊 Consolidation Results Analysis\n');

// Basic stats
console.log('Overall Statistics:');
console.log(`  Total groups: ${decisions.length}`);
console.log(`  Merges: ${decisions.filter((d: any) => d.action === 'merge').length}`);
console.log(`  Keep separate: ${decisions.filter((d: any) => d.action === 'keep_separate').length}`);
console.log(`  Needs review: ${decisions.filter((d: any) => d.action === 'needs_review').length}\n`);

// LLM vs Rule-based
const llmDecisions = decisions.filter((d: any) => d.semantic_validation);
const ruleDecisions = decisions.filter((d: any) => !d.semantic_validation);

console.log('Decision Source:');
console.log(`  Rule-based: ${ruleDecisions.length}`);
console.log(`  LLM-validated: ${llmDecisions.length}\n`);

// Sample rule-based merges
const ruleMerges = decisions.filter((d: any) => d.action === 'merge' && !d.semantic_validation);
console.log('✨ Sample Rule-Based Merges:\n');
ruleMerges.slice(0, 10).forEach((d: any, i: number) => {
  const group = duplicates.find((g: any) => g.normalized_key === d.group);
  console.log(`${i + 1}. ${d.canonical_name} [${d.canonical_category}]`);
  console.log(`   Variants: ${group.variants.map((v: any) => v.display_name).join(', ')}`);
  console.log(`   Reason: ${d.reason}\n`);
});

// Check for groups that might benefit from LLM
console.log('🔍 Potential LLM Candidates (complex cases):\n');
const complexGroups = duplicates.filter((g: any) => {
  const v1 = g.variants[0].name.toLowerCase();
  const v2 = g.variants[1].name.toLowerCase();

  // Skip simple plurals
  if (v1 + 's' === v2 || v2 + 's' === v1) return false;
  if (v1 + 'es' === v2 || v2 + 'es' === v1) return false;

  // Skip if same after punctuation removal
  const clean1 = v1.replace(/[^a-z0-9\s]/g, '');
  const clean2 = v2.replace(/[^a-z0-9\s]/g, '');
  if (clean1 === clean2) return false;

  // Has different words - complex case
  return true;
});

console.log(`Found ${complexGroups.length} complex groups\n`);
complexGroups.slice(0, 10).forEach((g: any, i: number) => {
  const decision = decisions.find((d: any) => d.group === g.normalized_key);
  console.log(
    `${i + 1}. "${g.variants[0].display_name}" vs "${g.variants[1].display_name}"`
  );
  console.log(`   Decision: ${decision.action} - ${decision.reason}\n`);
});

// Zero-usage groups
const zeroUsage = decisions.filter((d: any) => d.reason.includes('0 usage'));
console.log(`\n⚠️  Zero Usage Groups: ${zeroUsage.length}`);
console.log('   (These should be deleted entirely)\n');

// Expected consolidation impact
const ingredientsToDelete = decisions
  .filter((d: any) => d.action === 'merge' && d.duplicates_to_merge)
  .reduce((sum: number, d: any) => sum + (d.duplicates_to_merge?.length || 0), 0);

console.log('💾 Consolidation Impact:');
console.log(`  Ingredients to delete: ${ingredientsToDelete}`);
console.log(`  Groups to delete (0 usage): ${zeroUsage.length}`);
console.log(`  Total reduction: ${ingredientsToDelete + zeroUsage.length * 2} ingredients\n`);
