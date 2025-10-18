#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { chefs } from '../src/lib/db/chef-schema';
import { eq, like, or } from 'drizzle-orm';
import OpenAI from 'openai';

// Create OpenRouter client for script use
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
    'X-Title': 'Recipe Manager',
  },
});

/**
 * FIX LIDIA BASTIANICH RECIPE CONTENT QUALITY
 *
 * Fixes common content issues:
 * - Standardize recipe names (title case, proper Italian terms)
 * - Enhance descriptions with Lidia's voice
 * - Format instructions as numbered steps
 * - Estimate prep/cook times
 * - Fix servings information
 * - Ensure Italian cuisine is set
 */

interface FixResults {
  totalRecipes: number;
  namesFixed: number;
  descriptionsEnhanced: number;
  instructionsFormatted: number;
  timesEstimated: number;
  servingsAdded: number;
  cuisineFixed: number;
  errors: string[];
}

// Use Gemini Flash for cost-effective content enhancements
const AI_MODEL = 'google/gemini-2.0-flash-exp:free';

async function enhanceDescription(recipe: any): Promise<string> {
  const prompt = `You are helping to improve recipe descriptions for Lidia Bastianich's Italian recipes.

Recipe Name: ${recipe.name}
Current Description: ${recipe.description || 'None'}
Ingredients: ${typeof recipe.ingredients === 'string' ? recipe.ingredients : JSON.stringify(recipe.ingredients)}

Task: Write a warm, engaging 2-3 sentence description for this recipe that:
1. Captures Lidia's authentic Italian voice (warm, educational, family-oriented)
2. Mentions Italian heritage or tradition when relevant
3. Describes what makes this dish special
4. Uses proper Italian terminology
5. Makes the reader want to cook it

Return ONLY the description text, no other commentary.`;

  try {
    const completion = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    return content || recipe.description || '';
  } catch (error) {
    console.error(`   ⚠️  AI enhancement failed: ${error}`);
    return recipe.description || '';
  }
}

async function estimateTimesAndServings(recipe: any): Promise<{
  prepTime: number;
  cookTime: number;
  servings: number;
}> {
  const instructionsLength = (recipe.instructions || '').length;
  let ingredients: any[] = [];
  try {
    ingredients = typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients || [];
  } catch (e) {
    ingredients = [];
  }

  const prompt = `Analyze this recipe and estimate realistic cooking times and servings:

Recipe Name: ${recipe.name}
Ingredients Count: ${ingredients.length}
Instructions: ${recipe.instructions ? recipe.instructions.substring(0, 500) : 'None'}

Provide estimates in this exact JSON format:
{
  "prepTime": <number in minutes>,
  "cookTime": <number in minutes>,
  "servings": <number of servings>
}

Base estimates on typical Italian cooking:
- Simple salads/sides: 10-15 min prep, 0-20 min cook, 4-6 servings
- Soups/stews: 15-25 min prep, 30-60 min cook, 6-8 servings
- Pasta dishes: 15-20 min prep, 15-25 min cook, 4-6 servings
- Complex dishes: 25-40 min prep, 45-90 min cook, 6-8 servings

Return ONLY the JSON object, nothing else.`;

  try {
    const completion = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 100,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No response from AI');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      prepTime: Math.max(5, Math.min(120, parsed.prepTime || 15)),
      cookTime: Math.max(0, Math.min(180, parsed.cookTime || 30)),
      servings: Math.max(2, Math.min(12, parsed.servings || 4)),
    };
  } catch (error) {
    console.error(`   ⚠️  Time estimation failed: ${error}`);
    // Fallback heuristics
    const ingredientCount = ingredients.length;
    return {
      prepTime: Math.min(30, ingredientCount * 2),
      cookTime: instructionsLength > 500 ? 45 : 30,
      servings: 4,
    };
  }
}

function formatInstructions(instructions: string): string {
  if (!instructions || instructions.trim().length === 0) {
    return instructions;
  }

  // If already numbered, return as-is
  if (/^\s*\d+[.)]/.test(instructions)) {
    return instructions;
  }

  // Split by sentences or paragraphs
  const paragraphs = instructions
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length === 0) {
    return instructions;
  }

  // Number each paragraph as a step
  const numbered = paragraphs
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n\n');

  return numbered;
}

function standardizeName(name: string): string {
  if (!name) return name;

  // If ALL CAPS, convert to title case
  if (name === name.toUpperCase() && name.length > 5) {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => {
        // Keep certain words lowercase (articles, prepositions)
        if (['a', 'an', 'the', 'for', 'and', 'or', 'with', 'in', 'on'].includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ')
      .replace(/^[a-z]/, c => c.toUpperCase()); // Capitalize first word
  }

  return name.trim();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔧 FIX LIDIA BASTIANICH RECIPE CONTENT QUALITY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const results: FixResults = {
    totalRecipes: 0,
    namesFixed: 0,
    descriptionsEnhanced: 0,
    instructionsFormatted: 0,
    timesEstimated: 0,
    servingsAdded: 0,
    cuisineFixed: 0,
    errors: [],
  };

  // Get Lidia's chef profile
  const [chef] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'lidia-bastianich'))
    .limit(1);

  if (!chef) {
    console.error('❌ Lidia Bastianich chef profile not found');
    process.exit(1);
  }

  // Get all Lidia's recipes
  const lidiaRecipes = await db
    .select()
    .from(recipes)
    .where(eq(recipes.chef_id, chef.id))
    .orderBy(recipes.name);

  console.log(`📚 Found ${lidiaRecipes.length} Lidia Bastianich recipes\n`);
  results.totalRecipes = lidiaRecipes.length;

  if (lidiaRecipes.length === 0) {
    console.log('✅ No recipes found to fix');
    return;
  }

  console.log('🔧 Processing recipes...\n');

  for (let i = 0; i < lidiaRecipes.length; i++) {
    const recipe = lidiaRecipes[i];
    console.log(`[${i + 1}/${lidiaRecipes.length}] ${recipe.name}`);

    const updates: any = {};
    let needsUpdate = false;

    try {
      // 1. Fix name if ALL CAPS
      if (recipe.name === recipe.name.toUpperCase() && recipe.name.length > 5) {
        const newName = standardizeName(recipe.name);
        console.log(`   ✏️  Name: "${recipe.name}" → "${newName}"`);
        updates.name = newName;
        results.namesFixed++;
        needsUpdate = true;
      }

      // 2. Enhance description if missing or too short
      if (!recipe.description || recipe.description.trim().length < 50) {
        console.log(`   📝 Enhancing description...`);
        const enhanced = await enhanceDescription(recipe);
        if (enhanced && enhanced !== recipe.description) {
          console.log(`   ✅ Description enhanced (${enhanced.length} chars)`);
          updates.description = enhanced;
          results.descriptionsEnhanced++;
          needsUpdate = true;
        }
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 3. Format instructions if not numbered
      if (recipe.instructions && !/^\s*\d+[.)]/.test(recipe.instructions)) {
        const formatted = formatInstructions(recipe.instructions);
        if (formatted !== recipe.instructions) {
          console.log(`   📋 Instructions formatted with numbering`);
          updates.instructions = formatted;
          results.instructionsFormatted++;
          needsUpdate = true;
        }
      }

      // 4. Estimate times and servings if missing
      if (!recipe.prepTime || !recipe.cookTime || !recipe.servings) {
        console.log(`   ⏱️  Estimating times and servings...`);
        const estimates = await estimateTimesAndServings(recipe);

        if (!recipe.prepTime) {
          updates.prep_time = estimates.prepTime;
        }
        if (!recipe.cookTime) {
          updates.cook_time = estimates.cookTime;
        }
        if (!recipe.servings) {
          updates.servings = estimates.servings;
        }

        console.log(`   ✅ Estimates: ${estimates.prepTime}min prep, ${estimates.cookTime}min cook, ${estimates.servings} servings`);
        results.timesEstimated++;
        needsUpdate = true;

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 5. Fix cuisine if not Italian
      if (recipe.cuisine !== 'Italian') {
        console.log(`   🍝 Cuisine: "${recipe.cuisine}" → "Italian"`);
        updates.cuisine = 'Italian';
        results.cuisineFixed++;
        needsUpdate = true;
      }

      // Apply updates if needed
      if (needsUpdate) {
        updates.updated_at = new Date();
        await db
          .update(recipes)
          .set(updates)
          .where(eq(recipes.id, recipe.id));
        console.log(`   ✅ Recipe updated\n`);
      } else {
        console.log(`   ✅ No fixes needed\n`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing recipe: ${error}\n`);
      results.errors.push(`${recipe.name}: ${error}`);
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📊 FIX SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`Total Recipes Processed: ${results.totalRecipes}`);
  console.log(`Names Standardized: ${results.namesFixed}`);
  console.log(`Descriptions Enhanced: ${results.descriptionsEnhanced}`);
  console.log(`Instructions Formatted: ${results.instructionsFormatted}`);
  console.log(`Times/Servings Estimated: ${results.timesEstimated}`);
  console.log(`Cuisine Fixed: ${results.cuisineFixed}`);
  console.log(`Errors: ${results.errors.length}\n`);

  if (results.errors.length > 0) {
    console.log('Errors:');
    for (const error of results.errors) {
      console.log(`  - ${error}`);
    }
    console.log();
  }

  console.log('✅ Content fixes completed!\n');
  console.log('💡 Next steps:');
  console.log('   1. Review updated recipes in database');
  console.log('   2. Run audit again: npx tsx scripts/audit-lidia-recipes.ts');
  console.log('   3. Manually review AI-enhanced descriptions');
  console.log('   4. Adjust time estimates if needed\n');
}

main().catch(console.error);
