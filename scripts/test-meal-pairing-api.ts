/**
 * Meal Pairing System - API-Based Test Suite
 *
 * Tests via direct function calls (bypassing server-only restrictions)
 * and database queries for comprehensive validation.
 *
 * @version 1.0.0
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { getOpenRouterClient } from '@/lib/ai/openrouter-server';
import { renderPrompt } from '@/lib/ai/prompts';
import { generateMealByCuisine } from '@/lib/ai/prompts/meal-pairing';

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
// Test 1: Database Schema Verification
// ============================================================================

async function testDatabaseSchema() {
  logTest('Test 1: Database Schema - Pairing Metadata Fields');

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

    logInfo(`Found ${recipesWithMetadata.length} recipes with complete pairing metadata`);

    if (recipesWithMetadata.length === 0) {
      logWarning('No recipes with pairing metadata found - semantic search may not work optimally');
    } else {
      console.log('\n📊 Sample recipes with pairing metadata:');
      recipesWithMetadata.slice(0, 5).forEach((recipe) => {
        console.log(`\n  "${recipe.name}"`);
        console.log(
          `    Weight: ${recipe.weight_score}, Richness: ${recipe.richness_score}, Acidity: ${recipe.acidity_score}`
        );
        console.log(`    Temperature: ${recipe.serving_temperature || 'N/A'}`);
        if (recipe.dominant_textures) {
          try {
            const textures = JSON.parse(recipe.dominant_textures);
            console.log(`    Textures: ${textures.join(', ')}`);
          } catch {
            console.log(`    Textures: ${recipe.dominant_textures}`);
          }
        }
        if (recipe.pairing_rationale) {
          console.log(`    Rationale: ${recipe.pairing_rationale.substring(0, 80)}...`);
        }
      });
    }

    // Test specific queries
    logInfo('\n\nTesting pairing metadata queries...');

    // Query 1: Light appetizers
    const allRecipes = await db
      .select()
      .from(recipes)
      .where(and(isNotNull(recipes.weight_score), isNotNull(recipes.acidity_score)))
      .limit(100);

    const lightAppetizers = allRecipes.filter((r) => r.weight_score! <= 2 && r.acidity_score! >= 3);
    logInfo(`✓ Light, acidic appetizers: ${lightAppetizers.length}`);

    // Query 2: Rich main dishes
    const richMains = allRecipes.filter((r) => r.richness_score && r.richness_score >= 4);
    logInfo(`✓ Rich main dishes (richness >= 4): ${richMains.length}`);

    // Query 3: Temperature distribution
    const hotDishes = allRecipes.filter((r) => r.serving_temperature === 'hot');
    const coldDishes = allRecipes.filter((r) => r.serving_temperature === 'cold');
    const roomDishes = allRecipes.filter((r) => r.serving_temperature === 'room');

    logInfo(`✓ Hot dishes: ${hotDishes.length}`);
    logInfo(`✓ Cold dishes: ${coldDishes.length}`);
    logInfo(`✓ Room temperature dishes: ${roomDishes.length}`);

    recordResult({
      testName: 'Database Schema Verification',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: `Found ${recipesWithMetadata.length} recipes with pairing metadata`,
      evidence: {
        totalWithMetadata: recipesWithMetadata.length,
        lightAppetizers: lightAppetizers.length,
        richMains: richMains.length,
        temperatureDistribution: {
          hot: hotDishes.length,
          cold: coldDishes.length,
          room: roomDishes.length,
        },
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'Database Schema Verification',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 2: OpenRouter Integration
// ============================================================================

async function testOpenRouterIntegration() {
  logTest('Test 2: OpenRouter Integration');

  const startTime = Date.now();
  try {
    logInfo('Checking OpenRouter API key...');

    if (!process.env.OPENROUTER_API_KEY) {
      recordResult({
        testName: 'OpenRouter Integration',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'OPENROUTER_API_KEY not found in environment',
      });
      return;
    }

    logSuccess('OpenRouter API key found');

    logInfo('Testing OpenRouter client initialization...');
    const client = getOpenRouterClient();

    if (!client) {
      recordResult({
        testName: 'OpenRouter Integration',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Failed to initialize OpenRouter client',
      });
      return;
    }

    logSuccess('OpenRouter client initialized');

    logInfo('Testing simple API call...');

    const testResponse = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: 'Respond with exactly: "API test successful"',
        },
      ],
      max_tokens: 50,
    });

    const responseText = testResponse.choices[0]?.message?.content || '';
    logInfo(`Response: ${responseText}`);

    if (responseText.toLowerCase().includes('successful')) {
      logSuccess('OpenRouter API call successful');
    }

    recordResult({
      testName: 'OpenRouter Integration',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: 'OpenRouter client functional',
      evidence: {
        apiKeyPresent: true,
        clientInitialized: true,
        apiCallSuccessful: true,
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'OpenRouter Integration',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 3: Prompt System
// ============================================================================

async function testPromptSystem() {
  logTest('Test 3: Prompt System - Meal Pairing Templates');

  const startTime = Date.now();
  try {
    logInfo('Testing prompt rendering...');

    const variables = {
      cuisine: 'Italian',
      dietaryRestrictions: 'vegetarian',
      timeLimit: '90',
      servings: '4',
      databaseContext: 'No database context for test',
    };

    const rendered = renderPrompt(generateMealByCuisine, { variables });

    logInfo('Prompt template rendered successfully');
    console.log('\n📝 Rendered Prompt Sample:');
    console.log('System:', rendered.system.substring(0, 200) + '...');
    console.log('User:', rendered.user.substring(0, 300) + '...');
    console.log('Model:', rendered.config.model);
    console.log('Temperature:', rendered.config.temperature);

    if (!rendered.system || !rendered.user) {
      recordResult({
        testName: 'Prompt System',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Rendered prompt missing system or user content',
      });
      return;
    }

    // Verify key pairing principles are in system prompt
    const systemContent = rendered.system.toLowerCase();
    const requiredPrinciples = [
      'weight',
      'acid',
      'texture',
      'temperature',
      'flavor',
      'balance',
    ];

    const missingPrinciples = requiredPrinciples.filter(
      (principle) => !systemContent.includes(principle)
    );

    if (missingPrinciples.length > 0) {
      logWarning(`Missing pairing principles in system prompt: ${missingPrinciples.join(', ')}`);
    } else {
      logSuccess('All core pairing principles present in system prompt');
    }

    recordResult({
      testName: 'Prompt System',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: 'Prompt rendering successful',
      evidence: {
        systemPromptLength: rendered.system.length,
        userPromptLength: rendered.user.length,
        missingPrinciples: missingPrinciples.length,
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'Prompt System',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 4: End-to-End Meal Generation (Simplified)
// ============================================================================

async function testE2EMealGeneration() {
  logTest('Test 4: End-to-End Meal Generation');

  const startTime = Date.now();
  try {
    logInfo('Generating Italian meal via direct OpenRouter call...');

    const client = getOpenRouterClient();

    const variables = {
      cuisine: 'Italian',
      dietaryRestrictions: 'None',
      timeLimit: '90',
      servings: '4',
      databaseContext: '\n\nDATABASE CONTEXT: Using system recipes when appropriate.',
    };

    const rendered = renderPrompt(generateMealByCuisine, { variables });

    const response = await client.chat.completions.create({
      model: rendered.config.model,
      messages: [
        { role: 'system', content: rendered.system },
        { role: 'user', content: rendered.user },
      ],
      temperature: rendered.config.temperature,
      max_tokens: rendered.config.maxTokens,
      response_format: { type: 'json_object' },
    });

    const responseText = response.choices[0]?.message?.content;

    if (!responseText) {
      recordResult({
        testName: 'E2E Meal Generation',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'No response from AI',
      });
      return;
    }

    logInfo('Parsing AI response...');

    // Clean and parse JSON
    const cleanedJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const mealPlan = JSON.parse(cleanedJson);

    // Validate structure
    const requiredCourses = ['appetizer', 'main', 'side', 'dessert'];
    const missingCourses = requiredCourses.filter((course) => !mealPlan[course]);

    if (missingCourses.length > 0) {
      recordResult({
        testName: 'E2E Meal Generation',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: `Missing courses: ${missingCourses.join(', ')}`,
      });
      return;
    }

    // Log generated meal
    console.log('\n🍽️  GENERATED ITALIAN MEAL:');
    console.log('━'.repeat(80));
    console.log('🥗 Appetizer:', mealPlan.appetizer.name);
    console.log('   ', mealPlan.appetizer.description);
    console.log('   Pairing rationale:', mealPlan.appetizer.pairing_rationale);
    console.log('');
    console.log('🍝 Main Course:', mealPlan.main.name);
    console.log('   ', mealPlan.main.description);
    console.log('   Weight:', mealPlan.main.weight_score, '| Richness:', mealPlan.main.richness_score);
    console.log('');
    console.log('🥬 Side Dish:', mealPlan.side.name);
    console.log('   ', mealPlan.side.description);
    console.log('   Pairing rationale:', mealPlan.side.pairing_rationale);
    console.log('');
    console.log('🍰 Dessert:', mealPlan.dessert.name);
    console.log('   ', mealPlan.dessert.description);
    console.log('   Pairing rationale:', mealPlan.dessert.pairing_rationale);
    console.log('━'.repeat(80));

    if (mealPlan.meal_analysis) {
      console.log('\n📊 MEAL ANALYSIS:');
      console.log('Total prep time:', mealPlan.meal_analysis.total_prep_time, 'minutes');
      console.log('Texture variety:', mealPlan.meal_analysis.texture_variety_count, 'unique textures');
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

    // Texture variety
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

    // Temperature progression
    const temps = [
      mealPlan.appetizer.temperature,
      mealPlan.main.temperature,
      mealPlan.side.temperature,
      mealPlan.dessert.temperature,
    ];
    const tempCheck = temps.every((t) => t);
    console.log(
      `${tempCheck ? '✅' : '❌'} Temperature progression: ${temps.join(' → ')}`
    );

    // Weight balance
    const mainWeight = mealPlan.main.weight_score || 0;
    const appetizerWeight = mealPlan.appetizer.weight_score || 0;
    const sideWeight = mealPlan.side.weight_score || 0;

    let weightBalanced = true;
    if (mainWeight >= 4 && appetizerWeight > 2) {
      console.log(
        `⚠️  Weight imbalance: Heavy main (${mainWeight}) with heavy appetizer (${appetizerWeight})`
      );
      weightBalanced = false;
    } else {
      console.log(
        `✅ Weight balance: Main=${mainWeight}, Appetizer=${appetizerWeight}, Side=${sideWeight}`
      );
    }

    // Acid-fat balance
    const mainRichness = mealPlan.main.richness_score || 0;
    const sideAcidity = mealPlan.side.acidity_score || 0;

    let acidFatBalanced = true;
    if (mainRichness >= 4 && sideAcidity < 3) {
      console.log(
        `⚠️  Acid-fat imbalance: Rich main (${mainRichness}) needs more acidic side (${sideAcidity})`
      );
      acidFatBalanced = false;
    } else {
      console.log(
        `✅ Acid-fat balance: Main richness=${mainRichness}, Side acidity=${sideAcidity}`
      );
    }

    const allValidationsPassed = textureCheck && tempCheck && weightBalanced && acidFatBalanced;

    recordResult({
      testName: 'E2E Meal Generation',
      status: allValidationsPassed ? 'PASS' : 'FAIL',
      duration: Date.now() - startTime,
      details: allValidationsPassed
        ? 'Generated valid Italian meal with balanced pairing'
        : 'Generated meal but pairing principles violated',
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
      testName: 'E2E Meal Generation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 5: Recipe Database Search
// ============================================================================

async function testRecipeSearch() {
  logTest('Test 5: Recipe Database - Search for Main Dishes');

  const startTime = Date.now();
  try {
    logInfo('Searching for system recipes suitable as main dishes...');

    const mainDishes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.is_system_recipe, true))
      .orderBy(desc(recipes.created_at))
      .limit(20);

    logInfo(`Found ${mainDishes.length} system recipes`);

    if (mainDishes.length === 0) {
      recordResult({
        testName: 'Recipe Database Search',
        status: 'SKIP',
        duration: Date.now() - startTime,
        details: 'No system recipes found in database',
      });
      return;
    }

    console.log('\n📚 Sample system recipes:');
    mainDishes.slice(0, 5).forEach((recipe, index) => {
      console.log(`\n${index + 1}. ${recipe.name}`);
      console.log(`   ID: ${recipe.id}`);
      console.log(`   Cuisine: ${recipe.cuisine || 'N/A'}`);
      console.log(`   Description: ${recipe.description?.substring(0, 100) || 'N/A'}...`);
      if (recipe.weight_score) console.log(`   Weight: ${recipe.weight_score}`);
      if (recipe.richness_score) console.log(`   Richness: ${recipe.richness_score}`);
    });

    // Test if we can use one as a main dish input
    const selectedRecipe = mainDishes[0];
    logInfo(`\n\n✓ Selected recipe for main-first test: "${selectedRecipe.name}"`);

    recordResult({
      testName: 'Recipe Database Search',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: `Found ${mainDishes.length} system recipes`,
      evidence: {
        totalRecipes: mainDishes.length,
        sampleRecipe: {
          name: selectedRecipe.name,
          cuisine: selectedRecipe.cuisine,
          hasMetadata:
            selectedRecipe.weight_score !== null && selectedRecipe.richness_score !== null,
        },
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'Recipe Database Search',
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
    '║         MEAL PAIRING SYSTEM - API-BASED TEST SUITE                       ║'
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════════════════╝\n'
  );

  const overallStart = Date.now();

  // Run tests sequentially
  await testDatabaseSchema();
  await testOpenRouterIntegration();
  await testPromptSystem();
  await testE2EMealGeneration();
  await testRecipeSearch();

  const overallDuration = Date.now() - overallStart;

  // ============================================================================
  // Generate Test Report
  // ============================================================================

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
  console.log(`⏱️  Total Duration: ${overallDuration}ms (${(overallDuration / 1000).toFixed(2)}s)\n`);

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

  // Save detailed report to file
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

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
