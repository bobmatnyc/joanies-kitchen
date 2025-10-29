/**
 * Recipe Instruction Step Classifier - LLM Prompt Template
 *
 * Optimized for inexpensive models:
 * - Google Gemini 2.0 Flash (primary)
 * - GPT-4o-mini (fallback)
 * - Claude Haiku (fallback)
 *
 * Cost per classification: ~$0.0003 - $0.001
 */

import type { InstructionClassification } from '@/types/instruction-metadata';

// ============================================================================
// Prompt Template
// ============================================================================

export const INSTRUCTION_CLASSIFIER_SYSTEM_PROMPT = `You are a professional chef and culinary instructor specializing in recipe analysis. Your task is to classify individual recipe instruction steps into structured metadata.

You have expert knowledge of:
- Cooking techniques and methods
- Kitchen equipment and tools
- Professional kitchen organization (brigade system)
- Time estimation for different skill levels
- Task parallelization and equipment conflicts

Your classifications must be precise, consistent, and based on professional culinary standards.`;

export function buildInstructionClassifierPrompt(
  instruction: string,
  recipeContext?: {
    recipeName?: string;
    cuisine?: string;
    difficulty?: string;
    mainIngredients?: string[];
  }
): string {
  const contextStr = recipeContext
    ? `
Recipe Context:
- Name: ${recipeContext.recipeName || 'Unknown'}
- Cuisine: ${recipeContext.cuisine || 'Unknown'}
- Difficulty: ${recipeContext.difficulty || 'Unknown'}
- Main Ingredients: ${recipeContext.mainIngredients?.join(', ') || 'Unknown'}
`
    : '';

  return `Analyze this cooking instruction step and extract structured classification data.

${contextStr}
Instruction Step:
"${instruction}"

Provide a JSON response with the following structure:

{
  "work_type": "one of: prep, cook, setup, rest, assemble, clean, marinate, mix, monitor, serve, chill, strain",
  "technique": "primary cooking technique (e.g., dice, saute, roast, simmer, whisk) or null if none",
  "tools": ["array of equipment/tools used (e.g., chef_knife, skillet, oven, cutting_board)"],
  "roles": ["kitchen roles that would perform this (e.g., prep_cook, saucier, patissier, home_cook)"],
  "skill_level_required": "beginner, intermediate, or advanced",
  "estimated_time_minutes": {
    "beginner": <number>,
    "intermediate": <number>,
    "advanced": <number>
  },
  "can_parallelize": true or false (can this be done while other tasks are ongoing?),
  "requires_attention": true or false (can you walk away during this step?),
  "temperature": {
    "value": <number or null>,
    "unit": "F" or "C" or null,
    "type": "oven_preheat, surface, liquid, storage, or null"
  } or null,
  "equipment_conflicts": ["list of equipment that would conflict (e.g., oven, stove)"] or [],
  "prerequisite_steps": [] (leave empty for now),
  "notes": "any additional context or special considerations",
  "confidence": <number 0.0-1.0>
}

Classification Guidelines:

1. WORK TYPE
   - prep: Chopping, peeling, measuring, trimming
   - cook: Active cooking with heat
   - setup: Equipment setup, preheating
   - rest: Waiting, cooling, setting (no active work)
   - assemble: Combining components, plating
   - clean: Washing, draining, patting dry
   - marinate: Soaking in liquid
   - mix: Stirring, whisking, kneading
   - monitor: Watching, adjusting (partial attention)
   - serve: Final plating, garnishing
   - chill: Refrigerating
   - strain: Draining, filtering

2. TECHNIQUE
   - Use specific technique names (dice, mince, saute, roast, simmer, etc.)
   - If multiple techniques, choose the PRIMARY one
   - Use null if no specific technique (e.g., "set aside")

3. TOOLS
   - Infer tools even if not explicitly mentioned
   - Examples: "chop onions" → ["chef_knife", "cutting_board"]
   - Examples: "boil water" → ["pot", "stove"]
   - Use standard tool names (snake_case)

4. ROLES
   - home_cook: Default for general home cooking
   - prep_cook: Basic prep tasks (chopping, measuring)
   - saucier: Sauces, sautéing, stews
   - rotisseur: Roasting, grilling meats
   - poissonnier: Fish/seafood
   - entremetier: Vegetables, soups, starches
   - patissier: Baking, desserts
   - garde_manger: Cold prep, salads
   - Can assign multiple roles if applicable

5. TIME ESTIMATION
   - Beginner: 1.5-2x intermediate time
   - Intermediate: Baseline competent cook
   - Advanced: 0.7-0.8x intermediate time
   - Be realistic - consider complexity and ingredient volume
   - Prep tasks vary most by skill level
   - Passive tasks (rest, chill) are same for all levels

6. PARALLELIZATION
   - can_parallelize: true if this can be done alongside other tasks
   - Examples of FALSE: active stovetop cooking requiring constant attention
   - Examples of TRUE: marinating, chilling, oven baking, basic prep

7. ATTENTION REQUIRED
   - requires_attention: true if you must stay nearby and monitor
   - FALSE for: chilling, marinating, resting, oven baking (set timer)
   - TRUE for: active cooking, monitoring, anything that could burn/overcook

8. TEMPERATURE
   - Extract numeric temperature if mentioned
   - Convert to Fahrenheit if in Celsius
   - Types:
     - oven_preheat: Oven setting
     - surface: Pan/grill surface temp
     - liquid: Boiling, simmering temp
     - storage: Refrigerator, freezer temp
   - Use null if no temperature mentioned

9. EQUIPMENT CONFLICTS
   - List equipment that would prevent parallel tasks
   - Common conflicts: oven, stove (especially if only one burner)
   - Not conflicts: mixing_bowl, cutting_board (multiple available)

10. CONFIDENCE SCORE
    - 0.95-1.0: Very clear, unambiguous instruction
    - 0.85-0.94: Clear with minor interpretation needed
    - 0.70-0.84: Some ambiguity in time/equipment
    - 0.0-0.69: Significant ambiguity, manual review needed

Examples:

Instruction: "Dice 2 medium onions into 1/4-inch pieces."
Response:
{
  "work_type": "prep",
  "technique": "dice",
  "tools": ["chef_knife", "cutting_board"],
  "roles": ["prep_cook", "home_cook"],
  "skill_level_required": "beginner",
  "estimated_time_minutes": {
    "beginner": 8,
    "intermediate": 4,
    "advanced": 2
  },
  "can_parallelize": true,
  "requires_attention": true,
  "temperature": null,
  "equipment_conflicts": [],
  "prerequisite_steps": [],
  "notes": "Standard prep task, beginner-friendly",
  "confidence": 0.98
}

Instruction: "Preheat oven to 375°F."
Response:
{
  "work_type": "setup",
  "technique": null,
  "tools": ["oven"],
  "roles": ["home_cook"],
  "skill_level_required": "beginner",
  "estimated_time_minutes": {
    "beginner": 10,
    "intermediate": 10,
    "advanced": 10
  },
  "can_parallelize": true,
  "requires_attention": false,
  "temperature": {
    "value": 375,
    "unit": "F",
    "type": "oven_preheat"
  },
  "equipment_conflicts": ["oven"],
  "prerequisite_steps": [],
  "notes": "Oven preheating typically takes 10-15 minutes",
  "confidence": 0.99
}

Instruction: "Sear the steak over high heat for 2-3 minutes per side until golden-brown."
Response:
{
  "work_type": "cook",
  "technique": "sear",
  "tools": ["cast_iron_skillet", "stove", "tongs"],
  "roles": ["rotisseur", "home_cook"],
  "skill_level_required": "intermediate",
  "estimated_time_minutes": {
    "beginner": 8,
    "intermediate": 6,
    "advanced": 5
  },
  "can_parallelize": false,
  "requires_attention": true,
  "temperature": {
    "value": 450,
    "unit": "F",
    "type": "surface"
  },
  "equipment_conflicts": ["stove"],
  "prerequisite_steps": [],
  "notes": "Requires constant attention to prevent burning",
  "confidence": 0.96
}

Now classify the instruction step provided above. Return ONLY the JSON object, no additional text.`;
}

// ============================================================================
// Response Parsing & Validation
// ============================================================================

export function parseClassificationResponse(
  responseText: string
): InstructionClassification | null {
  try {
    // Remove markdown code blocks if present
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    // Basic validation
    if (!parsed.work_type || !parsed.confidence) {
      console.error('Missing required fields in classification response');
      return null;
    }

    return parsed as InstructionClassification;
  } catch (error) {
    console.error('Failed to parse classification response:', error);
    return null;
  }
}

// ============================================================================
// Batch Classification Helper
// ============================================================================

export function buildBatchClassificationPrompt(
  instructions: string[],
  recipeContext?: {
    recipeName?: string;
    cuisine?: string;
    difficulty?: string;
    mainIngredients?: string[];
  }
): string {
  const contextStr = recipeContext
    ? `
Recipe Context:
- Name: ${recipeContext.recipeName || 'Unknown'}
- Cuisine: ${recipeContext.cuisine || 'Unknown'}
- Difficulty: ${recipeContext.difficulty || 'Unknown'}
- Main Ingredients: ${recipeContext.mainIngredients?.join(', ') || 'Unknown'}
`
    : '';

  const instructionsList = instructions.map((inst, idx) => `${idx + 1}. "${inst}"`).join('\n');

  return `Analyze these ${instructions.length} cooking instruction steps from a single recipe and classify each one.

${contextStr}
Instructions:
${instructionsList}

For each instruction, provide a JSON classification following this structure:
{
  "step_index": <0-based index>,
  "work_type": "...",
  "technique": "..." or null,
  "tools": [...],
  "roles": [...],
  "skill_level_required": "...",
  "estimated_time_minutes": { "beginner": ..., "intermediate": ..., "advanced": ... },
  "can_parallelize": true/false,
  "requires_attention": true/false,
  "temperature": {...} or null,
  "equipment_conflicts": [...],
  "prerequisite_steps": [],
  "notes": "...",
  "confidence": <0.0-1.0>
}

Important considerations for batch classification:
1. Consider the SEQUENCE - later steps may depend on earlier steps
2. Identify equipment conflicts across steps (multiple steps using oven/stove)
3. Mark setup steps (preheat, prepare ingredients) as prerequisite to cooking steps
4. Be consistent with time estimates across similar tasks

Return a JSON array with one classification object per instruction:
[
  { "step_index": 0, ... },
  { "step_index": 1, ... },
  ...
]

Return ONLY the JSON array, no additional text.`;
}

// ============================================================================
// Tool/Technique/Role Validation
// ============================================================================

// Valid work types
export const VALID_WORK_TYPES = [
  'prep',
  'cook',
  'setup',
  'rest',
  'assemble',
  'clean',
  'marinate',
  'mix',
  'monitor',
  'serve',
  'chill',
  'strain',
] as const;

// Common techniques (subset for validation)
export const COMMON_TECHNIQUES = [
  'roast',
  'bake',
  'broil',
  'grill',
  'sear',
  'boil',
  'simmer',
  'poach',
  'steam',
  'blanch',
  'braise',
  'stew',
  'saute',
  'fry',
  'deep_fry',
  'pan_fry',
  'stir_fry',
  'dice',
  'mince',
  'chop',
  'slice',
  'julienne',
  'whisk',
  'beat',
  'fold',
  'stir',
  'knead',
  'reduce',
  'deglaze',
  'season',
  'drain',
  'strain',
  'chill',
  'marinate',
  'rest',
] as const;

// Common roles
export const COMMON_ROLES = [
  'home_cook',
  'prep_cook',
  'saucier',
  'rotisseur',
  'poissonnier',
  'entremetier',
  'patissier',
  'garde_manger',
  'tournant',
] as const;

// Skill levels
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

/**
 * Validates a classification response for basic correctness
 */
export function validateClassification(classification: InstructionClassification): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check work type
  if (!VALID_WORK_TYPES.includes(classification.work_type as any)) {
    errors.push(`Invalid work_type: ${classification.work_type}`);
  }

  // Check skill level
  if (!SKILL_LEVELS.includes(classification.skill_level_required as any)) {
    errors.push(`Invalid skill_level_required: ${classification.skill_level_required}`);
  }

  // Check time estimates
  if (!classification.estimated_time_minutes) {
    errors.push('Missing estimated_time_minutes');
  } else {
    const { beginner, intermediate, advanced } = classification.estimated_time_minutes;
    if (beginner < advanced) {
      errors.push('Time estimates invalid: beginner < advanced');
    }
    if (intermediate < advanced) {
      errors.push('Time estimates invalid: intermediate < advanced');
    }
    if (beginner <= 0 || intermediate <= 0 || advanced <= 0) {
      errors.push('Time estimates must be positive');
    }
  }

  // Check confidence
  if (classification.confidence < 0 || classification.confidence > 1) {
    errors.push('Confidence must be between 0.0 and 1.0');
  }

  // Check tools array
  if (!Array.isArray(classification.tools)) {
    errors.push('Tools must be an array');
  }

  // Check roles array
  if (!Array.isArray(classification.roles)) {
    errors.push('Roles must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Example Usage
// ============================================================================

/*
import { generateWithOpenRouter } from '@/lib/ai/openrouter-server';

async function classifyInstruction(instruction: string) {
  const prompt = buildInstructionClassifierPrompt(instruction, {
    recipeName: 'Classic Beef Stew',
    cuisine: 'American',
    difficulty: 'intermediate',
    mainIngredients: ['beef', 'carrots', 'potatoes'],
  });

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
    model: 'google/gemini-2.0-flash-exp:free',
    temperature: 0.1, // Low temperature for consistency
  });

  const classification = parseClassificationResponse(response);

  if (classification) {
    const validation = validateClassification(classification);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }
    return classification;
  }

  return null;
}
*/
