#!/usr/bin/env tsx

/**
 * Recipe Content Cleanup Script (Local LLM)
 *
 * Fixes content quality issues in recipes using:
 * 1. Regex-based fixes for simple patterns
 * 2. Local LLM (Ollama) for context-aware cleanup
 *
 * Usage:
 *   pnpm tsx scripts/cleanup-recipes-local-llm.ts --dry-run
 *   pnpm tsx scripts/cleanup-recipes-local-llm.ts --apply
 *   pnpm tsx scripts/cleanup-recipes-local-llm.ts --recipe-id=<uuid>
 *   pnpm tsx scripts/cleanup-recipes-local-llm.ts --apply --llm-only
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface CleanupResult {
  recipeId: string;
  recipeName: string;
  changes: CleanupChange[];
  ingredientsBefore: string[];
  ingredientsAfter: string[];
  instructionsBefore: string[];
  instructionsAfter: string[];
}

interface CleanupChange {
  type: 'regex' | 'llm';
  field: 'ingredients' | 'instructions';
  issueType: string;
  description: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

// Ollama API configuration
const OLLAMA_API = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.2'; // or 'qwen2.5'

// Regex cleanup patterns
const REGEX_FIXES = [
  {
    name: 'missing_space_after_number',
    pattern: /(\d+)(cups?|tablespoons?|teaspoons?|tbsp|tsp|oz|lbs?|grams?|g|kg|ml|liters?|l)\b/gi,
    replacement: '$1 $2',
    description: 'Add space between number and unit'
  },
  {
    name: 'missing_space_fraction',
    pattern: /([½¼¾⅓⅔⅛⅜⅝⅞])(cups?|tablespoons?|teaspoons?|tbsp|tsp|oz|lbs?|grams?|g|kg|ml|liters?|l)\b/gi,
    replacement: '$1 $2',
    description: 'Add space between fraction and unit'
  },
  {
    name: 'extra_brackets',
    pattern: /\[([^\]]+)\]/g,
    replacement: '$1',
    description: 'Remove extra brackets'
  },
  {
    name: 'http_urls',
    pattern: /https?:\/\/[^\s)]+/gi,
    replacement: '',
    description: 'Remove HTTP/HTTPS URLs'
  },
  {
    name: 'amazon_links',
    pattern: /(amzn\.to|amazon\.com|a\.co)\/[^\s)]+/gi,
    replacement: '',
    description: 'Remove Amazon links'
  },
  {
    name: 'checkbox_symbol',
    pattern: /▢\s*/g,
    replacement: '',
    description: 'Remove checkbox symbols'
  },
  {
    name: 'markdown_bold',
    pattern: /\*\*([^*]+)\*\*/g,
    replacement: '$1',
    description: 'Remove Markdown bold formatting'
  },
  {
    name: 'markdown_italic',
    pattern: /__([^_]+)__/g,
    replacement: '$1',
    description: 'Remove Markdown italic formatting'
  },
  {
    name: 'markdown_headers',
    pattern: /^#{1,6}\s+/gm,
    replacement: '',
    description: 'Remove Markdown headers'
  },
  {
    name: 'html_tags',
    pattern: /<[^>]+>/g,
    replacement: '',
    description: 'Remove HTML tags'
  },
  {
    name: 'encoding_apostrophe',
    pattern: /â€™/g,
    replacement: "'",
    description: 'Fix malformed apostrophe encoding'
  },
  {
    name: 'encoding_dash',
    pattern: /â€"/g,
    replacement: '—',
    description: 'Fix malformed dash encoding'
  },
  {
    name: 'encoding_quote_open',
    pattern: /â€œ/g,
    replacement: '"',
    description: 'Fix malformed opening quote'
  },
  {
    name: 'encoding_quote_close',
    pattern: /â€/g,
    replacement: '"',
    description: 'Fix malformed closing quote'
  },
  {
    name: 'encoding_ellipsis',
    pattern: /â€¦/g,
    replacement: '...',
    description: 'Fix malformed ellipsis'
  },
  {
    name: 'multiple_spaces',
    pattern: /\s{2,}/g,
    replacement: ' ',
    description: 'Remove multiple spaces'
  },
  {
    name: 'trailing_spaces',
    pattern: /\s+$/gm,
    replacement: '',
    description: 'Remove trailing spaces'
  },
  {
    name: 'leading_spaces',
    pattern: /^\s+/gm,
    replacement: '',
    description: 'Remove leading spaces'
  }
];

async function callOllama(prompt: string, model: string = OLLAMA_MODEL): Promise<string> {
  try {
    const response = await fetch(OLLAMA_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error('❌ Error calling Ollama:', error);
    throw error;
  }
}

async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) return false;

    const data = await response.json();
    const hasModel = data.models?.some((m: any) => m.name.includes(OLLAMA_MODEL));

    if (!hasModel) {
      console.error(`❌ Model '${OLLAMA_MODEL}' not found. Available models:`);
      data.models?.forEach((m: any) => console.log(`   - ${m.name}`));
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Ollama not available. Make sure Ollama is running: ollama serve');
    return false;
  }
}

function applyRegexFixes(text: string, changes: CleanupChange[], field: 'ingredients' | 'instructions'): string {
  let cleaned = text;

  for (const fix of REGEX_FIXES) {
    const before = cleaned;
    cleaned = cleaned.replace(fix.pattern, fix.replacement);

    if (before !== cleaned) {
      changes.push({
        type: 'regex',
        field,
        issueType: fix.name,
        description: fix.description
      });
    }
  }

  return cleaned.trim();
}

async function cleanWithLLM(items: string[], field: 'ingredients' | 'instructions', changes: CleanupChange[]): Promise<string[]> {
  const itemType = field === 'ingredients' ? 'ingredient' : 'instruction';
  const prompt = `You are a recipe editor. Clean up these recipe ${field} while preserving their original meaning.

Rules:
1. Fix formatting issues (encoding, spacing, punctuation)
2. Remove any remaining markup or HTML
3. Standardize measurements and units
4. Keep the original meaning and quantities
5. Do NOT add new information
6. Do NOT remove important details
7. Return ONLY the cleaned list, one item per line
8. Do NOT add commentary or explanations

${field.toUpperCase()} TO CLEAN:
${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Return the cleaned ${field} as a numbered list:`;

  try {
    const response = await callOllama(prompt);

    // Parse LLM response back into array
    const cleaned = response
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0);

    if (cleaned.length !== items.length) {
      console.warn(`⚠️  LLM returned ${cleaned.length} items, expected ${items.length}. Using original.`);
      return items;
    }

    // Check if LLM made changes
    const hasChanges = items.some((item, i) => item !== cleaned[i]);
    if (hasChanges) {
      changes.push({
        type: 'llm',
        field,
        issueType: 'llm_cleanup',
        description: `LLM cleaned ${field}`
      });
    }

    return cleaned;
  } catch (error) {
    console.error(`❌ LLM cleanup failed for ${field}:`, error);
    return items;
  }
}

async function cleanupRecipe(recipe: any, useLLM: boolean = true): Promise<CleanupResult> {
  const changes: CleanupChange[] = [];

  // Parse ingredients and instructions
  const ingredientsBefore = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : (typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : []);

  const instructionsBefore = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : (typeof recipe.instructions === 'string' ? JSON.parse(recipe.instructions) : []);

  // Phase 1: Regex fixes
  let ingredientsAfter = ingredientsBefore.map((ing: string) =>
    applyRegexFixes(ing, changes, 'ingredients')
  );

  let instructionsAfter = instructionsBefore.map((inst: string) =>
    applyRegexFixes(inst, changes, 'instructions')
  );

  // Phase 2: LLM cleanup (if enabled)
  if (useLLM) {
    console.log('   🤖 Applying LLM cleanup...');
    ingredientsAfter = await cleanWithLLM(ingredientsAfter, 'ingredients', changes);
    instructionsAfter = await cleanWithLLM(instructionsAfter, 'instructions', changes);
  }

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    changes,
    ingredientsBefore,
    ingredientsAfter,
    instructionsBefore,
    instructionsAfter
  };
}

function printCleanupPreview(result: CleanupResult) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Recipe: ${result.recipeName}`);
  console.log(`ID: ${result.recipeId}`);
  console.log(`Changes: ${result.changes.length}`);

  if (result.changes.length === 0) {
    console.log('✅ No changes needed\n');
    return;
  }

  console.log('\nChanges Applied:');
  const changesByType = new Map<string, number>();
  for (const change of result.changes) {
    changesByType.set(change.issueType, (changesByType.get(change.issueType) || 0) + 1);
  }

  for (const [type, count] of changesByType.entries()) {
    const change = result.changes.find(c => c.issueType === type)!;
    const icon = change.type === 'llm' ? '🤖' : '🔧';
    console.log(`   ${icon} ${type}: ${count} fix(es) - ${change.description}`);
  }

  // Show before/after for ingredients
  const ingredientChanges = result.ingredientsAfter.filter((ing, i) => ing !== result.ingredientsBefore[i]);
  if (ingredientChanges.length > 0) {
    console.log('\n📝 Ingredient Changes (sample):');
    for (let i = 0; i < result.ingredientsBefore.length && ingredientChanges.length > 0; i++) {
      if (result.ingredientsBefore[i] !== result.ingredientsAfter[i]) {
        console.log(`   BEFORE: ${result.ingredientsBefore[i]}`);
        console.log(`   AFTER:  ${result.ingredientsAfter[i]}`);
        console.log('');
        ingredientChanges.shift();
        if (ingredientChanges.length === 0) break;
      }
    }
  }

  // Show before/after for instructions
  const instructionChanges = result.instructionsAfter.filter((inst, i) => inst !== result.instructionsBefore[i]);
  if (instructionChanges.length > 0) {
    console.log('📋 Instruction Changes (sample):');
    for (let i = 0; i < result.instructionsBefore.length && instructionChanges.length > 0; i++) {
      if (result.instructionsBefore[i] !== result.instructionsAfter[i]) {
        console.log(`   BEFORE: ${result.instructionsBefore[i]}`);
        console.log(`   AFTER:  ${result.instructionsAfter[i]}`);
        console.log('');
        instructionChanges.shift();
        if (instructionChanges.length === 0) break;
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function applyCleanup(result: CleanupResult) {
  if (result.changes.length === 0) {
    return;
  }

  await db
    .update(recipes)
    .set({
      ingredients: JSON.stringify(result.ingredientsAfter),
      instructions: JSON.stringify(result.instructionsAfter),
      updatedAt: new Date()
    })
    .where(eq(recipes.id, result.recipeId));

  console.log(`✅ Applied changes to: ${result.recipeName}`);
}

async function createBackup() {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const backupPath = path.join(process.cwd(), 'tmp', `recipe-backup-${timestamp}.json`);

  const allRecipes = await db.select().from(recipes);

  // Ensure tmp directory exists
  const tmpDir = path.dirname(backupPath);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  fs.writeFileSync(backupPath, JSON.stringify(allRecipes, null, 2));
  console.log(`💾 Backup created: ${backupPath}\n`);

  return backupPath;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const llmOnly = args.includes('--llm-only');
  const recipeIdArg = args.find(arg => arg.startsWith('--recipe-id='));
  const specificRecipeId = recipeIdArg?.split('=')[1];

  console.log('═══════════════════════════════════════════════════════════');
  console.log('         RECIPE CONTENT CLEANUP (Local LLM)');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '✅ APPLY CHANGES'}`);
  console.log(`LLM: ${llmOnly ? '🤖 LLM ONLY' : '🔧 Regex + LLM'}\n`);

  // Check Ollama availability
  if (llmOnly || !dryRun) {
    console.log('🔌 Checking Ollama availability...');
    const ollamaAvailable = await checkOllamaAvailability();

    if (!ollamaAvailable) {
      console.error('\n❌ Ollama is required but not available.');
      console.log('💡 Start Ollama: ollama serve');
      console.log(`💡 Install model: ollama pull ${OLLAMA_MODEL}\n`);
      process.exit(1);
    }

    console.log(`✅ Ollama available (model: ${OLLAMA_MODEL})\n`);
  }

  try {
    // Create backup if applying changes
    if (!dryRun) {
      await createBackup();
    }

    // Get recipes to process
    let recipesToProcess;
    if (specificRecipeId) {
      console.log(`🎯 Processing specific recipe: ${specificRecipeId}\n`);
      recipesToProcess = await db.select().from(recipes).where(eq(recipes.id, specificRecipeId));

      if (recipesToProcess.length === 0) {
        console.error(`❌ Recipe not found: ${specificRecipeId}`);
        process.exit(1);
      }
    } else {
      // Load issue report to prioritize recipes with issues
      const reportPath = path.join(process.cwd(), 'tmp', 'recipe-content-issues.json');

      if (fs.existsSync(reportPath)) {
        console.log('📊 Loading issue report...');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        const recipeIds = [...new Set(report.affectedRecipes.map((r: any) => r.recipeId))];

        console.log(`🎯 Processing ${recipeIds.length} recipes with known issues\n`);

        recipesToProcess = await db.select().from(recipes);
        recipesToProcess = recipesToProcess.filter(r => recipeIds.includes(r.id));
      } else {
        console.log('⚠️  No issue report found. Run detect-recipe-issues.ts first.');
        console.log('📋 Processing all recipes...\n');
        recipesToProcess = await db.select().from(recipes);
      }
    }

    const results: CleanupResult[] = [];
    let processedCount = 0;
    let changedCount = 0;

    for (const recipe of recipesToProcess) {
      processedCount++;
      console.log(`\n[${processedCount}/${recipesToProcess.length}] Processing: ${recipe.name}`);

      const result = await cleanupRecipe(recipe, !llmOnly);
      results.push(result);

      if (result.changes.length > 0) {
        changedCount++;
        printCleanupPreview(result);

        if (!dryRun) {
          await applyCleanup(result);
        }
      } else {
        console.log('   ✅ No changes needed');
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    CLEANUP SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📊 Recipes Processed: ${processedCount}`);
    console.log(`✏️  Recipes Changed: ${changedCount}`);
    console.log(`✅ Recipes Clean: ${processedCount - changedCount}\n`);

    if (dryRun) {
      console.log('💡 Next Steps:');
      console.log('   Run with --apply flag to apply changes');
      console.log('   Example: pnpm tsx scripts/cleanup-recipes-local-llm.ts --apply\n');
    } else {
      console.log('✅ Cleanup complete!\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main();
