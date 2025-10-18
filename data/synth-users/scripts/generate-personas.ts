/**
 * Persona Generation Script for Synthetic Users
 *
 * Generates diverse user personas with realistic attributes using LLM
 * Each persona represents a unique cooking profile with:
 * - Demographic information (age, location, family size)
 * - Cooking preferences (skill level, cuisines, dietary restrictions)
 * - Behavioral patterns (activity level, time availability, budget)
 *
 * Usage:
 *   pnpm tsx data/synth-users/scripts/generate-personas.ts [count]
 *
 * Example:
 *   pnpm tsx data/synth-users/scripts/generate-personas.ts 50
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create OpenRouter client for standalone script
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
      'X-Title': 'Joanie\'s Kitchen - Synthetic User Generation',
    },
  });
}

// Persona archetype templates for diversity
const PERSONA_ARCHETYPES = [
  'Busy Parent',
  'Foodie Explorer',
  'Health Conscious',
  'Budget Cook',
  'Beginner Chef',
  'Professional Chef',
  'Senior Cook',
  'College Student',
  'Meal Prepper',
  'Gourmet Enthusiast',
  'Plant-Based Cook',
  'Traditional Home Cook',
  'Quick & Easy Specialist',
  'Baking Enthusiast',
  'International Cuisine Lover',
] as const;

const AGE_GROUPS = ['18-25', '26-35', '36-50', '51-65', '66+'] as const;

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

const CUISINES = [
  'Italian',
  'Mexican',
  'Chinese',
  'Japanese',
  'Indian',
  'Thai',
  'French',
  'Mediterranean',
  'American',
  'Korean',
  'Vietnamese',
  'Greek',
  'Middle Eastern',
  'Spanish',
  'Caribbean',
] as const;

const DIETARY_RESTRICTIONS = [
  'none',
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'low-carb',
  'keto',
  'paleo',
  'pescatarian',
  'halal',
  'kosher',
] as const;

const FAMILY_SIZES = ['single', 'couple', 'small family (3-4)', 'large family (5+)'] as const;

interface Persona {
  id: string;
  archetype: typeof PERSONA_ARCHETYPES[number];
  name: string;
  username: string;
  email: string;
  bio: string;
  ageGroup: typeof AGE_GROUPS[number];
  location: string;
  skillLevel: typeof SKILL_LEVELS[number];
  cuisineInterests: string[];
  dietaryRestrictions: typeof DIETARY_RESTRICTIONS[number][];
  timeAvailability: 'minimal' | 'moderate' | 'flexible';
  budgetConstraint: 'economy' | 'moderate' | 'premium';
  familySize: typeof FAMILY_SIZES[number];
  activityLevel: 'low' | 'medium' | 'high';
  specialties: string[];
  cookingGoals: string[];
}

/**
 * Generate a single persona using GPT-4o
 */
async function generatePersona(
  archetype: typeof PERSONA_ARCHETYPES[number],
  index: number
): Promise<Persona> {
  const prompt = `Generate a realistic user persona for a recipe sharing platform.

Archetype: ${archetype}

Return a JSON object with these exact fields:
{
  "name": "First Last (realistic full name)",
  "username": "unique_username (lowercase, no spaces)",
  "email": "email@example.com",
  "bio": "2-3 sentence bio describing cooking journey and interests",
  "ageGroup": "one of: 18-25, 26-35, 36-50, 51-65, 66+",
  "location": "City, State (realistic US location)",
  "skillLevel": "one of: beginner, intermediate, advanced",
  "cuisineInterests": ["3-5 cuisines from: Italian, Mexican, Chinese, Japanese, Indian, Thai, French, Mediterranean, American, Korean, Vietnamese, Greek, Middle Eastern, Spanish, Caribbean"],
  "dietaryRestrictions": ["0-2 from: none, vegetarian, vegan, gluten-free, dairy-free, low-carb, keto, paleo, pescatarian, halal, kosher"],
  "timeAvailability": "one of: minimal, moderate, flexible",
  "budgetConstraint": "one of: economy, moderate, premium",
  "familySize": "one of: single, couple, small family (3-4), large family (5+)",
  "activityLevel": "one of: low, medium, high (based on archetype)",
  "specialties": ["2-3 cooking specialties or signature dishes"],
  "cookingGoals": ["2-3 specific cooking goals"]
}

Make the persona realistic, diverse, and consistent with the archetype.
Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const client = getOpenRouterClient();
    const response = await client.chat.completions.create({
      model: 'openai/gpt-4o-2024-11-20',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9, // High temperature for diversity
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    // Strip markdown code blocks if present
    let jsonContent = content;
    if (content.startsWith('```')) {
      // Remove ```json or ``` at start and ``` at end
      jsonContent = content
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
    }

    // Parse JSON response
    const personaData = JSON.parse(jsonContent);

    // Generate unique ID
    const id = `persona-${archetype.toLowerCase().replace(/\s+/g, '-')}-${index}`;

    return {
      id,
      archetype,
      ...personaData,
    };
  } catch (error) {
    console.error(`Error generating persona for ${archetype}:`, error);
    throw error;
  }
}

/**
 * Generate multiple personas with diversity
 */
async function generatePersonas(count: number): Promise<Persona[]> {
  console.log(`\n🎭 Generating ${count} diverse user personas...\n`);

  const personas: Persona[] = [];
  const archetypesPool = [...PERSONA_ARCHETYPES];

  // Ensure we use all archetypes at least once if count >= archetypes length
  const iterations = Math.ceil(count / archetypesPool.length);
  const expandedArchetypes: typeof PERSONA_ARCHETYPES[number][] = [];

  for (let i = 0; i < iterations; i++) {
    expandedArchetypes.push(...archetypesPool);
  }

  // Shuffle for randomness
  const shuffled = expandedArchetypes
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < shuffled.length; i++) {
    const archetype = shuffled[i];

    try {
      console.log(`[${i + 1}/${count}] Generating ${archetype}...`);

      const persona = await generatePersona(archetype, i + 1);
      personas.push(persona);
      successCount++;

      console.log(`  ✓ ${persona.name} (@${persona.username})`);
      console.log(`    ${persona.ageGroup} | ${persona.skillLevel} | ${persona.location}`);
      console.log(`    Interests: ${persona.cuisineInterests.slice(0, 3).join(', ')}`);

      // Rate limiting: wait 1 second between requests
      if (i < shuffled.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      failCount++;
      console.error(`  ✗ Failed to generate ${archetype}`);

      // Continue with next persona
      continue;
    }
  }

  console.log(`\n📊 Generation Summary:`);
  console.log(`  Success: ${successCount}/${count}`);
  console.log(`  Failed: ${failCount}/${count}`);

  return personas;
}

/**
 * Validate persona data quality
 */
function validatePersonas(personas: Persona[]): {
  valid: Persona[];
  invalid: Persona[];
  issues: string[];
} {
  const valid: Persona[] = [];
  const invalid: Persona[] = [];
  const issues: string[] = [];

  for (const persona of personas) {
    const personaIssues: string[] = [];

    // Check required fields
    if (!persona.name || persona.name.length < 3) {
      personaIssues.push('Invalid name');
    }
    if (!persona.username || !/^[a-z0-9_]+$/.test(persona.username)) {
      personaIssues.push('Invalid username format');
    }
    if (!persona.email || !persona.email.includes('@')) {
      personaIssues.push('Invalid email');
    }
    if (!persona.bio || persona.bio.length < 20) {
      personaIssues.push('Bio too short');
    }

    // Check enum values
    if (!AGE_GROUPS.includes(persona.ageGroup as any)) {
      personaIssues.push('Invalid age group');
    }
    if (!SKILL_LEVELS.includes(persona.skillLevel)) {
      personaIssues.push('Invalid skill level');
    }
    if (!FAMILY_SIZES.includes(persona.familySize as any)) {
      personaIssues.push('Invalid family size');
    }

    // Check arrays
    if (!Array.isArray(persona.cuisineInterests) || persona.cuisineInterests.length < 1) {
      personaIssues.push('Invalid cuisine interests');
    }
    if (!Array.isArray(persona.dietaryRestrictions) || persona.dietaryRestrictions.length < 1) {
      personaIssues.push('Invalid dietary restrictions');
    }
    if (!Array.isArray(persona.specialties) || persona.specialties.length < 1) {
      personaIssues.push('Invalid specialties');
    }
    if (!Array.isArray(persona.cookingGoals) || persona.cookingGoals.length < 1) {
      personaIssues.push('Invalid cooking goals');
    }

    if (personaIssues.length > 0) {
      invalid.push(persona);
      issues.push(`${persona.id}: ${personaIssues.join(', ')}`);
    } else {
      valid.push(persona);
    }
  }

  return { valid, invalid, issues };
}

/**
 * Calculate persona diversity metrics
 */
function calculateDiversityMetrics(personas: Persona[]) {
  const metrics = {
    archetypes: new Set<string>(),
    ageGroups: new Set<string>(),
    skillLevels: new Set<string>(),
    cuisines: new Set<string>(),
    diets: new Set<string>(),
    familySizes: new Set<string>(),
    activityLevels: new Set<string>(),
  };

  for (const persona of personas) {
    metrics.archetypes.add(persona.archetype);
    metrics.ageGroups.add(persona.ageGroup);
    metrics.skillLevels.add(persona.skillLevel);
    persona.cuisineInterests.forEach(c => metrics.cuisines.add(c));
    persona.dietaryRestrictions.forEach(d => metrics.diets.add(d));
    metrics.familySizes.add(persona.familySize);
    metrics.activityLevels.add(persona.activityLevel);
  }

  return {
    archetypeCount: metrics.archetypes.size,
    ageGroupCount: metrics.ageGroups.size,
    skillLevelCount: metrics.skillLevels.size,
    cuisineCount: metrics.cuisines.size,
    dietCount: metrics.diets.size,
    familySizeCount: metrics.familySizes.size,
    activityLevelCount: metrics.activityLevels.size,
    diversityScore: (
      metrics.archetypes.size / PERSONA_ARCHETYPES.length +
      metrics.ageGroups.size / AGE_GROUPS.length +
      metrics.skillLevels.size / SKILL_LEVELS.length +
      metrics.cuisines.size / CUISINES.length +
      metrics.diets.size / DIETARY_RESTRICTIONS.length +
      metrics.familySizes.size / FAMILY_SIZES.length
    ) / 6 * 100,
  };
}

/**
 * Save personas to JSON file
 */
function savePersonas(personas: Persona[], outputPath: string) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify(personas, null, 2),
    'utf-8'
  );

  console.log(`\n💾 Saved ${personas.length} personas to: ${outputPath}`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const count = args[0] ? parseInt(args[0], 10) : 50;

  if (isNaN(count) || count < 1 || count > 200) {
    console.error('❌ Invalid count. Please provide a number between 1 and 200.');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    // Generate personas
    const personas = await generatePersonas(count);

    // Validate personas
    console.log('\n🔍 Validating personas...');
    const { valid, invalid, issues } = validatePersonas(personas);

    if (invalid.length > 0) {
      console.warn(`\n⚠️  ${invalid.length} personas failed validation:`);
      issues.forEach(issue => console.warn(`  - ${issue}`));
    }

    // Calculate diversity metrics
    const metrics = calculateDiversityMetrics(valid);
    console.log('\n📈 Diversity Metrics:');
    console.log(`  Archetypes: ${metrics.archetypeCount}/${PERSONA_ARCHETYPES.length}`);
    console.log(`  Age Groups: ${metrics.ageGroupCount}/${AGE_GROUPS.length}`);
    console.log(`  Skill Levels: ${metrics.skillLevelCount}/${SKILL_LEVELS.length}`);
    console.log(`  Cuisines: ${metrics.cuisineCount}/${CUISINES.length}`);
    console.log(`  Dietary Restrictions: ${metrics.dietCount}/${DIETARY_RESTRICTIONS.length}`);
    console.log(`  Family Sizes: ${metrics.familySizeCount}/${FAMILY_SIZES.length}`);
    console.log(`  Activity Levels: ${metrics.activityLevelCount}/3`);
    console.log(`  Overall Diversity Score: ${metrics.diversityScore.toFixed(1)}%`);

    // Save to file
    const outputPath = path.join(
      process.cwd(),
      'data',
      'synth-users',
      'generated',
      'personas.json'
    );
    savePersonas(valid, outputPath);

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Persona generation complete!`);
    console.log(`  Total personas: ${valid.length}`);
    console.log(`  Time elapsed: ${duration}s`);
    console.log(`  Average time per persona: ${(parseFloat(duration) / valid.length).toFixed(1)}s`);

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

export type { Persona };
export { generatePersonas, validatePersonas, calculateDiversityMetrics };
