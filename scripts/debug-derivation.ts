import ollama from 'ollama';
import { parseJsonResponse } from './lib/qa-helpers';

async function test() {
  const sampleInstructions = [
    'Preheat oven to 350°F.',
    'Mix 2 cups flour with 1 cup sugar.',
    'Add 3 eggs and 1/2 cup melted butter.',
    'Stir in 1 teaspoon vanilla extract.',
  ];

  const prompt = `Analyze this recipe and extract all ingredients with their quantities.

Recipe: Test Recipe

Instructions:
${sampleInstructions.join('\n')}

Return a JSON array of ingredients with quantities.

Format: [{"ingredient": "flour", "amount": "2", "unit": "cups"}, {"ingredient": "sugar", "amount": "1", "unit": "cup"}]

Rules:
- Lowercase ingredient names
- Extract quantities from instructions
- Empty string for unit if none
- Include ALL ingredients

Return the JSON array now:`;

  const response = await ollama.chat({
    model: 'qwen2.5-coder:7b-instruct',
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

  console.log('RAW RESPONSE:');
  console.log(response.message.content);
  console.log('\n' + '='.repeat(60));

  try {
    const parsed = parseJsonResponse(response.message.content);
    console.log('\nPARSED:');
    console.log(JSON.stringify(parsed, null, 2));

    console.log('\nIS ARRAY:', Array.isArray(parsed));

    if (Array.isArray(parsed)) {
      console.log('\nFILTERED INGREDIENTS:');
      const ingredients = parsed.filter(item =>
        typeof item === 'object' &&
        item.ingredient &&
        typeof item.ingredient === 'string'
      );
      console.log(JSON.stringify(ingredients, null, 2));
    }
  } catch (error) {
    console.log('\nERROR:');
    console.log((error as Error).message);
    console.log((error as Error).stack);
  }
}

test().catch(console.error);
