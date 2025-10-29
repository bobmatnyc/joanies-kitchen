/**
 * Recipe Instruction Classifier
 *
 * AI-powered classification of recipe instruction steps into structured metadata.
 * Provides work type, technique, tools, time estimates, and parallelization data.
 *
 * Note: Can be used in server actions and scripts (no 'server-only' directive)
 */

import OpenAI from 'openai';
import type {
  InstructionClassification,
  InstructionMetadata,
  SkillLevelEnum,
} from '@/types/instruction-metadata';
import {
  buildBatchClassificationPrompt,
  buildInstructionClassifierPrompt,
  INSTRUCTION_CLASSIFIER_SYSTEM_PROMPT,
  parseClassificationResponse,
  validateClassification,
} from './instruction-classifier-prompt';

const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';
const CLASSIFICATION_TEMPERATURE = 0.1; // Low for consistency

/**
 * Create OpenRouter client (script-safe version)
 */
function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
      'X-Title': 'Recipe Manager',
    },
  });
}

/**
 * Helper function to call OpenRouter API
 */
async function generateWithOpenRouter(params: {
  messages: Array<{ role: string; content: string }>;
  model: string;
  temperature: number;
}): Promise<string> {
  const client = getOpenRouterClient();

  const response = await client.chat.completions.create({
    model: params.model,
    messages: params.messages as any,
    temperature: params.temperature,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Classifies a single instruction step
 */
export async function classifyInstruction(
  instruction: string,
  recipeContext?: {
    recipeName?: string;
    cuisine?: string;
    difficulty?: string;
    mainIngredients?: string[];
  }
): Promise<InstructionMetadata | null> {
  try {
    const prompt = buildInstructionClassifierPrompt(instruction, recipeContext);

    const response = await generateWithOpenRouter({
      messages: [
        {
          role: 'system',
          content: INSTRUCTION_CLASSIFIER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: DEFAULT_MODEL,
      temperature: CLASSIFICATION_TEMPERATURE,
    });

    const classification = parseClassificationResponse(response);

    if (!classification) {
      console.error('Failed to parse classification response');
      return null;
    }

    // Validate classification
    const validation = validateClassification(classification);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
      // Still return it - validation errors might be minor
    }

    // Build metadata object
    const metadata: InstructionMetadata = {
      step_index: 0, // Will be set by caller
      step_text: instruction,
      classification,
      generated_at: new Date().toISOString(),
      model_used: DEFAULT_MODEL,
      confidence: classification.confidence,
    };

    return metadata;
  } catch (error) {
    console.error('Classification error:', error);
    return null;
  }
}

/**
 * Classifies all instructions in a recipe (batch)
 * This is more efficient than classifying individually
 */
export async function classifyRecipeInstructions(
  instructions: string[],
  recipeContext?: {
    recipeName?: string;
    cuisine?: string;
    difficulty?: string;
    mainIngredients?: string[];
  }
): Promise<InstructionMetadata[]> {
  try {
    const prompt = buildBatchClassificationPrompt(instructions, recipeContext);

    const response = await generateWithOpenRouter({
      messages: [
        {
          role: 'system',
          content: INSTRUCTION_CLASSIFIER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: DEFAULT_MODEL,
      temperature: CLASSIFICATION_TEMPERATURE,
    });

    // Parse batch response (remove markdown code blocks if present)
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const classifications = JSON.parse(cleanedResponse) as Array<
      InstructionClassification & { step_index: number }
    >;

    // Convert to metadata array
    const metadata: InstructionMetadata[] = classifications.map((classification) => ({
      step_index: classification.step_index,
      step_text: instructions[classification.step_index] || '',
      classification,
      generated_at: new Date().toISOString(),
      model_used: DEFAULT_MODEL,
      confidence: classification.confidence,
    }));

    // Validate all classifications
    const validationErrors: string[] = [];
    metadata.forEach((item, idx) => {
      const validation = validateClassification(item.classification);
      if (!validation.valid) {
        validationErrors.push(`Step ${idx}: ${validation.errors.join(', ')}`);
      }
    });

    if (validationErrors.length > 0) {
      console.warn('Validation warnings:', validationErrors);
      // Still return - these might be minor issues
    }

    return metadata;
  } catch (error) {
    console.error('Batch classification error:', error);
    return [];
  }
}

/**
 * Checks if a recipe needs classification
 */
export function needsClassification(recipe: {
  instructions: string | null;
  instruction_metadata: string | null;
}): boolean {
  if (!recipe.instructions) return false;
  if (recipe.instruction_metadata) return false; // Already classified

  return true;
}

/**
 * Estimates cost for classifying a recipe
 * Based on Gemini 2.0 Flash pricing
 */
export function estimateClassificationCost(instructionCount: number): number {
  const tokensPerInstruction = 550; // Average
  const totalTokens = tokensPerInstruction * instructionCount;

  // Gemini Flash pricing: $0.075/1M input, $0.30/1M output
  const inputCost = (totalTokens * 0.6 * 0.075) / 1_000_000; // 60% input
  const outputCost = (totalTokens * 0.4 * 0.3) / 1_000_000; // 40% output

  return inputCost + outputCost;
}

/**
 * Calculates total estimated time for all instructions at a given skill level
 */
export function calculateTotalTime(
  metadata: InstructionMetadata[],
  skillLevel: SkillLevelEnum
): number {
  return metadata.reduce((total, step) => {
    return total + step.classification.estimated_time_minutes[skillLevel];
  }, 0);
}

/**
 * Gets all unique tools required for a recipe
 */
export function getRequiredTools(metadata: InstructionMetadata[]): string[] {
  const tools = new Set<string>();
  metadata.forEach((step) => {
    step.classification.tools.forEach((tool) => tools.add(tool));
  });
  return Array.from(tools);
}

/**
 * Identifies steps that require constant attention
 */
export function getAttentionRequiredSteps(metadata: InstructionMetadata[]): InstructionMetadata[] {
  return metadata.filter((step) => step.classification.requires_attention);
}

/**
 * Identifies passive steps (can walk away)
 */
export function getPassiveSteps(metadata: InstructionMetadata[]): InstructionMetadata[] {
  return metadata.filter((step) => !step.classification.requires_attention);
}
