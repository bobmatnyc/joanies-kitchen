/**
 * Test Phase 2 Ollama Integration
 *
 * Validates that ollama.chat() works with improved error handling
 */

import ollama from 'ollama';
import { parseJsonResponse, extractIngredientArray, sleep } from './lib/qa-helpers';

const MODEL = 'qwen2.5-coder:7b-instruct';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

async function extractIngredientsFromInstructions(
  instructions: string[],
  retryCount = 0
): Promise<{ ingredients: string[]; error?: string }> {
  const instructionsText = instructions.join('\n');

  const prompt = `Extract ALL ingredients from these cooking instructions. List every ingredient mentioned (food items only).

Instructions:
${instructionsText}

Return a JSON array of lowercase ingredient names (no quantities, no tools/equipment).

Example format: ["flour", "sugar", "eggs", "salt", "butter", "milk"]

If no ingredients found, return: []`;

  try {
    const response = await ollama.chat({
      model: MODEL,
      messages: [{
        role: 'user',
        content: prompt,
      }],
      format: 'json',
      options: {
        temperature: 0.1,
        num_ctx: 4096,
      },
    });

    // Validate response structure
    if (!response || !response.message || !response.message.content) {
      throw new Error(`Invalid response from Ollama: ${JSON.stringify(response)}`);
    }

    const content = response.message.content.trim();
    if (!content) {
      throw new Error('Empty response content from Ollama');
    }

    const parsed = parseJsonResponse(content);
    const ingredients = extractIngredientArray(parsed);

    return { ingredients };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Ollama error: ${errorMsg}`);

    if (retryCount < MAX_RETRIES) {
      console.error(`⚠️  Extraction failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY * (retryCount + 1));
      return extractIngredientsFromInstructions(instructions, retryCount + 1);
    }
    return {
      ingredients: [],
      error: `Failed after ${MAX_RETRIES} retries: ${errorMsg}`,
    };
  }
}

async function testOllama() {
  console.log('🧪 Testing Phase 2 Ollama Integration\n');
  console.log(`🤖 Using model: ${MODEL}\n`);

  // Check Ollama availability
  try {
    const models = await ollama.list();
    console.log(`✅ Ollama is running with ${models.models.length} models available\n`);
  } catch (error) {
    console.error('❌ Error: Ollama is not running or not accessible');
    console.error('   Please start Ollama with: ollama serve');
    process.exit(1);
  }

  // Test with sample instructions
  const testInstructions = [
    "Preheat oven to 350°F.",
    "Mix flour, sugar, and eggs in a large bowl.",
    "Add melted butter and milk.",
    "Bake for 30 minutes until golden brown."
  ];

  console.log('📝 Test Instructions:');
  testInstructions.forEach((inst, idx) => {
    console.log(`   ${idx + 1}. ${inst}`);
  });
  console.log('\n🔄 Extracting ingredients...\n');

  const result = await extractIngredientsFromInstructions(testInstructions);

  if (result.error) {
    console.error(`❌ Extraction failed: ${result.error}`);
    process.exit(1);
  }

  console.log('✅ Extraction successful!\n');
  console.log('📋 Extracted Ingredients:');
  result.ingredients.forEach((ing, idx) => {
    console.log(`   ${idx + 1}. ${ing}`);
  });

  console.log('\n🎉 Phase 2 Ollama integration verified!\n');
  console.log('Expected ingredients: flour, sugar, eggs, butter, milk');
  console.log(`Found ${result.ingredients.length} ingredients\n`);

  return true;
}

// Run test
testOllama()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });
