/**
 * Phase 3: Missing Ingredient Derivation
 *
 * Purpose: Generate ingredient lists for recipes with missing/incomplete ingredients
 * using Qwen2.5-7B LLM. Only outputs high-confidence (≥0.90) results.
 *
 * Process:
 * 1. Filter recipes with missing ingredients (from Phase 1 report)
 * 2. For each recipe, use Qwen2.5-7B to extract ingredients with quantities
 * 3. Parse into structured format
 * 4. Validate against recipe instructions
 * 5. Calculate confidence score
 * 6. Save only high-confidence (≥0.90) derivations
 *
 * Output: tmp/qa-derived-ingredients.json
 *
 * Usage:
 *   pnpm tsx scripts/qa-derive-missing-ingredients.ts
 *   pnpm tsx scripts/qa-derive-missing-ingredients.ts --resume
 *   pnpm tsx scripts/qa-derive-missing-ingredients.ts --min-confidence 0.85
 */

import fs from 'node:fs';
import path from 'node:path';
import cliProgress from 'cli-progress';
import { inArray } from 'drizzle-orm';
import ollama from 'ollama';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { parseJsonResponse, sleep } from './lib/qa-helpers';

interface DerivedIngredient {
  ingredient: string;
  amount: string;
  unit: string;
  optional?: boolean;
}

interface DerivationResult {
  recipe_id: string;
  recipe_name: string;
  original_ingredients: string[]; // May be empty or incomplete
  derived_ingredients: DerivedIngredient[];
  confidence: number;
  validation_notes: string[];
  changes: {
    ingredients_added: number;
    ingredients_modified: number;
    total_ingredients: number;
  };
  derivation_error?: string;
}

interface DerivationReport {
  timestamp: string;
  total_candidates: number;
  processed: number;
  model_used: string;
  min_confidence_threshold: number;
  statistics: {
    high_confidence: number; // ≥0.90
    medium_confidence: number; // 0.70-0.89
    low_confidence: number; // <0.70
    errors: number;
  };
  high_confidence_results: DerivationResult[]; // Only ≥0.90
  all_results: DerivationResult[];
}

interface Checkpoint {
  last_processed_index: number;
  results: DerivationResult[];
  timestamp: string;
}

const MODEL = 'qwen2.5-coder:7b-instruct';
const DEFAULT_MIN_CONFIDENCE = 0.9;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const CHECKPOINT_INTERVAL = 100;

async function deriveIngredientsWithQuantities(
  recipeName: string,
  instructions: string[],
  retryCount = 0
): Promise<{ ingredients: DerivedIngredient[]; error?: string }> {
  const instructionsText = instructions.join('\n');

  const prompt = `Analyze this recipe and extract all ingredients with their quantities.

Recipe: ${recipeName}

Instructions:
${instructionsText}

Return a JSON array of ingredients with quantities. Include common ingredients (salt, pepper, oil, water) if used.

Format: [{"ingredient": "flour", "amount": "2", "unit": "cups"}, {"ingredient": "eggs", "amount": "3", "unit": ""}]

Rules:
- Lowercase ingredient names
- Extract quantities from instructions
- Empty string for unit if none (e.g., eggs, cloves)
- Mark optional items with "optional": true
- Include ALL ingredients from instructions

Return the JSON array now:`;

  try {
    const response = await ollama.chat({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      format: 'json',
      options: {
        temperature: 0.1,
        num_ctx: 4096,
      },
    });

    // Validate response structure
    if (!response || !response.message || !response.message.content) {
      throw new Error(`Invalid response from Ollama: ${JSON.stringify(response)}`);
    }

    const content = response.message.content.trim();
    if (!content) {
      throw new Error('Empty response content from Ollama');
    }

    const parsed = parseJsonResponse(content);

    // Handle both direct array and {"ingredients": [...]} formats
    let ingredientArray: any[];
    if (Array.isArray(parsed)) {
      ingredientArray = parsed;
    } else if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
      ingredientArray = parsed.ingredients;
    } else {
      throw new Error('Response is not an array or object with ingredients array');
    }

    // Validate and normalize response
    const ingredients: DerivedIngredient[] = ingredientArray
      .filter(
        (item) => typeof item === 'object' && item.ingredient && typeof item.ingredient === 'string'
      )
      .map((item) => ({
        ingredient: item.ingredient.toLowerCase().trim(),
        amount: item.amount ? String(item.amount).trim() : '',
        unit: item.unit ? String(item.unit).toLowerCase().trim() : '',
        optional: item.optional === true,
      }));

    return { ingredients };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Ollama error: ${errorMsg}`);

    if (retryCount < MAX_RETRIES) {
      console.error(`⚠️  Derivation failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY * (retryCount + 1));
      return deriveIngredientsWithQuantities(recipeName, instructions, retryCount + 1);
    }
    return {
      ingredients: [],
      error: `Failed after ${MAX_RETRIES} retries: ${errorMsg}`,
    };
  }
}

function calculateConfidence(
  derivedIngredients: DerivedIngredient[],
  instructions: string
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 1.0;
  const instructionsLower = instructions.toLowerCase();

  if (derivedIngredients.length === 0) {
    return { score: 0, notes: ['No ingredients derived'] };
  }

  // Check if all derived ingredients appear in instructions
  let mentionedCount = 0;
  for (const item of derivedIngredients) {
    if (instructionsLower.includes(item.ingredient.toLowerCase())) {
      mentionedCount++;
    } else {
      // Check for common implied ingredients
      const commonImplied = ['salt', 'pepper', 'water', 'oil', 'butter'];
      if (commonImplied.includes(item.ingredient)) {
        notes.push(`Implied ingredient added: ${item.ingredient}`);
      } else {
        notes.push(`Ingredient not mentioned in instructions: ${item.ingredient}`);
        score -= 0.05; // Penalty for unmentioned ingredients
      }
    }
  }

  const mentionRate = mentionedCount / derivedIngredients.length;
  if (mentionRate < 0.8) {
    score *= mentionRate; // Reduce score proportionally
  }

  // Check if quantities are specified
  const withQuantities = derivedIngredients.filter((i) => i.amount && i.amount !== '').length;
  const quantityRate = withQuantities / derivedIngredients.length;
  if (quantityRate < 0.7) {
    notes.push(`Low quantity specification rate: ${(quantityRate * 100).toFixed(0)}%`);
    score *= 0.8 + quantityRate * 0.2; // Reduce score if few quantities
  }

  // Bonus for reasonable ingredient count (5-20 typical)
  if (derivedIngredients.length >= 5 && derivedIngredients.length <= 20) {
    notes.push('Reasonable ingredient count');
  } else if (derivedIngredients.length < 3) {
    notes.push('Very few ingredients (suspiciously low)');
    score *= 0.7;
  } else if (derivedIngredients.length > 25) {
    notes.push('Very many ingredients (suspiciously high)');
    score *= 0.8;
  }

  return { score: Math.max(0, Math.min(1, score)), notes };
}

async function loadCheckpoint(): Promise<Checkpoint | null> {
  const checkpointPath = path.join(process.cwd(), 'tmp', 'qa-derive-ingredients-checkpoint.json');
  if (fs.existsSync(checkpointPath)) {
    const data = fs.readFileSync(checkpointPath, 'utf-8');
    return JSON.parse(data);
  }
  return null;
}

async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  const checkpointPath = path.join(process.cwd(), 'tmp', 'qa-derive-ingredients-checkpoint.json');
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

async function deriveMissingIngredients() {
  console.log('🔍 Phase 3: Missing Ingredient Derivation\n');
  console.log(`🤖 Using model: ${MODEL}\n`);

  // Parse command line arguments
  const minConfidenceArg = process.argv.find((arg) => arg.startsWith('--min-confidence='));
  const minConfidence = minConfidenceArg
    ? parseFloat(minConfidenceArg.split('=')[1])
    : DEFAULT_MIN_CONFIDENCE;

  console.log(`📊 Minimum confidence threshold: ${minConfidence.toFixed(2)}\n`);

  // Check Ollama availability
  try {
    await ollama.list();
  } catch (_error) {
    console.error('❌ Error: Ollama is not running or not accessible');
    console.error('   Please start Ollama with: ollama serve');
    process.exit(1);
  }

  // Ensure tmp directory exists
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Load Phase 1 structure report to find recipes with missing ingredients
  const structureReportPath = path.join(tmpDir, 'qa-structure-report.json');
  if (!fs.existsSync(structureReportPath)) {
    console.error('❌ Error: Structure report not found');
    console.error('   Please run Phase 1 first: pnpm tsx scripts/qa-recipe-structure.ts');
    process.exit(1);
  }

  const structureReport = JSON.parse(fs.readFileSync(structureReportPath, 'utf-8'));
  const missingIngredientsIds = structureReport.critical_issues.missing_ingredients.map(
    (item: any) => item.id
  );

  console.log(`📋 Found ${missingIngredientsIds.length} recipes with missing ingredients\n`);

  // Check for resume flag
  const shouldResume = process.argv.includes('--resume');
  let startIndex = 0;
  let results: DerivationResult[] = [];

  if (shouldResume) {
    const checkpoint = await loadCheckpoint();
    if (checkpoint) {
      console.log(`📍 Resuming from checkpoint: ${checkpoint.last_processed_index + 1} processed`);
      startIndex = checkpoint.last_processed_index + 1;
      results = checkpoint.results;
    } else {
      console.log('⚠️  No checkpoint found, starting from beginning');
    }
  }

  // Fetch recipes with missing ingredients
  const candidateRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ingredients: recipes.ingredients,
      instructions: recipes.instructions,
    })
    .from(recipes)
    .where(inArray(recipes.id, missingIngredientsIds));

  console.log(`🔄 Processing ${candidateRecipes.length - startIndex} recipes\n`);

  const report: DerivationReport = {
    timestamp: new Date().toISOString(),
    total_candidates: candidateRecipes.length,
    processed: 0,
    model_used: MODEL,
    min_confidence_threshold: minConfidence,
    statistics: {
      high_confidence: 0,
      medium_confidence: 0,
      low_confidence: 0,
      errors: 0,
    },
    high_confidence_results: [],
    all_results: [],
  };

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format:
      'Deriving |{bar}| {percentage}% | {value}/{total} | High Conf: {highConf} | Errors: {errors}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  progressBar.start(candidateRecipes.length - startIndex, 0, { highConf: 0, errors: 0 });

  let highConfCount = 0;
  let errorCount = 0;

  for (let i = startIndex; i < candidateRecipes.length; i++) {
    const recipe = candidateRecipes[i];

    // Parse original ingredients
    let originalIngredients: string[] = [];
    try {
      const parsed = JSON.parse(recipe.ingredients);
      if (Array.isArray(parsed)) {
        originalIngredients = parsed.filter((ing) => typeof ing === 'string' && ing.trim() !== '');
      }
    } catch (_error) {
      // Already flagged in Phase 1
    }

    // Parse instructions
    let instructionsArray: string[] = [];
    try {
      const parsed = JSON.parse(recipe.instructions);
      if (Array.isArray(parsed)) {
        instructionsArray = parsed.filter((inst) => typeof inst === 'string' && inst.trim() !== '');
      }
    } catch (_error) {
      errorCount++;
      progressBar.update(i - startIndex + 1, { highConf: highConfCount, errors: errorCount });
      continue;
    }

    if (instructionsArray.length === 0) {
      errorCount++;
      progressBar.update(i - startIndex + 1, { highConf: highConfCount, errors: errorCount });
      continue;
    }

    // Derive ingredients using LLM
    const derivation = await deriveIngredientsWithQuantities(recipe.name, instructionsArray);

    if (derivation.error) {
      errorCount++;
      results.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        original_ingredients: originalIngredients,
        derived_ingredients: [],
        confidence: 0,
        validation_notes: [],
        changes: {
          ingredients_added: 0,
          ingredients_modified: 0,
          total_ingredients: 0,
        },
        derivation_error: derivation.error,
      });
      report.statistics.errors++;
    } else {
      const instructionsText = instructionsArray.join(' ');
      const { score, notes } = calculateConfidence(derivation.ingredients, instructionsText);

      const changes = {
        ingredients_added: derivation.ingredients.length - originalIngredients.length,
        ingredients_modified: 0, // All are new since original was empty/missing
        total_ingredients: derivation.ingredients.length,
      };

      const result: DerivationResult = {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        original_ingredients: originalIngredients,
        derived_ingredients: derivation.ingredients,
        confidence: score,
        validation_notes: notes,
        changes,
      };

      results.push(result);

      // Categorize by confidence
      if (score >= 0.9) {
        report.statistics.high_confidence++;
        highConfCount++;
      } else if (score >= 0.7) {
        report.statistics.medium_confidence++;
      } else {
        report.statistics.low_confidence++;
      }
    }

    progressBar.update(i - startIndex + 1, { highConf: highConfCount, errors: errorCount });

    // Save checkpoint
    if ((i + 1) % CHECKPOINT_INTERVAL === 0) {
      await saveCheckpoint({
        last_processed_index: i,
        results,
        timestamp: new Date().toISOString(),
      });
    }
  }

  progressBar.stop();

  // Filter high confidence results
  report.high_confidence_results = results.filter((r) => r.confidence >= minConfidence);
  report.all_results = results;
  report.processed = results.length;

  // Write report to file
  const reportPath = path.join(tmpDir, 'qa-derived-ingredients.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Clean up checkpoint
  const checkpointPath = path.join(tmpDir, 'qa-derive-ingredients-checkpoint.json');
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }

  // Print summary
  console.log('\n📋 Ingredient Derivation Summary:');
  console.log('─'.repeat(60));
  console.log(`Total Candidates:        ${report.total_candidates.toLocaleString()}`);
  console.log(`Processed:               ${report.processed.toLocaleString()}`);
  console.log(`Model Used:              ${report.model_used}`);
  console.log(`Min Confidence:          ${minConfidence.toFixed(2)}`);
  console.log('');
  console.log('Confidence Distribution:');
  console.log(
    `  🟢 High (≥0.90):       ${report.statistics.high_confidence.toLocaleString()} (${((report.statistics.high_confidence / report.processed) * 100).toFixed(2)}%)`
  );
  console.log(
    `  🟡 Medium (0.70-0.89): ${report.statistics.medium_confidence.toLocaleString()} (${((report.statistics.medium_confidence / report.processed) * 100).toFixed(2)}%)`
  );
  console.log(
    `  🔴 Low (<0.70):        ${report.statistics.low_confidence.toLocaleString()} (${((report.statistics.low_confidence / report.processed) * 100).toFixed(2)}%)`
  );
  console.log(`  ❌ Errors:             ${report.statistics.errors.toLocaleString()}`);
  console.log('');
  console.log(
    `📦 Ready for DB Update:  ${report.high_confidence_results.length.toLocaleString()} recipes (≥${minConfidence.toFixed(2)} confidence)`
  );
  console.log('─'.repeat(60));
  console.log(`\n✅ Report saved to: ${reportPath}\n`);

  return report;
}

// Run derivation
deriveMissingIngredients()
  .then(() => {
    console.log('✅ Ingredient derivation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during derivation:', error);
    process.exit(1);
  });
