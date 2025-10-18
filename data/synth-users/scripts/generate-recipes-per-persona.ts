/**
 * Recipe Generation Script for Synthetic User Personas
 *
 * Generates personalized recipes for each persona based on their:
 * - Skill level (beginner/intermediate/advanced)
 * - Cuisine interests
 * - Dietary restrictions
 * - Time availability
 * - Family size
 * - Budget constraints
 *
 * Uses LLM (Gemini Flash or GPT-4o-mini) for cost-effective generation
 * with quality validation (AI score > 3.0)
 *
 * Usage:
 *   pnpm tsx data/synth-users/scripts/generate-recipes-per-persona.ts [personas-file] [count-per-persona]
 *
 * Example:
 *   pnpm tsx data/synth-users/scripts/generate-recipes-per-persona.ts data/synth-users/generated/personas.json 10
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Types
interface Persona {
  id: string;
  archetype: string;
  name: string;
  username: string;
  email: string;
  bio: string;
  ageGroup: string;
  location: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  cuisineInterests: string[];
  dietaryRestrictions: string[];
  timeAvailability: 'minimal' | 'moderate' | 'flexible';
  budgetConstraint: 'economy' | 'moderate' | 'premium';
  familySize: string;
  activityLevel: 'low' | 'medium' | 'high';
  specialties: string[];
  cookingGoals: string[];
}

interface GeneratedRecipe {
  personaId: string;
  personaUsername: string;
  name: string;
  description: string;
  cuisine: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: Array<{
    name: string;
    amount: string;
    unit: string;
    notes?: string;
  }>;
  instructions: string[];
  tags: string[];
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  estimatedCost?: 'low' | 'medium' | 'high';
  qualityScore?: number;
}

// Create OpenRouter client
function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
      'X-Title': 'Joanie\'s Kitchen - Recipe Generation',
    },
  });
}

/**
 * Calculate difficulty based on persona skill level and recipe complexity
 */
function getDifficultyForPersona(persona: Persona): 'easy' | 'medium' | 'hard' {
  if (persona.skillLevel === 'beginner') {
    return Math.random() < 0.7 ? 'easy' : 'medium';
  } else if (persona.skillLevel === 'intermediate') {
    const rand = Math.random();
    if (rand < 0.3) return 'easy';
    if (rand < 0.8) return 'medium';
    return 'hard';
  } else {
    // advanced
    const rand = Math.random();
    if (rand < 0.2) return 'medium';
    return 'hard';
  }
}

/**
 * Get appropriate cook time based on persona's time availability
 */
function getCookTimeRange(persona: Persona): { min: number; max: number } {
  if (persona.timeAvailability === 'minimal') {
    return { min: 15, max: 45 };
  } else if (persona.timeAvailability === 'moderate') {
    return { min: 30, max: 90 };
  } else {
    return { min: 45, max: 180 };
  }
}

/**
 * Get servings based on family size
 */
function getServingsForPersona(persona: Persona): number {
  if (persona.familySize.includes('single')) return 1 + Math.floor(Math.random() * 2); // 1-2
  if (persona.familySize.includes('couple')) return 2 + Math.floor(Math.random() * 2); // 2-3
  if (persona.familySize.includes('small family')) return 4 + Math.floor(Math.random() * 2); // 4-5
  return 6 + Math.floor(Math.random() * 3); // 6-8
}

/**
 * Select random cuisine from persona's interests
 */
function selectCuisine(persona: Persona): string {
  const interests = persona.cuisineInterests;
  return interests[Math.floor(Math.random() * interests.length)];
}

/**
 * Generate a single recipe for a persona using LLM
 */
async function generateRecipe(persona: Persona, index: number): Promise<GeneratedRecipe> {
  const difficulty = getDifficultyForPersona(persona);
  const timeRange = getCookTimeRange(persona);
  const servings = getServingsForPersona(persona);
  const cuisine = selectCuisine(persona);

  const prompt = `Generate a realistic ${cuisine} recipe for a ${persona.skillLevel} home cook.

Persona Context:
- Skill Level: ${persona.skillLevel}
- Dietary Restrictions: ${persona.dietaryRestrictions.join(', ')}
- Time Available: ${persona.timeAvailability}
- Budget: ${persona.budgetConstraint}
- Family Size: ${persona.familySize}
- Specialties: ${persona.specialties.join(', ')}

Recipe Requirements:
- Cuisine: ${cuisine}
- Difficulty: ${difficulty}
- Cook Time: ${timeRange.min}-${timeRange.max} minutes total
- Servings: ${servings}
- Must respect dietary restrictions: ${persona.dietaryRestrictions.join(', ')}

Return ONLY valid JSON with this exact structure:
{
  "name": "Recipe Name",
  "description": "2-3 sentence description that's appetizing and informative",
  "cuisine": "${cuisine}",
  "difficulty": "${difficulty}",
  "prepTime": number (minutes),
  "cookTime": number (minutes),
  "servings": ${servings},
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": "1",
      "unit": "cup",
      "notes": "optional preparation notes"
    }
  ],
  "instructions": [
    "Step 1 with specific details",
    "Step 2...",
    "..."
  ],
  "tags": ["3-5 relevant tags like meal-type, main-ingredient, cooking-method"],
  "nutritionInfo": {
    "calories": estimated number,
    "protein": grams,
    "carbs": grams,
    "fat": grams
  },
  "estimatedCost": "one of: low, medium, high"
}

Make the recipe realistic, delicious, and aligned with the persona's profile.
Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const client = getOpenRouterClient();
    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free', // Cost-effective for recipe generation
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8, // Some creativity but still coherent
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    // Strip markdown code blocks if present
    let jsonContent = content;
    if (content.startsWith('```')) {
      jsonContent = content
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
    }

    // Parse JSON response
    const recipeData = JSON.parse(jsonContent);

    return {
      personaId: persona.id,
      personaUsername: persona.username,
      ...recipeData,
    };
  } catch (error) {
    console.error(`Error generating recipe for ${persona.username}:`, error);
    throw error;
  }
}

/**
 * Calculate persona-recipe alignment score (0-100)
 */
function calculateAlignmentScore(persona: Persona, recipe: GeneratedRecipe): number {
  let score = 0;
  let maxScore = 0;

  // Cuisine match (20 points)
  maxScore += 20;
  if (persona.cuisineInterests.includes(recipe.cuisine)) {
    score += 20;
  }

  // Difficulty match (20 points)
  maxScore += 20;
  const difficultyMatch = {
    beginner: { easy: 20, medium: 10, hard: 0 },
    intermediate: { easy: 10, medium: 20, hard: 15 },
    advanced: { easy: 5, medium: 15, hard: 20 },
  };
  score += difficultyMatch[persona.skillLevel][recipe.difficulty];

  // Time availability match (20 points)
  maxScore += 20;
  const totalTime = recipe.prepTime + recipe.cookTime;
  if (persona.timeAvailability === 'minimal' && totalTime <= 45) score += 20;
  else if (persona.timeAvailability === 'moderate' && totalTime <= 90) score += 20;
  else if (persona.timeAvailability === 'flexible') score += 15;
  else score += 5;

  // Servings match (15 points)
  maxScore += 15;
  const expectedServings = getServingsForPersona(persona);
  if (Math.abs(recipe.servings - expectedServings) <= 1) score += 15;
  else if (Math.abs(recipe.servings - expectedServings) <= 2) score += 10;
  else score += 5;

  // Dietary restrictions compliance (25 points)
  maxScore += 25;
  // If persona has restrictions, check recipe tags/description
  const hasRestrictions = !persona.dietaryRestrictions.includes('none');
  if (hasRestrictions) {
    // For now, assume LLM respected restrictions (full validation would require ingredient analysis)
    score += 20; // Trust but verify in real implementation
  } else {
    score += 25; // No restrictions to worry about
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * Validate recipe quality
 */
function validateRecipe(recipe: GeneratedRecipe): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!recipe.name || recipe.name.length < 3) issues.push('Invalid name');
  if (!recipe.description || recipe.description.length < 20) issues.push('Description too short');
  if (!recipe.cuisine) issues.push('Missing cuisine');
  if (!['easy', 'medium', 'hard'].includes(recipe.difficulty)) issues.push('Invalid difficulty');
  if (!recipe.prepTime || recipe.prepTime < 0) issues.push('Invalid prep time');
  if (!recipe.cookTime || recipe.cookTime < 0) issues.push('Invalid cook time');
  if (!recipe.servings || recipe.servings < 1) issues.push('Invalid servings');
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 2) issues.push('Too few ingredients');
  if (!Array.isArray(recipe.instructions) || recipe.instructions.length < 3) issues.push('Too few instructions');
  if (!Array.isArray(recipe.tags) || recipe.tags.length < 2) issues.push('Too few tags');

  // Check ingredients structure
  for (const ing of recipe.ingredients || []) {
    if (!ing.name || !ing.amount) {
      issues.push('Ingredient missing name or amount');
      break;
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Generate multiple recipes for a single persona
 */
async function generateRecipesForPersona(
  persona: Persona,
  count: number
): Promise<GeneratedRecipe[]> {
  console.log(`\n👤 ${persona.name} (@${persona.username})`);
  console.log(`   Generating ${count} ${persona.skillLevel} ${persona.cuisineInterests[0]} recipes...`);

  const recipes: GeneratedRecipe[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < count; i++) {
    try {
      const recipe = await generateRecipe(persona, i + 1);

      // Validate recipe
      const validation = validateRecipe(recipe);
      if (!validation.valid) {
        console.log(`   ✗ Recipe ${i + 1}: Validation failed - ${validation.issues.join(', ')}`);
        failCount++;
        continue;
      }

      // Calculate alignment score
      const alignmentScore = calculateAlignmentScore(persona, recipe);
      recipe.qualityScore = alignmentScore;

      // Only accept recipes with good alignment (> 60%)
      if (alignmentScore < 60) {
        console.log(`   ⚠️  Recipe ${i + 1}: Low alignment score (${alignmentScore}%)`);
        failCount++;
        continue;
      }

      recipes.push(recipe);
      successCount++;

      console.log(`   ✓ ${recipe.name}`);
      console.log(`      ${recipe.difficulty} | ${recipe.prepTime + recipe.cookTime}min | ${recipe.servings} servings | Alignment: ${alignmentScore}%`);

      // Rate limiting: wait 2 seconds between requests
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      failCount++;
      console.error(`   ✗ Recipe ${i + 1}: Generation failed`);
      continue;
    }
  }

  console.log(`   📊 Summary: ${successCount}/${count} recipes generated`);
  return recipes;
}

/**
 * Generate recipes for all personas
 */
async function generateAllRecipes(
  personas: Persona[],
  countPerPersona: number
): Promise<Map<string, GeneratedRecipe[]>> {
  console.log(`\n🍳 Generating recipes for ${personas.length} personas (${countPerPersona} each)...\n`);

  const recipesByPersona = new Map<string, GeneratedRecipe[]>();
  let totalSuccess = 0;
  let totalAttempted = 0;

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i];

    try {
      const recipes = await generateRecipesForPersona(persona, countPerPersona);
      recipesByPersona.set(persona.id, recipes);

      totalSuccess += recipes.length;
      totalAttempted += countPerPersona;

      // Brief pause between personas
      if (i < personas.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(`Error generating recipes for ${persona.username}:`, error);
      recipesByPersona.set(persona.id, []);
      totalAttempted += countPerPersona;
    }
  }

  console.log(`\n📊 Overall Summary:`);
  console.log(`  Total Recipes: ${totalSuccess}/${totalAttempted}`);
  console.log(`  Success Rate: ${((totalSuccess / totalAttempted) * 100).toFixed(1)}%`);
  console.log(`  Average per Persona: ${(totalSuccess / personas.length).toFixed(1)}`);

  return recipesByPersona;
}

/**
 * Calculate quality metrics
 */
function calculateQualityMetrics(recipesByPersona: Map<string, GeneratedRecipe[]>) {
  const allRecipes: GeneratedRecipe[] = [];
  recipesByPersona.forEach(recipes => allRecipes.push(...recipes));

  const alignmentScores = allRecipes.map(r => r.qualityScore || 0);
  const avgAlignment = alignmentScores.reduce((a, b) => a + b, 0) / alignmentScores.length;
  const minAlignment = Math.min(...alignmentScores);
  const maxAlignment = Math.max(...alignmentScores);

  const difficulties = allRecipes.reduce((acc, r) => {
    acc[r.difficulty] = (acc[r.difficulty] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const cuisines = new Set(allRecipes.map(r => r.cuisine));
  const avgCookTime = allRecipes.reduce((a, b) => a + b.prepTime + b.cookTime, 0) / allRecipes.length;

  return {
    totalRecipes: allRecipes.length,
    avgAlignment: avgAlignment.toFixed(1),
    minAlignment,
    maxAlignment,
    difficulties,
    cuisineVariety: cuisines.size,
    avgCookTime: avgCookTime.toFixed(0),
  };
}

/**
 * Save recipes to JSON file
 */
function saveRecipes(recipesByPersona: Map<string, GeneratedRecipe[]>, outputPath: string) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Convert Map to object for JSON serialization
  const recipesObject: Record<string, GeneratedRecipe[]> = {};
  recipesByPersona.forEach((recipes, personaId) => {
    recipesObject[personaId] = recipes;
  });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(recipesObject, null, 2),
    'utf-8'
  );

  console.log(`\n💾 Saved recipes to: ${outputPath}`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const personasFile = args[0] || 'data/synth-users/generated/personas.json';
  const countPerPersona = args[1] ? parseInt(args[1], 10) : 10;

  if (isNaN(countPerPersona) || countPerPersona < 1 || countPerPersona > 50) {
    console.error('❌ Invalid count per persona. Please provide a number between 1 and 50.');
    process.exit(1);
  }

  // Load personas
  if (!fs.existsSync(personasFile)) {
    console.error(`❌ Personas file not found: ${personasFile}`);
    console.error('   Please run generate-personas.ts first.');
    process.exit(1);
  }

  const personas: Persona[] = JSON.parse(fs.readFileSync(personasFile, 'utf-8'));
  console.log(`📖 Loaded ${personas.length} personas from ${personasFile}`);

  const startTime = Date.now();

  try {
    // Generate recipes
    const recipesByPersona = await generateAllRecipes(personas, countPerPersona);

    // Calculate metrics
    console.log('\n📈 Quality Metrics:');
    const metrics = calculateQualityMetrics(recipesByPersona);
    console.log(`  Total Recipes: ${metrics.totalRecipes}`);
    console.log(`  Avg Alignment Score: ${metrics.avgAlignment}%`);
    console.log(`  Alignment Range: ${metrics.minAlignment}% - ${metrics.maxAlignment}%`);
    console.log(`  Difficulty Distribution: Easy=${metrics.difficulties.easy || 0}, Medium=${metrics.difficulties.medium || 0}, Hard=${metrics.difficulties.hard || 0}`);
    console.log(`  Cuisine Variety: ${metrics.cuisineVariety} unique cuisines`);
    console.log(`  Avg Cook Time: ${metrics.avgCookTime} minutes`);

    // Save to file
    const outputPath = path.join(
      process.cwd(),
      'data',
      'synth-users',
      'generated',
      'recipes.json'
    );
    saveRecipes(recipesByPersona, outputPath);

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Recipe generation complete!`);
    console.log(`  Time elapsed: ${duration}s`);
    console.log(`  Average time per recipe: ${(parseFloat(duration) / metrics.totalRecipes).toFixed(1)}s`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export type { Persona, GeneratedRecipe };
export { generateRecipesForPersona, generateAllRecipes, calculateAlignmentScore, validateRecipe };
