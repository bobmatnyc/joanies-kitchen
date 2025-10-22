/**
 * Test Semantic Comparison with Local LLM
 *
 * Validates that the LLM correctly identifies:
 * - True duplicates (should merge)
 * - Different ingredients (should keep separate)
 *
 * Usage: tsx scripts/test-semantic-comparison.ts
 */

import { semanticCompare } from './semantic-consolidation';

interface TestCase {
  ingredient1: string;
  ingredient2: string;
  expected: 'merge' | 'separate';
  reason: string;
}

const testCases: TestCase[] = [
  // Should MERGE (true duplicates)
  {
    ingredient1: 'Ancho Chiles',
    ingredient2: 'Ancho Chili',
    expected: 'merge',
    reason: 'Spelling variant (chile vs chili)',
  },
  {
    ingredient1: 'Bean Sprout',
    ingredient2: 'Bean Sprouts',
    expected: 'merge',
    reason: 'Plural variant',
  },
  {
    ingredient1: 'Black Pepper',
    ingredient2: 'Black Peppers',
    expected: 'merge',
    reason: 'Plural variant',
  },
  {
    ingredient1: 'Cherry Tomato',
    ingredient2: 'Cherry Tomatoes',
    expected: 'merge',
    reason: 'Plural variant',
  },
  {
    ingredient1: 'Red Bell Pepper',
    ingredient2: 'Bell Pepper',
    expected: 'merge',
    reason: 'Same ingredient with descriptor',
  },

  // Should KEEP SEPARATE (different ingredients)
  {
    ingredient1: 'Balsamic Vinegar',
    ingredient2: 'Balsamic Vinaigrette',
    expected: 'separate',
    reason: 'Vinegar is ingredient, vinaigrette is dressing (different products)',
  },
  {
    ingredient1: 'Tomato',
    ingredient2: 'Tomato Sauce',
    expected: 'separate',
    reason: 'Raw ingredient vs processed product',
  },
  {
    ingredient1: 'Chicken Breast',
    ingredient2: 'Chicken Stock',
    expected: 'separate',
    reason: 'Different chicken products',
  },
  {
    ingredient1: 'Roasted Red Peppers',
    ingredient2: 'Red Bell Pepper',
    expected: 'separate',
    reason: 'Different preparation states',
  },
  {
    ingredient1: 'Olive Oil',
    ingredient2: 'Olives',
    expected: 'separate',
    reason: 'Oil vs whole fruit',
  },
];

async function runTests() {
  console.log('🧪 Testing Semantic Comparison with Local LLM\n');
  console.log(`Running ${testCases.length} test cases...\n`);

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const testCase of testCases) {
    const { ingredient1, ingredient2, expected, reason } = testCase;

    console.log(`Testing: "${ingredient1}" vs "${ingredient2}"`);
    console.log(`Expected: ${expected} - ${reason}`);

    try {
      const result = await semanticCompare(ingredient1, ingredient2);

      const actualDecision = result.similar ? 'merge' : 'separate';
      const success = actualDecision === expected;

      if (success) {
        console.log(
          `✅ PASS - LLM said ${actualDecision} (confidence: ${result.confidence.toFixed(2)})`
        );
        console.log(`   Reason: ${result.reason}\n`);
        passed++;
      } else {
        console.log(
          `❌ FAIL - LLM said ${actualDecision} (confidence: ${result.confidence.toFixed(2)})`
        );
        console.log(`   Reason: ${result.reason}`);
        console.log(`   Expected: ${expected}\n`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR - ${error}\n`);
      failed++;
    }
  }

  const duration = Date.now() - startTime;

  console.log('━'.repeat(60));
  console.log('\n📊 Test Results:\n');
  console.log(`✅ Passed: ${passed}/${testCases.length}`);
  console.log(`❌ Failed: ${failed}/${testCases.length}`);
  console.log(`🎯 Accuracy: ${((passed / testCases.length) * 100).toFixed(1)}%`);
  console.log(`⏱️  Total time: ${(duration / 1000).toFixed(2)}s`);
  console.log(`⏱️  Avg per test: ${(duration / testCases.length / 1000).toFixed(2)}s\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! LLM semantic comparison working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Review LLM responses above.\n');
  }
}

// Run tests
if (require.main === module) {
  runTests().catch((error) => {
    console.error('❌ Error running tests:', error);
    process.exit(1);
  });
}
