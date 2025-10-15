#!/usr/bin/env tsx
/**
 * Test Script for Embedding Generation and Database Operations
 *
 * This script tests:
 * 1. Single embedding generation
 * 2. Batch embedding generation
 * 3. Recipe-specific embedding generation
 * 4. Similarity calculations
 * 5. Database save/retrieve operations
 * 6. Vector similarity search
 *
 * Usage:
 *   npm run tsx scripts/test-embeddings.ts
 *   or
 *   npx tsx scripts/test-embeddings.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  generateRecipeEmbedding,
  buildRecipeEmbeddingText,
  cosineSimilarity,
  findSimilar,
  EmbeddingError,
} from '../src/lib/ai/embeddings';
import {
  saveRecipeEmbedding,
  getRecipeEmbedding,
  deleteRecipeEmbedding,
  findSimilarRecipes,
  countRecipeEmbeddings,
  getRecipesNeedingEmbedding,
  EmbeddingDatabaseError,
} from '../src/lib/db/embeddings';
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Test configuration
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');
const SKIP_API = process.argv.includes('--skip-api');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logTest(testName: string) {
  log(`\n→ ${testName}`, 'cyan');
}

function logSuccess(message: string) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`  ✗ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`  ! ${message}`, 'yellow');
}

function logInfo(message: string) {
  if (VERBOSE) {
    log(`    ${message}`, 'blue');
  }
}

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
};

async function runTest(
  name: string,
  testFn: () => Promise<void>,
  skipCondition?: boolean
): Promise<void> {
  logTest(name);

  if (skipCondition) {
    logWarning('Skipped');
    testResults.skipped++;
    return;
  }

  try {
    await testFn();
    logSuccess('Passed');
    testResults.passed++;
  } catch (error: any) {
    logError(`Failed: ${error.message}`);
    if (VERBOSE && error.stack) {
      console.error(error.stack);
    }
    testResults.failed++;
  }
}

// Test sample data
const sampleRecipes = [
  {
    name: 'Spaghetti Carbonara',
    description: 'Classic Italian pasta with eggs, cheese, and pancetta',
    cuisine: 'Italian',
    tags: JSON.stringify(['pasta', 'italian', 'comfort-food']),
    ingredients: JSON.stringify([
      '400g spaghetti',
      '200g pancetta',
      '4 eggs',
      '100g parmesan cheese',
      'black pepper',
      'salt',
    ]),
    instructions: JSON.stringify([
      'Boil pasta in salted water',
      'Fry pancetta until crispy',
      'Mix eggs with grated cheese',
      'Combine everything while hot',
    ]),
  },
  {
    name: 'Chicken Tikka Masala',
    description: 'Creamy Indian curry with tender chicken pieces',
    cuisine: 'Indian',
    tags: JSON.stringify(['curry', 'indian', 'spicy']),
    ingredients: JSON.stringify([
      '500g chicken breast',
      '400ml coconut cream',
      'tikka masala paste',
      'onion',
      'garlic',
      'ginger',
      'tomatoes',
    ]),
    instructions: JSON.stringify([
      'Marinate chicken in tikka paste',
      'Sauté onions, garlic, and ginger',
      'Add chicken and cook through',
      'Add tomatoes and cream, simmer',
    ]),
  },
];

async function testEmbeddingGeneration() {
  logSection('TEST 1: Single Embedding Generation');

  await runTest(
    'Test 1.1: Generate embedding for simple text',
    async () => {
      const text = 'Delicious pasta recipe with tomatoes and basil';
      const embedding = await generateEmbedding(text);

      if (embedding.length !== 384) {
        throw new Error(`Expected 384 dimensions, got ${embedding.length}`);
      }

      logInfo(`Generated embedding with ${embedding.length} dimensions`);
      logInfo(`Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
    },
    SKIP_API
  );

  await runTest(
    'Test 1.2: Validate embedding values are numbers',
    async () => {
      const text = 'Test recipe text';
      const embedding = await generateEmbedding(text);

      if (embedding.some(v => typeof v !== 'number' || isNaN(v))) {
        throw new Error('Embedding contains invalid values');
      }

      logInfo('All embedding values are valid numbers');
    },
    SKIP_API
  );

  await runTest(
    'Test 1.3: Handle empty text error',
    async () => {
      try {
        await generateEmbedding('');
        throw new Error('Should have thrown error for empty text');
      } catch (error) {
        if (!(error instanceof EmbeddingError)) {
          throw new Error('Should throw EmbeddingError');
        }
        logInfo(`Correctly threw error: ${error.message}`);
      }
    },
    SKIP_API
  );

  await runTest(
    'Test 1.4: Test retry mechanism with invalid API key',
    async () => {
      const originalKey = process.env.HUGGINGFACE_API_KEY;
      process.env.HUGGINGFACE_API_KEY = '';

      try {
        await generateEmbedding('test');
        throw new Error('Should have thrown error for missing API key');
      } catch (error) {
        if (!(error instanceof EmbeddingError) || error.code !== 'CONFIG_ERROR') {
          throw new Error('Should throw CONFIG_ERROR');
        }
        logInfo('Correctly handled missing API key');
      } finally {
        process.env.HUGGINGFACE_API_KEY = originalKey;
      }
    },
    SKIP_API
  );
}

async function testBatchProcessing() {
  logSection('TEST 2: Batch Embedding Generation');

  await runTest(
    'Test 2.1: Generate embeddings for multiple texts',
    async () => {
      const texts = [
        'Italian pasta with tomato sauce',
        'Indian curry with chicken',
        'Mexican tacos with beef',
      ];

      const embeddings = await generateEmbeddingsBatch(texts, {
        batchSize: 2,
        delayMs: 500,
        onProgress: (processed, total) => {
          logInfo(`Progress: ${processed}/${total}`);
        },
      });

      if (embeddings.length !== texts.length) {
        throw new Error(`Expected ${texts.length} embeddings, got ${embeddings.length}`);
      }

      embeddings.forEach((emb, idx) => {
        if (emb.length !== 384) {
          throw new Error(`Embedding ${idx} has wrong dimension: ${emb.length}`);
        }
      });

      logInfo(`Generated ${embeddings.length} embeddings successfully`);
    },
    SKIP_API
  );

  await runTest(
    'Test 2.2: Handle empty array',
    async () => {
      const embeddings = await generateEmbeddingsBatch([]);
      if (embeddings.length !== 0) {
        throw new Error('Should return empty array for empty input');
      }
      logInfo('Correctly handled empty input');
    },
    SKIP_API
  );
}

async function testRecipeEmbeddings() {
  logSection('TEST 3: Recipe-Specific Embeddings');

  await runTest(
    'Test 3.1: Build recipe embedding text',
    async () => {
      const recipe: any = {
        id: 'test-1',
        name: 'Test Recipe',
        description: 'A delicious test recipe',
        cuisine: 'International',
        tags: JSON.stringify(['test', 'sample']),
        ingredients: JSON.stringify(['ingredient1', 'ingredient2']),
        difficulty: 'easy',
      };

      const embeddingText = buildRecipeEmbeddingText(recipe);
      logInfo(`Embedding text: "${embeddingText}"`);

      if (!embeddingText.includes('Test Recipe')) {
        throw new Error('Should include recipe name');
      }
      if (!embeddingText.includes('International')) {
        throw new Error('Should include cuisine');
      }
      if (!embeddingText.includes('ingredient1')) {
        throw new Error('Should include ingredients');
      }
    }
  );

  await runTest(
    'Test 3.2: Generate embedding for recipe',
    async () => {
      const recipe: any = {
        id: 'test-2',
        name: 'Pasta Carbonara',
        description: 'Classic Italian pasta',
        cuisine: 'Italian',
        tags: JSON.stringify(['pasta', 'italian']),
        ingredients: JSON.stringify(['spaghetti', 'eggs', 'cheese']),
      };

      const result = await generateRecipeEmbedding(recipe);

      if (result.embedding.length !== 384) {
        throw new Error('Invalid embedding dimension');
      }
      if (!result.embeddingText) {
        throw new Error('Missing embedding text');
      }
      if (result.modelName !== 'sentence-transformers/all-MiniLM-L6-v2') {
        throw new Error('Wrong model name');
      }

      logInfo(`Embedding text length: ${result.embeddingText.length} chars`);
      logInfo(`Model: ${result.modelName}`);
    },
    SKIP_API
  );
}

async function testSimilarityCalculations() {
  logSection('TEST 4: Similarity Calculations');

  await runTest(
    'Test 4.1: Calculate cosine similarity',
    async () => {
      const vec1 = Array(384).fill(0).map(() => Math.random());
      const vec2 = Array(384).fill(0).map(() => Math.random());

      const similarity = cosineSimilarity(vec1, vec2);

      if (similarity < -1 || similarity > 1) {
        throw new Error(`Invalid similarity score: ${similarity}`);
      }

      logInfo(`Similarity between random vectors: ${similarity.toFixed(4)}`);
    }
  );

  await runTest(
    'Test 4.2: Identical vectors have similarity 1',
    async () => {
      const vec = Array(384).fill(0).map(() => Math.random());
      const similarity = cosineSimilarity(vec, vec);

      if (Math.abs(similarity - 1.0) > 0.0001) {
        throw new Error(`Expected similarity ~1.0, got ${similarity}`);
      }

      logInfo(`Similarity of identical vectors: ${similarity.toFixed(6)}`);
    }
  );

  await runTest(
    'Test 4.3: Find similar embeddings',
    async () => {
      const query = Array(384).fill(0).map(() => Math.random());
      const candidates = [
        { id: 1, embedding: query, name: 'Exact match' },
        { id: 2, embedding: Array(384).fill(0).map(() => Math.random()), name: 'Random 1' },
        { id: 3, embedding: Array(384).fill(0).map(() => Math.random()), name: 'Random 2' },
      ];

      const similar = findSimilar(query, candidates, 2);

      if (similar.length !== 2) {
        throw new Error('Should return top 2 results');
      }
      if (similar[0].id !== 1) {
        throw new Error('Most similar should be exact match');
      }

      logInfo(`Top result: "${similar[0].name}" (similarity: ${similar[0].similarity.toFixed(4)})`);
    }
  );
}

async function testDatabaseOperations() {
  logSection('TEST 5: Database Operations');

  let testRecipeId: string | null = null;

  await runTest(
    'Test 5.1: Create test recipe in database',
    async () => {
      const [recipe] = await db.insert(recipes).values({
        userId: 'test-user',
        name: 'Test Embedding Recipe',
        description: 'Recipe for testing embeddings',
        cuisine: 'Test Cuisine',
        tags: JSON.stringify(['test', 'embedding']),
        ingredients: JSON.stringify(['test ingredient 1', 'test ingredient 2']),
        instructions: JSON.stringify(['Test instruction 1']),
        isPublic: false,
      }).returning();

      testRecipeId = recipe.id;
      logInfo(`Created test recipe with ID: ${testRecipeId}`);
    }
  );

  await runTest(
    'Test 5.2: Save embedding to database',
    async () => {
      if (!testRecipeId) throw new Error('No test recipe created');

      const embedding = Array(384).fill(0).map(() => Math.random());
      const embeddingText = 'Test embedding text for recipe';

      const saved = await saveRecipeEmbedding(
        testRecipeId,
        embedding,
        embeddingText
      );

      if (!saved.id) {
        throw new Error('Failed to save embedding');
      }

      logInfo(`Saved embedding with ID: ${saved.id}`);
    },
    SKIP_API
  );

  await runTest(
    'Test 5.3: Retrieve embedding from database',
    async () => {
      if (!testRecipeId) throw new Error('No test recipe created');

      const retrieved = await getRecipeEmbedding(testRecipeId);

      if (!retrieved) {
        throw new Error('Failed to retrieve embedding');
      }
      if (retrieved.embedding.length !== 384) {
        throw new Error('Retrieved embedding has wrong dimension');
      }

      logInfo(`Retrieved embedding: ${retrieved.embedding.length} dimensions`);
    },
    SKIP_API
  );

  await runTest(
    'Test 5.4: Count embeddings',
    async () => {
      const count = await countRecipeEmbeddings();
      logInfo(`Total embeddings in database: ${count}`);

      if (count < 0) {
        throw new Error('Invalid count');
      }
    }
  );

  await runTest(
    'Test 5.5: Find recipes needing embeddings',
    async () => {
      const needsEmbedding = await getRecipesNeedingEmbedding();
      logInfo(`Recipes needing embeddings: ${needsEmbedding.length}`);
    }
  );

  await runTest(
    'Test 5.6: Vector similarity search',
    async () => {
      if (!testRecipeId) throw new Error('No test recipe created');

      const testEmbedding = await getRecipeEmbedding(testRecipeId);
      if (!testEmbedding) {
        logWarning('No embedding to search with, skipping');
        return;
      }

      const similar = await findSimilarRecipes(testEmbedding.embedding, 5, 0.0);
      logInfo(`Found ${similar.length} similar recipes`);

      if (similar.length > 0) {
        const recipeName = (similar[0] as any).recipe_name || 'Unknown';
        logInfo(`Most similar: ${recipeName} (similarity: ${similar[0].similarity.toFixed(4)})`);
      }
    },
    SKIP_API
  );

  await runTest(
    'Test 5.7: Delete test embedding',
    async () => {
      if (!testRecipeId) throw new Error('No test recipe created');

      const deleted = await deleteRecipeEmbedding(testRecipeId);
      if (!deleted) {
        logWarning('Embedding was not found (might have been already deleted)');
      } else {
        logInfo('Successfully deleted test embedding');
      }
    },
    SKIP_API
  );

  await runTest(
    'Test 5.8: Clean up test recipe',
    async () => {
      if (!testRecipeId) throw new Error('No test recipe created');

      await db.delete(recipes).where(eq(recipes.id, testRecipeId));
      logInfo('Cleaned up test recipe');
    }
  );
}

async function testEndToEnd() {
  logSection('TEST 6: End-to-End Workflow');

  let e2eRecipeId: string | null = null;

  await runTest(
    'Test 6.1: Full workflow - create recipe and generate embedding',
    async () => {
      // Create recipe
      const [recipe] = await db.insert(recipes).values({
        userId: 'test-user-e2e',
        name: 'End-to-End Test Recipe',
        description: 'Testing full embedding workflow',
        cuisine: 'International',
        tags: JSON.stringify(['test', 'e2e']),
        ingredients: JSON.stringify(['ingredient A', 'ingredient B']),
        instructions: JSON.stringify(['Step 1', 'Step 2']),
        isPublic: false,
      }).returning();

      e2eRecipeId = recipe.id;

      // Generate embedding
      const result = await generateRecipeEmbedding(recipe as any);

      // Save to database
      await saveRecipeEmbedding(
        recipe.id,
        result.embedding,
        result.embeddingText,
        result.modelName
      );

      // Verify it was saved
      const saved = await getRecipeEmbedding(recipe.id);
      if (!saved) {
        throw new Error('Embedding was not saved');
      }

      logInfo('Successfully completed full workflow');
    },
    SKIP_API
  );

  await runTest(
    'Test 6.2: Clean up E2E test data',
    async () => {
      if (e2eRecipeId) {
        await deleteRecipeEmbedding(e2eRecipeId);
        await db.delete(recipes).where(eq(recipes.id, e2eRecipeId));
        logInfo('Cleaned up E2E test data');
      }
    },
    SKIP_API
  );
}

async function main() {
  log('\n🧪 RECIPE EMBEDDING SYSTEM TEST SUITE', 'bright');
  log('=====================================\n', 'bright');

  // Check API key
  if (!process.env.HUGGINGFACE_API_KEY && !SKIP_API) {
    logWarning('HUGGINGFACE_API_KEY not found in environment');
    logWarning('API-dependent tests will be skipped');
    logWarning('Add --skip-api flag to suppress this warning\n');
  }

  try {
    // Run all test suites
    await testEmbeddingGeneration();
    await testBatchProcessing();
    await testRecipeEmbeddings();
    await testSimilarityCalculations();
    await testDatabaseOperations();
    await testEndToEnd();

    // Print summary
    logSection('TEST SUMMARY');
    log(`✓ Passed:  ${testResults.passed}`, 'green');
    log(`✗ Failed:  ${testResults.failed}`, 'red');
    log(`⊘ Skipped: ${testResults.skipped}`, 'yellow');
    console.log('─'.repeat(60));

    const total = testResults.passed + testResults.failed + testResults.skipped;
    const successRate = total > 0
      ? ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)
      : '0';

    log(`\nSuccess Rate: ${successRate}% (${testResults.passed}/${testResults.passed + testResults.failed})`, 'bright');

    if (testResults.failed === 0) {
      log('\n✨ All tests passed!', 'green');
      process.exit(0);
    } else {
      log(`\n❌ ${testResults.failed} test(s) failed`, 'red');
      process.exit(1);
    }

  } catch (error: any) {
    logError(`\nFatal error: ${error.message}`);
    if (VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
main();
