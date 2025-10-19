/**
 * Meal Pairing System - Comprehensive Test Suite
 *
 * Tests all aspects of the meal pairing implementation:
 * - Cuisine-based generation
 * - Main-first generation
 * - Dietary restrictions
 * - Server actions with authentication
 * - Database queries and metadata
 *
 * @version 1.0.0
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

import { generateMeal } from '@/lib/ai/meal-pairing-engine';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

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

function validateMealPlan(mealPlan: any): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check required courses
  if (!mealPlan.appetizer) issues.push('Missing appetizer');
  if (!mealPlan.main) issues.push('Missing main course');
  if (!mealPlan.side) issues.push('Missing side dish');
  if (!mealPlan.dessert) issues.push('Missing dessert');
  if (!mealPlan.meal_analysis) issues.push('Missing meal analysis');

  // Check course structure
  ['appetizer', 'main', 'side', 'dessert'].forEach((course) => {
    if (mealPlan[course]) {
      if (!mealPlan[course].name) issues.push(`${course} missing name`);
      if (!mealPlan[course].description) issues.push(`${course} missing description`);
      if (!mealPlan[course].dominant_textures || mealPlan[course].dominant_textures.length === 0) {
        issues.push(`${course} missing textures`);
      }
      if (!mealPlan[course].temperature) issues.push(`${course} missing temperature`);
      if (typeof mealPlan[course].prep_time_minutes !== 'number') {
        issues.push(`${course} missing prep time`);
      }
      if (!mealPlan[course].key_ingredients || mealPlan[course].key_ingredients.length === 0) {
        issues.push(`${course} missing ingredients`);
      }
      if (!mealPlan[course].pairing_rationale) issues.push(`${course} missing pairing rationale`);
    }
  });

  // Check meal analysis
  if (mealPlan.meal_analysis) {
    const analysis = mealPlan.meal_analysis;
    if (typeof analysis.total_prep_time !== 'number') issues.push('Missing total prep time');
    if (typeof analysis.texture_variety_count !== 'number') issues.push('Missing texture count');
    if (!analysis.color_palette || analysis.color_palette.length === 0) {
      issues.push('Missing color palette');
    }
    if (!analysis.temperature_progression || analysis.temperature_progression.length === 0) {
      issues.push('Missing temperature progression');
    }
    if (!analysis.cultural_coherence) issues.push('Missing cultural coherence');
    if (!analysis.estimated_macros) issues.push('Missing macros');
    if (!analysis.chef_notes) issues.push('Missing chef notes');
  }

  return { valid: issues.length === 0, issues };
}

function validatePairingPrinciples(mealPlan: any): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check texture variety (minimum 6 unique textures)
  const allTextures = new Set([
    ...(mealPlan.appetizer?.dominant_textures || []),
    ...(mealPlan.main?.dominant_textures || []),
    ...(mealPlan.side?.dominant_textures || []),
    ...(mealPlan.dessert?.dominant_textures || []),
  ]);

  if (allTextures.size < 6) {
    issues.push(`Insufficient texture variety: ${allTextures.size}/6 (found: ${Array.from(allTextures).join(', ')})`);
  }

  // Check temperature progression exists
  const temps = [
    mealPlan.appetizer?.temperature,
    mealPlan.main?.temperature,
    mealPlan.side?.temperature,
    mealPlan.dessert?.temperature,
  ].filter(Boolean);

  if (temps.length < 4) {
    issues.push('Incomplete temperature progression');
  }

  // Check weight balance (if main is heavy, appetizer and side should be light)
  if (mealPlan.main?.weight_score && mealPlan.main.weight_score >= 4) {
    if (mealPlan.appetizer?.weight_score && mealPlan.appetizer.weight_score > 2) {
      issues.push('Heavy main paired with heavy appetizer (violates weight balance)');
    }
    if (mealPlan.side?.weight_score && mealPlan.side.weight_score > 2) {
      logWarning('Heavy main paired with heavy side (potential weight imbalance)');
    }
  }

  // Check acid-fat balance (rich main should have acidic side)
  if (mealPlan.main?.richness_score && mealPlan.main.richness_score >= 4) {
    if (mealPlan.side?.acidity_score && mealPlan.side.acidity_score < 3) {
      logWarning('Rich main without adequate acidic side (acid-fat balance rule)');
    }
  }

  return { valid: issues.length === 0, issues };
}

// ============================================================================
// Test 1: Cuisine-Based Meal Generation (Italian, 4 servings)
// ============================================================================

async function testCuisineBasedGeneration() {
  logTest('Test 1: Cuisine-Based Meal Generation (Italian)');

  const startTime = Date.now();
  try {
    logInfo('Requesting Italian meal for 4 servings...');

    const result = await generateMeal({
      cuisine: 'Italian',
      servings: 4,
      maxTime: 120,
    });

    if (!result.success) {
      recordResult({
        testName: 'Cuisine-Based Generation',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Generation failed',
        error: result.error,
      });
      return;
    }

    const mealPlan = result.mealPlan!;

    // Log generated meal
    console.log('\n📋 GENERATED ITALIAN MEAL:');
    console.log('Appetizer:', mealPlan.appetizer.name);
    console.log('Main:', mealPlan.main.name);
    console.log('Side:', mealPlan.side.name);
    console.log('Dessert:', mealPlan.dessert.name);
    console.log('\n📊 MEAL ANALYSIS:');
    console.log('Total prep time:', mealPlan.meal_analysis.total_prep_time, 'minutes');
    console.log('Texture variety:', mealPlan.meal_analysis.texture_variety_count, 'textures');
    console.log('Color palette:', mealPlan.meal_analysis.color_palette.join(', '));
    console.log('Temperature progression:', mealPlan.meal_analysis.temperature_progression.join(' → '));
    console.log('Cultural coherence:', mealPlan.meal_analysis.cultural_coherence);
    console.log('Chef notes:', mealPlan.meal_analysis.chef_notes);

    // Validate structure
    const structureValidation = validateMealPlan(mealPlan);
    if (!structureValidation.valid) {
      recordResult({
        testName: 'Cuisine-Based Generation',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Structure validation failed',
        error: structureValidation.issues.join('; '),
        evidence: mealPlan,
      });
      return;
    }

    // Validate pairing principles
    const pairingValidation = validatePairingPrinciples(mealPlan);
    if (!pairingValidation.valid) {
      logWarning('Pairing principle violations detected:');
      pairingValidation.issues.forEach((issue) => console.log(`  - ${issue}`));
    }

    // Check for recipe links
    const linkedCourses = [
      mealPlan.appetizer,
      mealPlan.main,
      mealPlan.side,
      mealPlan.dessert,
    ].filter((course) => course.recipe_id);

    logInfo(`Linked ${linkedCourses.length}/4 courses to database recipes`);
    linkedCourses.forEach((course) => {
      console.log(`  - ${course.name} → recipe_id: ${course.recipe_id}`);
    });

    recordResult({
      testName: 'Cuisine-Based Generation',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: `Generated Italian meal with ${linkedCourses.length}/4 recipe links`,
      evidence: {
        mealPlan,
        structureValid: true,
        pairingValid: pairingValidation.valid,
        linkedRecipes: linkedCourses.length,
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
// Test 2: Main-First Meal Generation
// ============================================================================

async function testMainFirstGeneration() {
  logTest('Test 2: Main-First Meal Generation');

  const startTime = Date.now();
  try {
    // First, find a main dish in the database
    logInfo('Searching for main dishes in database...');

    const mainDishes = await db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.is_system_recipe, true),
          isNotNull(recipes.weight_score) // Prefer recipes with pairing metadata
        )
      )
      .limit(10);

    if (mainDishes.length === 0) {
      recordResult({
        testName: 'Main-First Generation',
        status: 'SKIP',
        duration: Date.now() - startTime,
        details: 'No recipes with pairing metadata found in database',
      });
      return;
    }

    // Select a recipe to use as main dish
    const selectedMain = mainDishes[0];
    logInfo(`Selected main dish: "${selectedMain.name}"`);
    if (selectedMain.weight_score) logInfo(`  Weight score: ${selectedMain.weight_score}`);
    if (selectedMain.richness_score) logInfo(`  Richness score: ${selectedMain.richness_score}`);

    logInfo('\nGenerating complementary courses...');

    const result = await generateMeal({
      mainDish: selectedMain.name,
      servings: 4,
      maxTime: 90,
    });

    if (!result.success) {
      recordResult({
        testName: 'Main-First Generation',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Generation failed',
        error: result.error,
      });
      return;
    }

    const mealPlan = result.mealPlan!;

    // Log generated meal
    console.log('\n📋 GENERATED MEAL AROUND:', selectedMain.name);
    console.log('Appetizer:', mealPlan.appetizer.name);
    console.log('  Rationale:', mealPlan.appetizer.pairing_rationale);
    console.log('Main:', mealPlan.main.name);
    console.log('Side:', mealPlan.side.name);
    console.log('  Rationale:', mealPlan.side.pairing_rationale);
    console.log('Dessert:', mealPlan.dessert.name);
    console.log('  Rationale:', mealPlan.dessert.pairing_rationale);

    // Validate structure and pairing
    const structureValidation = validateMealPlan(mealPlan);
    const pairingValidation = validatePairingPrinciples(mealPlan);

    if (!structureValidation.valid) {
      recordResult({
        testName: 'Main-First Generation',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Structure validation failed',
        error: structureValidation.issues.join('; '),
      });
      return;
    }

    // Check weight balance specifically
    if (selectedMain.weight_score && mealPlan.main.weight_score) {
      logInfo(`\n⚖️  WEIGHT BALANCE CHECK:`);
      logInfo(`Database main weight: ${selectedMain.weight_score}`);
      logInfo(`Generated main weight: ${mealPlan.main.weight_score}`);
      logInfo(`Appetizer weight: ${mealPlan.appetizer.weight_score || 'N/A'}`);
      logInfo(`Side weight: ${mealPlan.side.weight_score || 'N/A'}`);
    }

    recordResult({
      testName: 'Main-First Generation',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: `Generated meal around "${selectedMain.name}"`,
      evidence: {
        selectedMainDish: selectedMain.name,
        mealPlan,
        pairingValid: pairingValidation.valid,
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
// Test 3: Dietary Restrictions
// ============================================================================

async function testDietaryRestrictions() {
  logTest('Test 3: Dietary Restrictions (Vegetarian, Vegan, Gluten-Free)');

  const startTime = Date.now();
  const subTests: { restriction: string[]; passed: boolean }[] = [];

  try {
    // Test 3a: Vegetarian
    logInfo('\n🌱 Testing vegetarian restriction...');
    const vegResult = await generateMeal({
      cuisine: 'Mediterranean',
      dietary: ['vegetarian'],
      servings: 4,
    });

    if (vegResult.success) {
      const mealPlan = vegResult.mealPlan!;
      logInfo('Generated vegetarian meal:');
      console.log('  Appetizer:', mealPlan.appetizer.name);
      console.log('  Main:', mealPlan.main.name);
      console.log('  Side:', mealPlan.side.name);
      console.log('  Dessert:', mealPlan.dessert.name);

      // Manual check for vegetarian compliance
      const allIngredients = [
        ...mealPlan.appetizer.key_ingredients,
        ...mealPlan.main.key_ingredients,
        ...mealPlan.side.key_ingredients,
        ...mealPlan.dessert.key_ingredients,
      ].join(' ').toLowerCase();

      const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'meat'];
      const hasMeat = meatKeywords.some((keyword) => allIngredients.includes(keyword));

      if (hasMeat) {
        logFailure('Vegetarian meal contains meat ingredients!');
        subTests.push({ restriction: ['vegetarian'], passed: false });
      } else {
        logSuccess('Vegetarian meal validated');
        subTests.push({ restriction: ['vegetarian'], passed: true });
      }
    } else {
      logFailure(`Vegetarian generation failed: ${vegResult.error}`);
      subTests.push({ restriction: ['vegetarian'], passed: false });
    }

    // Test 3b: Vegan
    logInfo('\n🥗 Testing vegan restriction...');
    const veganResult = await generateMeal({
      cuisine: 'Asian',
      dietary: ['vegan'],
      servings: 4,
    });

    if (veganResult.success) {
      const mealPlan = veganResult.mealPlan!;
      logInfo('Generated vegan meal:');
      console.log('  Main:', mealPlan.main.name);

      const allIngredients = [
        ...mealPlan.appetizer.key_ingredients,
        ...mealPlan.main.key_ingredients,
        ...mealPlan.side.key_ingredients,
        ...mealPlan.dessert.key_ingredients,
      ].join(' ').toLowerCase();

      const animalKeywords = [
        'chicken',
        'beef',
        'pork',
        'fish',
        'egg',
        'dairy',
        'milk',
        'cheese',
        'butter',
        'cream',
        'honey',
      ];
      const hasAnimalProducts = animalKeywords.some((keyword) => allIngredients.includes(keyword));

      if (hasAnimalProducts) {
        logFailure('Vegan meal contains animal products!');
        subTests.push({ restriction: ['vegan'], passed: false });
      } else {
        logSuccess('Vegan meal validated');
        subTests.push({ restriction: ['vegan'], passed: true });
      }
    } else {
      logFailure(`Vegan generation failed: ${veganResult.error}`);
      subTests.push({ restriction: ['vegan'], passed: false });
    }

    // Test 3c: Gluten-Free
    logInfo('\n🌾 Testing gluten-free restriction...');
    const gfResult = await generateMeal({
      cuisine: 'Mexican',
      dietary: ['gluten-free'],
      servings: 4,
    });

    if (gfResult.success) {
      const mealPlan = gfResult.mealPlan!;
      logInfo('Generated gluten-free meal:');
      console.log('  Main:', mealPlan.main.name);

      const allIngredients = [
        ...mealPlan.appetizer.key_ingredients,
        ...mealPlan.main.key_ingredients,
        ...mealPlan.side.key_ingredients,
        ...mealPlan.dessert.key_ingredients,
      ].join(' ').toLowerCase();

      const glutenKeywords = ['wheat', 'flour', 'bread', 'pasta', 'noodles', 'barley', 'rye', 'soy sauce'];
      const hasGluten = glutenKeywords.some((keyword) => allIngredients.includes(keyword));

      if (hasGluten) {
        logWarning('Gluten-free meal may contain gluten (check ingredients carefully)');
        subTests.push({ restriction: ['gluten-free'], passed: false });
      } else {
        logSuccess('Gluten-free meal validated');
        subTests.push({ restriction: ['gluten-free'], passed: true });
      }
    } else {
      logFailure(`Gluten-free generation failed: ${gfResult.error}`);
      subTests.push({ restriction: ['gluten-free'], passed: false });
    }

    // Overall result
    const allPassed = subTests.every((t) => t.passed);
    const passedCount = subTests.filter((t) => t.passed).length;

    recordResult({
      testName: 'Dietary Restrictions',
      status: allPassed ? 'PASS' : 'FAIL',
      duration: Date.now() - startTime,
      details: `${passedCount}/${subTests.length} dietary restrictions validated`,
      evidence: subTests,
    });
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
// Test 4: Database Queries and Pairing Metadata
// ============================================================================

async function testDatabaseQueries() {
  logTest('Test 4: Database Queries and Pairing Metadata');

  const startTime = Date.now();
  try {
    // Query 1: Find all recipes with pairing metadata
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

    if (recipesWithMetadata.length > 0) {
      console.log('\n📊 Sample recipes with pairing metadata:');
      recipesWithMetadata.slice(0, 5).forEach((recipe) => {
        console.log(`\n  "${recipe.name}"`);
        console.log(`    Weight: ${recipe.weight_score}, Richness: ${recipe.richness_score}, Acidity: ${recipe.acidity_score}`);
        console.log(`    Temperature: ${recipe.serving_temperature}`);
        if (recipe.dominant_textures) {
          const textures = JSON.parse(recipe.dominant_textures);
          console.log(`    Textures: ${textures.join(', ')}`);
        }
      });
    }

    // Query 2: Find light appetizers (weight <= 2, acidity >= 3)
    logInfo('\n\nQuerying light, acidic appetizers...');

    const lightAppetizers = await db
      .select()
      .from(recipes)
      .where(
        and(
          isNotNull(recipes.weight_score),
          isNotNull(recipes.acidity_score),
          eq(recipes.is_system_recipe, true)
        )
      )
      .limit(50);

    const filteredAppetizers = lightAppetizers.filter(
      (r) => r.weight_score! <= 2 && r.acidity_score! >= 3
    );

    logInfo(`Found ${filteredAppetizers.length} light, acidic appetizers`);

    if (filteredAppetizers.length > 0) {
      filteredAppetizers.slice(0, 3).forEach((recipe) => {
        console.log(`  - ${recipe.name} (W:${recipe.weight_score}, A:${recipe.acidity_score})`);
      });
    }

    // Query 3: Find rich main dishes (richness >= 4)
    logInfo('\n\nQuerying rich main dishes...');

    const allRecipes = await db
      .select()
      .from(recipes)
      .where(
        and(isNotNull(recipes.richness_score), eq(recipes.is_system_recipe, true))
      )
      .limit(50);

    const richMains = allRecipes.filter((r) => r.richness_score! >= 4);

    logInfo(`Found ${richMains.length} rich main dishes`);

    if (richMains.length > 0) {
      richMains.slice(0, 3).forEach((recipe) => {
        console.log(`  - ${recipe.name} (R:${recipe.richness_score})`);
      });
    }

    // Query 4: Check temperature distribution
    logInfo('\n\nAnalyzing serving temperature distribution...');

    const hotDishes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.serving_temperature, 'hot'))
      .limit(1);

    const coldDishes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.serving_temperature, 'cold'))
      .limit(1);

    const roomDishes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.serving_temperature, 'room'))
      .limit(1);

    console.log(`  Hot dishes: ${hotDishes.length > 0 ? '✓' : '✗'}`);
    console.log(`  Cold dishes: ${coldDishes.length > 0 ? '✓' : '✗'}`);
    console.log(`  Room temperature: ${roomDishes.length > 0 ? '✓' : '✗'}`);

    recordResult({
      testName: 'Database Queries',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: `Queried pairing metadata successfully`,
      evidence: {
        recipesWithMetadata: recipesWithMetadata.length,
        lightAppetizers: filteredAppetizers.length,
        richMains: richMains.length,
        temperatureDistribution: {
          hot: hotDishes.length > 0,
          cold: coldDishes.length > 0,
          room: roomDishes.length > 0,
        },
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'Database Queries',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Exception thrown',
      error: error.message,
    });
  }
}

// ============================================================================
// Test 5: Performance and Error Handling
// ============================================================================

async function testPerformanceAndErrors() {
  logTest('Test 5: Performance and Error Handling');

  const startTime = Date.now();
  try {
    // Test 5a: Invalid input handling
    logInfo('Testing invalid input handling...');

    const invalidResult = await generateMeal({
      // No cuisine, theme, or main dish
      servings: 4,
    });

    if (invalidResult.success) {
      logInfo('Freestyle mode worked with minimal input');
    } else {
      logInfo(`Rejected invalid input: ${invalidResult.error}`);
    }

    // Test 5b: Performance check (generation time)
    logInfo('\nTesting generation performance...');

    const perfStart = Date.now();
    const perfResult = await generateMeal({
      cuisine: 'French',
      servings: 2,
    });
    const perfDuration = Date.now() - perfStart;

    if (perfResult.success) {
      logInfo(`Generation time: ${perfDuration}ms`);
      if (perfDuration < 10000) {
        logSuccess('Performance acceptable (< 10s)');
      } else {
        logWarning('Performance slow (> 10s)');
      }
    }

    recordResult({
      testName: 'Performance and Error Handling',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: `Generation time: ${perfDuration}ms`,
      evidence: {
        generationTime: perfDuration,
        invalidInputHandled: !invalidResult.success,
      },
    });
  } catch (error: any) {
    recordResult({
      testName: 'Performance and Error Handling',
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
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║         MEAL PAIRING SYSTEM - COMPREHENSIVE TEST SUITE                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

  const overallStart = Date.now();

  // Run tests sequentially
  await testCuisineBasedGeneration();
  await testMainFirstGeneration();
  await testDietaryRestrictions();
  await testDatabaseQueries();
  await testPerformanceAndErrors();

  const overallDuration = Date.now() - overallStart;

  // ============================================================================
  // Generate Test Report
  // ============================================================================

  console.log('\n\n╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           TEST REPORT                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`⏱️  Total Duration: ${overallDuration}ms\n`);

  console.log('DETAILED RESULTS:\n');
  results.forEach((result, index) => {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${index + 1}. ${statusIcon} ${result.testName}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Details: ${result.details}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  // Save detailed report to file
  const reportPath = join(process.cwd(), 'tmp', 'meal-pairing-test-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      duration: overallDuration,
    },
    results,
  };

  const fs = await import('fs/promises');
  await fs.mkdir(join(process.cwd(), 'tmp'), { recursive: true });
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
