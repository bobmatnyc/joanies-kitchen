// ============================================================================
// Joanie's Kitchen Meal Pairing Prompt System
// Integrates with OpenRouter and Semantic Search
// Sophistication: Simple → Intermediate (Flavor Science + Practical Heuristics)
// ============================================================================

// System context for OpenRouter API calls
const MEAL_PAIRING_SYSTEM_PROMPT = `You are Joanie's Kitchen meal planning assistant. You create balanced, delicious multi-course meals using flavor science, cultural traditions, and practical cooking wisdom.

CORE PAIRING PRINCIPLES:

1. WEIGHT MATCHING (1-5 scale)
   - Heavy mains (4-5) → Light sides/apps (1-2)
   - Medium mains (3) → Light-medium sides (2-3)
   - Light mains (1-2) → Light sides (1-3)

2. ACID-FAT BALANCE
   - Rich/fatty dishes REQUIRE acidic components
   - Rule: side_acidity >= main_richness - 1

3. TEXTURE CONTRAST (minimum 6 unique textures per meal)
   - Never serve consecutive courses with identical texture
   - Layer opposites: crispy/creamy, crunchy/soft, flaky/smooth

4. TEMPERATURE PROGRESSION
   - Classic: Hot → Cold → Hot → Cold
   - Alternation prevents sensory fatigue

5. FLAVOR INTENSITY MATCHING
   - Match within 1-2 points on 1-5 scale
   - Delicate with delicate, bold with bold
   - Exception: palate cleansers after rich courses

6. CULTURAL COHERENCE
   - Western cuisines: prefer shared flavor compounds
   - East Asian: embrace contrasting flavor profiles
   - Match regional pairing traditions when cuisine specified

7. NUTRITIONAL BALANCE
   - Target: 40% carbs, 30% protein, 30% fats across full meal
   - Minimum 10g fiber across courses
   - Distribute protein: appetizer 15%, main 65%, side 20%

8. COLOR VARIETY
   - Minimum 3 distinct colors per course
   - Avoid monochromatic plates (all beige/brown)

DATABASE INTEGRATION:
- Use semantic search results to find compatible recipes
- Consider ingredient co-occurrence patterns
- Respect seasonal alignment when available
- Prioritize recipes with complementary cooking methods`;

// ============================================================================
// Type Definitions
// ============================================================================

interface MealPairingInput {
  mode: 'cuisine' | 'theme' | 'main-first' | 'freestyle';
  cuisine?: string;
  theme?: string;
  mainDish?: string;
  dietaryRestrictions?: string[];
  availableIngredients?: string[];
  timeLimit?: number;
  servings?: number;
}

interface RecipeSearchResult {
  id: string;
  name: string;
  description: string;
  score: number;
  course?: string;
}

interface MealPlanCourse {
  name: string;
  description: string;
  weight_score?: number;
  richness_score?: number;
  acidity_score?: number;
  sweetness_level?: string;
  dominant_textures: string[];
  dominant_flavors?: string[];
  temperature: 'hot' | 'cold' | 'room';
  prep_time_minutes: number;
  key_ingredients: string[];
  pairing_rationale: string;
  cuisine_influence?: string;
  recipe_id?: string; // Link to existing recipe in DB
}

interface MealPlan {
  appetizer: MealPlanCourse;
  main: MealPlanCourse;
  side: MealPlanCourse;
  dessert: MealPlanCourse;
  meal_analysis: {
    total_prep_time: number;
    texture_variety_count: number;
    color_palette: string[];
    temperature_progression: string[];
    cultural_coherence: string;
    estimated_macros: {
      carbs_percent: number;
      protein_percent: number;
      fat_percent: number;
    };
    chef_notes: string;
  };
}

// ============================================================================
// Prompt Builder
// ============================================================================

function buildMealPairingPrompt(input: MealPairingInput): string {
  let prompt = '';

  // MODE 1: Cuisine-based
  if (input.mode === 'cuisine' && input.cuisine) {
    prompt = `Create a complete ${input.cuisine} meal with appetizer, main course, side dish, and dessert.

CUISINE CONTEXT: ${input.cuisine}
Apply appropriate cultural pairing traditions for this cuisine.

CONSTRAINTS:`;
  }

  // MODE 2: Theme-based
  if (input.mode === 'theme' && input.theme) {
    prompt = `Create a complete meal for the theme: "${input.theme}"
Include appetizer, main course, side dish, and dessert that cohesively express this theme.

THEME INTERPRETATION:
- Consider seasonal associations
- Apply appropriate formality level
- Match occasion expectations

CONSTRAINTS:`;
  }

  // MODE 3: Main-first (most common use case)
  if (input.mode === 'main-first' && input.mainDish) {
    prompt = `Given this main dish, create complementary appetizer, side dish, and dessert:

MAIN DISH: ${input.mainDish}

ANALYSIS REQUIRED:
1. Identify main dish weight/richness (1-5)
2. Determine dominant flavors and textures
3. Assess fat content and acidity needs
4. Note cultural cuisine context

PAIRING STRATEGY:
- Appetizer should stimulate appetite (light, acidic, or hot)
- Side should balance main's richness and provide texture contrast
- Dessert should provide sweet closure without overwhelming

CONSTRAINTS:`;
  }

  // MODE 4: Freestyle
  if (input.mode === 'freestyle') {
    prompt = `Create a balanced, delicious multi-course meal (appetizer, main, side, dessert).

CREATIVE BRIEF:
- Showcase seasonal ingredients when possible
- Balance familiar with unexpected
- Ensure technical feasibility for home cooks

CONSTRAINTS:`;
  }

  // Add universal constraints
  if (input.dietaryRestrictions?.length) {
    prompt += `\n- Dietary restrictions: ${input.dietaryRestrictions.join(', ')}`;
  }

  if (input.availableIngredients?.length) {
    prompt += `\n- Prioritize these available ingredients: ${input.availableIngredients.join(', ')}`;
  }

  if (input.timeLimit) {
    prompt += `\n- Maximum total prep time: ${input.timeLimit} minutes`;
  }

  prompt += `\n- Servings: ${input.servings || 4}`;

  // Output format specification
  prompt += `

OUTPUT FORMAT (JSON):
{
  "appetizer": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "Why this starts the meal well"
  },
  "main": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "richness_score": 1-5,
    "dominant_flavors": [],
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "cuisine_influence": ""
  },
  "side": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "acidity_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "How this balances the main"
  },
  "dessert": {
    "name": "",
    "description": "",
    "sweetness_level": "light|moderate|rich",
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "Why this concludes the meal"
  },
  "meal_analysis": {
    "total_prep_time": 0,
    "texture_variety_count": 0,
    "color_palette": [],
    "temperature_progression": [],
    "cultural_coherence": "",
    "estimated_macros": {
      "carbs_percent": 0,
      "protein_percent": 0,
      "fat_percent": 0
    },
    "chef_notes": "Overall meal philosophy and any special considerations"
  }
}

CRITICAL: Respond ONLY with valid JSON. No markdown, no backticks, no explanatory text.`;

  return prompt;
}

// ============================================================================
// Semantic Search Integration
// ============================================================================

/**
 * Mock semantic search - replace with your actual implementation
 */
async function semanticSearch(params: {
  query: string;
  limit: number;
  filters?: {
    course?: string;
    dietary?: string[];
  };
}): Promise<RecipeSearchResult[]> {
  // TODO: Replace with actual pgvector semantic search
  // This should query your recipes table using embeddings
  console.log('Semantic search:', params);
  return [];
}

/**
 * Enriches meal plan with links to actual recipes in database
 */
function enrichWithRecipeLinks(
  mealPlan: MealPlan,
  candidates: {
    appetizerCandidates: RecipeSearchResult[];
    sideCandidates: RecipeSearchResult[];
    dessertCandidates: RecipeSearchResult[];
  }
): MealPlan {
  // Simple matching: look for recipe name similarity
  const findMatch = (courseName: string, candidates: RecipeSearchResult[]) => {
    const match = candidates.find(c =>
      c.name.toLowerCase().includes(courseName.toLowerCase()) ||
      courseName.toLowerCase().includes(c.name.toLowerCase())
    );
    return match?.id;
  };

  return {
    ...mealPlan,
    appetizer: {
      ...mealPlan.appetizer,
      recipe_id: findMatch(mealPlan.appetizer.name, candidates.appetizerCandidates)
    },
    side: {
      ...mealPlan.side,
      recipe_id: findMatch(mealPlan.side.name, candidates.sideCandidates)
    },
    dessert: {
      ...mealPlan.dessert,
      recipe_id: findMatch(mealPlan.dessert.name, candidates.dessertCandidates)
    }
  };
}

// ============================================================================
// Main Meal Generation Function
// ============================================================================

async function generateMealWithSemanticSearch(
  input: MealPairingInput
): Promise<MealPlan> {

  // Step 1: If main dish is specified, find similar recipes
  let semanticContext = '';

  if (input.mainDish) {
    const similarMains = await semanticSearch({
      query: input.mainDish,
      limit: 3,
      filters: { course: 'main' }
    });

    if (similarMains.length > 0) {
      semanticContext += `\nRELATED MAIN DISHES IN DATABASE:\n`;
      semanticContext += similarMains.map(r =>
        `- ${r.name} (similarity: ${r.score.toFixed(2)}): ${r.description}`
      ).join('\n');
    }
  }

  // Step 2: Build constraint-aware searches for other courses

  // For appetizer: search for light, acidic, stimulating
  const appetizerCandidates = await semanticSearch({
    query: `light appetizer ${input.cuisine || ''} acidic fresh`,
    limit: 5,
    filters: {
      course: 'appetizer',
      dietary: input.dietaryRestrictions
    }
  });

  // For side: based on main's characteristics (assume rich main needs light side)
  const sideCandidates = await semanticSearch({
    query: `light side dish ${input.cuisine || ''} vegetables crisp`,
    limit: 5,
    filters: {
      course: 'side',
      dietary: input.dietaryRestrictions
    }
  });

  // For dessert: sweet conclusion
  const dessertCandidates = await semanticSearch({
    query: `dessert ${input.cuisine || ''} sweet light`,
    limit: 5,
    filters: {
      course: 'dessert',
      dietary: input.dietaryRestrictions
    }
  });

  // Step 3: Enrich prompt with database context
  if (appetizerCandidates.length > 0) {
    semanticContext += `\n\nAVAILABLE APPETIZERS IN DATABASE:\n`;
    semanticContext += appetizerCandidates.map(r =>
      `- ${r.name}: ${r.description}`
    ).join('\n');
  }

  if (sideCandidates.length > 0) {
    semanticContext += `\n\nAVAILABLE SIDES IN DATABASE:\n`;
    semanticContext += sideCandidates.map(r =>
      `- ${r.name}: ${r.description}`
    ).join('\n');
  }

  if (dessertCandidates.length > 0) {
    semanticContext += `\n\nAVAILABLE DESSERTS IN DATABASE:\n`;
    semanticContext += dessertCandidates.map(r =>
      `- ${r.name}: ${r.description}`
    ).join('\n');
  }

  // Step 4: Build enhanced prompt with database awareness
  let enhancedPrompt = buildMealPairingPrompt(input);

  if (semanticContext) {
    enhancedPrompt += `\n\nDATABASE CONTEXT (prioritize these existing recipes when appropriate):\n${semanticContext}\n\n`;
    enhancedPrompt += `You may suggest existing recipes from the database OR create new pairings if database options don't meet pairing principles.`;
  }

  // Step 5: Call OpenRouter (using Anthropic API format)
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: MEAL_PAIRING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: enhancedPrompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.content[0].text;

  // Handle potential markdown wrapping
  const cleanedJson = responseText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const mealPlan: MealPlan = JSON.parse(cleanedJson);

  // Step 6: Link to actual recipe IDs where matches exist
  return enrichWithRecipeLinks(mealPlan, {
    appetizerCandidates,
    sideCandidates,
    dessertCandidates
  });
}

// ============================================================================
// Simplified API Interface
// ============================================================================

interface SimpleMealRequest {
  cuisine?: string;        // "Italian", "Thai", "French"
  theme?: string;          // "Summer BBQ", "Romantic Dinner", "Holiday Feast"
  mainDish?: string;       // "Grilled Salmon", "Beef Bourguignon"
  dietary?: string[];      // ["vegetarian", "gluten-free"]
  ingredients?: string[];  // ["tomatoes", "basil", "garlic"]
  maxTime?: number;        // 60 (minutes)
  servings?: number;       // 4
}

/**
 * Main entry point - converts simple request to full input
 */
async function generateMeal(request: SimpleMealRequest): Promise<MealPlan> {
  // Determine mode based on what's provided
  let mode: MealPairingInput['mode'] = 'freestyle';

  if (request.mainDish) {
    mode = 'main-first';
  } else if (request.cuisine) {
    mode = 'cuisine';
  } else if (request.theme) {
    mode = 'theme';
  }

  const input: MealPairingInput = {
    mode,
    cuisine: request.cuisine,
    theme: request.theme,
    mainDish: request.mainDish,
    dietaryRestrictions: request.dietary,
    availableIngredients: request.ingredients,
    timeLimit: request.maxTime,
    servings: request.servings || 4
  };

  return generateMealWithSemanticSearch(input);
}

// ============================================================================
// Usage Examples - Uncomment to test
// ============================================================================

/*
// Example 1: Cuisine-based
const italianMeal = await generateMeal({
  cuisine: "Italian",
  servings: 6
});

// Example 2: Main-first with restrictions
const steakMeal = await generateMeal({
  mainDish: "Pan-seared ribeye steak",
  dietary: ["gluten-free"],
  maxTime: 90
});

// Example 3: Theme-based with ingredients
const springParty = await generateMeal({
  theme: "Spring garden party",
  ingredients: ["asparagus", "peas", "mint"],
  maxTime: 120,
  servings: 8
});

// Example 4: Freestyle with constraints
const quickDinner = await generateMeal({
  dietary: ["vegetarian", "dairy-free"],
  maxTime: 45,
  servings: 2
});
*/

// ============================================================================
// Export for Integration
// ============================================================================

export {
  generateMeal,
  generateMealWithSemanticSearch,
  buildMealPairingPrompt,
  MEAL_PAIRING_SYSTEM_PROMPT,
  type MealPairingInput,
  type MealPlan,
  type SimpleMealRequest
};
