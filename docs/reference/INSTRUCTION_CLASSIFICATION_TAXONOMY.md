# Recipe Instruction Classification Taxonomy

**Version**: 1.0.0
**Last Updated**: 2025-10-18
**Status**: Design Phase

---

## Overview

This document defines a comprehensive taxonomy for classifying individual recipe instruction steps. The classification system enables:

- Accurate time estimation by skill level
- Parallel task detection and optimization
- Equipment conflict identification
- Kitchen role assignment for multi-cook coordination
- Enhanced meal preparation timelines

## Table of Contents

1. [Work Types](#work-types)
2. [Cooking Techniques](#cooking-techniques)
3. [Tools & Equipment](#tools--equipment)
4. [Kitchen Roles](#kitchen-roles)
5. [Skill Levels](#skill-levels)
6. [Classification Examples](#classification-examples)
7. [Edge Cases](#edge-cases)

---

## Work Types

Work types categorize the **nature of activity** in a cooking step.

```typescript
enum WorkType {
  PREP = "prep",              // Chopping, peeling, measuring, trimming
  COOK = "cook",              // Active cooking with heat application
  SETUP = "setup",            // Equipment setup, preheating, arrangement
  REST = "rest",              // Waiting, resting, cooling, setting
  ASSEMBLE = "assemble",      // Combining components, layering, building
  CLEAN = "clean",            // Washing, draining, patting dry
  MARINATE = "marinate",      // Soaking, marinating, brining
  MIX = "mix",                // Stirring, whisking, kneading, blending
  MONITOR = "monitor",        // Watching, adjusting heat, checking doneness
  SERVE = "serve",            // Final plating, garnishing, presentation
  CHILL = "chill",            // Refrigerating, freezing
  STRAIN = "strain",          // Draining, straining, filtering
}
```

### Work Type Characteristics

| Work Type | Hands-on? | Heat? | Can Walk Away? | Typical Duration |
|-----------|-----------|-------|----------------|------------------|
| PREP      | Yes       | No    | No             | 5-30 min         |
| COOK      | Yes       | Yes   | Sometimes      | 10-60 min        |
| SETUP     | Yes       | No    | Yes            | 2-10 min         |
| REST      | No        | No    | Yes            | 10-180 min       |
| ASSEMBLE  | Yes       | No    | No             | 5-20 min         |
| CLEAN     | Yes       | No    | No             | 2-10 min         |
| MARINATE  | No        | No    | Yes            | 30-1440 min      |
| MIX       | Yes       | No    | No             | 2-15 min         |
| MONITOR   | Partial   | Yes   | No             | 5-60 min         |
| SERVE     | Yes       | No    | No             | 2-10 min         |
| CHILL     | No        | No    | Yes            | 30-480 min       |
| STRAIN    | Yes       | No    | No             | 2-5 min          |

---

## Cooking Techniques

Techniques represent the **specific culinary method** being employed.

```typescript
enum Technique {
  // Dry Heat Methods
  ROAST = "roast",            // High heat in oven, uncovered
  BAKE = "bake",              // Moderate heat in oven, often covered
  BROIL = "broil",            // High heat from above
  GRILL = "grill",            // High heat from below/direct
  SEAR = "sear",              // Very high heat, quick browning
  TOAST = "toast",            // Dry heat to brown bread/nuts

  // Moist Heat Methods
  BOIL = "boil",              // 212°F/100°C, vigorous bubbles
  SIMMER = "simmer",          // 180-200°F, gentle bubbles
  POACH = "poach",            // 160-180°F, no bubbles
  STEAM = "steam",            // Cook with water vapor
  BLANCH = "blanch",          // Brief boiling, then ice bath
  BRAISE = "braise",          // Low heat, covered, with liquid
  STEW = "stew",              // Simmer in liquid, longer cooking

  // Fat-Based Methods
  SAUTE = "saute",            // Medium-high heat, small amount of fat
  FRY = "fry",                // Submerged in hot oil
  DEEP_FRY = "deep_fry",      // Completely submerged in oil
  PAN_FRY = "pan_fry",        // Partial submersion in oil
  STIR_FRY = "stir_fry",      // High heat, constant motion
  SWEAT = "sweat",            // Low heat, covered, to soften
  CARAMELIZE = "caramelize",  // Cook sugars until brown

  // Cutting Techniques
  DICE = "dice",              // 1/4 to 1/2 inch cubes
  MINCE = "mince",            // Very fine pieces (< 1/8 inch)
  CHOP = "chop",              // Rough 1/2 to 1 inch pieces
  SLICE = "slice",            // Thin, uniform cuts
  JULIENNE = "julienne",      // Thin matchstick strips
  CHIFFONADE = "chiffonade",  // Thin ribbon cuts (herbs/leafy greens)
  CUBE = "cube",              // Large 1-2 inch cubes
  BRUNOISE = "brunoise",      // 1/8 inch fine dice
  PEEL = "peel",              // Remove outer skin
  TRIM = "trim",              // Remove unwanted portions

  // Mixing Techniques
  WHISK = "whisk",            // Incorporate air, combine
  BEAT = "beat",              // Vigorous mixing
  FOLD = "fold",              // Gentle incorporation
  STIR = "stir",              // Basic circular mixing
  KNEAD = "knead",            // Work dough by hand
  CREAM = "cream",            // Beat fat and sugar until fluffy
  EMULSIFY = "emulsify",      // Combine oil and water-based liquids
  WHIP = "whip",              // Beat to incorporate maximum air

  // Reduction & Concentration
  REDUCE = "reduce",          // Boil to evaporate liquid
  DEGLAZE = "deglaze",        // Add liquid to dissolve browned bits
  CONCENTRATE = "concentrate", // Reduce liquid to intensify flavor

  // Other Essential Techniques
  SEASON = "season",          // Add salt, pepper, spices
  TASTE = "taste",            // Check for seasoning
  DRAIN = "drain",            // Remove liquid
  STRAIN = "strain",          // Filter out solids
  TOSS = "toss",              // Combine by lifting and dropping
  PLATE = "plate",            // Arrange on serving dish
  GARNISH = "garnish",        // Add final decorative elements
  REST = "rest",              // Allow to sit (meat, dough)
  CHILL = "chill",            // Refrigerate
  FREEZE = "freeze",          // Freeze solid
  THAW = "thaw",              // Bring to room temp
  TEMPER = "temper",          // Gradually adjust temperature
  BLOOM = "bloom",            // Hydrate gelatin or yeast
  PROOF = "proof",            // Allow dough to rise
  GLAZE = "glaze",            // Apply shiny coating
  BASTE = "baste",            // Moisten during cooking
  TRUSS = "truss",            // Tie meat/poultry
  SCORE = "score",            // Make shallow cuts
  ZEST = "zest",              // Remove citrus peel

  // Preparation Methods
  MARINATE = "marinate",      // Soak in seasoned liquid
  BRINE = "brine",            // Soak in salt solution
  DRY_RUB = "dry_rub",        // Apply dry spice mixture
  COAT = "coat",              // Cover with flour, breadcrumbs, etc.
  DREDGE = "dredge",          // Lightly coat with dry ingredient

  // Safety & Quality
  CHECK_TEMP = "check_temp",  // Verify internal temperature
  WASH = "wash",              // Clean ingredients
  PAT_DRY = "pat_dry",        // Remove excess moisture
}
```

### Technique Difficulty Mapping

| Skill Level | Techniques                                              |
|-------------|--------------------------------------------------------|
| Beginner    | boil, simmer, bake, chop, slice, dice, stir, drain     |
| Intermediate| saute, roast, mince, whisk, fold, reduce, deglaze      |
| Advanced    | julienne, brunoise, emulsify, temper, truss, caramelize|

---

## Tools & Equipment

Comprehensive categorization of kitchen tools and equipment.

```typescript
enum ToolCategory {
  CUTTING = "cutting",
  COOKWARE = "cookware",
  BAKEWARE = "bakeware",
  UTENSILS = "utensils",
  APPLIANCES = "appliances",
  MEASURING = "measuring",
  PREP = "prep",
  SERVING = "serving",
  SPECIALTY = "specialty",
}

enum Tool {
  // Cutting (CUTTING)
  KNIFE_CHEF = "chef_knife",
  KNIFE_PARING = "paring_knife",
  KNIFE_BREAD = "bread_knife",
  KNIFE_BONING = "boning_knife",
  CUTTING_BOARD = "cutting_board",
  KITCHEN_SHEARS = "kitchen_shears",
  PEELER = "vegetable_peeler",
  MANDOLINE = "mandoline",
  GRATER = "box_grater",
  MICROPLANE = "microplane",

  // Cookware (COOKWARE)
  SKILLET = "skillet",
  SKILLET_CAST_IRON = "cast_iron_skillet",
  SKILLET_NONSTICK = "nonstick_skillet",
  SAUCEPAN_SMALL = "small_saucepan",
  SAUCEPAN_MEDIUM = "medium_saucepan",
  SAUCEPAN_LARGE = "large_saucepan",
  POT_STOCK = "stock_pot",
  POT_DUTCH_OVEN = "dutch_oven",
  WOK = "wok",
  GRIDDLE = "griddle",
  DOUBLE_BOILER = "double_boiler",

  // Bakeware (BAKEWARE)
  BAKING_SHEET = "baking_sheet",
  BAKING_DISH = "baking_dish",
  CAKE_PAN = "cake_pan",
  MUFFIN_TIN = "muffin_tin",
  LOAF_PAN = "loaf_pan",
  PIE_DISH = "pie_dish",
  SPRINGFORM_PAN = "springform_pan",
  COOLING_RACK = "cooling_rack",
  PARCHMENT_PAPER = "parchment_paper",
  ALUMINUM_FOIL = "aluminum_foil",

  // Utensils (UTENSILS)
  WOODEN_SPOON = "wooden_spoon",
  SPATULA = "spatula",
  SPATULA_RUBBER = "rubber_spatula",
  SPATULA_METAL = "metal_spatula",
  WHISK = "whisk",
  TONGS = "tongs",
  LADLE = "ladle",
  SLOTTED_SPOON = "slotted_spoon",
  SPIDER_STRAINER = "spider_strainer",
  ROLLING_PIN = "rolling_pin",
  PASTRY_BRUSH = "pastry_brush",
  CAN_OPENER = "can_opener",

  // Appliances (APPLIANCES)
  OVEN = "oven",
  STOVE = "stove",
  MICROWAVE = "microwave",
  TOASTER = "toaster",
  TOASTER_OVEN = "toaster_oven",
  BLENDER = "blender",
  BLENDER_IMMERSION = "immersion_blender",
  FOOD_PROCESSOR = "food_processor",
  STAND_MIXER = "stand_mixer",
  HAND_MIXER = "hand_mixer",
  SLOW_COOKER = "slow_cooker",
  PRESSURE_COOKER = "pressure_cooker",
  AIR_FRYER = "air_fryer",
  RICE_COOKER = "rice_cooker",
  COFFEE_GRINDER = "coffee_grinder",

  // Measuring (MEASURING)
  MEASURING_CUPS = "measuring_cups",
  MEASURING_SPOONS = "measuring_spoons",
  LIQUID_MEASURING_CUP = "liquid_measuring_cup",
  KITCHEN_SCALE = "kitchen_scale",
  INSTANT_READ_THERMOMETER = "instant_read_thermometer",
  OVEN_THERMOMETER = "oven_thermometer",
  TIMER = "timer",

  // Prep (PREP)
  MIXING_BOWL_SMALL = "small_mixing_bowl",
  MIXING_BOWL_MEDIUM = "medium_mixing_bowl",
  MIXING_BOWL_LARGE = "large_mixing_bowl",
  COLANDER = "colander",
  STRAINER = "fine_mesh_strainer",
  SALAD_SPINNER = "salad_spinner",
  CITRUS_JUICER = "citrus_juicer",
  GARLIC_PRESS = "garlic_press",
  MORTAR_AND_PESTLE = "mortar_and_pestle",

  // Serving (SERVING)
  SERVING_PLATTER = "serving_platter",
  SERVING_BOWL = "serving_bowl",
  SERVING_SPOON = "serving_spoon",
  CARVING_KNIFE = "carving_knife",
  CARVING_FORK = "carving_fork",

  // Specialty (SPECIALTY)
  PASTA_MAKER = "pasta_maker",
  PIZZA_STONE = "pizza_stone",
  PIZZA_CUTTER = "pizza_cutter",
  MEAT_MALLET = "meat_mallet",
  MEAT_THERMOMETER = "meat_thermometer",
  CANDY_THERMOMETER = "candy_thermometer",
  KITCHEN_TORCH = "kitchen_torch",
  CHEESECLOTH = "cheesecloth",
  BUTCHER_TWINE = "butcher_twine",
  SUSHI_MAT = "sushi_mat",
}
```

### Tool Essentiality Levels

**Essential** (90% of home kitchens):
- chef_knife, cutting_board, skillet, saucepan, baking_sheet
- wooden_spoon, spatula, whisk, measuring_cups, mixing_bowls

**Common** (60% of home kitchens):
- cast_iron_skillet, stock_pot, colander, hand_mixer, blender

**Specialized** (<30% of home kitchens):
- mandoline, stand_mixer, food_processor, dutch_oven, instant_read_thermometer

**Professional** (<10% of home kitchens):
- pasta_maker, kitchen_torch, sous_vide, mortar_and_pestle

---

## Kitchen Roles

Based on the classic French brigade system, adapted for modern home and professional kitchens.

```typescript
enum KitchenRole {
  // Home Cook Roles
  HOME_COOK = "home_cook",              // General all-purpose (default)
  MEAL_PREPPER = "meal_prepper",        // Batch cooking, advance prep

  // Professional Brigade Roles
  PREP_COOK = "prep_cook",              // Mise en place, basic prep work
  COMMIS = "commis",                    // Junior cook, learning role

  // Station-Specific Roles
  SAUCIER = "saucier",                  // Sauces, sautéed dishes, stews
  ROTISSEUR = "rotisseur",              // Roasted/grilled meats, jus
  GRILLARDIN = "grillardin",            // Grilled items
  FRITURIER = "friturier",              // Fried items
  POISSONNIER = "poissonnier",          // Fish and seafood preparation
  ENTREMETIER = "entremetier",          // Vegetables, soups, starches, eggs
  POTAGER = "potager",                  // Soups (subset of entremetier)
  LEGUMIER = "legumier",                // Vegetables (subset of entremetier)
  PATISSIER = "patissier",              // Pastries, desserts, baked goods
  BOULANGER = "boulanger",              // Bread specialist
  GLACIER = "glacier",                  // Ice creams, frozen desserts
  CONFISEUR = "confiseur",              // Candies, petit fours
  GARDE_MANGER = "garde_manger",        // Cold prep, salads, charcuterie, pâtés
  BOUCHER = "boucher",                  // Butchery, meat fabrication

  // Management Roles
  TOURNANT = "tournant",                // Swing cook (covers all stations)
  SOUS_CHEF = "sous_chef",              // Coordination, supervision
  CHEF_DE_PARTIE = "chef_de_partie",    // Station head
  EXPEDITOR = "expeditor",              // Final plating, quality control
}
```

### Role Assignment Logic

```typescript
// Role is determined by:
// 1. Primary ingredient
// 2. Technique used
// 3. Temperature (hot vs. cold)
// 4. Complexity

const roleMapping = {
  // Proteins
  "chicken, beef, pork": ["rotisseur", "grillardin"],
  "fish, seafood": ["poissonnier"],

  // Vegetables & Starches
  "vegetables": ["entremetier", "legumier"],
  "soups": ["potager", "entremetier"],
  "pasta, rice": ["entremetier"],

  // Sauces & Sautés
  "sauce, gravy, reduction": ["saucier"],
  "sauté, pan sauce": ["saucier"],

  // Baking & Pastry
  "bread, rolls": ["boulanger"],
  "cake, pastry, cookies": ["patissier"],
  "ice cream, sorbet": ["glacier"],
  "candy, chocolate": ["confiseur"],

  // Cold Prep
  "salad, cold appetizer": ["garde_manger"],
  "charcuterie, pâté": ["garde_manger"],

  // Frying
  "deep fry, pan fry": ["friturier"],

  // General Prep
  "chop, dice, measure": ["prep_cook", "commis"],
};
```

---

## Skill Levels

Skill levels affect time estimates and technique difficulty assessment.

```typescript
enum SkillLevel {
  BEGINNER = "beginner",          // Limited cooking experience (0-1 years)
  INTERMEDIATE = "intermediate",   // Competent home cook (1-5 years)
  ADVANCED = "advanced",          // Experienced cook or professional (5+ years)
}
```

### Skill Level Characteristics

| Skill Level  | Knife Speed | Technique Knowledge | Multi-tasking | Time Multiplier |
|--------------|-------------|---------------------|---------------|-----------------|
| Beginner     | Slow        | Basic               | Limited       | 2.0x            |
| Intermediate | Moderate    | Good                | Moderate      | 1.3x            |
| Advanced     | Fast        | Excellent           | Expert        | 1.0x            |

### Skill Level Time Adjustments

```typescript
const skillTimeMultipliers = {
  beginner: {
    prep: 2.0,      // 2x longer for prep tasks
    cook: 1.5,      // 1.5x longer for active cooking
    monitor: 1.0,   // Same for passive monitoring
    rest: 1.0,      // Same for resting/waiting
  },
  intermediate: {
    prep: 1.3,
    cook: 1.2,
    monitor: 1.0,
    rest: 1.0,
  },
  advanced: {
    prep: 1.0,      // Baseline
    cook: 1.0,
    monitor: 1.0,
    rest: 1.0,
  },
};
```

---

## Classification Examples

### Example 1: Simple Prep Step

**Instruction**: "Dice 2 medium onions into 1/4-inch pieces."

```json
{
  "work_type": "prep",
  "technique": "dice",
  "tools": ["chef_knife", "cutting_board"],
  "roles": ["prep_cook", "commis"],
  "estimated_time_minutes": {
    "beginner": 8,
    "intermediate": 4,
    "advanced": 2
  },
  "can_parallelize": true,
  "requires_attention": true,
  "temperature": null,
  "skill_level_required": "beginner",
  "confidence": 0.98
}
```

### Example 2: Complex Cooking Step

**Instruction**: "Sear the steak over high heat for 2-3 minutes per side until a golden-brown crust forms."

```json
{
  "work_type": "cook",
  "technique": "sear",
  "tools": ["cast_iron_skillet", "stove", "tongs"],
  "roles": ["rotisseur", "grillardin"],
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
  "skill_level_required": "intermediate",
  "equipment_conflicts": ["stove"],
  "confidence": 0.95
}
```

### Example 3: Passive Waiting Step

**Instruction**: "Let the dough rest in the refrigerator for 30 minutes."

```json
{
  "work_type": "rest",
  "technique": "chill",
  "tools": ["refrigerator"],
  "roles": ["patissier", "boulanger"],
  "estimated_time_minutes": {
    "beginner": 30,
    "intermediate": 30,
    "advanced": 30
  },
  "can_parallelize": true,
  "requires_attention": false,
  "temperature": {
    "value": 40,
    "unit": "F",
    "type": "storage"
  },
  "skill_level_required": "beginner",
  "confidence": 0.99
}
```

### Example 4: Multi-Step Instruction

**Instruction**: "Preheat the oven to 375°F and grease a 9x13 inch baking dish."

```json
{
  "work_type": "setup",
  "technique": null,
  "tools": ["oven", "baking_dish", "pastry_brush"],
  "roles": ["patissier", "home_cook"],
  "estimated_time_minutes": {
    "beginner": 5,
    "intermediate": 3,
    "advanced": 2
  },
  "can_parallelize": true,
  "requires_attention": false,
  "temperature": {
    "value": 375,
    "unit": "F",
    "type": "oven_preheat"
  },
  "skill_level_required": "beginner",
  "notes": "Multi-step: preheat + greasing",
  "confidence": 0.97
}
```

### Example 5: Monitoring Step

**Instruction**: "Simmer the sauce, stirring occasionally, until thickened (about 15-20 minutes)."

```json
{
  "work_type": "monitor",
  "technique": "simmer",
  "tools": ["saucepan", "stove", "wooden_spoon"],
  "roles": ["saucier"],
  "estimated_time_minutes": {
    "beginner": 20,
    "intermediate": 18,
    "advanced": 15
  },
  "can_parallelize": true,
  "requires_attention": true,
  "temperature": {
    "value": 185,
    "unit": "F",
    "type": "liquid"
  },
  "skill_level_required": "intermediate",
  "equipment_conflicts": ["stove"],
  "notes": "Requires periodic stirring",
  "confidence": 0.94
}
```

---

## Edge Cases

### Multi-Step Instructions

Some instructions contain multiple actions:

**Example**: "Chop the vegetables and sauté them in olive oil until softened."

**Strategy**: Split into two classification entries:
1. "Chop the vegetables" → prep/chop
2. "Sauté in olive oil until softened" → cook/saute

**Implementation**: LLM should detect compound instructions and either:
- Classify the **dominant** action
- Flag for manual splitting
- Return an array of classifications

### Ambiguous Time Estimates

**Example**: "Cook until done."

**Strategy**: Use heuristics based on:
- Ingredient type (chicken breast ~15 min, whole chicken ~90 min)
- Cooking method (grill vs. oven)
- Default ranges by technique

### Equipment Inference

**Example**: "Boil the pasta."

**Implied Equipment**: pot, stove, colander

**Strategy**: LLM should infer equipment from technique even when not explicitly mentioned.

### Temperature Variations

Instructions may specify temperature in various ways:
- "High heat" → 450°F+
- "Medium heat" → 300-375°F
- "Low heat" → 200-275°F
- "Until golden brown" → visual cue, ~350-375°F

**Strategy**: Normalize to numeric temperature ranges with uncertainty flags.

### Vague Instructions

**Example**: "Season to taste."

**Strategy**: Classify as technique="season", short duration, high parallelization potential.

### Regional/Cultural Variations

Techniques may have different names:
- "Sauté" vs. "Pan fry"
- "Grill" (US) vs. "Broil" (UK)

**Strategy**: Normalize to primary technique, store regional variant in notes.

---

## Usage Guidelines

### For LLM Classification

1. **Read entire instruction** before classifying
2. **Identify primary action** (work type + technique)
3. **Infer equipment** even if not explicitly stated
4. **Assign appropriate role** based on ingredient + technique
5. **Estimate time** using skill multipliers
6. **Flag conflicts** (equipment, timing, complexity)
7. **Provide confidence score** (0.0-1.0)

### For Application Integration

1. **Cache classifications** in database (JSONB column)
2. **Never re-classify** unless instruction text changes
3. **Use classifications** for:
   - Enhanced meal prep timelines
   - Equipment checklists
   - Skill level filtering
   - Parallel task suggestions
   - Kitchen organization

### Confidence Score Interpretation

| Score Range | Meaning              | Action                    |
|-------------|----------------------|---------------------------|
| 0.90-1.00   | High confidence      | Auto-accept               |
| 0.80-0.89   | Good confidence      | Accept, periodic review   |
| 0.70-0.79   | Moderate confidence  | Flag for human review     |
| 0.00-0.69   | Low confidence       | Require manual review     |

---

## Version History

| Version | Date       | Changes                          |
|---------|------------|----------------------------------|
| 1.0.0   | 2025-10-18 | Initial taxonomy design          |

---

## Related Documents

- `INSTRUCTION_METADATA_SCHEMA.md` - Database schema design
- `INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md` - LLM cost analysis
- `INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md` - Implementation guide
- `src/types/instruction-metadata.ts` - TypeScript definitions
