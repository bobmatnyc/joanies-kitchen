/**
 * Fix Recipe Capitalization Script
 *
 * Automatically fixes common capitalization issues in recipe titles, descriptions, and instructions.
 * Uses rules-based approach for simple cases, LLM for complex cases.
 *
 * Usage:
 *   pnpm run fix:capitalization              # Fix all recipes
 *   pnpm run fix:capitalization:dry-run      # Test without updating
 *   pnpm run fix:capitalization:sample       # Test on 50 recipes
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
    'X-Title': 'Joanie\'s Kitchen - Recipe Capitalization',
  },
});

interface CapitalizationFix {
  recipeId: string;
  recipeName: string;
  changes: {
    title?: { old: string; new: string };
    description?: { old: string; new: string };
    instructions?: Array<{ index: number; old: string; new: string }>;
  };
}

/**
 * Check if text needs capitalization fixes
 */
function needsCapitalization(text: string): boolean {
  // All lowercase
  if (text === text.toLowerCase()) return true;

  // All uppercase (more than 50% uppercase)
  const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 0 && uppercaseCount / letterCount > 0.7) return true;

  // First letter not capitalized
  if (text.length > 0 && text[0] === text[0].toLowerCase() && /[a-z]/.test(text[0])) return true;

  return false;
}

/**
 * Apply automatic title case (simple rules)
 */
function applyTitleCase(text: string): string {
  const smallWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with'];

  const words = text.toLowerCase().split(' ');

  return words.map((word, index) => {
    // Always capitalize first and last word
    if (index === 0 || index === words.length - 1) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }

    // Don't capitalize small words unless they're the first word
    if (smallWords.includes(word)) {
      return word;
    }

    // Capitalize everything else
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

/**
 * Apply sentence case (first letter capitalized, rest lowercase)
 */
function applySentenceCase(text: string): string {
  // Split into sentences
  const sentences = text.split(/([.!?]\s+)/);

  return sentences.map(sentence => {
    if (sentence.match(/^[.!?]\s+$/)) return sentence;

    const trimmed = sentence.trim();
    if (trimmed.length === 0) return sentence;

    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }).join('');
}

/**
 * Use LLM for complex capitalization fixes
 */
async function fixWithLLM(text: string, type: 'title' | 'description' | 'instruction'): Promise<string> {
  const prompts = {
    title: 'Fix the capitalization of this recipe title. Use title case (capitalize major words). Return ONLY the corrected title, nothing else.',
    description: 'Fix the capitalization of this recipe description. Use sentence case (capitalize first letter of sentences). Return ONLY the corrected description, nothing else.',
    instruction: 'Fix the capitalization of this recipe instruction. Use sentence case. Return ONLY the corrected instruction, nothing else.',
  };

  try {
    const response = await openrouter.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free', // Free Gemini model
      messages: [
        {
          role: 'user',
          content: `${prompts[type]}\n\nText: ${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const fixed = response.choices[0]?.message?.content?.trim();
    return fixed || text;
  } catch (error) {
    console.error(`LLM error for ${type}:`, error);
    // Fallback to automatic method
    return type === 'title' ? applyTitleCase(text) : applySentenceCase(text);
  }
}

/**
 * Process a single recipe
 */
async function processRecipe(
  recipe: any,
  useLLM: boolean,
  dryRun: boolean
): Promise<CapitalizationFix | null> {
  const changes: CapitalizationFix['changes'] = {};
  let hasChanges = false;

  // Check title
  if (needsCapitalization(recipe.name)) {
    const fixed = useLLM
      ? await fixWithLLM(recipe.name, 'title')
      : applyTitleCase(recipe.name);

    if (fixed !== recipe.name) {
      changes.title = { old: recipe.name, new: fixed };
      hasChanges = true;
    }
  }

  // Check description
  if (recipe.description && needsCapitalization(recipe.description)) {
    const fixed = useLLM
      ? await fixWithLLM(recipe.description, 'description')
      : applySentenceCase(recipe.description);

    if (fixed !== recipe.description) {
      changes.description = { old: recipe.description, new: fixed };
      hasChanges = true;
    }
  }

  // Check instructions
  if (recipe.instructions) {
    const instructions = JSON.parse(recipe.instructions);
    const fixedInstructions = [];

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];

      if (needsCapitalization(instruction)) {
        const fixed = useLLM
          ? await fixWithLLM(instruction, 'instruction')
          : applySentenceCase(instruction);

        if (fixed !== instruction) {
          if (!changes.instructions) changes.instructions = [];
          changes.instructions.push({ index: i, old: instruction, new: fixed });
          fixedInstructions.push(fixed);
          hasChanges = true;
        } else {
          fixedInstructions.push(instruction);
        }
      } else {
        fixedInstructions.push(instruction);
      }
    }

    // Update database if not dry run
    if (hasChanges && !dryRun) {
      const updates: any = {};

      if (changes.title) {
        updates.name = changes.title.new;
      }

      if (changes.description) {
        updates.description = changes.description.new;
      }

      if (changes.instructions && changes.instructions.length > 0) {
        updates.instructions = JSON.stringify(fixedInstructions);
      }

      await db.update(recipes).set(updates).where(eq(recipes.id, recipe.id));
    }
  }

  if (!hasChanges) return null;

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    changes,
  };
}

/**
 * Main function
 */
async function fixCapitalization() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sampleMode = args.includes('--sample');
  const useLLM = !args.includes('--no-llm'); // Use LLM by default

  console.log('🔤 Recipe Capitalization Fixer\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`LLM: ${useLLM ? 'ENABLED (Gemini 2.0 Flash FREE)' : 'DISABLED (Rules-based only)'}`);
  console.log(`Sample: ${sampleMode ? 'YES (50 recipes)' : 'NO (All recipes)'}\n`);

  // Get recipes
  const allRecipes = await db
    .select()
    .from(recipes)
    .limit(sampleMode ? 50 : 100000);

  console.log(`📊 Found ${allRecipes.length} recipes to check\n`);

  const fixes: CapitalizationFix[] = [];
  let processed = 0;

  for (const recipe of allRecipes) {
    const fix = await processRecipe(recipe, useLLM, dryRun);

    if (fix) {
      fixes.push(fix);
      console.log(`✓ Fixed "${recipe.name}"`);

      if (fix.changes.title) {
        console.log(`  Title: "${fix.changes.title.old}" → "${fix.changes.title.new}"`);
      }

      if (fix.changes.description) {
        console.log(`  Description: Changed`);
      }

      if (fix.changes.instructions) {
        console.log(`  Instructions: ${fix.changes.instructions.length} fixes`);
      }

      console.log('');
    }

    processed++;
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${allRecipes.length} (${((processed / allRecipes.length) * 100).toFixed(1)}%)\n`);
    }

    // Rate limiting for LLM
    if (useLLM) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between requests
    }
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total recipes checked: ${allRecipes.length}`);
  console.log(`Recipes with fixes: ${fixes.length}`);
  console.log(`Recipes without issues: ${allRecipes.length - fixes.length}`);
  console.log(`Percentage needing fixes: ${((fixes.length / allRecipes.length) * 100).toFixed(1)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (dryRun) {
    console.log('ℹ️  This was a DRY RUN - no changes were made.');
    console.log('   To apply fixes, run: pnpm run fix:capitalization\n');
  } else {
    console.log('✅ All fixes have been applied!\n');
  }

  process.exit(0);
}

fixCapitalization().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
