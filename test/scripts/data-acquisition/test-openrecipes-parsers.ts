#!/usr/bin/env tsx

/**
 * OpenRecipes Parser Test Suite
 *
 * Tests all schema.org/Recipe parsers to ensure they handle
 * various format variations correctly.
 *
 * Run: tsx scripts/data-acquisition/test-openrecipes-parsers.ts
 */

console.log(`\n${'='.repeat(80)}`);
console.log('  OPENRECIPES PARSER TEST SUITE');
console.log('='.repeat(80));

// Test counters
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.log(`✗ ${name} - Assertion failed`);
      failed++;
    }
  } catch (error: any) {
    console.log(`✗ ${name} - Error: ${error.message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// ============================================================================
// ISO 8601 Duration Parser Tests
// ============================================================================

console.log('\n--- ISO 8601 Duration Parser ---');

function parseISO8601Duration(duration: string | undefined): number | null {
  if (!duration || typeof duration !== 'string') return null;

  try {
    const regex = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const match = duration.match(regex);

    if (!match) return null;

    const days = parseInt(match[1] || '0', 10);
    const hours = parseInt(match[2] || '0', 10);
    const minutes = parseInt(match[3] || '0', 10);
    const seconds = parseInt(match[4] || '0', 10);

    const totalMinutes = days * 24 * 60 + hours * 60 + minutes + Math.ceil(seconds / 60);

    return totalMinutes > 0 ? totalMinutes : null;
  } catch (_error) {
    return null;
  }
}

test('PT30M = 30 minutes', () => {
  return assertEqual(parseISO8601Duration('PT30M'), 30);
});

test('PT1H30M = 90 minutes', () => {
  return assertEqual(parseISO8601Duration('PT1H30M'), 90);
});

test('PT2H = 120 minutes', () => {
  return assertEqual(parseISO8601Duration('PT2H'), 120);
});

test('PT1H = 60 minutes', () => {
  return assertEqual(parseISO8601Duration('PT1H'), 60);
});

test('PT45M = 45 minutes', () => {
  return assertEqual(parseISO8601Duration('PT45M'), 45);
});

test('P1DT2H = 1560 minutes (26 hours)', () => {
  return assertEqual(parseISO8601Duration('P1DT2H'), 1560);
});

test('PT90S = 2 minutes (rounded up)', () => {
  return assertEqual(parseISO8601Duration('PT90S'), 2);
});

test('Invalid duration = null', () => {
  return assertEqual(parseISO8601Duration('invalid'), null);
});

test('Undefined duration = null', () => {
  return assertEqual(parseISO8601Duration(undefined), null);
});

// ============================================================================
// Instruction Parser Tests
// ============================================================================

console.log('\n--- Instruction Parser ---');

function parseInstructions(instructions: any): string[] {
  if (!instructions) return [];

  if (typeof instructions === 'string') {
    return instructions
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  if (Array.isArray(instructions)) {
    return instructions
      .map((step) => {
        if (typeof step === 'string') {
          return step.trim();
        }
        if (step['@type'] === 'HowToStep') {
          return step.text || step.itemListElement || step.name || '';
        }
        if (step['@type'] === 'HowToSection') {
          if (Array.isArray(step.itemListElement)) {
            return step.itemListElement
              .map((item: any) => item.text || item.name || '')
              .filter(Boolean)
              .join(' ');
          }
        }
        if (step.text) {
          return step.text;
        }
        return typeof step === 'object' ? JSON.stringify(step) : String(step);
      })
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  if (instructions['@type'] === 'HowToStep') {
    const text = instructions.text || instructions.itemListElement || instructions.name || '';
    return text ? [text.trim()] : [];
  }

  if (instructions['@type'] === 'HowToSection') {
    if (Array.isArray(instructions.itemListElement)) {
      return instructions.itemListElement
        .map((item: any) => item.text || item.name || '')
        .filter(Boolean);
    }
  }

  if (instructions.text) {
    return [instructions.text];
  }

  return [];
}

test('String array format', () => {
  const input = ['Step 1', 'Step 2', 'Step 3'];
  const expected = ['Step 1', 'Step 2', 'Step 3'];
  return assertEqual(parseInstructions(input), expected);
});

test('HowToStep array format', () => {
  const input = [
    { '@type': 'HowToStep', text: 'Preheat oven' },
    { '@type': 'HowToStep', text: 'Mix ingredients' },
  ];
  const expected = ['Preheat oven', 'Mix ingredients'];
  return assertEqual(parseInstructions(input), expected);
});

test('Single string with newlines', () => {
  const input = 'Step 1\nStep 2\nStep 3';
  const expected = ['Step 1', 'Step 2', 'Step 3'];
  return assertEqual(parseInstructions(input), expected);
});

test('HowToSection with nested steps', () => {
  const input = [
    {
      '@type': 'HowToSection',
      name: 'Preparation',
      itemListElement: [
        { '@type': 'HowToStep', text: 'Step 1' },
        { '@type': 'HowToStep', text: 'Step 2' },
      ],
    },
  ];
  const expected = ['Step 1 Step 2'];
  return assertEqual(parseInstructions(input), expected);
});

test('Single HowToStep object', () => {
  const input = { '@type': 'HowToStep', text: 'Single step' };
  const expected = ['Single step'];
  return assertEqual(parseInstructions(input), expected);
});

test('Empty instructions', () => {
  return assertEqual(parseInstructions(null), []);
});

// ============================================================================
// Image Parser Tests
// ============================================================================

console.log('\n--- Image Parser ---');

function parseImages(image: any): string[] {
  if (!image) return [];

  if (typeof image === 'string') {
    return [image];
  }

  if (Array.isArray(image)) {
    return image
      .map((img) => {
        if (typeof img === 'string') {
          return img;
        }
        if (img['@type'] === 'ImageObject') {
          return img.url || img.contentUrl || img.thumbnailUrl || '';
        }
        if (img.url) {
          return img.url;
        }
        return '';
      })
      .filter(Boolean);
  }

  if (image['@type'] === 'ImageObject') {
    return [image.url || image.contentUrl || image.thumbnailUrl || ''].filter(Boolean);
  }

  if (image.url) {
    return [image.url];
  }

  return [];
}

test('String URL', () => {
  const input = 'https://example.com/recipe.jpg';
  const expected = ['https://example.com/recipe.jpg'];
  return assertEqual(parseImages(input), expected);
});

test('Array of URLs', () => {
  const input = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
  const expected = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
  return assertEqual(parseImages(input), expected);
});

test('ImageObject with url', () => {
  const input = {
    '@type': 'ImageObject',
    url: 'https://example.com/recipe.jpg',
  };
  const expected = ['https://example.com/recipe.jpg'];
  return assertEqual(parseImages(input), expected);
});

test('ImageObject with contentUrl', () => {
  const input = {
    '@type': 'ImageObject',
    contentUrl: 'https://example.com/recipe.jpg',
  };
  const expected = ['https://example.com/recipe.jpg'];
  return assertEqual(parseImages(input), expected);
});

test('Array of ImageObjects', () => {
  const input = [
    { '@type': 'ImageObject', url: 'https://example.com/1.jpg' },
    { '@type': 'ImageObject', url: 'https://example.com/2.jpg' },
  ];
  const expected = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
  return assertEqual(parseImages(input), expected);
});

test('Empty image', () => {
  return assertEqual(parseImages(null), []);
});

// ============================================================================
// Servings Parser Tests
// ============================================================================

console.log('\n--- Servings Parser ---');

function parseServings(recipeYield: any): number | null {
  if (!recipeYield) return null;

  if (typeof recipeYield === 'number') {
    return Math.max(1, Math.floor(recipeYield));
  }

  if (typeof recipeYield === 'string') {
    const match = recipeYield.match(/(\d+)/);
    return match ? Math.max(1, parseInt(match[1], 10)) : null;
  }

  return null;
}

test('Number input', () => {
  return assertEqual(parseServings(4), 4);
});

test('"4 servings"', () => {
  return assertEqual(parseServings('4 servings'), 4);
});

test('"Makes 8"', () => {
  return assertEqual(parseServings('Makes 8'), 8);
});

test('"6-8 people"', () => {
  return assertEqual(parseServings('6-8 people'), 6);
});

test('"Serves 4-6"', () => {
  return assertEqual(parseServings('Serves 4-6'), 4);
});

test('Float number (rounds down)', () => {
  return assertEqual(parseServings(4.7), 4);
});

test('Empty servings', () => {
  return assertEqual(parseServings(null), null);
});

// ============================================================================
// Source Detection Tests
// ============================================================================

console.log('\n--- Source Detection ---');

function detectSource(filename: string, url?: string): string {
  if (url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  const lower = filename.toLowerCase();
  if (lower.includes('allrecipes')) return 'allrecipes.com';
  if (lower.includes('foodnetwork')) return 'foodnetwork.com';
  if (lower.includes('epicurious')) return 'epicurious.com';
  if (lower.includes('bbcgoodfood') || lower.includes('bbc')) return 'bbcgoodfood.com';
  if (lower.includes('recipeland')) return 'recipeland.com';

  return 'openrecipes.org';
}

test('URL detection', () => {
  return assertEqual(
    detectSource('unknown.json', 'https://allrecipes.com/recipe/12345'),
    'allrecipes.com'
  );
});

test('Filename detection: allrecipes', () => {
  return assertEqual(detectSource('allrecipes.json'), 'allrecipes.com');
});

test('Filename detection: foodnetwork', () => {
  return assertEqual(detectSource('foodnetwork.json'), 'foodnetwork.com');
});

test('Filename detection: epicurious', () => {
  return assertEqual(detectSource('epicurious.json'), 'epicurious.com');
});

test('Filename detection: bbcgoodfood', () => {
  return assertEqual(detectSource('bbcgoodfood.json'), 'bbcgoodfood.com');
});

test('Unknown source defaults to openrecipes.org', () => {
  return assertEqual(detectSource('unknown.json'), 'openrecipes.org');
});

// ============================================================================
// Recipe Validation Tests
// ============================================================================

console.log('\n--- Recipe Validation ---');

function isRecipeValid(recipe: any): boolean {
  const name = recipe.name || recipe.title;
  const ingredients = recipe.recipeIngredient || recipe.ingredients;
  const instructions = recipe.recipeInstructions || recipe.instructions;

  return (
    !!name &&
    name.length > 3 &&
    !!ingredients &&
    (Array.isArray(ingredients) ? ingredients.length > 0 : ingredients.length > 10) &&
    !!instructions
  );
}

test('Valid recipe with all fields', () => {
  const recipe = {
    name: 'Spaghetti Carbonara',
    recipeIngredient: ['pasta', 'eggs', 'bacon'],
    recipeInstructions: 'Cook pasta. Mix eggs. Combine.',
  };
  return isRecipeValid(recipe);
});

test('Invalid recipe: name too short', () => {
  const recipe = {
    name: 'Abc',
    recipeIngredient: ['pasta', 'eggs'],
    recipeInstructions: 'Cook.',
  };
  return !isRecipeValid(recipe);
});

test('Invalid recipe: no ingredients', () => {
  const recipe = {
    name: 'Test Recipe',
    recipeIngredient: [],
    recipeInstructions: 'Cook.',
  };
  return !isRecipeValid(recipe);
});

test('Invalid recipe: no instructions', () => {
  const recipe = {
    name: 'Test Recipe',
    recipeIngredient: ['pasta'],
    recipeInstructions: null,
  };
  return !isRecipeValid(recipe);
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${'='.repeat(80)}`);
console.log('  TEST SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${passed + failed}`);
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log('='.repeat(80));

if (failed === 0) {
  console.log('\n🎉 All tests passed! Parsers are working correctly.\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} test(s) failed. Please review the errors above.\n`);
  process.exit(1);
}
