/**
 * Test script for recipe placeholder selection logic
 * Run with: npx tsx scripts/test-placeholder-logic.ts
 */

import { getPlaceholderImage, getPlaceholderTheme } from '@/lib/utils/recipe-placeholders';

// Test cases with various recipe tag combinations
const testCases = [
  {
    name: 'Breakfast Recipe',
    tags: ['Breakfast', 'Quick', 'Easy'],
    expectedTheme: 'breakfast',
  },
  {
    name: 'Dessert Recipe',
    tags: ['Dessert', 'Baked', 'Sweet'],
    expectedTheme: 'dessert',
  },
  {
    name: 'Pasta Recipe',
    tags: ['Italian', 'Pasta', 'Dinner'],
    expectedTheme: 'pasta',
  },
  {
    name: 'Salad Recipe',
    tags: ['Salad', 'Vegetarian', 'Healthy'],
    expectedTheme: 'salad',
  },
  {
    name: 'Soup Recipe',
    tags: ['Soup', 'Comfort Food', 'Winter'],
    expectedTheme: 'soup',
  },
  {
    name: 'Meat Dish',
    tags: ['Beef', 'Grilled', 'Main'],
    expectedTheme: 'meat',
  },
  {
    name: 'Seafood Recipe',
    tags: ['Fish', 'Seafood', 'Healthy'],
    expectedTheme: 'seafood',
  },
  {
    name: 'Vegetarian Recipe',
    tags: ['Vegan', 'Vegetables', 'Healthy'],
    expectedTheme: 'vegetarian',
  },
  {
    name: 'Baked Goods',
    tags: ['Baked', 'Bread', 'Snack'],
    expectedTheme: 'baked',
  },
  {
    name: 'Beverage',
    tags: ['Beverage', 'Cold', 'Refreshing'],
    expectedTheme: 'beverage',
  },
  {
    name: 'Generic Recipe (No specific tags)',
    tags: ['Tasty', 'Homemade'],
    expectedTheme: 'generic',
  },
  {
    name: 'Chicken Stir-Fry',
    tags: ['Chicken', 'Asian', 'Quick'],
    expectedTheme: 'meat',
  },
  {
    name: 'Vegetable Soup',
    tags: ['Soup', 'Vegetarian', 'Warm'],
    expectedTheme: 'soup',
  },
  {
    name: 'Cheese Pizza',
    tags: ['Pizza', 'Italian', 'Cheese'],
    expectedTheme: 'pasta',
  },
  {
    name: 'Caesar Salad',
    tags: ['Salad', 'Caesar', 'Lettuce'],
    expectedTheme: 'salad',
  },
  {
    name: 'Grilled Salmon',
    tags: ['Salmon', 'Grilled', 'Seafood'],
    expectedTheme: 'seafood',
  },
  {
    name: 'Chocolate Cake',
    tags: ['Dessert', 'Cake', 'Chocolate'],
    expectedTheme: 'dessert',
  },
  {
    name: 'Tofu Stir-Fry',
    tags: ['Tofu', 'Vegan', 'Stir-Fried'],
    expectedTheme: 'vegetarian',
  },
  {
    name: 'Iced Coffee',
    tags: ['Beverage', 'Coffee', 'Cold'],
    expectedTheme: 'beverage',
  },
  {
    name: 'Banana Bread',
    tags: ['Baked', 'Bread', 'Banana'],
    expectedTheme: 'baked',
  },
];

console.log('🧪 Testing Recipe Placeholder Selection Logic\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const theme = getPlaceholderTheme(testCase.tags);
  const imagePath = getPlaceholderImage(testCase.tags);
  const success = theme === testCase.expectedTheme;

  if (success) {
    passed++;
    console.log(`✅ ${testCase.name}`);
  } else {
    failed++;
    console.log(`❌ ${testCase.name}`);
    console.log(`   Expected: ${testCase.expectedTheme}, Got: ${theme}`);
  }

  console.log(`   Tags: [${testCase.tags.join(', ')}]`);
  console.log(`   Theme: ${theme}`);
  console.log(`   Image: ${imagePath}`);
  console.log('');
}

console.log('='.repeat(70));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Review the logic.');
  process.exit(1);
}
