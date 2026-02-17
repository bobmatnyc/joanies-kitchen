import ollama from 'ollama';
import { extractIngredientArray, parseJsonResponse } from './lib/qa-helpers';

async function test() {
  const sampleInstructions = [
    'Preheat oven to 350°F.',
    'In a large bowl, mix flour, sugar, and salt.',
    'Add eggs and butter, mix until smooth.',
    'Pour into greased baking pan.',
    'Bake for 30 minutes.',
  ];

  const prompt = `Extract ALL ingredients from these cooking instructions. Return a JSON array of ingredient names (lowercase, no quantities).

Instructions:
${sampleInstructions.join('\n')}

Expected ingredients: flour, sugar, salt, eggs, butter (these are ALL mentioned in the instructions above)

Return format: ["flour", "sugar", "salt", "eggs", "butter"]

Return the JSON array now:`;

  const response = await ollama.chat({
    model: 'qwen2.5-coder:7b-instruct',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    format: 'json',
    options: {
      temperature: 0.1,
      num_ctx: 4096,
    },
  });

  console.log('RAW RESPONSE:');
  console.log(response.message.content);
  console.log(`\n${'='.repeat(60)}`);

  try {
    const parsed = parseJsonResponse(response.message.content);
    console.log('\nPARSED (parseJsonResponse):');
    console.log(JSON.stringify(parsed, null, 2));

    console.log('\nEXTRACTED INGREDIENTS:');
    const ingredients = extractIngredientArray(parsed);
    console.log(JSON.stringify(ingredients, null, 2));
  } catch (error) {
    console.log('\nERROR:');
    console.log((error as Error).message);
  }
}

test().catch(console.error);
