/**
 * Semantic Consolidation Using Local LLM (Ollama)
 *
 * Enhances rule-based consolidation with semantic understanding using local Mistral LLM.
 *
 * Hybrid Approach:
 * 1. Apply fast rule-based decisions first
 * 2. Use LLM for ambiguous/uncertain cases
 * 3. Validate high-impact merges with LLM
 *
 * Usage: tsx scripts/semantic-consolidation.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DuplicateGroup, IngredientVariant } from './analyze-ingredient-duplicates';

interface SemanticAnalysis {
  similar: boolean;
  reason: string;
  confidence: number;
}

interface ConsolidationDecision {
  group: string;
  action: 'merge' | 'keep_separate' | 'needs_review';
  canonical_id?: string;
  canonical_name?: string;
  canonical_category?: string;
  duplicates_to_merge?: string[];
  reason: string;
  aliases?: string[];
  confidence?: 'high' | 'medium' | 'low';
  semantic_validation?: SemanticAnalysis;
}

// Import rule-based functions
const CATEGORY_HIERARCHY: Record<string, number> = {
  vegetables: 10,
  fruits: 10,
  herbs: 10,
  spices: 10,
  meats: 9,
  seafood: 9,
  poultry: 9,
  proteins: 8,
  dairy: 8,
  nuts: 8,
  grains: 7,
  pasta: 7,
  legumes: 7,
  oils: 6,
  condiments: 6,
  sweeteners: 6,
  baking: 5,
  beverages: 5,
  tools: 4,
  other: 1,
};

function selectCanonicalCategory(variants: IngredientVariant[]): string {
  const categories = new Set(variants.map((v) => v.category).filter(Boolean));
  if (categories.size === 1) {
    return Array.from(categories)[0] || 'other';
  }

  const categoryUsage = new Map<string, number>();
  variants.forEach((v) => {
    if (v.category) {
      categoryUsage.set(v.category, (categoryUsage.get(v.category) || 0) + v.usage_count);
    }
  });

  const sortedCategories = Array.from(categoryUsage.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (CATEGORY_HIERARCHY[b[0]] || 0) - (CATEGORY_HIERARCHY[a[0]] || 0);
  });

  return sortedCategories[0]?.[0] || 'other';
}

function selectCanonicalName(variants: IngredientVariant[]): string {
  const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
  const totalUsage = variants.reduce((sum, v) => sum + v.usage_count, 0);
  if (sorted[0].usage_count > totalUsage * 0.5) {
    return sorted[0].display_name;
  }

  const pluralVariants = variants.filter((v) => v.name.endsWith('s') || v.name.includes('es'));
  if (pluralVariants.length > 0) {
    return pluralVariants.sort((a, b) => b.usage_count - a.usage_count)[0].display_name;
  }

  return sorted[0].display_name;
}

function arePluralVariants(variants: IngredientVariant[]): boolean {
  if (variants.length < 2) return false;

  const names = variants.map((v) => v.name.toLowerCase()).sort((a, b) => a.length - b.length);
  const base = names[0];

  for (let i = 1; i < names.length; i++) {
    const variant = names[i];
    if (variant === `${base}s`) continue;
    if (variant === `${base}es`) continue;
    if (base.endsWith('y') && variant === `${base.slice(0, -1)}ies`) continue;
    return false;
  }

  return true;
}

function arePunctuationVariants(variants: IngredientVariant[]): boolean {
  if (variants.length > 3) return false;

  const normalized = variants.map((v) =>
    v.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const uniqueNormalized = new Set(normalized);
  return uniqueNormalized.size === 1;
}

function areCategoryDuplicates(variants: IngredientVariant[]): boolean {
  const uniqueNames = new Set(variants.map((v) => v.name.toLowerCase()));
  if (uniqueNames.size !== 1) return false;

  const categories = new Set(variants.map((v) => v.category).filter(Boolean));
  return categories.size > 1;
}

function areZeroUsageDuplicates(variants: IngredientVariant[]): boolean {
  return variants.every((v) => v.usage_count === 0);
}

/**
 * Semantic comparison using local Ollama LLM (HTTP API)
 */
async function semanticCompare(ing1: string, ing2: string, retries = 1): Promise<SemanticAnalysis> {
  const prompt = `Are these two ingredients the same thing? Answer ONLY with valid JSON.

Ingredient 1: "${ing1}"
Ingredient 2: "${ing2}"

Rules for evaluation:
1. Plural/singular forms are the SAME (e.g., "onion" = "onions")
2. Different spellings/punctuation are the SAME (e.g., "chile" = "chili")
3. Related but different products are NOT the same (e.g., "vinegar" ≠ "vinaigrette")
4. Different preparation states might be DIFFERENT (e.g., "roasted peppers" ≠ "raw peppers")
5. Same ingredient with descriptors are usually SAME (e.g., "red bell pepper" = "bell pepper")

Return ONLY this JSON structure (no other text):
{
  "similar": true or false,
  "reason": "brief explanation in one sentence",
  "confidence": 0.0 to 1.0
}`;

  try {
    // Use Ollama HTTP API (more reliable than CLI)
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more deterministic results
          num_predict: 200, // Limit response length
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { response: string };
    const responseText = data.response;

    // Extract JSON from response (may have surrounding text)
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in response: ${responseText.slice(0, 200)}`);
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (
      typeof result.similar !== 'boolean' ||
      typeof result.reason !== 'string' ||
      typeof result.confidence !== 'number'
    ) {
      throw new Error('Invalid JSON structure');
    }

    return result;
  } catch (error) {
    if (retries > 0) {
      console.warn(`⚠️  LLM call failed for "${ing1}" vs "${ing2}", retrying... (${retries} left)`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
      return semanticCompare(ing1, ing2, retries - 1);
    }

    console.error(`❌ LLM failed for "${ing1}" vs "${ing2}":`, error);
    // Return conservative fallback
    return {
      similar: false,
      reason: 'LLM analysis failed - defaulting to separate',
      confidence: 0.0,
    };
  }
}

/**
 * Hybrid consolidation: Rules + LLM validation
 */
async function analyzeGroupWithSemantics(group: DuplicateGroup): Promise<ConsolidationDecision> {
  const { variants, normalized_key } = group;

  // Rule 1: Zero usage duplicates
  if (areZeroUsageDuplicates(variants)) {
    return {
      group: normalized_key,
      action: 'needs_review',
      reason: 'All variants have 0 usage - recommend deletion',
      confidence: 'medium',
    };
  }

  // Rule 2: High-confidence plural variants
  if (arePluralVariants(variants)) {
    // BUT: Check if display names differ significantly
    // If so, use LLM to validate
    if (variants.length === 2) {
      const display1 = variants[0].display_name.toLowerCase();
      const display2 = variants[1].display_name.toLowerCase();

      // Count word differences (after normalizing plurals)
      const words1 = new Set(
        display1
          .replace(/s$/i, '')
          .split(/\s+/)
          .filter((w) => w.length > 2)
      );
      const words2 = new Set(
        display2
          .replace(/s$/i, '')
          .split(/\s+/)
          .filter((w) => w.length > 2)
      );

      const intersection = new Set([...words1].filter((x) => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      const wordOverlap = intersection.size / union.size;

      // If less than 50% word overlap, use LLM to validate
      if (wordOverlap < 0.5) {
        console.log(
          `🤔 Ambiguous plural case (${(wordOverlap * 100).toFixed(0)}% overlap): "${variants[0].display_name}" vs "${variants[1].display_name}"`
        );

        const semantic = await semanticCompare(variants[0].display_name, variants[1].display_name);

        if (semantic.similar && semantic.confidence >= 0.7) {
          const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
          const canonical = sorted[0];
          const duplicates = sorted.slice(1);

          return {
            group: normalized_key,
            action: 'merge',
            canonical_id: canonical.id,
            canonical_name: selectCanonicalName(variants),
            canonical_category: selectCanonicalCategory(variants),
            duplicates_to_merge: duplicates.map((v) => v.id),
            reason: `Semantically equivalent despite display name differences (LLM: ${semantic.reason})`,
            aliases: variants
              .map((v) => v.display_name)
              .filter((n) => n !== selectCanonicalName(variants)),
            confidence: semantic.confidence >= 0.85 ? 'high' : 'medium',
            semantic_validation: semantic,
          };
        } else if (!semantic.similar && semantic.confidence >= 0.7) {
          return {
            group: normalized_key,
            action: 'keep_separate',
            reason: `Different ingredients despite similar normalized form (LLM: ${semantic.reason})`,
            confidence: semantic.confidence >= 0.85 ? 'high' : 'medium',
            semantic_validation: semantic,
          };
        }
      }
    }

    // High-confidence plural variants (no LLM needed)
    const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    return {
      group: normalized_key,
      action: 'merge',
      canonical_id: canonical.id,
      canonical_name: selectCanonicalName(variants),
      canonical_category: selectCanonicalCategory(variants),
      duplicates_to_merge: duplicates.map((v) => v.id),
      reason: 'Plural/singular variants of same ingredient (rule-based)',
      aliases: variants
        .map((v) => v.display_name)
        .filter((n) => n !== selectCanonicalName(variants)),
      confidence: 'high',
    };
  }

  // Rule 3: High-confidence punctuation variants
  if (arePunctuationVariants(variants)) {
    const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    return {
      group: normalized_key,
      action: 'merge',
      canonical_id: canonical.id,
      canonical_name: selectCanonicalName(variants),
      canonical_category: selectCanonicalCategory(variants),
      duplicates_to_merge: duplicates.map((v) => v.id),
      reason: 'Punctuation/spelling variants of same ingredient (rule-based)',
      aliases: variants
        .map((v) => v.display_name)
        .filter((n) => n !== selectCanonicalName(variants)),
      confidence: 'high',
    };
  }

  // Rule 4: High-confidence category duplicates
  if (areCategoryDuplicates(variants)) {
    const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    return {
      group: normalized_key,
      action: 'merge',
      canonical_id: canonical.id,
      canonical_name: selectCanonicalName(variants),
      canonical_category: selectCanonicalCategory(variants),
      duplicates_to_merge: duplicates.map((v) => v.id),
      reason: 'Same ingredient in multiple categories (rule-based)',
      aliases: [],
      confidence: 'high',
    };
  }

  // *** NEW: Use LLM for ambiguous cases ***
  // Only compare first 2 variants (most common case)
  if (variants.length === 2) {
    console.log(`🤖 LLM analyzing: "${variants[0].display_name}" vs "${variants[1].display_name}"`);

    const semantic = await semanticCompare(variants[0].display_name, variants[1].display_name);

    if (semantic.similar && semantic.confidence >= 0.7) {
      // LLM says merge with high confidence
      const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);

      return {
        group: normalized_key,
        action: 'merge',
        canonical_id: canonical.id,
        canonical_name: selectCanonicalName(variants),
        canonical_category: selectCanonicalCategory(variants),
        duplicates_to_merge: duplicates.map((v) => v.id),
        reason: `Semantically equivalent (LLM: ${semantic.reason})`,
        aliases: variants
          .map((v) => v.display_name)
          .filter((n) => n !== selectCanonicalName(variants)),
        confidence: semantic.confidence >= 0.85 ? 'high' : 'medium',
        semantic_validation: semantic,
      };
    } else if (!semantic.similar && semantic.confidence >= 0.7) {
      // LLM says keep separate with high confidence
      return {
        group: normalized_key,
        action: 'keep_separate',
        reason: `Semantically different (LLM: ${semantic.reason})`,
        confidence: semantic.confidence >= 0.85 ? 'high' : 'medium',
        semantic_validation: semantic,
      };
    } else {
      // Low confidence from LLM
      return {
        group: normalized_key,
        action: 'needs_review',
        reason: `LLM uncertain (confidence: ${semantic.confidence.toFixed(2)}): ${semantic.reason}`,
        confidence: 'low',
        semantic_validation: semantic,
      };
    }
  }

  // Multiple variants or other complex cases - needs review
  return {
    group: normalized_key,
    action: 'needs_review',
    reason: 'Multiple variants with complex patterns - manual review recommended',
    confidence: 'low',
  };
}

async function main() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  const inputPath = path.join(tmpDir, 'potential-duplicates.json');
  const outputPath = path.join(tmpDir, 'semantic-consolidation-decisions.json');

  // Check if Ollama is running
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      throw new Error('Ollama API not responding');
    }
  } catch (_error) {
    console.error('❌ Error: Ollama is not running or not installed!');
    console.error('   Start Ollama: ollama serve');
    console.error('   Install model: ollama pull mistral\n');
    process.exit(1);
  }

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error('❌ Error: potential-duplicates.json not found!');
    console.error('   Run: tsx scripts/analyze-ingredient-duplicates.ts first\n');
    process.exit(1);
  }

  // Load duplicate groups
  const duplicates: DuplicateGroup[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  console.log(`📋 Loaded ${duplicates.length} duplicate groups from analysis\n`);
  console.log('🤖 Applying hybrid consolidation (Rules + LLM)...\n');

  const startTime = Date.now();
  let llmCallCount = 0;

  // Analyze each group
  const decisions: ConsolidationDecision[] = [];
  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    const decision = await analyzeGroupWithSemantics(group);
    decisions.push(decision);

    if (decision.semantic_validation) {
      llmCallCount++;
    }

    // Progress indicator every 10 items
    if ((i + 1) % 10 === 0 || i === duplicates.length - 1) {
      const progress = (((i + 1) / duplicates.length) * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (duplicates.length - i - 1) / rate;
      console.log(
        `Progress: ${i + 1}/${duplicates.length} (${progress}%) - ETA: ${Math.ceil(remaining / 60)}m`
      );
    }
  }

  const duration = Date.now() - startTime;

  // Generate statistics
  const stats = {
    total: decisions.length,
    merge: decisions.filter((d) => d.action === 'merge').length,
    keep_separate: decisions.filter((d) => d.action === 'keep_separate').length,
    needs_review: decisions.filter((d) => d.action === 'needs_review').length,
    high_confidence: decisions.filter((d) => d.confidence === 'high').length,
    medium_confidence: decisions.filter((d) => d.confidence === 'medium').length,
    low_confidence: decisions.filter((d) => d.confidence === 'low').length,
    llm_calls: llmCallCount,
    rule_based: decisions.length - llmCallCount,
  };

  // Calculate consolidation impact
  const ingredientsToDelete = decisions
    .filter((d) => d.action === 'merge' && d.duplicates_to_merge)
    .reduce((sum, d) => sum + (d.duplicates_to_merge?.length || 0), 0);

  // Save decisions
  fs.writeFileSync(outputPath, JSON.stringify(decisions, null, 2));

  console.log('✅ Semantic Analysis Complete!\n');
  console.log('⏱️  Performance:');
  console.log(`   - Total time: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   - LLM calls: ${llmCallCount}`);
  console.log(`   - Rule-based: ${stats.rule_based}`);
  console.log(`   - Avg per decision: ${(duration / decisions.length).toFixed(0)}ms\n`);

  console.log('📊 Decision Summary:');
  console.log(`   - Total decisions: ${stats.total}`);
  console.log(`   - Merge: ${stats.merge} groups`);
  console.log(`   - Keep separate: ${stats.keep_separate} groups`);
  console.log(`   - Needs review: ${stats.needs_review} groups\n`);

  console.log('🎯 Confidence Distribution:');
  console.log(`   - High: ${stats.high_confidence}`);
  console.log(`   - Medium: ${stats.medium_confidence}`);
  console.log(`   - Low: ${stats.low_confidence}\n`);

  console.log('💾 Consolidation Impact:');
  console.log(`   - Ingredients to delete: ${ingredientsToDelete}`);
  console.log(`   - Canonical ingredients to keep: ${stats.merge}\n`);

  console.log(`📁 Decisions saved to: ${outputPath}\n`);

  // Show LLM-validated merges
  const llmMerges = decisions
    .filter((d) => d.action === 'merge' && d.semantic_validation)
    .slice(0, 10);

  if (llmMerges.length > 0) {
    console.log('🧠 Sample LLM-Validated Merges:\n');
    llmMerges.forEach((decision, idx) => {
      console.log(`${idx + 1}. ${decision.canonical_name} [${decision.canonical_category}]`);
      console.log(`   Reason: ${decision.reason}`);
      console.log(
        `   Confidence: ${decision.semantic_validation?.confidence.toFixed(2)} - ${decision.semantic_validation?.reason}`
      );
      if (decision.aliases && decision.aliases.length > 0) {
        console.log(`   Aliases: ${decision.aliases.join(', ')}`);
      }
      console.log('');
    });
  }

  // Show LLM-validated separations
  const llmSeparations = decisions
    .filter((d) => d.action === 'keep_separate' && d.semantic_validation)
    .slice(0, 5);

  if (llmSeparations.length > 0) {
    console.log('🔍 LLM-Validated Separations:\n');
    llmSeparations.forEach((decision, idx) => {
      console.log(`${idx + 1}. ${decision.group}`);
      console.log(`   Reason: ${decision.reason}`);
      console.log(
        `   Confidence: ${decision.semantic_validation?.confidence.toFixed(2)} - ${decision.semantic_validation?.reason}\n`
      );
    });
  }

  // Show items needing review
  const reviewItems = decisions.filter((d) => d.action === 'needs_review');
  if (reviewItems.length > 0) {
    console.log(`⚠️  ${reviewItems.length} groups need manual review:\n`);
    reviewItems.slice(0, 5).forEach((decision, idx) => {
      console.log(`${idx + 1}. ${decision.group}`);
      console.log(`   Reason: ${decision.reason}\n`);
    });
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error during semantic analysis:', error);
    process.exit(1);
  });
}

export { analyzeGroupWithSemantics, semanticCompare };
