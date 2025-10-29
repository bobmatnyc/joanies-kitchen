/**
 * Phase 2: LLM-Powered Consolidation Decision
 *
 * Uses Claude 3.5 Sonnet via OpenRouter to intelligently analyze duplicate groups and decide:
 * - Which ingredients should be merged
 * - Which should remain separate (semantic differences)
 * - Correct canonical names and categories
 * - Appropriate aliases for variants
 *
 * Usage: tsx scripts/llm-ingredient-consolidation.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DuplicateGroup } from './analyze-ingredient-duplicates';

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
}

const BATCH_SIZE = 15; // Process 15 groups at a time to stay within token limits
const MAX_RETRIES = 3;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function analyzeWithLLM(groups: DuplicateGroup[]): Promise<ConsolidationDecision[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable not set');
  }

  const decisions: ConsolidationDecision[] = [];

  const totalBatches = Math.ceil(groups.length / BATCH_SIZE);
  console.log(`🤖 Processing ${groups.length} duplicate groups in ${totalBatches} batches...\n`);

  for (let i = 0; i < groups.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = groups.slice(i, i + BATCH_SIZE);

    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} groups)...`);

    const prompt = buildAnalysisPrompt(batch);

    let attempt = 0;
    let batchDecisions: ConsolidationDecision[] = [];

    while (attempt < MAX_RETRIES) {
      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://joanies.kitchen',
            'X-Title': "Joanie's Kitchen - Ingredient Consolidation",
          },
          body: JSON.stringify({
            model: 'anthropic/claude-3.5-sonnet',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 8192,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('No content in OpenRouter response');
        }

        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : content;

        batchDecisions = JSON.parse(jsonText);
        console.log(`   ✅ Processed ${batchDecisions.length} decisions`);
        break;
      } catch (error) {
        attempt++;
        console.error(
          `   ⚠️  Attempt ${attempt} failed:`,
          error instanceof Error ? error.message : error
        );

        if (attempt >= MAX_RETRIES) {
          console.error(`   ❌ Max retries reached for batch ${batchNum}`);
          // Create placeholder decisions for failed batch
          batchDecisions = batch.map((group) => ({
            group: group.normalized_key,
            action: 'needs_review' as const,
            reason: 'LLM analysis failed - manual review required',
            confidence: 'low' as const,
          }));
        } else {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    decisions.push(...batchDecisions);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < groups.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return decisions;
}

function buildAnalysisPrompt(batch: DuplicateGroup[]): string {
  return `You are an expert ingredient data curator for a recipe database. Analyze these ingredient duplicate groups and decide which should be merged.

GROUPS TO ANALYZE:
${JSON.stringify(batch, null, 2)}

CONSOLIDATION RULES:
1. **Merge plural/singular variants** (bean sprout/bean sprouts → bean sprouts - prefer plural)
2. **Merge punctuation variants** (chile/chili/chilies → chili or chilies based on common usage)
3. **Merge apostrophe variants** (angel hair/angel's hair → angel hair - no apostrophe)
4. **Merge category duplicates** (same ingredient in different categories → pick most appropriate)
5. **Keep separate if semantically different** (balsamic vinegar ≠ balsamic vinaigrette)
6. **Remove zero-usage duplicates** (0 recipes in all variants → mark for review)
7. **Fix miscategorizations** (bamboo skewers → "tools" not "other")

CANONICAL NAME SELECTION:
- Choose the most commonly used display name (highest usage_count)
- Prefer full spelling over abbreviations
- Use proper capitalization
- For plural vs singular: prefer PLURAL form as canonical

CATEGORY SELECTION:
- Choose the most specific correct category
- Consider: vegetables, fruits, proteins, meats, seafood, dairy, grains, pasta, spices, herbs, condiments, oils, nuts, sweeteners, baking, beverages, tools, other
- If usage_count differs significantly across categories, choose the higher-usage category

OUTPUT FORMAT:
Return a JSON array of decisions. For each group:
{
  "group": "normalized_key",
  "action": "merge" | "keep_separate" | "needs_review",
  "canonical_id": "UUID of ingredient to keep (highest usage)",
  "canonical_name": "Standardized display name (proper capitalization)",
  "canonical_category": "Correct category",
  "duplicates_to_merge": ["UUID1", "UUID2"],  // All other variant IDs
  "reason": "Brief explanation of decision",
  "aliases": ["variant1", "variant2"],  // Alternative names to store
  "confidence": "high" | "medium" | "low"
}

IMPORTANT:
- For "merge" action: canonical_id MUST be one of the variant IDs (usually highest usage)
- duplicates_to_merge should include ALL other variant IDs
- aliases should include the display_name of merged variants
- For "keep_separate": explain why variants are semantically different
- For "needs_review": flag uncertain cases requiring human judgment

Return ONLY valid JSON array, no markdown formatting.`;
}

async function main() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  const inputPath = path.join(tmpDir, 'potential-duplicates.json');
  const outputPath = path.join(tmpDir, 'consolidation-decisions.json');

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error('❌ Error: potential-duplicates.json not found!');
    console.error('   Run: tsx scripts/analyze-ingredient-duplicates.ts first\n');
    process.exit(1);
  }

  // Load duplicate groups
  const duplicates: DuplicateGroup[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  console.log(`📋 Loaded ${duplicates.length} duplicate groups from analysis\n`);

  // Run LLM analysis
  const decisions = await analyzeWithLLM(duplicates);

  // Generate statistics
  const stats = {
    total: decisions.length,
    merge: decisions.filter((d) => d.action === 'merge').length,
    keep_separate: decisions.filter((d) => d.action === 'keep_separate').length,
    needs_review: decisions.filter((d) => d.action === 'needs_review').length,
    high_confidence: decisions.filter((d) => d.confidence === 'high').length,
    medium_confidence: decisions.filter((d) => d.confidence === 'medium').length,
    low_confidence: decisions.filter((d) => d.confidence === 'low').length,
  };

  // Calculate consolidation impact
  const ingredientsToDelete = decisions
    .filter((d) => d.action === 'merge' && d.duplicates_to_merge)
    .reduce((sum, d) => sum + (d.duplicates_to_merge?.length || 0), 0);

  // Save decisions
  fs.writeFileSync(outputPath, JSON.stringify(decisions, null, 2));

  console.log('\n✅ LLM Analysis Complete!\n');
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

  // Show sample high-confidence merges
  const highConfidenceMerges = decisions
    .filter((d) => d.action === 'merge' && d.confidence === 'high')
    .slice(0, 5);

  if (highConfidenceMerges.length > 0) {
    console.log('✨ Sample High-Confidence Merges:\n');
    highConfidenceMerges.forEach((decision, idx) => {
      console.log(`${idx + 1}. ${decision.canonical_name} [${decision.canonical_category}]`);
      console.log(`   Reason: ${decision.reason}`);
      console.log(`   Aliases: ${decision.aliases?.join(', ') || 'none'}\n`);
    });
  }

  // Show items needing review
  const reviewItems = decisions.filter((d) => d.action === 'needs_review');
  if (reviewItems.length > 0) {
    console.log(`⚠️  ${reviewItems.length} groups need manual review:\n`);
    reviewItems.slice(0, 10).forEach((decision, idx) => {
      console.log(`${idx + 1}. ${decision.group}`);
      console.log(`   Reason: ${decision.reason}\n`);
    });
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error during LLM analysis:', error);
    process.exit(1);
  });
}

export { analyzeWithLLM };
export type { ConsolidationDecision };
