/**
 * Normalize Recipe Data for Meal Planning
 *
 * This script uses LLMs to parse recipe data and populate:
 * - Normalized ingredients database
 * - Tools/equipment database
 * - Recipe ingredient mappings
 * - Recipe tool mappings
 * - Recipe tasks with time estimates and role assignments
 *
 * Run once to process all existing recipes, then use incremental updates for new recipes.
 */

import 'dotenv/config';
import { db } from '../src/lib/db';
import {
  recipes,
  ingredients,
  recipeIngredients,
  tools,
  recipeTools,
  recipeTasks,
  type NewIngredient,
  type NewRecipeIngredient,
  type NewTool,
  type NewRecipeTool,
  type NewRecipeTask,
} from '../src/lib/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Model configuration
const PARSING_MODEL = 'anthropic/claude-3.5-sonnet'; // Best for structured extraction
const BATCH_SIZE = 10; // Process N recipes at a time
const DELAY_MS = 1000; // Rate limiting between batches

interface ParsedIngredient {
  canonical_name: string; // Normalized name (lowercase, singular)
  display_name: string; // Display name (proper case)
  category: string;
  subcategory?: string;
  amount?: number;
  unit?: string;
  preparation?: string;
  is_optional: boolean;
  original_text: string;
}

interface ParsedTool {
  canonical_name: string;
  display_name: string;
  category: string;
  is_optional: boolean;
  quantity: number;
  notes?: string;
}

interface ParsedTask {
  task_name: string;
  task_order: number;
  instruction_text: string;
  task_type: string;
  role: string;
  active_time: number;
  passive_time: number;
  can_be_parallel: boolean;
  depends_on_indices: number[]; // Task indices this depends on
  ingredient_names: string[]; // Canonical names
  tool_names: string[]; // Canonical names
}

/**
 * Parse recipe ingredients using LLM
 */
async function parseIngredients(
  recipeId: string,
  recipeName: string,
  ingredientsJson: string
): Promise<ParsedIngredient[]> {
  const prompt = `Parse these recipe ingredients into normalized, structured data.

Recipe: ${recipeName}
Ingredients:
${ingredientsJson}

For each ingredient, extract:
1. canonical_name: Lowercase, singular form (e.g., "all-purpose flour", "yellow onion")
2. display_name: Proper case display name (e.g., "All-Purpose Flour")
3. category: One of [produce, meat, seafood, dairy, grains, baking, spices, condiments, canned, frozen, beverages, other]
4. subcategory: More specific (e.g., "vegetables", "herbs", "chicken", "beef")
5. amount: Numeric amount if specified (e.g., 2.5)
6. unit: Unit as written (cup, tbsp, oz, lb, g, etc.)
7. preparation: Preparation method (diced, minced, chopped, etc.)
8. is_optional: Boolean if marked optional
9. original_text: Original ingredient line

Return ONLY a JSON array of objects. No additional text.

Example:
[
  {
    "canonical_name": "yellow onion",
    "display_name": "Yellow Onion",
    "category": "produce",
    "subcategory": "vegetables",
    "amount": 1,
    "unit": "large",
    "preparation": "diced",
    "is_optional": false,
    "original_text": "1 large yellow onion, diced"
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: PARSING_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`[parseIngredients] Error for recipe ${recipeId}:`, error);
    return [];
  }
}

/**
 * Parse recipe tools using LLM
 */
async function parseTools(
  recipeId: string,
  recipeName: string,
  instructionsJson: string
): Promise<ParsedTool[]> {
  const prompt = `Extract all kitchen tools and equipment needed for this recipe.

Recipe: ${recipeName}
Instructions:
${instructionsJson}

For each tool, identify:
1. canonical_name: Lowercase, specific name (e.g., "large-pot", "8-inch-skillet")
2. display_name: Proper case (e.g., "Large Pot", "8-inch Skillet")
3. category: One of [cookware, bakeware, knives, utensils, appliances, measuring, prep, serving, other]
4. is_optional: Boolean if can be substituted
5. quantity: How many needed (usually 1)
6. notes: Size or specifications

Return ONLY a JSON array. No additional text.

Example:
[
  {
    "canonical_name": "large-pot",
    "display_name": "Large Pot",
    "category": "cookware",
    "is_optional": false,
    "quantity": 1,
    "notes": "3-4 quart capacity"
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: PARSING_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`[parseTools] Error for recipe ${recipeId}:`, error);
    return [];
  }
}

/**
 * Break down recipe into tasks with time estimates and roles
 */
async function parseTasks(
  recipeId: string,
  recipeName: string,
  instructionsJson: string,
  ingredientsJson: string
): Promise<ParsedTask[]> {
  const prompt = `Break down this recipe into individual tasks with time estimates and restaurant-style role assignments.

Recipe: ${recipeName}

Instructions:
${instructionsJson}

Ingredients available:
${ingredientsJson}

For each task, provide:
1. task_name: Short name (e.g., "Dice onions", "Boil pasta", "Bake chicken")
2. task_order: Sequential number starting from 1
3. instruction_text: Full instruction step
4. task_type: One of [prep, mixing, cooking, baking, chilling, resting, boiling, simmering, sauteing, searing, roasting, grilling, frying, assembly, plating, other]
5. role: One of [prep_cook, line_cook, pastry, garde_manger, sous_chef, expeditor]
   - prep_cook: Chopping, peeling, measuring
   - line_cook: Active cooking, sautéing, searing
   - pastry: Baking, desserts
   - garde_manger: Cold prep, salads, appetizers
   - sous_chef: Multi-tasking, coordination
   - expeditor: Final plating, assembly
6. active_time: Hands-on time in minutes
7. passive_time: Waiting time in minutes (oven, chilling, resting)
8. can_be_parallel: Boolean - can this be done alongside other tasks?
9. depends_on_indices: Array of task_order numbers that must be completed first
10. ingredient_names: Array of canonical ingredient names used in this step
11. tool_names: Array of canonical tool names used

Return ONLY a JSON array. No additional text.

Example:
[
  {
    "task_name": "Dice onions",
    "task_order": 1,
    "instruction_text": "Dice the onion into 1/4-inch pieces",
    "task_type": "prep",
    "role": "prep_cook",
    "active_time": 5,
    "passive_time": 0,
    "can_be_parallel": true,
    "depends_on_indices": [],
    "ingredient_names": ["yellow onion"],
    "tool_names": ["chef-knife", "cutting-board"]
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: PARSING_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 6000,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`[parseTasks] Error for recipe ${recipeId}:`, error);
    return [];
  }
}

/**
 * Find or create normalized ingredient
 */
async function findOrCreateIngredient(parsed: ParsedIngredient): Promise<string> {
  // Check if ingredient already exists
  const existing = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.name, parsed.canonical_name))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create new ingredient
  const [newIngredient] = await db
    .insert(ingredients)
    .values({
      name: parsed.canonical_name,
      display_name: parsed.display_name,
      category: parsed.category as any,
      subcategory: parsed.subcategory,
      standard_unit: parsed.unit || 'unit',
      unit_type: determineUnitType(parsed.unit),
      is_common: isCommonIngredient(parsed.canonical_name),
    })
    .returning();

  console.log(`  ✓ Created ingredient: ${newIngredient.display_name}`);
  return newIngredient.id;
}

/**
 * Find or create normalized tool
 */
async function findOrCreateTool(parsed: ParsedTool): Promise<string> {
  const existing = await db
    .select()
    .from(tools)
    .where(eq(tools.name, parsed.canonical_name))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [newTool] = await db
    .insert(tools)
    .values({
      name: parsed.canonical_name,
      display_name: parsed.display_name,
      category: parsed.category as any,
      is_essential: isEssentialTool(parsed.canonical_name),
    })
    .returning();

  console.log(`  ✓ Created tool: ${newTool.display_name}`);
  return newTool.id;
}

/**
 * Determine unit type from unit string
 */
function determineUnitType(unit?: string): 'volume' | 'weight' | 'count' | 'subjective' {
  if (!unit) return 'count';
  const lower = unit.toLowerCase();

  const volumeUnits = ['cup', 'tbsp', 'tsp', 'ml', 'l', 'fl oz', 'quart', 'pint', 'gallon'];
  const weightUnits = ['oz', 'lb', 'g', 'kg', 'mg'];
  const subjectiveUnits = ['taste', 'needed', 'desired', 'pinch', 'dash'];

  if (volumeUnits.some(u => lower.includes(u))) return 'volume';
  if (weightUnits.some(u => lower.includes(u))) return 'weight';
  if (subjectiveUnits.some(u => lower.includes(u))) return 'subjective';

  return 'count';
}

/**
 * Check if ingredient is commonly stocked
 */
function isCommonIngredient(name: string): boolean {
  const common = [
    'salt', 'pepper', 'olive oil', 'butter', 'garlic', 'onion',
    'sugar', 'flour', 'egg', 'milk', 'water', 'oil'
  ];
  return common.some(c => name.includes(c));
}

/**
 * Check if tool is essential kitchen equipment
 */
function isEssentialTool(name: string): boolean {
  const essential = [
    'knife', 'cutting-board', 'pot', 'pan', 'bowl', 'spoon',
    'measuring-cup', 'measuring-spoon', 'spatula'
  ];
  return essential.some(e => name.includes(e));
}

/**
 * Process a single recipe
 */
async function processRecipe(recipe: any) {
  console.log(`\n[${recipe.id}] Processing: ${recipe.name}`);

  try {
    // Parse ingredients
    const parsedIngredients = await parseIngredients(
      recipe.id,
      recipe.name,
      recipe.ingredients
    );

    // Create ingredient mappings
    for (let i = 0; i < parsedIngredients.length; i++) {
      const parsed = parsedIngredients[i];
      const ingredientId = await findOrCreateIngredient(parsed);

      await db.insert(recipeIngredients).values({
        recipe_id: recipe.id,
        ingredient_id: ingredientId,
        amount: parsed.amount ? String(parsed.amount) : null,
        unit: parsed.unit,
        preparation: parsed.preparation,
        is_optional: parsed.is_optional,
        display_order: i + 1,
        original_text: parsed.original_text,
        parsed_by_model: PARSING_MODEL,
        confidence_score: '0.95',
        needs_review: false,
      });
    }

    console.log(`  ✓ Mapped ${parsedIngredients.length} ingredients`);

    // Parse tools
    const parsedTools = await parseTools(
      recipe.id,
      recipe.name,
      recipe.instructions
    );

    // Create tool mappings
    for (const parsed of parsedTools) {
      const toolId = await findOrCreateTool(parsed);

      await db.insert(recipeTools).values({
        recipe_id: recipe.id,
        tool_id: toolId,
        is_optional: parsed.is_optional,
        quantity: parsed.quantity,
        notes: parsed.notes,
      });
    }

    console.log(`  ✓ Mapped ${parsedTools.length} tools`);

    // Parse tasks
    const parsedTasks = await parseTasks(
      recipe.id,
      recipe.name,
      recipe.instructions,
      recipe.ingredients
    );

    // Create task entries
    const ingredientNameToId = new Map<string, string>();
    for (const parsed of parsedIngredients) {
      const ing = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.name, parsed.canonical_name))
        .limit(1);
      if (ing.length > 0) {
        ingredientNameToId.set(parsed.canonical_name, ing[0].id);
      }
    }

    const toolNameToId = new Map<string, string>();
    for (const parsed of parsedTools) {
      const tool = await db
        .select()
        .from(tools)
        .where(eq(tools.name, parsed.canonical_name))
        .limit(1);
      if (tool.length > 0) {
        toolNameToId.set(parsed.canonical_name, tool[0].id);
      }
    }

    const taskIdsByOrder = new Map<number, string>();

    for (const parsed of parsedTasks) {
      const ingredientIds = parsed.ingredient_names
        .map(name => ingredientNameToId.get(name))
        .filter(Boolean);

      const toolIds = parsed.tool_names
        .map(name => toolNameToId.get(name))
        .filter(Boolean);

      const dependsOnTaskIds = parsed.depends_on_indices
        .map(idx => taskIdsByOrder.get(idx))
        .filter(Boolean);

      const [task] = await db.insert(recipeTasks).values({
        recipe_id: recipe.id,
        task_name: parsed.task_name,
        task_order: parsed.task_order,
        instruction_text: parsed.instruction_text,
        task_type: parsed.task_type as any,
        role: parsed.role as any,
        active_time: parsed.active_time,
        passive_time: parsed.passive_time,
        can_be_parallel: parsed.can_be_parallel,
        depends_on_task_ids: JSON.stringify(dependsOnTaskIds),
        ingredient_ids: JSON.stringify(ingredientIds),
        tool_ids: JSON.stringify(toolIds),
        parsed_by_model: PARSING_MODEL,
        confidence_score: '0.90',
      }).returning();

      taskIdsByOrder.set(parsed.task_order, task.id);
    }

    console.log(`  ✓ Created ${parsedTasks.length} tasks`);
    console.log(`✓ Completed: ${recipe.name}`);

  } catch (error) {
    console.error(`✗ Error processing recipe ${recipe.id}:`, error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🍳 Recipe Normalization for Meal Planning');
  console.log('==========================================\n');

  // Get all recipes that haven't been normalized yet
  const recipesToProcess = await db
    .select()
    .from(recipes)
    .where(isNull(recipes.is_meal_prep_friendly))
    .limit(BATCH_SIZE);

  console.log(`Found ${recipesToProcess.length} recipes to process\n`);

  for (let i = 0; i < recipesToProcess.length; i++) {
    const recipe = recipesToProcess[i];

    await processRecipe(recipe);

    // Rate limiting
    if (i < recipesToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n✅ Normalization complete!');
  console.log(`Processed ${recipesToProcess.length} recipes`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
