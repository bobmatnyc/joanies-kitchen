#!/usr/bin/env tsx
/**
 * Simple Ollama Test - No External Dependencies
 *
 * Tests just the Ollama extraction logic with mock recipe content
 */

import { extractRecipeWithAI } from './lib/recipe-parser-script';

// Mock recipe markdown from a typical recipe page
const MOCK_RECIPE_MARKDOWN = `
# Butter Chicken Recipe

A rich and creamy Indian curry that's perfect for dinner parties.

## Ingredients

- 2 pounds boneless chicken thighs, cut into chunks
- 1 cup plain yogurt
- 2 tablespoons lemon juice
- 2 teaspoons ground cumin
- 2 teaspoons paprika
- 1 teaspoon turmeric
- 1 teaspoon garam masala
- 1 teaspoon salt
- 3 tablespoons butter
- 1 onion, diced
- 4 cloves garlic, minced
- 1 tablespoon fresh ginger, grated
- 1 can (14 oz) tomato sauce
- 1 cup heavy cream
- Fresh cilantro for garnish

## Instructions

1. In a bowl, combine yogurt, lemon juice, cumin, paprika, turmeric, garam masala, and salt. Add chicken and marinate for at least 2 hours.

2. Heat butter in a large skillet over medium heat. Add onion and cook until softened, about 5 minutes.

3. Add garlic and ginger, cook for 1 minute until fragrant.

4. Add the marinated chicken and cook until browned on all sides, about 8 minutes.

5. Pour in the tomato sauce and bring to a simmer. Reduce heat and cook for 15 minutes.

6. Stir in the heavy cream and simmer for 5 more minutes.

7. Garnish with fresh cilantro and serve over basmati rice.

**Prep Time:** 15 minutes (plus 2 hours marinating)
**Cook Time:** 30 minutes
**Servings:** 6
**Difficulty:** Medium
**Cuisine:** Indian
`;

const TEST_URL = 'https://example.com/butter-chicken';

async function testOllamaSimple() {
  console.log('='.repeat(80));
  console.log('Simple Ollama Recipe Extraction Test');
  console.log('='.repeat(80));
  console.log('\nTesting with mock recipe markdown...\n');

  const startTime = Date.now();

  try {
    console.log('Extracting recipe with Ollama...');
    const recipe = await extractRecipeWithAI(
      MOCK_RECIPE_MARKDOWN,
      TEST_URL,
      {
        ogTitle: 'Butter Chicken Recipe',
        ogDescription: 'A rich and creamy Indian curry',
        ogImage: 'https://example.com/butter-chicken.jpg'
      }
    );

    const extractTime = Date.now() - startTime;

    if (!recipe) {
      throw new Error('Recipe extraction returned null');
    }

    console.log('\nExtraction Results:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(recipe, null, 2));
    console.log('='.repeat(80));

    console.log(`\n✓ Extraction completed in ${extractTime}ms`);
    console.log(`✓ SUCCESS: Ollama extraction working!`);

    // Validation
    console.log('\nValidation:');
    console.log(`  - Name: ${recipe.name ? '✓' : '✗'}`);
    console.log(`  - Ingredients: ${recipe.ingredients?.length || 0} items ${recipe.ingredients?.length > 0 ? '✓' : '✗'}`);
    console.log(`  - Instructions: ${recipe.instructions?.length || 0} steps ${recipe.instructions?.length > 0 ? '✓' : '✗'}`);
    console.log(`  - Confidence: ${recipe.confidence || 'N/A'}`);

  } catch (error) {
    console.error(`\n✗ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testOllamaSimple();
