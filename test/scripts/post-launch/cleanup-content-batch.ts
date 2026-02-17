/**
 * Content Cleanup Batch Script - Post-Launch Priority 1C
 *
 * PURPOSE: Improve recipe quality using local LLM (Ollama + Llama 3.2)
 *
 * FIXES:
 * - Empty or poor descriptions
 * - Degree symbol formatting (F → °F, C → °C)
 * - Measurement normalization (1/2 cup, 2 tablespoons, etc.)
 * - Ingredient list formatting
 * - Missing cuisine/tags
 *
 * TECHNOLOGY: Ollama + Llama 3.2 (local, free, no API costs)
 *
 * USAGE:
 *   pnpm tsx scripts/post-launch/cleanup-content-batch.ts
 *
 * CONFIGURATION:
 *   --detect      Detect recipes needing cleanup (dry-run)
 *   --batch=N     Process N recipes at a time (default: 10)
 *   --limit=N     Total recipes to process (default: all)
 *   --approve     Auto-approve changes (skip manual review)
 *   --resume      Continue from last checkpoint
 *
 * TIMELINE: 1 week (100 recipes/day)
 * COST: $0 (runs locally)
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, isNotNull, sql, or, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_BATCH_SIZE = 10;
const PROGRESS_FILE = path.join(process.cwd(), 'tmp', 'cleanup-progress.json');
const REPORT_FILE = path.join(process.cwd(), 'tmp', 'cleanup-report.md');
const OLLAMA_MODEL = 'llama3.2'; // Local Llama 3.2 model

// Ensure tmp directory exists
if (!fs.existsSync(path.dirname(PROGRESS_FILE))) {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
}

// ============================================================================
// TYPES
// ============================================================================

interface RecipeForCleanup {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  instructions: string | null;
  cuisine: string | null;
  tags: string | null;
  issues: string[];
}

interface CleanupSuggestion {
  recipeId: string;
  recipeName: string;
  changes: {
    field: string;
    before: string;
    after: string;
    reason: string;
  }[];
  approved: boolean;
}

interface ProgressState {
  totalRecipes: number;
  processedCount: number;
  approvedCount: number;
  skippedCount: number;
  lastProcessedId: string | null;
  startTime: string;
  lastUpdateTime: string;
  suggestions: CleanupSuggestion[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '[INFO]',
    success: '[SUCCESS]',
    error: '[ERROR]',
    warning: '[WARNING]',
  }[type];

  console.log(`${timestamp} ${prefix} ${message}`);
}

function loadProgress(): ProgressState | null {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      log(`Failed to load progress: ${error}`, 'warning');
      return null;
    }
  }
  return null;
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdateTime = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function checkOllamaInstalled(): Promise<boolean> {
  try {
    await execAsync('which ollama');
    return true;
  } catch {
    return false;
  }
}

async function checkOllamaModelAvailable(model: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('ollama list');
    return stdout.includes(model);
  } catch {
    return false;
  }
}

async function queryOllama(prompt: string): Promise<string> {
  try {
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const { stdout } = await execAsync(
      `echo "${escapedPrompt}" | ollama run ${OLLAMA_MODEL}`
    );
    return stdout.trim();
  } catch (error) {
    log(`Ollama query failed: ${error}`, 'error');
    return '';
  }
}

// ============================================================================
// DETECTION LOGIC
// ============================================================================

function detectIssues(recipe: RecipeForCleanup): string[] {
  const issues: string[] = [];

  // Issue 1: Empty or very short description
  if (!recipe.description || recipe.description.length < 20) {
    issues.push('empty_description');
  }

  // Issue 2: Description is just the recipe name repeated
  if (recipe.description && recipe.description.toLowerCase() === recipe.name.toLowerCase()) {
    issues.push('redundant_description');
  }

  // Issue 3: Degree symbols missing (F, C without degree symbol)
  if (recipe.instructions) {
    const tempPattern = /\b(\d+)\s*([FC])\b(?!°)/g;
    if (tempPattern.test(recipe.instructions)) {
      issues.push('missing_degree_symbols');
    }
  }

  // Issue 4: Inconsistent measurements (1/2 vs ½, etc.)
  if (recipe.ingredients) {
    const hasStandardFractions = /1\/2|1\/4|1\/3|3\/4/.test(recipe.ingredients);
    const hasUnicodeFractions = /½|¼|⅓|¾/.test(recipe.ingredients);
    if (hasStandardFractions && hasUnicodeFractions) {
      issues.push('inconsistent_fractions');
    }
  }

  // Issue 5: Missing cuisine
  if (!recipe.cuisine || recipe.cuisine === '') {
    issues.push('missing_cuisine');
  }

  // Issue 6: Missing tags
  if (!recipe.tags || recipe.tags === '[]') {
    issues.push('missing_tags');
  }

  return issues;
}

async function detectRecipesNeedingCleanup(limit?: number): Promise<RecipeForCleanup[]> {
  log('Detecting recipes needing cleanup...');

  const allRecipes = await db.query.recipes.findMany({
    columns: {
      id: true,
      name: true,
      description: true,
      ingredients: true,
      instructions: true,
      cuisine: true,
      tags: true,
    },
    limit: limit,
  });

  const recipesNeedingCleanup: RecipeForCleanup[] = [];

  for (const recipe of allRecipes) {
    const issues = detectIssues(recipe as RecipeForCleanup);
    if (issues.length > 0) {
      recipesNeedingCleanup.push({
        ...recipe,
        issues,
      } as RecipeForCleanup);
    }
  }

  log(`Found ${recipesNeedingCleanup.length} recipes needing cleanup`, 'success');

  return recipesNeedingCleanup;
}

// ============================================================================
// CLEANUP LOGIC
// ============================================================================

async function generateCleanupSuggestions(
  recipe: RecipeForCleanup
): Promise<CleanupSuggestion> {
  const changes: CleanupSuggestion['changes'] = [];

  // Fix 1: Generate description if missing
  if (recipe.issues.includes('empty_description') || recipe.issues.includes('redundant_description')) {
    const prompt = `Generate a brief, appetizing description (2-3 sentences) for this recipe:
Name: ${recipe.name}
Cuisine: ${recipe.cuisine || 'Unknown'}
Ingredients: ${recipe.ingredients ? JSON.parse(recipe.ingredients).slice(0, 5).join(', ') : 'N/A'}

Description should be engaging, highlight key flavors, and NOT repeat the recipe name.
Output ONLY the description, no extra text.`;

    const newDescription = await queryOllama(prompt);

    if (newDescription) {
      changes.push({
        field: 'description',
        before: recipe.description || '(empty)',
        after: newDescription,
        reason: 'Generated engaging description',
      });
    }
  }

  // Fix 2: Add degree symbols
  if (recipe.issues.includes('missing_degree_symbols') && recipe.instructions) {
    const fixedInstructions = recipe.instructions
      .replace(/\b(\d+)\s*F\b(?!°)/g, '$1°F')
      .replace(/\b(\d+)\s*C\b(?!°)/g, '$1°C');

    if (fixedInstructions !== recipe.instructions) {
      changes.push({
        field: 'instructions',
        before: recipe.instructions.substring(0, 100) + '...',
        after: fixedInstructions.substring(0, 100) + '...',
        reason: 'Fixed degree symbol formatting',
      });
    }
  }

  // Fix 3: Normalize fractions
  if (recipe.issues.includes('inconsistent_fractions') && recipe.ingredients) {
    const fixedIngredients = recipe.ingredients
      .replace(/½/g, '1/2')
      .replace(/¼/g, '1/4')
      .replace(/¾/g, '3/4')
      .replace(/⅓/g, '1/3')
      .replace(/⅔/g, '2/3');

    if (fixedIngredients !== recipe.ingredients) {
      changes.push({
        field: 'ingredients',
        before: 'Mixed unicode and standard fractions',
        after: 'Normalized to standard fractions (1/2, 1/4, etc.)',
        reason: 'Normalized fraction formatting',
      });
    }
  }

  // Fix 4: Suggest cuisine if missing
  if (recipe.issues.includes('missing_cuisine')) {
    const prompt = `Based on this recipe name and ingredients, suggest the most appropriate cuisine type (one word):
Name: ${recipe.name}
Ingredients: ${recipe.ingredients ? JSON.parse(recipe.ingredients).slice(0, 10).join(', ') : 'N/A'}

Output ONLY the cuisine name (e.g., Italian, Mexican, American, Asian, Mediterranean). No extra text.`;

    const suggestedCuisine = await queryOllama(prompt);

    if (suggestedCuisine && suggestedCuisine.length < 30) {
      changes.push({
        field: 'cuisine',
        before: recipe.cuisine || '(empty)',
        after: suggestedCuisine,
        reason: 'Suggested cuisine based on ingredients',
      });
    }
  }

  // Fix 5: Generate tags if missing
  if (recipe.issues.includes('missing_tags')) {
    const prompt = `Generate 3-5 relevant tags for this recipe (comma-separated):
Name: ${recipe.name}
Cuisine: ${recipe.cuisine || 'Unknown'}
Ingredients: ${recipe.ingredients ? JSON.parse(recipe.ingredients).slice(0, 10).join(', ') : 'N/A'}

Tags should be: dietary preferences (vegetarian, vegan, gluten-free), meal types (breakfast, lunch, dinner), characteristics (quick, easy, healthy, comfort-food).
Output ONLY the tags separated by commas. No extra text.`;

    const suggestedTags = await queryOllama(prompt);

    if (suggestedTags) {
      const tagsArray = suggestedTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0 && t.length < 20)
        .slice(0, 5);

      if (tagsArray.length > 0) {
        changes.push({
          field: 'tags',
          before: recipe.tags || '[]',
          after: JSON.stringify(tagsArray),
          reason: 'Generated relevant tags',
        });
      }
    }
  }

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    changes,
    approved: false,
  };
}

async function promptApproval(suggestion: CleanupSuggestion): Promise<boolean> {
  console.log('\n' + '='.repeat(80));
  console.log(`Recipe: ${suggestion.recipeName}`);
  console.log('='.repeat(80));

  for (const change of suggestion.changes) {
    console.log(`\nField: ${change.field}`);
    console.log(`Reason: ${change.reason}`);
    console.log(`Before: ${change.before}`);
    console.log(`After: ${change.after}`);
  }

  console.log('\n' + '='.repeat(80));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Approve changes? (y/n/q to quit): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'q') {
        process.exit(0);
      }
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function applyCleanupSuggestions(suggestion: CleanupSuggestion) {
  const updates: any = {};

  for (const change of suggestion.changes) {
    if (change.field === 'description') {
      updates.description = change.after;
    } else if (change.field === 'instructions') {
      updates.instructions = change.after;
    } else if (change.field === 'ingredients') {
      updates.ingredients = change.after;
    } else if (change.field === 'cuisine') {
      updates.cuisine = change.after;
    } else if (change.field === 'tags') {
      updates.tags = change.after;
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();

    await db.update(recipes)
      .set(updates)
      .where(eq(recipes.id, suggestion.recipeId));

    log(`Applied changes to recipe: ${suggestion.recipeName}`, 'success');
  }
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const detectOnly = args.includes('--detect');
  const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || String(DEFAULT_BATCH_SIZE));
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || undefined;
  const autoApprove = args.includes('--approve');
  const isResume = args.includes('--resume');

  log('='.repeat(80));
  log('CONTENT CLEANUP BATCH SCRIPT - POST-LAUNCH PRIORITY 1C');
  log('='.repeat(80));

  // Check Ollama installation
  log('Checking Ollama installation...');
  const ollamaInstalled = await checkOllamaInstalled();
  if (!ollamaInstalled) {
    log('ERROR: Ollama not installed. Install with: brew install ollama', 'error');
    process.exit(1);
  }

  // Check Ollama model
  log(`Checking for model: ${OLLAMA_MODEL}...`);
  const modelAvailable = await checkOllamaModelAvailable(OLLAMA_MODEL);
  if (!modelAvailable) {
    log(`ERROR: Model ${OLLAMA_MODEL} not found. Pull with: ollama pull ${OLLAMA_MODEL}`, 'error');
    process.exit(1);
  }

  log('Ollama setup verified', 'success');

  // Detect recipes needing cleanup
  const recipesNeedingCleanup = await detectRecipesNeedingCleanup(limit);

  if (detectOnly) {
    log('DETECTION REPORT', 'info');
    log('='.repeat(80));

    const issueStats: Record<string, number> = {};

    for (const recipe of recipesNeedingCleanup) {
      console.log(`\n${recipe.name}:`);
      console.log(`  Issues: ${recipe.issues.join(', ')}`);

      for (const issue of recipe.issues) {
        issueStats[issue] = (issueStats[issue] || 0) + 1;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('ISSUE SUMMARY:');
    for (const [issue, count] of Object.entries(issueStats)) {
      console.log(`  ${issue}: ${count} recipes`);
    }

    console.log('\n' + '='.repeat(80));
    log('Detection complete. Run without --detect to start cleanup.', 'success');
    return;
  }

  // Initialize progress
  let progress: ProgressState;

  if (isResume) {
    const loaded = loadProgress();
    if (loaded) {
      progress = loaded;
      log(`Resuming from checkpoint: ${progress.processedCount} processed`, 'success');
    } else {
      log('No progress file found, starting fresh', 'warning');
      progress = {
        totalRecipes: recipesNeedingCleanup.length,
        processedCount: 0,
        approvedCount: 0,
        skippedCount: 0,
        lastProcessedId: null,
        startTime: new Date().toISOString(),
        lastUpdateTime: new Date().toISOString(),
        suggestions: [],
      };
    }
  } else {
    progress = {
      totalRecipes: recipesNeedingCleanup.length,
      processedCount: 0,
      approvedCount: 0,
      skippedCount: 0,
      lastProcessedId: null,
      startTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString(),
      suggestions: [],
    };
  }

  saveProgress(progress);

  // Process recipes in batches
  log(`Processing ${recipesNeedingCleanup.length} recipes...`);

  for (const recipe of recipesNeedingCleanup) {
    // Skip if already processed
    if (progress.suggestions.find(s => s.recipeId === recipe.id)) {
      log(`Skipping ${recipe.name} (already processed)`, 'info');
      continue;
    }

    log(`Processing: ${recipe.name}`, 'info');

    // Generate cleanup suggestions
    const suggestion = await generateCleanupSuggestions(recipe);

    if (suggestion.changes.length === 0) {
      log(`No changes needed for ${recipe.name}`, 'info');
      progress.skippedCount++;
      continue;
    }

    // Approval
    let approved = autoApprove;
    if (!autoApprove) {
      approved = await promptApproval(suggestion);
    }

    suggestion.approved = approved;
    progress.suggestions.push(suggestion);

    if (approved) {
      await applyCleanupSuggestions(suggestion);
      progress.approvedCount++;
      log(`Changes approved and applied for ${recipe.name}`, 'success');
    } else {
      progress.skippedCount++;
      log(`Changes skipped for ${recipe.name}`, 'warning');
    }

    progress.processedCount++;
    progress.lastProcessedId = recipe.id;
    saveProgress(progress);

    // Progress update
    const percentComplete = ((progress.processedCount / progress.totalRecipes) * 100).toFixed(1);
    log(
      `Progress: ${progress.processedCount}/${progress.totalRecipes} (${percentComplete}%) | ` +
      `Approved: ${progress.approvedCount} | Skipped: ${progress.skippedCount}`,
      'info'
    );
  }

  // Final summary
  log('='.repeat(80));
  log('CLEANUP COMPLETE', 'success');
  log('='.repeat(80));
  log(`Total recipes processed: ${progress.processedCount}`);
  log(`Changes approved: ${progress.approvedCount}`);
  log(`Changes skipped: ${progress.skippedCount}`);

  const approvalRate = ((progress.approvedCount / progress.processedCount) * 100).toFixed(1);
  log(`Approval rate: ${approvalRate}%`);

  const duration = (new Date().getTime() - new Date(progress.startTime).getTime()) / 1000 / 60;
  log(`Duration: ${duration.toFixed(1)} minutes`);

  log(`Progress saved to: ${PROGRESS_FILE}`, 'info');

  // Generate report
  const report = `# Content Cleanup Report

**Date**: ${new Date().toISOString()}
**Duration**: ${duration.toFixed(1)} minutes

## Summary

- **Total recipes processed**: ${progress.processedCount}
- **Changes approved**: ${progress.approvedCount}
- **Changes skipped**: ${progress.skippedCount}
- **Approval rate**: ${approvalRate}%

## Changes by Field

${generateFieldReport(progress.suggestions)}

## Sample Changes

${generateSampleChanges(progress.suggestions)}
`;

  fs.writeFileSync(REPORT_FILE, report);
  log(`Report saved to: ${REPORT_FILE}`, 'info');
}

function generateFieldReport(suggestions: CleanupSuggestion[]): string {
  const fieldStats: Record<string, number> = {};

  for (const suggestion of suggestions) {
    if (!suggestion.approved) continue;

    for (const change of suggestion.changes) {
      fieldStats[change.field] = (fieldStats[change.field] || 0) + 1;
    }
  }

  let report = '';
  for (const [field, count] of Object.entries(fieldStats)) {
    report += `- **${field}**: ${count} recipes\n`;
  }

  return report;
}

function generateSampleChanges(suggestions: CleanupSuggestion[]): string {
  const approvedSuggestions = suggestions.filter(s => s.approved).slice(0, 5);

  let report = '';

  for (const suggestion of approvedSuggestions) {
    report += `### ${suggestion.recipeName}\n\n`;

    for (const change of suggestion.changes) {
      report += `**${change.field}** (${change.reason}):\n`;
      report += `- Before: ${change.before.substring(0, 100)}\n`;
      report += `- After: ${change.after.substring(0, 100)}\n\n`;
    }
  }

  return report;
}

// ============================================================================
// EXECUTE
// ============================================================================

main().catch((error) => {
  log(`Fatal error: ${error}`, 'error');
  process.exit(1);
});
