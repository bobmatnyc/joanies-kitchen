/**
 * Test Script for AI Prompt Store
 *
 * Usage: tsx scripts/test-prompt-store.ts
 *
 * Tests:
 * - All prompts are registered
 * - Variable substitution works
 * - Validation catches errors
 * - Model recommendations exist
 */

import {
  getPrompt,
  renderPrompt,
  validatePromptVariables,
  listPromptsWithInfo,
  getPromptsByCategory,
  searchPromptsByTag,
  getRecommendedModel,
  promptStore,
} from '../src/lib/ai/prompts';

console.log('🧪 Testing AI Prompt Store\n');

// Test 1: List all prompts
console.log('📋 Test 1: List All Prompts');
const prompts = listPromptsWithInfo();
console.log(`   ✓ Found ${prompts.length} prompts`);
prompts.forEach((p) => {
  console.log(`   - ${p.id} (${p.category}): ${p.name}`);
});
console.log('');

// Test 2: Get prompts by category
console.log('📂 Test 2: Get Prompts by Category');
const mealPrompts = getPromptsByCategory('meal');
console.log(`   ✓ Meal category: ${mealPrompts.length} prompts`);
const nutritionPrompts = getPromptsByCategory('nutrition');
console.log(`   ✓ Nutrition category: ${nutritionPrompts.length} prompts`);
const analysisPrompts = getPromptsByCategory('analysis');
console.log(`   ✓ Analysis category: ${analysisPrompts.length} prompts`);
const recipePrompts = getPromptsByCategory('recipe');
console.log(`   ✓ Recipe category: ${recipePrompts.length} prompts`);
console.log('');

// Test 3: Search by tag
console.log('🏷️  Test 3: Search by Tag');
const budgetPrompts = searchPromptsByTag('budget');
console.log(`   ✓ Budget tag: ${budgetPrompts.length} prompts`);
const allergenPrompts = searchPromptsByTag('allergens');
console.log(`   ✓ Allergen tag: ${allergenPrompts.length} prompts`);
console.log('');

// Test 4: Variable substitution
console.log('🔄 Test 4: Variable Substitution');
const template = getPrompt('meal-builder-complete');
if (!template) {
  console.error('   ✗ Failed to get template');
  process.exit(1);
}

const variables = {
  mainDish: 'Grilled Salmon',
  cuisine: 'Mediterranean',
  dietaryRestrictions: 'gluten-free',
  servings: '4',
  occasion: 'dinner party',
};

const rendered = renderPrompt(template, { variables });
console.log('   ✓ Rendered prompt successfully');
console.log(`   ✓ System prompt length: ${rendered.system.length} chars`);
console.log(`   ✓ User prompt length: ${rendered.user.length} chars`);
console.log(`   ✓ Model: ${rendered.config.model}`);
console.log(`   ✓ Temperature: ${rendered.config.temperature}`);
console.log(`   ✓ Max Tokens: ${rendered.config.maxTokens}`);

// Verify no unreplaced variables
if (rendered.user.includes('{{')) {
  console.error('   ✗ Unreplaced variables found!');
  process.exit(1);
}
console.log('   ✓ No unreplaced variables');
console.log('');

// Test 5: Validation
console.log('✅ Test 5: Variable Validation');

// Test valid variables
const validVariables = {
  mainDish: 'Salmon',
  cuisine: 'Mediterranean',
  dietaryRestrictions: 'none',
  servings: '4',
  occasion: 'dinner',
};
const validValidation = validatePromptVariables(template, validVariables);
if (!validValidation.valid) {
  console.error('   ✗ Valid variables marked as invalid');
  process.exit(1);
}
console.log('   ✓ Valid variables accepted');

// Test missing variables
const invalidVariables = {
  mainDish: 'Salmon',
  cuisine: 'Mediterranean',
  // Missing: dietaryRestrictions, servings, occasion
};
const invalidValidation = validatePromptVariables(template, invalidVariables);
if (invalidValidation.valid) {
  console.error('   ✗ Invalid variables marked as valid');
  process.exit(1);
}
console.log('   ✓ Missing variables detected');
console.log(`   ✓ Errors: ${invalidValidation.errors.length}`);
invalidValidation.errors.forEach((err) => {
  console.log(`      - ${err}`);
});
console.log('');

// Test 6: Model recommendations
console.log('🤖 Test 6: Model Recommendations');
const testPromptIds = [
  'meal-builder-complete',
  'dietary-meal-builder',
  'recipe-improvement-analyzer',
  'comprehensive-nutrition-calculator',
];

testPromptIds.forEach((id) => {
  const model = getRecommendedModel(id);
  if (!model) {
    console.error(`   ✗ No model recommendation for ${id}`);
    process.exit(1);
  }
  console.log(`   ✓ ${id}: ${model}`);
});
console.log('');

// Test 7: Prompt metadata
console.log('📊 Test 7: Prompt Metadata');
Object.values(promptStore).forEach((prompt) => {
  // Check required fields
  if (!prompt.id || !prompt.name || !prompt.version || !prompt.category) {
    console.error(`   ✗ Missing metadata in ${prompt.id}`);
    process.exit(1);
  }

  // Check model suggestions
  if (!prompt.modelSuggestions || prompt.modelSuggestions.length === 0) {
    console.error(`   ✗ No model suggestions for ${prompt.id}`);
    process.exit(1);
  }

  // Check variables
  if (!prompt.variables) {
    console.error(`   ✗ No variables defined for ${prompt.id}`);
    process.exit(1);
  }

  // Check prompts
  if (!prompt.systemPrompt || !prompt.userPromptTemplate) {
    console.error(`   ✗ Missing prompt content for ${prompt.id}`);
    process.exit(1);
  }
});
console.log('   ✓ All prompts have valid metadata');
console.log('   ✓ All prompts have model suggestions');
console.log('   ✓ All prompts have defined variables');
console.log('   ✓ All prompts have system and user templates');
console.log('');

// Summary
console.log('═══════════════════════════════════════════════════');
console.log('✅ All Tests Passed!');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log('Prompt Store Statistics:');
console.log(`   Total Prompts: ${Object.keys(promptStore).length}`);
console.log(`   Meal Prompts: ${mealPrompts.length}`);
console.log(`   Recipe Prompts: ${recipePrompts.length}`);
console.log(`   Nutrition Prompts: ${nutritionPrompts.length}`);
console.log(`   Analysis Prompts: ${analysisPrompts.length}`);
console.log('');
console.log('Model Distribution:');
const modelCounts: Record<string, number> = {};
Object.values(promptStore).forEach((prompt) => {
  const primaryModel = prompt.modelSuggestions.find((s) => s.priority === 'primary');
  if (primaryModel) {
    modelCounts[primaryModel.model] = (modelCounts[primaryModel.model] || 0) + 1;
  }
});
Object.entries(modelCounts).forEach(([model, count]) => {
  console.log(`   ${model}: ${count} prompts`);
});
console.log('');
console.log('🚀 Prompt Store is ready for production!');
