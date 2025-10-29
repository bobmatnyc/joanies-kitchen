/**
 * AI Prompt Store - Central Registry
 *
 * Centralized access to all AI prompts with variable substitution,
 * validation, and helper functions.
 */

import { ingredientSubstitutionPrompts } from './ingredient-substitution';
import { mealGenerationPrompts } from './meal-generation';
import { mealPairingPrompts } from './meal-pairing';
import { nutritionalEstimationPrompts } from './nutritional-estimation';
import { recipeAnalysisPrompts } from './recipe-analysis';
import type {
  PromptCategory,
  PromptRenderOptions,
  PromptStoreMetadata,
  PromptTemplate,
  PromptValidationResult,
  RenderedPrompt,
} from './types';

/**
 * Central prompt store registry
 * Maps prompt IDs to prompt templates
 */
export const promptStore: Record<string, PromptTemplate> = {
  // Meal Generation Prompts (6 prompts)
  ...Object.fromEntries(
    Object.entries(mealGenerationPrompts).map(([, prompt]) => [prompt.id, prompt])
  ),
  // Recipe Analysis Prompts (5 prompts)
  ...Object.fromEntries(
    Object.entries(recipeAnalysisPrompts).map(([, prompt]) => [prompt.id, prompt])
  ),
  // Nutritional Estimation Prompts (4 prompts)
  ...Object.fromEntries(
    Object.entries(nutritionalEstimationPrompts).map(([, prompt]) => [prompt.id, prompt])
  ),
  // Meal Pairing Prompts (4 prompts)
  ...Object.fromEntries(
    Object.entries(mealPairingPrompts).map(([, prompt]) => [prompt.id, prompt])
  ),
  // Ingredient Substitution Prompts (1 prompt)
  ...Object.fromEntries(
    Object.entries(ingredientSubstitutionPrompts).map(([, prompt]) => [prompt.id, prompt])
  ),
};

/**
 * Get a prompt template by ID
 */
export function getPrompt(id: string): PromptTemplate | undefined {
  return promptStore[id];
}

/**
 * Get all prompts in a specific category
 */
export function getPromptsByCategory(category: PromptCategory): PromptTemplate[] {
  return Object.values(promptStore).filter((prompt) => prompt.category === category);
}

/**
 * Search prompts by tags
 */
export function searchPromptsByTag(tag: string): PromptTemplate[] {
  return Object.values(promptStore).filter((prompt) => prompt.tags?.includes(tag.toLowerCase()));
}

/**
 * Get prompt store metadata
 */
export function getPromptStoreMetadata(): PromptStoreMetadata {
  const prompts = Object.values(promptStore);
  const categories = prompts.reduce(
    (acc, prompt) => {
      acc[prompt.category] = (acc[prompt.category] || 0) + 1;
      return acc;
    },
    {} as Record<PromptCategory, number>
  );

  return {
    totalPrompts: prompts.length,
    categories,
    lastUpdated: new Date().toISOString(),
    version: '1.0.0',
  };
}

/**
 * Validate that all required variables are provided
 */
export function validatePromptVariables(
  template: PromptTemplate,
  variables: Record<string, string>
): PromptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const requiredVar of template.variables) {
    if (!(requiredVar in variables) || variables[requiredVar] === undefined) {
      errors.push(`Missing required variable: ${requiredVar}`);
    } else if (variables[requiredVar].trim() === '') {
      warnings.push(`Variable "${requiredVar}" is empty`);
    }
  }

  // Check for extraneous variables (not an error, just a warning)
  const allValidVars = new Set([...template.variables, ...(template.optionalVariables || [])]);
  for (const providedVar of Object.keys(variables)) {
    if (!allValidVars.has(providedVar)) {
      warnings.push(`Unused variable provided: ${providedVar}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Render a prompt template with variable substitution
 *
 * Replaces {{variableName}} placeholders with actual values
 */
export function renderPrompt(
  template: PromptTemplate,
  options: PromptRenderOptions
): RenderedPrompt {
  const { variables, modelOverride, temperatureOverride, maxTokensOverride } = options;

  // Validate variables
  const validation = validatePromptVariables(template, variables);
  if (!validation.valid) {
    throw new Error(`Invalid prompt variables: ${validation.errors.join(', ')}`);
  }

  // Render user prompt with variable substitution
  let userPrompt = template.userPromptTemplate;

  // Replace all {{variable}} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    userPrompt = userPrompt.replace(placeholder, value);
  }

  // Check for unreplaced variables (indicates missing required variables)
  const unreplacedVars = userPrompt.match(/\{\{(\w+)\}\}/g);
  if (unreplacedVars) {
    throw new Error(`Unreplaced variables in prompt: ${unreplacedVars.join(', ')}`);
  }

  // Determine model (use override or default to first suggestion)
  const model =
    modelOverride ||
    template.modelSuggestions.find((s) => s.priority === 'primary')?.model ||
    template.modelSuggestions[0]?.model ||
    'google/gemini-2.0-flash-exp:free';

  return {
    system: template.systemPrompt,
    user: userPrompt,
    config: {
      model,
      temperature: temperatureOverride ?? template.temperature ?? 0.7,
      maxTokens: maxTokensOverride ?? template.maxTokens ?? 2000,
      responseFormat: template.responseFormat,
    },
  };
}

/**
 * Helper function to render a prompt by ID
 */
export function renderPromptById(promptId: string, options: PromptRenderOptions): RenderedPrompt {
  const template = getPrompt(promptId);
  if (!template) {
    throw new Error(`Prompt not found: ${promptId}`);
  }
  return renderPrompt(template, options);
}

/**
 * List all available prompt IDs
 */
export function listPromptIds(): string[] {
  return Object.keys(promptStore);
}

/**
 * List all available prompt IDs with names and descriptions
 */
export function listPromptsWithInfo(): Array<{
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  version: string;
}> {
  return Object.values(promptStore).map((prompt) => ({
    id: prompt.id,
    name: prompt.name,
    description: prompt.description,
    category: prompt.category,
    version: prompt.version,
  }));
}

/**
 * Get recommended model for a prompt
 */
export function getRecommendedModel(promptId: string): string | undefined {
  const template = getPrompt(promptId);
  if (!template) return undefined;

  return (
    template.modelSuggestions.find((s) => s.priority === 'primary')?.model ||
    template.modelSuggestions[0]?.model
  );
}

/**
 * Get fallback models for a prompt
 */
export function getFallbackModels(promptId: string): string[] {
  const template = getPrompt(promptId);
  if (!template) return [];

  return template.modelSuggestions
    .filter((s) => s.priority === 'fallback' || s.priority === 'alternative')
    .map((s) => s.model);
}

export * from './ingredient-substitution';
export * from './meal-generation';
export * from './meal-pairing';
export * from './nutritional-estimation';
export * from './recipe-analysis';
// Re-export everything for convenience
export * from './types';

// Export metadata for documentation
export const PROMPT_STORE_VERSION = '1.0.0';
export const TOTAL_PROMPTS = Object.keys(promptStore).length;
