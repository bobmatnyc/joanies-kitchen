/**
 * Phase 2: LLM-Based Ingredient Extraction
 *
 * Purpose: Use Qwen2.5-7B to extract ingredients from instructions and compare
 * with declared ingredient lists. Identifies mismatches and missing ingredients.
 *
 * Process:
 * 1. Load recipes in batches (50 at a time for memory efficiency)
 * 2. For each recipe, send instructions to Qwen2.5-7B
 * 3. Extract ingredients from LLM response
 * 4. Compare with declared ingredients
 * 5. Calculate match percentage
 * 6. Flag mismatches
 *
 * Output: tmp/qa-ingredient-extraction-report.json
 *
 * Usage:
 *   pnpm tsx scripts/qa-recipe-ingredients-llm.ts
 *   pnpm tsx scripts/qa-recipe-ingredients-llm.ts --resume  # Resume from checkpoint
 */

import fs from 'node:fs';
import path from 'node:path';
import cliProgress from 'cli-progress';
import ollama from 'ollama';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { extractIngredientArray, parseJsonResponse, sleep } from './lib/qa-helpers';

interface ExtractionResult {
  recipe_id: string;
  recipe_name: string;
  declared_ingredients: string[];
  extracted_ingredients: string[];
  match_percentage: number;
  missing_in_instructions: string[]; // Declared but not found in instructions
  extra_in_instructions: string[]; // Found in instructions but not declared
  confidence: number;
  extraction_error?: string;
}

interface ExtractionReport {
  timestamp: string;
  total_recipes: number;
  processed_recipes: number;
  model_used: string;
  statistics: {
    perfect_matches: number; // 100% match
    high_matches: number; // >= 80%
    medium_matches: number; // >= 60%
    low_matches: number; // < 60%
    extraction_errors: number;
  };
  results: ExtractionResult[];
  checkpoint_saved: boolean;
}

interface Checkpoint {
  last_processed_index: number;
  results: ExtractionResult[];
  timestamp: string;
}

const _BATCH_SIZE = 50;
const CHECKPOINT_INTERVAL = 500; // Save checkpoint every 500 recipes
const MODEL = 'qwen2.5-coder:7b-instruct';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

async function extractIngredientsFromInstructions(
  instructions: string[],
  retryCount = 0
): Promise<{ ingredients: string[]; error?: string }> {
  const instructionsText = instructions.join('\n');

  const prompt = `Extract ALL ingredients from these cooking instructions. List every ingredient mentioned (food items only).

Instructions:
${instructionsText}

Return a JSON array of lowercase ingredient names (no quantities, no tools/equipment).

Example format: ["flour", "sugar", "eggs", "salt", "butter", "milk"]

If no ingredients found, return: []`;

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
        temperature: 0.1, // Low temperature for consistency
        num_ctx: 4096, // Context window
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
    const ingredients = extractIngredientArray(parsed);

    return { ingredients };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Ollama error: ${errorMsg}`);

    if (retryCount < MAX_RETRIES) {
      console.error(`⚠️  Extraction failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY * (retryCount + 1)); // Exponential backoff
      return extractIngredientsFromInstructions(instructions, retryCount + 1);
    }
    return {
      ingredients: [],
      error: `Failed after ${MAX_RETRIES} retries: ${errorMsg}`,
    };
  }
}

function calculateMatchPercentage(declared: string[], extracted: string[]): number {
  if (declared.length === 0) return 0;

  const declaredLower = declared.map((i) => i.toLowerCase().trim());
  const extractedLower = extracted.map((i) => i.toLowerCase().trim());

  let matches = 0;
  for (const ingredient of declaredLower) {
    // Check if any extracted ingredient contains this declared ingredient
    // or vice versa (handles partial matches)
    const found = extractedLower.some(
      (ext) => ext.includes(ingredient) || ingredient.includes(ext)
    );
    if (found) matches++;
  }

  return (matches / declaredLower.length) * 100;
}

function findMissingAndExtra(
  declared: string[],
  extracted: string[]
): { missing: string[]; extra: string[] } {
  const declaredLower = declared.map((i) => i.toLowerCase().trim());
  const extractedLower = extracted.map((i) => i.toLowerCase().trim());

  const missing = declared.filter((_ing, idx) => {
    const ingLower = declaredLower[idx];
    return !extractedLower.some((ext) => ext.includes(ingLower) || ingLower.includes(ext));
  });

  const extra = extracted.filter((_ing, idx) => {
    const ingLower = extractedLower[idx];
    return !declaredLower.some((decl) => decl.includes(ingLower) || ingLower.includes(decl));
  });

  return { missing, extra };
}

async function loadCheckpoint(): Promise<Checkpoint | null> {
  const checkpointPath = path.join(
    process.cwd(),
    'tmp',
    'qa-ingredient-extraction-checkpoint.json'
  );
  if (fs.existsSync(checkpointPath)) {
    const data = fs.readFileSync(checkpointPath, 'utf-8');
    return JSON.parse(data);
  }
  return null;
}

async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  const checkpointPath = path.join(
    process.cwd(),
    'tmp',
    'qa-ingredient-extraction-checkpoint.json'
  );
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

async function extractIngredients() {
  console.log('🔍 Phase 2: LLM-Based Ingredient Extraction\n');
  console.log(`🤖 Using model: ${MODEL}\n`);

  // Check if Ollama is running and model is available
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

  // Check for resume flag
  const shouldResume = process.argv.includes('--resume');
  let startIndex = 0;
  let results: ExtractionResult[] = [];

  if (shouldResume) {
    const checkpoint = await loadCheckpoint();
    if (checkpoint) {
      console.log(
        `📍 Resuming from checkpoint: ${checkpoint.last_processed_index + 1} recipes processed`
      );
      startIndex = checkpoint.last_processed_index + 1;
      results = checkpoint.results;
    } else {
      console.log('⚠️  No checkpoint found, starting from beginning');
    }
  }

  // Fetch all recipes
  console.log('📊 Fetching recipes from database...');
  const allRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ingredients: recipes.ingredients,
      instructions: recipes.instructions,
    })
    .from(recipes);

  console.log(`✅ Found ${allRecipes.length} recipes`);
  console.log(`🔄 Processing ${allRecipes.length - startIndex} recipes\n`);

  const report: ExtractionReport = {
    timestamp: new Date().toISOString(),
    total_recipes: allRecipes.length,
    processed_recipes: 0,
    model_used: MODEL,
    statistics: {
      perfect_matches: 0,
      high_matches: 0,
      medium_matches: 0,
      low_matches: 0,
      extraction_errors: 0,
    },
    results: [],
    checkpoint_saved: false,
  };

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Extracting |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s | Errors: {errors}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  progressBar.start(allRecipes.length - startIndex, 0, { errors: 0 });

  let errorCount = 0;

  for (let i = startIndex; i < allRecipes.length; i++) {
    const recipe = allRecipes[i];

    // Parse declared ingredients
    let declaredIngredients: string[] = [];
    try {
      const parsed = JSON.parse(recipe.ingredients);
      if (Array.isArray(parsed)) {
        declaredIngredients = parsed.filter((ing) => typeof ing === 'string' && ing.trim() !== '');
      }
    } catch (_error) {
      // Skip recipes with malformed JSON (already caught in Phase 1)
      errorCount++;
      progressBar.update(i - startIndex + 1, { errors: errorCount });
      continue;
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
      progressBar.update(i - startIndex + 1, { errors: errorCount });
      continue;
    }

    if (instructionsArray.length === 0) {
      // Skip recipes with no instructions
      errorCount++;
      progressBar.update(i - startIndex + 1, { errors: errorCount });
      continue;
    }

    // Extract ingredients using LLM
    const extraction = await extractIngredientsFromInstructions(instructionsArray);

    if (extraction.error) {
      errorCount++;
      results.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        declared_ingredients: declaredIngredients,
        extracted_ingredients: [],
        match_percentage: 0,
        missing_in_instructions: declaredIngredients,
        extra_in_instructions: [],
        confidence: 0,
        extraction_error: extraction.error,
      });
    } else {
      const matchPercentage = calculateMatchPercentage(declaredIngredients, extraction.ingredients);
      const { missing, extra } = findMissingAndExtra(declaredIngredients, extraction.ingredients);

      results.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        declared_ingredients: declaredIngredients,
        extracted_ingredients: extraction.ingredients,
        match_percentage: matchPercentage,
        missing_in_instructions: missing,
        extra_in_instructions: extra,
        confidence: matchPercentage / 100,
      });
    }

    progressBar.update(i - startIndex + 1, { errors: errorCount });

    // Save checkpoint every CHECKPOINT_INTERVAL recipes
    if ((i + 1) % CHECKPOINT_INTERVAL === 0) {
      await saveCheckpoint({
        last_processed_index: i,
        results,
        timestamp: new Date().toISOString(),
      });
      report.checkpoint_saved = true;
    }
  }

  progressBar.stop();

  // Calculate statistics
  for (const result of results) {
    if (result.extraction_error) {
      report.statistics.extraction_errors++;
    } else if (result.match_percentage === 100) {
      report.statistics.perfect_matches++;
    } else if (result.match_percentage >= 80) {
      report.statistics.high_matches++;
    } else if (result.match_percentage >= 60) {
      report.statistics.medium_matches++;
    } else {
      report.statistics.low_matches++;
    }
  }

  report.results = results;
  report.processed_recipes = results.length;

  // Write report to file
  const reportPath = path.join(tmpDir, 'qa-ingredient-extraction-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Clean up checkpoint
  const checkpointPath = path.join(tmpDir, 'qa-ingredient-extraction-checkpoint.json');
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }

  // Print summary
  console.log('\n📋 Ingredient Extraction Summary:');
  console.log('─'.repeat(60));
  console.log(`Total Recipes:           ${report.total_recipes.toLocaleString()}`);
  console.log(`Processed:               ${report.processed_recipes.toLocaleString()}`);
  console.log(`Model Used:              ${report.model_used}`);
  console.log('');
  console.log('Match Quality:');
  console.log(
    `  🟢 Perfect (100%):     ${report.statistics.perfect_matches.toLocaleString()} (${((report.statistics.perfect_matches / report.processed_recipes) * 100).toFixed(2)}%)`
  );
  console.log(
    `  🟡 High (≥80%):        ${report.statistics.high_matches.toLocaleString()} (${((report.statistics.high_matches / report.processed_recipes) * 100).toFixed(2)}%)`
  );
  console.log(
    `  🟠 Medium (≥60%):      ${report.statistics.medium_matches.toLocaleString()} (${((report.statistics.medium_matches / report.processed_recipes) * 100).toFixed(2)}%)`
  );
  console.log(
    `  🔴 Low (<60%):         ${report.statistics.low_matches.toLocaleString()} (${((report.statistics.low_matches / report.processed_recipes) * 100).toFixed(2)}%)`
  );
  console.log(`  ❌ Errors:             ${report.statistics.extraction_errors.toLocaleString()}`);
  console.log('─'.repeat(60));
  console.log(`\n✅ Report saved to: ${reportPath}\n`);

  return report;
}

// Run extraction
extractIngredients()
  .then(() => {
    console.log('✅ Ingredient extraction complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during extraction:', error);
    process.exit(1);
  });
