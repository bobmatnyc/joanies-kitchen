/**
 * Meal Pairing System - Standalone Test Suite
 *
 * Comprehensive testing without server-only module restrictions.
 * Tests via direct API calls and database queries.
 *
 * @version 1.0.0
 */

import { config } from 'dotenv';
import { join } from 'path';
import OpenAI from 'openai';

// Load environment variables FIRST
config({ path: join(process.cwd(), '.env.local') });

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { recipes } from '@/lib/db/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import ws from 'ws';

// Configure neon for WebSocket
neonConfig.webSocketConstructor = ws;

// ============================================================================
// Database Setup
// ============================================================================

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

// ============================================================================
// OpenRouter Client
// ============================================================================

function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
      'X-Title': 'Recipe Manager - Meal Pairing Tests',
    },
  });
}

// ============================================================================
// Test Configuration
// ============================================================================

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details: string;
  evidence?: any;
  error?: string;
}

const results: TestResult[] = [];

// ============================================================================
// Utility Functions
// ============================================================================

function logTest(testName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(80));
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logFailure(message: string) {
  console.log(`❌ ${message}`);
}

function logInfo(message: string) {
  console.log(`ℹ️  ${message}`);
}

function logWarning(message: string) {
  console.log(`⚠️  ${message}`);
}

function recordResult(result: TestResult) {
  results.push(result);
  if (result.status === 'PASS') {
    logSuccess(`${result.testName} - ${result.duration}ms`);
  } else if (result.status === 'FAIL') {
    logFailure(`${result.testName} - ${result.error || result.details}`);
  } else {
    logWarning(`${result.testName} - ${result.details}`);
  }
}

// ============================================================================
// Meal Pairing System Prompt (inline)
// ============================================================================

const MEAL_PAIRING_SYSTEM_PROMPT = `You are Joanie's Kitchen meal planning assistant. You create balanced, delicious multi-course meals using flavor science and practical cooking wisdom.

CORE PAIRING PRINCIPLES:
1. WEIGHT MATCHING (1-5 scale): Heavy mains → Light sides/apps
2. ACID-FAT BALANCE: Rich dishes REQUIRE acidic components
3. TEXTURE CONTRAST: Minimum 6 unique textures per meal
4. TEMPERATURE PROGRESSION: Hot → Cold → Hot → Cold alternation
5. FLAVOR INTENSITY MATCHING: Match within 1-2 points on 1-5 scale

Respond ONLY with valid JSON, no markdown, no explanations.`;

// ============================================================================
// Test 1: Environment and Database Setup
// ============================================================================

async function testEnvironmentSetup() {
  logTest('Test 1: Environment and Database Setup');

  const startTime = Date.now();
  try {
    // Check environment variables
    const requiredEnvVars = ['DATABASE_URL', 'OPENROUTER_API_KEY'];
    const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

    if (missingVars.length > 0) {
      recordResult({
        testName: 'Environment Setup',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: `Missing environment variables: ${missingVars.join(', ')}`,
      });
      return;
    }

    logSuccess('All required environment variables present');

    // Test database connection
    logInfo('Testing database connection...');
    const testQuery = await db.select().from(recipes).limit(1);

    logSuccess(`Database connection successful (${testQuery.length} test records)`);

    recordResult({
      testName: 'Environment Setup',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: 'Environment and database configured correctly',
    });
  } catch (error: any) {
    recordResult({
      testName: 'Environment Setup',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 2: Database Pairing Metadata
// ============================================================================

async function testDatabaseMetadata() {
  logTest('Test 2: Database Pairing Metadata Fields');

  const startTime = Date.now();
  try {
    logInfo('Querying recipes with pairing metadata...');

    const recipesWithMetadata = await db
      .select()
      .from(recipes)
      .where(
        and(
          isNotNull(recipes.weight_score),
          isNotNull(recipes.richness_score),
          isNotNull(recipes.acidity_score)
        )
      )
      .limit(20);

    const metadataCount = recipesWithMetadata.length;
    logInfo(`Found ${metadataCount} recipes with complete pairing metadata`);

    if (metadataCount === 0) {
      logWarning('No recipes with pairing metadata - meal pairing may generate all new recipes');
    } else {
      console.log('\n📊 Sample recipes with pairing metadata:');
      recipesWithMetadata.slice(0, 3).forEach((recipe) => {
        console.log(`\n  "${recipe.name}"`);
        console.log(
          `    Weight: ${recipe.weight_score}, Richness: ${recipe.richness_score}, Acidity: ${recipe.acidity_score}`
        );
        console.log(`    Temperature: ${recipe.serving_temperature || 'not set'}`);
        if (recipe.dominant_textures) {
          try {
            const textures = JSON.parse(recipe.dominant_textures);
            console.log(`    Textures: ${textures.join(', ')}`);
          } catch {
            console.log(`    Textures: ${recipe.dominant_textures}`);
          }
        }
      });
    }

    // Test metadata-based queries
    const allMetadata = await db
      .select()
      .from(recipes)
      .where(and(isNotNull(recipes.weight_score), isNotNull(recipes.richness_score)))
      .limit(100);

    const lightAppetizers = allMetadata.filter((r) => r.weight_score! <= 2);
    const richMains = allMetadata.filter((r) => r.richness_score! >= 4);
    const acidicSides = allMetadata.filter((r) => r.acidity_score && r.acidity_score >= 3);

    console.log('\n📈 Metadata-based query results:');
    console.log(`  Light dishes (weight ≤ 2): ${lightAppetizers.length}`);
    console.log(`  Rich dishes (richness ≥ 4): ${richMains.length}`);
    console.log(`  Acidic dishes (acidity ≥ 3): ${acidicSides.length}`);

    recordResult({
      testName: 'Database Metadata',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: `Found ${metadataCount} recipes with pairing metadata`,
      evidence: {
        totalWithMetadata: metadataCount,
        lightDishes: lightAppetizers.length,
        richDishes: richMains.length,
        acidicDishes: acidicSides.length,
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'Database Metadata',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 3: OpenRouter API Integration
// ============================================================================

async function testOpenRouterAPI() {
  logTest('Test 3: OpenRouter API Integration');

  const startTime = Date.now();
  try {
    logInfo('Initializing OpenRouter client...');
    const client = createOpenRouterClient();

    logSuccess('OpenRouter client created');

    logInfo('Testing simple API call...');

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: 'Respond with exactly: "OpenRouter API is working"',
        },
      ],
      max_tokens: 20,
    });

    const text = response.choices[0]?.message?.content || '';
    logInfo(`API Response: "${text}"`);

    if (text.toLowerCase().includes('working')) {
      logSuccess('OpenRouter API call successful');
    }

    recordResult({
      testName: 'OpenRouter API Integration',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: 'OpenRouter API functional',
    });
  } catch (error: any) {
    recordResult({
      testName: 'OpenRouter API Integration',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 4: Cuisine-Based Meal Generation (Italian)
// ============================================================================

async function testCuisineMealGeneration() {
  logTest('Test 4: Cuisine-Based Meal Generation (Italian, 4 servings)');

  const startTime = Date.now();
  try {
    logInfo('Generating Italian meal for 4 servings...');

    const client = createOpenRouterClient();

    const userPrompt = `Create a complete Italian meal with appetizer, main course, side dish, and dessert.

CUISINE CONTEXT: Italian
CONSTRAINTS:
- Dietary restrictions: None
- Maximum total prep time: 120 minutes
- Servings: 4

OUTPUT FORMAT (JSON):
{
  "appetizer": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": ""
  },
  "main": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "richness_score": 1-5,
    "dominant_flavors": [],
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": []
  },
  "side": {
    "name": "",
    "description": "",
    "acidity_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": ""
  },
  "dessert": {
    "name": "",
    "description": "",
    "sweetness_level": "light|moderate|rich",
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": ""
  },
  "meal_analysis": {
    "total_prep_time": 0,
    "texture_variety_count": 0,
    "color_palette": [],
    "temperature_progression": [],
    "cultural_coherence": "",
    "estimated_macros": {
      "carbs_percent": 0,
      "protein_percent": 0,
      "fat_percent": 0
    },
    "chef_notes": ""
  }
}

CRITICAL: Respond ONLY with valid JSON. No markdown, no backticks.`;

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        { role: 'system', content: MEAL_PAIRING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseText = response.choices[0]?.message?.content;

    if (!responseText) {
      recordResult({
        testName: 'Cuisine-Based Generation',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'No response from AI',
      });
      return;
    }

    logInfo('Parsing meal plan...');

    const cleanedJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const mealPlan = JSON.parse(cleanedJson);

    // Display generated meal
    console.log('\n🍽️  GENERATED ITALIAN MEAL');
    console.log('━'.repeat(80));
    console.log('🥗 Appetizer:', mealPlan.appetizer.name);
    console.log('   ', mealPlan.appetizer.description);
    console.log('   Rationale:', mealPlan.appetizer.pairing_rationale);
    console.log('');
    console.log('🍝 Main Course:', mealPlan.main.name);
    console.log('   ', mealPlan.main.description);
    console.log(`    Weight: ${mealPlan.main.weight_score}, Richness: ${mealPlan.main.richness_score}`);
    console.log('');
    console.log('🥬 Side Dish:', mealPlan.side.name);
    console.log('   ', mealPlan.side.description);
    console.log('   Rationale:', mealPlan.side.pairing_rationale);
    console.log('');
    console.log('🍰 Dessert:', mealPlan.dessert.name);
    console.log('   ', mealPlan.dessert.description);
    console.log('   Rationale:', mealPlan.dessert.pairing_rationale);
    console.log('━'.repeat(80));

    if (mealPlan.meal_analysis) {
      console.log('\n📊 MEAL ANALYSIS:');
      console.log('Total prep time:', mealPlan.meal_analysis.total_prep_time, 'minutes');
      console.log('Texture variety:', mealPlan.meal_analysis.texture_variety_count, 'textures');
      console.log('Color palette:', mealPlan.meal_analysis.color_palette.join(', '));
      console.log(
        'Temperature progression:',
        mealPlan.meal_analysis.temperature_progression.join(' → ')
      );
      console.log('Cultural coherence:', mealPlan.meal_analysis.cultural_coherence);
      console.log('\n👨\u200d🍳 Chef Notes:', mealPlan.meal_analysis.chef_notes);
    }

    // Validate pairing principles
    console.log('\n🔍 PAIRING PRINCIPLES VALIDATION:');

    const allTextures = new Set([
      ...(mealPlan.appetizer.dominant_textures || []),
      ...(mealPlan.main.dominant_textures || []),
      ...(mealPlan.side.dominant_textures || []),
      ...(mealPlan.dessert.dominant_textures || []),
    ]);

    const textureCheck = allTextures.size >= 6;
    console.log(
      `${textureCheck ? '✅' : '❌'} Texture variety: ${allTextures.size}/6 (${Array.from(allTextures).join(', ')})`
    );

    const temps = [
      mealPlan.appetizer.temperature,
      mealPlan.main.temperature,
      mealPlan.side.temperature,
      mealPlan.dessert.temperature,
    ];
    const tempCheck = temps.every((t) => t);
    console.log(`${tempCheck ? '✅' : '❌'} Temperature progression: ${temps.join(' → ')}`);

    const mainWeight = mealPlan.main.weight_score || 0;
    const appetizerWeight = mealPlan.appetizer.weight_score || 0;

    let weightBalanced = true;
    if (mainWeight >= 4 && appetizerWeight > 2) {
      console.log(
        `⚠️  Weight imbalance: Heavy main (${mainWeight}) with heavy appetizer (${appetizerWeight})`
      );
      weightBalanced = false;
    } else {
      console.log(`✅ Weight balance: Main=${mainWeight}, Appetizer=${appetizerWeight}`);
    }

    const mainRichness = mealPlan.main.richness_score || 0;
    const sideAcidity = mealPlan.side.acidity_score || 0;

    let acidFatBalanced = true;
    if (mainRichness >= 4 && sideAcidity < 3) {
      console.log(
        `⚠️  Acid-fat imbalance: Rich main (${mainRichness}) needs acidic side (${sideAcidity})`
      );
      acidFatBalanced = false;
    } else {
      console.log(`✅ Acid-fat balance: Main richness=${mainRichness}, Side acidity=${sideAcidity}`);
    }

    const allValid = textureCheck && tempCheck && weightBalanced && acidFatBalanced;

    recordResult({
      testName: 'Cuisine-Based Generation',
      status: allValid ? 'PASS' : 'FAIL',
      duration: Date.now() - startTime,
      details: allValid
        ? 'Generated valid Italian meal'
        : 'Generated meal but violated pairing principles',
      evidence: {
        mealPlan,
        validation: {
          textureVariety: allTextures.size,
          temperatureProgression: temps,
          weightBalanced,
          acidFatBalanced,
        },
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'Cuisine-Based Generation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 5: Main-First Generation with Real Recipe
// ============================================================================

async function testMainFirstGeneration() {
  logTest('Test 5: Main-First Meal Generation');

  const startTime = Date.now();
  try {
    logInfo('Finding suitable main dish from database...');

    const mainDishes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.is_system_recipe, true))
      .orderBy(desc(recipes.created_at))
      .limit(10);

    if (mainDishes.length === 0) {
      recordResult({
        testName: 'Main-First Generation',
        status: 'SKIP',
        duration: Date.now() - startTime,
        details: 'No system recipes found in database',
      });
      return;
    }

    const selectedMain = mainDishes[0];
    logInfo(`Selected main: "${selectedMain.name}"`);
    if (selectedMain.weight_score) logInfo(`  Weight: ${selectedMain.weight_score}`);
    if (selectedMain.richness_score) logInfo(`  Richness: ${selectedMain.richness_score}`);

    logInfo('\nGenerating complementary courses...');

    const client = createOpenRouterClient();

    const userPrompt = `Given this main dish, create complementary appetizer, side dish, and dessert:

MAIN DISH: ${selectedMain.name}
${selectedMain.description ? 'Description: ' + selectedMain.description : ''}
${selectedMain.weight_score ? 'Weight: ' + selectedMain.weight_score : ''}
${selectedMain.richness_score ? 'Richness: ' + selectedMain.richness_score : ''}

PAIRING STRATEGY:
- Appetizer should stimulate appetite (light, acidic, or hot)
- Side should balance main's richness and provide texture contrast
- Dessert should provide sweet closure

CONSTRAINTS:
- Servings: 4
- Maximum total prep time: 90 minutes

Use the same JSON format as before. CRITICAL: Respond ONLY with valid JSON.`;

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        { role: 'system', content: MEAL_PAIRING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseText = response.choices[0]?.message?.content;

    if (!responseText) {
      recordResult({
        testName: 'Main-First Generation',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'No response from AI',
      });
      return;
    }

    const cleanedJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const mealPlan = JSON.parse(cleanedJson);

    console.log('\n🍽️  GENERATED MEAL AROUND:', selectedMain.name);
    console.log('━'.repeat(80));
    console.log('🥗 Appetizer:', mealPlan.appetizer.name);
    console.log('   Rationale:', mealPlan.appetizer.pairing_rationale);
    console.log('🍝 Main:', mealPlan.main.name);
    console.log('🥬 Side:', mealPlan.side.name);
    console.log('   Rationale:', mealPlan.side.pairing_rationale);
    console.log('🍰 Dessert:', mealPlan.dessert.name);
    console.log('   Rationale:', mealPlan.dessert.pairing_rationale);

    recordResult({
      testName: 'Main-First Generation',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: `Generated meal around "${selectedMain.name}"`,
      evidence: {
        selectedMainDish: selectedMain.name,
        mealPlan,
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'Main-First Generation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 6: Dietary Restrictions
// ============================================================================

async function testDietaryRestrictions() {
  logTest('Test 6: Dietary Restrictions (Vegetarian)');

  const startTime = Date.now();
  try {
    logInfo('Generating vegetarian meal...');

    const client = createOpenRouterClient();

    const userPrompt = `Create a complete Mediterranean vegetarian meal.

CONSTRAINTS:
- Dietary restrictions: vegetarian (no meat, poultry, or fish)
- Servings: 4
- Maximum total prep time: 90 minutes

Use the same JSON format. CRITICAL: Respond ONLY with valid JSON.`;

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        { role: 'system', content: MEAL_PAIRING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseText = response.choices[0]?.message?.content;

    if (!responseText) {
      recordResult({
        testName: 'Dietary Restrictions',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'No response from AI',
      });
      return;
    }

    const cleanedJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const mealPlan = JSON.parse(cleanedJson);

    console.log('\n🌱 GENERATED VEGETARIAN MEAL:');
    console.log('Appetizer:', mealPlan.appetizer.name);
    console.log('Main:', mealPlan.main.name);
    console.log('Side:', mealPlan.side.name);
    console.log('Dessert:', mealPlan.dessert.name);

    // Check for meat ingredients
    const allIngredients = [
      ...mealPlan.appetizer.key_ingredients,
      ...mealPlan.main.key_ingredients,
      ...mealPlan.side.key_ingredients,
      ...mealPlan.dessert.key_ingredients,
    ]
      .join(' ')
      .toLowerCase();

    const meatKeywords = [
      'chicken',
      'beef',
      'pork',
      'lamb',
      'fish',
      'salmon',
      'tuna',
      'shrimp',
      'meat',
    ];
    const hasMeat = meatKeywords.some((keyword) => allIngredients.includes(keyword));

    if (hasMeat) {
      logFailure('Vegetarian meal contains meat ingredients!');
      recordResult({
        testName: 'Dietary Restrictions',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Vegetarian restriction violated',
      });
    } else {
      logSuccess('Vegetarian meal validated');
      recordResult({
        testName: 'Dietary Restrictions',
        status: 'PASS',
        duration: Date.now() - startTime,
        details: 'Dietary restrictions respected',
        evidence: { mealPlan },
      });
    }
  } catch (error: any) {
    recordResult({
      testName: 'Dietary Restrictions',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║      MEAL PAIRING SYSTEM - COMPREHENSIVE TEST SUITE                      ║'
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════════════════╝\n'
  );

  const overallStart = Date.now();

  await testEnvironmentSetup();
  await testDatabaseMetadata();
  await testOpenRouterAPI();
  await testCuisineMealGeneration();
  await testMainFirstGeneration();
  await testDietaryRestrictions();

  const overallDuration = Date.now() - overallStart;

  // Generate Test Report
  console.log(
    '\n\n╔═══════════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║                           TEST REPORT                                     ║'
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════════════════╝\n'
  );

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(
    `⏱️  Total Duration: ${overallDuration}ms (${(overallDuration / 1000).toFixed(2)}s)\n`
  );

  console.log('DETAILED RESULTS:\n');
  results.forEach((result, index) => {
    const statusIcon =
      result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${index + 1}. ${statusIcon} ${result.testName}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Details: ${result.details}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  // Save report
  const fs = await import('fs/promises');
  const reportDir = join(process.cwd(), 'tmp');
  await fs.mkdir(reportDir, { recursive: true });

  const reportPath = join(reportDir, 'meal-pairing-test-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      duration: overallDuration,
      successRate: `${((passed / results.length) * 100).toFixed(1)}%`,
    },
    results,
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`📄 Detailed report saved to: ${reportPath}\n`);

  // Close database pool
  await pool.end();

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch((error) => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
