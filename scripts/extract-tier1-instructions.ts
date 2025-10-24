/**
 * Tier 1 Instruction Extraction Tool
 *
 * PURPOSE: Interactive tool to extract instructions for 50 high-priority recipes (12+ ingredients)
 *
 * WORKFLOW:
 * 1. Load Tier 1 recipes from prioritization file
 * 2. For each recipe:
 *    - Display recipe details (name, ingredients, source URL)
 *    - Wait for manual instruction paste
 *    - Validate instruction format
 *    - Update database with instructions + QA tracking
 * 3. Track progress and provide completion stats
 *
 * USAGE:
 *   pnpm tsx scripts/extract-tier1-instructions.ts
 *
 * INSTRUCTIONS FOR USE:
 * 1. Visit the recipe source URL in browser
 * 2. Copy the instructions from the webpage
 * 3. Paste into the terminal when prompted
 * 4. Press Enter twice to submit
 * 5. Script will validate and save to database
 *
 * CREATED: 2025-10-24
 * LAUNCH: October 27, 2025 (3 days)
 */

import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';
import { eq } from 'drizzle-orm';
import * as readline from 'readline';

interface Tier1Recipe {
  id: string;
  name: string;
  ingredientCount: number;
  source: string;
}

interface CategoryBData {
  tiers: {
    tier1: {
      recipes: Tier1Recipe[];
    };
  };
}

// ANSI color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

async function loadTier1Recipes(): Promise<Tier1Recipe[]> {
  const fs = await import('fs');
  const path = await import('path');

  const dataPath = path.join(process.cwd(), 'tmp', 'category-b-prioritized.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as CategoryBData;

  return data.tiers.tier1.recipes;
}

async function promptForInstructions(recipe: Tier1Recipe): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Recipe: ${colors.yellow}${recipe.name}${colors.reset}`);
  console.log(`${colors.bright}Ingredients: ${colors.green}${recipe.ingredientCount}${colors.reset}`);
  console.log(`${colors.bright}Source: ${colors.blue}${recipe.source}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  console.log(`${colors.yellow}Instructions:${colors.reset}`);
  console.log(`1. Visit the source URL in your browser`);
  console.log(`2. Copy the recipe instructions`);
  console.log(`3. Paste them below`);
  console.log(`4. Press Enter twice when done (or type 'skip' to skip this recipe)\n`);

  return new Promise((resolve) => {
    let instructionsText = '';
    let emptyLineCount = 0;

    rl.on('line', (line) => {
      if (line.toLowerCase().trim() === 'skip') {
        rl.close();
        resolve('SKIP');
        return;
      }

      if (line.trim() === '') {
        emptyLineCount++;
        if (emptyLineCount >= 2) {
          rl.close();
          resolve(instructionsText.trim());
          return;
        }
      } else {
        emptyLineCount = 0;
        instructionsText += line + '\n';
      }
    });
  });
}

function formatInstructionsToArray(instructionsText: string): string[] {
  // Split by common instruction delimiters
  const steps = instructionsText
    .split(/\n\s*\n|\n\d+\.\s+|\nStep \d+:?/gi)
    .map(step => step.trim())
    .filter(step => step.length > 0);

  // If we got very few steps, try splitting by periods followed by capital letters
  if (steps.length < 3) {
    const altSteps = instructionsText
      .split(/\.\s+(?=[A-Z])/)
      .map(step => step.trim())
      .filter(step => step.length > 10);

    if (altSteps.length > steps.length) {
      return altSteps;
    }
  }

  return steps;
}

async function updateRecipeInstructions(
  recipeId: string,
  instructions: string[],
  source: string
): Promise<void> {
  const instructionsJson = JSON.stringify(instructions);

  await db.update(recipes)
    .set({
      instructions: instructionsJson,
      qa_status: 'validated',
      qa_method: 'manual-instruction-extraction',
      qa_timestamp: new Date(),
      qa_confidence: '1.00',
      qa_notes: `Tier 1 high-priority recipe. Instructions manually extracted from ${source} and validated.`,
      qa_fixes_applied: JSON.stringify(['instructions_added']),
    })
    .where(eq(recipes.id, recipeId));
}

async function main() {
  console.log(`\n${colors.bright}${colors.green}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.green}║   Tier 1 Instruction Extraction Tool - Phase 1        ║${colors.reset}`);
  console.log(`${colors.bright}${colors.green}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const tier1Recipes = await loadTier1Recipes();
  const total = tier1Recipes.length;

  console.log(`${colors.bright}Total Tier 1 Recipes: ${colors.yellow}${total}${colors.reset}`);
  console.log(`${colors.bright}Estimated Time: ${colors.yellow}2-3 hours${colors.reset}`);
  console.log(`${colors.bright}Priority: ${colors.red}HIGH${colors.reset} (12+ ingredients, complex recipes)\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const recipe of tier1Recipes) {
    try {
      const instructionsText = await promptForInstructions(recipe);

      if (instructionsText === 'SKIP') {
        console.log(`${colors.yellow}⊘ Skipped${colors.reset}\n`);
        skipped++;
        continue;
      }

      if (instructionsText.length < 50) {
        console.log(`${colors.red}✗ Instructions too short (< 50 characters). Skipping.${colors.reset}\n`);
        errors++;
        continue;
      }

      const instructionsArray = formatInstructionsToArray(instructionsText);

      console.log(`\n${colors.green}✓ Parsed ${instructionsArray.length} instruction steps${colors.reset}`);

      await updateRecipeInstructions(recipe.id, instructionsArray, recipe.source);

      processed++;
      console.log(`${colors.green}✓ Saved to database${colors.reset}`);
      console.log(`${colors.bright}Progress: ${colors.green}${processed}/${total}${colors.reset} (${Math.round((processed/total)*100)}%)\n`);

    } catch (error) {
      console.error(`${colors.red}✗ Error processing recipe:${colors.reset}`, error);
      errors++;
    }
  }

  // Summary
  console.log(`\n${colors.bright}${colors.green}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.green}║   Extraction Complete - Summary                        ║${colors.reset}`);
  console.log(`${colors.bright}${colors.green}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);
  console.log(`${colors.bright}Total Recipes: ${colors.yellow}${total}${colors.reset}`);
  console.log(`${colors.bright}Processed: ${colors.green}${processed}${colors.reset}`);
  console.log(`${colors.bright}Skipped: ${colors.yellow}${skipped}${colors.reset}`);
  console.log(`${colors.bright}Errors: ${colors.red}${errors}${colors.reset}\n`);

  if (processed > 0) {
    console.log(`${colors.green}✓ ${processed} recipes now searchable!${colors.reset}`);
    console.log(`${colors.green}✓ Database updated with validated instructions${colors.reset}\n`);
  }

  process.exit(0);
}

main().catch(console.error);
