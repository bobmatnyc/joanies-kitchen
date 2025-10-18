/**
 * Recipe Instruction Classification Types
 *
 * Comprehensive type definitions for recipe instruction step classification.
 * Used for AI-powered analysis of cooking steps to enhance meal planning.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const WorkType = z.enum([
  'prep',       // Chopping, peeling, measuring, trimming
  'cook',       // Active cooking with heat application
  'setup',      // Equipment setup, preheating, arrangement
  'rest',       // Waiting, resting, cooling, setting
  'assemble',   // Combining components, layering, building
  'clean',      // Washing, draining, patting dry
  'marinate',   // Soaking, marinating, brining
  'mix',        // Stirring, whisking, kneading, blending
  'monitor',    // Watching, adjusting heat, checking doneness
  'serve',      // Final plating, garnishing, presentation
  'chill',      // Refrigerating, freezing
  'strain',     // Draining, straining, filtering
]);

export const Technique = z.enum([
  // Dry Heat Methods
  'roast',
  'bake',
  'broil',
  'grill',
  'sear',
  'toast',

  // Moist Heat Methods
  'boil',
  'simmer',
  'poach',
  'steam',
  'blanch',
  'braise',
  'stew',

  // Fat-Based Methods
  'saute',
  'fry',
  'deep_fry',
  'pan_fry',
  'stir_fry',
  'sweat',
  'caramelize',

  // Cutting Techniques
  'dice',
  'mince',
  'chop',
  'slice',
  'julienne',
  'chiffonade',
  'cube',
  'brunoise',
  'peel',
  'trim',

  // Mixing Techniques
  'whisk',
  'beat',
  'fold',
  'stir',
  'knead',
  'cream',
  'emulsify',
  'whip',

  // Reduction & Concentration
  'reduce',
  'deglaze',
  'concentrate',

  // Other Essential Techniques
  'season',
  'taste',
  'drain',
  'strain',
  'toss',
  'plate',
  'garnish',
  'rest',
  'chill',
  'freeze',
  'thaw',
  'temper',
  'bloom',
  'proof',
  'glaze',
  'baste',
  'truss',
  'score',
  'zest',

  // Preparation Methods
  'marinate',
  'brine',
  'dry_rub',
  'coat',
  'dredge',

  // Safety & Quality
  'check_temp',
  'wash',
  'pat_dry',
]);

export const Tool = z.enum([
  // Cutting
  'chef_knife',
  'paring_knife',
  'bread_knife',
  'boning_knife',
  'cutting_board',
  'kitchen_shears',
  'vegetable_peeler',
  'mandoline',
  'box_grater',
  'microplane',

  // Cookware
  'skillet',
  'cast_iron_skillet',
  'nonstick_skillet',
  'small_saucepan',
  'medium_saucepan',
  'large_saucepan',
  'stock_pot',
  'dutch_oven',
  'wok',
  'griddle',
  'double_boiler',

  // Bakeware
  'baking_sheet',
  'baking_dish',
  'cake_pan',
  'muffin_tin',
  'loaf_pan',
  'pie_dish',
  'springform_pan',
  'cooling_rack',
  'parchment_paper',
  'aluminum_foil',

  // Utensils
  'wooden_spoon',
  'spatula',
  'rubber_spatula',
  'metal_spatula',
  'whisk',
  'tongs',
  'ladle',
  'slotted_spoon',
  'spider_strainer',
  'rolling_pin',
  'pastry_brush',
  'can_opener',

  // Appliances
  'oven',
  'stove',
  'microwave',
  'toaster',
  'toaster_oven',
  'blender',
  'immersion_blender',
  'food_processor',
  'stand_mixer',
  'hand_mixer',
  'slow_cooker',
  'pressure_cooker',
  'air_fryer',
  'rice_cooker',
  'coffee_grinder',

  // Measuring
  'measuring_cups',
  'measuring_spoons',
  'liquid_measuring_cup',
  'kitchen_scale',
  'instant_read_thermometer',
  'oven_thermometer',
  'timer',

  // Prep
  'small_mixing_bowl',
  'medium_mixing_bowl',
  'large_mixing_bowl',
  'colander',
  'fine_mesh_strainer',
  'salad_spinner',
  'citrus_juicer',
  'garlic_press',
  'mortar_and_pestle',

  // Serving
  'serving_platter',
  'serving_bowl',
  'serving_spoon',
  'carving_knife',
  'carving_fork',

  // Specialty
  'pasta_maker',
  'pizza_stone',
  'pizza_cutter',
  'meat_mallet',
  'meat_thermometer',
  'candy_thermometer',
  'kitchen_torch',
  'cheesecloth',
  'butcher_twine',
  'sushi_mat',
]);

export const KitchenRole = z.enum([
  // Home Cook Roles
  'home_cook',
  'meal_prepper',

  // Professional Brigade Roles
  'prep_cook',
  'commis',

  // Station-Specific Roles
  'saucier',
  'rotisseur',
  'grillardin',
  'friturier',
  'poissonnier',
  'entremetier',
  'potager',
  'legumier',
  'patissier',
  'boulanger',
  'glacier',
  'confiseur',
  'garde_manger',
  'boucher',

  // Management Roles
  'tournant',
  'sous_chef',
  'chef_de_partie',
  'expeditor',
]);

export const SkillLevel = z.enum(['beginner', 'intermediate', 'advanced']);

export const TemperatureUnit = z.enum(['F', 'C']);

export const TemperatureType = z.enum([
  'oven_preheat',
  'surface',
  'liquid',
  'storage',
]);

// ============================================================================
// Type Exports (for convenience)
// ============================================================================

export type WorkTypeEnum = z.infer<typeof WorkType>;
export type TechniqueEnum = z.infer<typeof Technique>;
export type ToolEnum = z.infer<typeof Tool>;
export type KitchenRoleEnum = z.infer<typeof KitchenRole>;
export type SkillLevelEnum = z.infer<typeof SkillLevel>;
export type TemperatureUnitEnum = z.infer<typeof TemperatureUnit>;
export type TemperatureTypeEnum = z.infer<typeof TemperatureType>;

// ============================================================================
// Classification Schema
// ============================================================================

export const TemperatureSchema = z.object({
  value: z.number(),
  unit: TemperatureUnit,
  type: TemperatureType,
});

export const TimeEstimateSchema = z.object({
  beginner: z.number().positive(),
  intermediate: z.number().positive(),
  advanced: z.number().positive(),
});

export const InstructionClassificationSchema = z.object({
  work_type: WorkType,
  technique: Technique.nullable(),
  tools: z.array(Tool),
  roles: z.array(KitchenRole),
  skill_level_required: SkillLevel,

  estimated_time_minutes: TimeEstimateSchema,

  can_parallelize: z.boolean(),
  requires_attention: z.boolean(),

  temperature: TemperatureSchema.nullable(),

  equipment_conflicts: z.array(Tool),
  prerequisite_steps: z.array(z.number()), // Step indices

  notes: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export const InstructionMetadataSchema = z.object({
  step_index: z.number().int().nonnegative(),
  step_text: z.string(),
  classification: InstructionClassificationSchema,
  generated_at: z.string(), // ISO timestamp
  model_used: z.string(), // e.g., "gpt-4o-mini", "gemini-2.0-flash"
  confidence: z.number().min(0).max(1),
});

// ============================================================================
// Type Exports
// ============================================================================

export type Temperature = z.infer<typeof TemperatureSchema>;
export type TimeEstimate = z.infer<typeof TimeEstimateSchema>;
export type InstructionClassification = z.infer<typeof InstructionClassificationSchema>;
export type InstructionMetadata = z.infer<typeof InstructionMetadataSchema>;

// ============================================================================
// Recipe with Classified Instructions
// ============================================================================

export const RecipeWithClassifiedInstructionsSchema = z.object({
  id: z.string(),
  name: z.string(),
  instructions: z.array(z.string()),
  instruction_metadata: z.array(InstructionMetadataSchema).nullable(),
});

export type RecipeWithClassifiedInstructions = z.infer<
  typeof RecipeWithClassifiedInstructionsSchema
>;

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Identifies steps that can be done in parallel
 */
export function getParallelSteps(
  metadata: InstructionMetadata[]
): InstructionMetadata[][] {
  const parallel: InstructionMetadata[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < metadata.length; i++) {
    if (used.has(i)) continue;

    const step = metadata[i];
    if (!step.classification.can_parallelize) {
      parallel.push([step]);
      used.add(i);
      continue;
    }

    const group = [step];
    used.add(i);

    // Find other steps that can run in parallel
    for (let j = i + 1; j < metadata.length; j++) {
      if (used.has(j)) continue;

      const candidate = metadata[j];
      if (!candidate.classification.can_parallelize) continue;

      // Check for equipment conflicts
      const hasConflict = step.classification.equipment_conflicts.some((tool) =>
        candidate.classification.tools.includes(tool)
      );

      if (!hasConflict) {
        group.push(candidate);
        used.add(j);
      }
    }

    parallel.push(group);
  }

  return parallel;
}

/**
 * Identifies equipment conflicts across all steps
 */
export function getEquipmentConflicts(
  metadata: InstructionMetadata[]
): Array<{ equipment: ToolEnum; steps: number[] }> {
  const equipmentUsage = new Map<ToolEnum, number[]>();

  metadata.forEach((step, idx) => {
    step.classification.equipment_conflicts.forEach((tool) => {
      if (!equipmentUsage.has(tool)) {
        equipmentUsage.set(tool, []);
      }
      equipmentUsage.get(tool)!.push(idx);
    });
  });

  return Array.from(equipmentUsage.entries())
    .filter(([_, steps]) => steps.length > 1)
    .map(([equipment, steps]) => ({ equipment, steps }));
}

/**
 * Gets all unique tools required for a recipe
 */
export function getRequiredTools(metadata: InstructionMetadata[]): ToolEnum[] {
  const tools = new Set<ToolEnum>();
  metadata.forEach((step) => {
    step.classification.tools.forEach((tool) => tools.add(tool));
  });
  return Array.from(tools);
}

/**
 * Gets all techniques used in a recipe
 */
export function getUsedTechniques(metadata: InstructionMetadata[]): TechniqueEnum[] {
  const techniques = new Set<TechniqueEnum>();
  metadata.forEach((step) => {
    if (step.classification.technique) {
      techniques.add(step.classification.technique);
    }
  });
  return Array.from(techniques);
}

/**
 * Categorizes steps by work type
 */
export function groupByWorkType(
  metadata: InstructionMetadata[]
): Map<WorkTypeEnum, InstructionMetadata[]> {
  const groups = new Map<WorkTypeEnum, InstructionMetadata[]>();

  metadata.forEach((step) => {
    const workType = step.classification.work_type;
    if (!groups.has(workType)) {
      groups.set(workType, []);
    }
    groups.get(workType)!.push(step);
  });

  return groups;
}

/**
 * Determines overall recipe difficulty based on classified steps
 */
export function calculateRecipeDifficulty(
  metadata: InstructionMetadata[]
): SkillLevelEnum {
  const skillLevels = metadata.map((s) => s.classification.skill_level_required);

  const hasAdvanced = skillLevels.includes('advanced');
  const hasIntermediate = skillLevels.includes('intermediate');

  if (hasAdvanced) return 'advanced';
  if (hasIntermediate && skillLevels.length > 3) return 'intermediate';
  if (hasIntermediate) return 'intermediate';
  return 'beginner';
}

/**
 * Identifies steps that require constant attention
 */
export function getAttentionRequiredSteps(
  metadata: InstructionMetadata[]
): InstructionMetadata[] {
  return metadata.filter((step) => step.classification.requires_attention);
}

/**
 * Identifies passive steps (can walk away)
 */
export function getPassiveSteps(metadata: InstructionMetadata[]): InstructionMetadata[] {
  return metadata.filter((step) => !step.classification.requires_attention);
}

/**
 * Validates that prerequisite steps make sense (no circular dependencies)
 */
export function validatePrerequisites(metadata: InstructionMetadata[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  metadata.forEach((step, idx) => {
    step.classification.prerequisite_steps.forEach((prereqIdx) => {
      if (prereqIdx >= idx) {
        errors.push(
          `Step ${idx} has invalid prerequisite ${prereqIdx} (must be earlier step)`
        );
      }
      if (prereqIdx < 0 || prereqIdx >= metadata.length) {
        errors.push(`Step ${idx} has invalid prerequisite ${prereqIdx} (out of range)`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Constants
// ============================================================================

export const SKILL_LEVEL_LABELS: Record<SkillLevelEnum, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const WORK_TYPE_LABELS: Record<WorkTypeEnum, string> = {
  prep: 'Preparation',
  cook: 'Cooking',
  setup: 'Setup',
  rest: 'Resting',
  assemble: 'Assembly',
  clean: 'Cleaning',
  marinate: 'Marinating',
  mix: 'Mixing',
  monitor: 'Monitoring',
  serve: 'Serving',
  chill: 'Chilling',
  strain: 'Straining',
};

export const WORK_TYPE_ICONS: Record<WorkTypeEnum, string> = {
  prep: '🔪',
  cook: '🔥',
  setup: '⚙️',
  rest: '⏰',
  assemble: '🏗️',
  clean: '🧼',
  marinate: '🫗',
  mix: '🥄',
  monitor: '👀',
  serve: '🍽️',
  chill: '❄️',
  strain: '🚰',
};

export const SKILL_LEVEL_COLORS: Record<SkillLevelEnum, string> = {
  beginner: 'green',
  intermediate: 'yellow',
  advanced: 'red',
};
