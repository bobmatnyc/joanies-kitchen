/**
 * AI Prompt Store - Type Definitions
 *
 * Centralized type system for reusable, versioned AI prompts
 */

/**
 * Prompt category types
 */
export type PromptCategory =
  | 'meal' // Meal planning and generation
  | 'recipe' // Recipe creation and modification
  | 'nutrition' // Nutritional analysis and estimation
  | 'analysis'; // Recipe analysis and classification

/**
 * Model recommendation with priority
 */
export interface ModelSuggestion {
  model: string;
  priority: 'primary' | 'fallback' | 'alternative';
  reason?: string;
}

/**
 * Temperature settings for different use cases
 */
export interface TemperaturePreset {
  creative: number; // 0.7-0.9 for creative tasks
  balanced: number; // 0.5-0.7 for balanced output
  precise: number; // 0.1-0.3 for factual/classification
}

/**
 * Core prompt template structure
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  category: PromptCategory;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[]; // Required template variables
  optionalVariables?: string[]; // Optional template variables
  modelSuggestions: ModelSuggestion[];
  temperature?: number; // Recommended temperature
  maxTokens?: number; // Recommended max tokens
  responseFormat?: 'json_object' | 'text'; // Expected response format
  examples?: PromptExample[]; // Example inputs/outputs
  tags?: string[]; // Searchable tags
  metadata?: {
    costEstimate?: string; // e.g., "$0.0003-$0.001 per call"
    averageLatency?: string; // e.g., "1-2 seconds"
    author?: string;
    lastUpdated?: string;
  };
}

/**
 * Example input/output for a prompt
 */
export interface PromptExample {
  input: Record<string, string>;
  output: string;
  notes?: string;
}

/**
 * Rendered prompt ready for AI call
 */
export interface RenderedPrompt {
  system: string;
  user: string;
  config: {
    model: string;
    temperature: number;
    maxTokens: number;
    responseFormat?: 'json_object' | 'text';
  };
}

/**
 * Prompt rendering options
 */
export interface PromptRenderOptions {
  variables: Record<string, string>;
  modelOverride?: string; // Override default model
  temperatureOverride?: number; // Override default temperature
  maxTokensOverride?: number; // Override default max tokens
}

/**
 * Validation result for rendered prompts
 */
export interface PromptValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Prompt store registry metadata
 */
export interface PromptStoreMetadata {
  totalPrompts: number;
  categories: Record<PromptCategory, number>;
  lastUpdated: string;
  version: string;
}
