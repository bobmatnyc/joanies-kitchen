/**
 * Tag ID System
 *
 * New ID-based tag system with:
 * - Hierarchical structure (category.subcategory?.item)
 * - Type-safe tag IDs
 * - Support for localization
 * - Backward compatibility with old string tags
 *
 * Format: category.item or category.subcategory.item
 * Examples: "cuisine.italian", "cuisine.italian.sicilian", "difficulty.beginner"
 */

/**
 * Tag ID format: category.subcategory?.item
 * Examples:
 * - cuisine.italian
 * - cuisine.italian.sicilian (2-level hierarchy)
 * - difficulty.beginner (flat)
 */
export type TagId = string;

/**
 * Tag category enumeration
 * 11 categories based on recipe tag research
 */
export enum TagCategory {
  Cuisine = 'cuisine',
  MealType = 'mealType',
  Course = 'course',
  DishType = 'dishType',
  Dietary = 'dietary',
  CookingMethod = 'cookingMethod',
  MainIngredient = 'mainIngredient',
  Season = 'season',
  Planning = 'planning',
  Difficulty = 'difficulty',
  Characteristics = 'characteristics',
  Other = 'other',
}

/**
 * Tag ID constants for type safety and autocomplete
 * Organized by category
 */
export const TAG_IDS = {
  // ==================== DIFFICULTY (Required tag category) ====================
  DIFFICULTY: {
    BEGINNER: 'difficulty.beginner' as const,
    INTERMEDIATE: 'difficulty.intermediate' as const,
    ADVANCED: 'difficulty.advanced' as const,
    EXPERT: 'difficulty.expert' as const,
  },

  // ==================== CUISINE (2-level hierarchy) ====================
  CUISINE: {
    // Italian cuisine
    ITALIAN: 'cuisine.italian' as const,
    SICILIAN: 'cuisine.italian.sicilian' as const,
    TUSCAN: 'cuisine.italian.tuscan' as const,
    NEAPOLITAN: 'cuisine.italian.neapolitan' as const,
    ROMAN: 'cuisine.italian.roman' as const,

    // Mexican cuisine
    MEXICAN: 'cuisine.mexican' as const,
    TEX_MEX: 'cuisine.mexican.texMex' as const,
    YUCATAN: 'cuisine.mexican.yucatan' as const,

    // Asian cuisines
    CHINESE: 'cuisine.chinese' as const,
    CANTONESE: 'cuisine.chinese.cantonese' as const,
    SZECHUAN: 'cuisine.chinese.szechuan' as const,
    HUNAN: 'cuisine.chinese.hunan' as const,

    JAPANESE: 'cuisine.japanese' as const,
    KOREAN: 'cuisine.korean' as const,
    THAI: 'cuisine.thai' as const,
    VIETNAMESE: 'cuisine.vietnamese' as const,
    INDIAN: 'cuisine.indian' as const,

    // European cuisines
    FRENCH: 'cuisine.french' as const,
    PROVENCAL: 'cuisine.french.provencal' as const,

    GREEK: 'cuisine.greek' as const,
    SPANISH: 'cuisine.spanish' as const,
    GERMAN: 'cuisine.german' as const,
    BRITISH: 'cuisine.british' as const,
    IRISH: 'cuisine.irish' as const,

    // Regional
    MEDITERRANEAN: 'cuisine.mediterranean' as const,
    MIDDLE_EASTERN: 'cuisine.middleEastern' as const,
    AMERICAN: 'cuisine.american' as const,
    SOUTHERN: 'cuisine.american.southern' as const,
    CAJUN: 'cuisine.american.cajun' as const,

    // Other
    BRAZILIAN: 'cuisine.brazilian' as const,
    CARIBBEAN: 'cuisine.caribbean' as const,
    ETHIOPIAN: 'cuisine.ethiopian' as const,
    MOROCCAN: 'cuisine.moroccan' as const,
    TURKISH: 'cuisine.turkish' as const,
  },

  // ==================== MEAL TYPE (Flat) ====================
  MEAL_TYPE: {
    BREAKFAST: 'mealType.breakfast' as const,
    BRUNCH: 'mealType.brunch' as const,
    LUNCH: 'mealType.lunch' as const,
    DINNER: 'mealType.dinner' as const,
    SNACK: 'mealType.snack' as const,
    DESSERT: 'mealType.dessert' as const,
    APPETIZER: 'mealType.appetizer' as const,
    BEVERAGE: 'mealType.beverage' as const,
  },

  // ==================== COURSE (Flat) ====================
  COURSE: {
    APPETIZER: 'course.appetizer' as const,
    SOUP: 'course.soup' as const,
    SALAD: 'course.salad' as const,
    MAIN: 'course.main' as const,
    SIDE: 'course.side' as const,
    DESSERT: 'course.dessert' as const,
    BEVERAGE: 'course.beverage' as const,
  },

  // ==================== DISH TYPE (Flat - NEW category) ====================
  DISH_TYPE: {
    SOUP: 'dishType.soup' as const,
    STEW: 'dishType.stew' as const,
    SALAD: 'dishType.salad' as const,
    SANDWICH: 'dishType.sandwich' as const,
    WRAP: 'dishType.wrap' as const,
    PIZZA: 'dishType.pizza' as const,
    PASTA: 'dishType.pasta' as const,
    CASSEROLE: 'dishType.casserole' as const,
    STIR_FRY: 'dishType.stirFry' as const,
    CURRY: 'dishType.curry' as const,
    BOWL: 'dishType.bowl' as const,
    TACO: 'dishType.taco' as const,
    BURGER: 'dishType.burger' as const,
    SMOOTHIE: 'dishType.smoothie' as const,
  },

  // ==================== DIETARY (2-level hierarchy) ====================
  DIETARY: {
    // Vegetarian family
    VEGETARIAN: 'dietary.vegetarian' as const,
    VEGAN: 'dietary.vegetarian.vegan' as const,

    // Allergen-free
    GLUTEN_FREE: 'dietary.glutenFree' as const,
    DAIRY_FREE: 'dietary.dairyFree' as const,
    NUT_FREE: 'dietary.nutFree' as const,
    EGG_FREE: 'dietary.eggFree' as const,
    SOY_FREE: 'dietary.soyFree' as const,

    // Low-carb family
    LOW_CARB: 'dietary.lowCarb' as const,
    KETO: 'dietary.lowCarb.keto' as const,

    // Other diets
    PALEO: 'dietary.paleo' as const,
    WHOLE30: 'dietary.whole30' as const,
    LOW_FAT: 'dietary.lowFat' as const,
    LOW_SODIUM: 'dietary.lowSodium' as const,
    SUGAR_FREE: 'dietary.sugarFree' as const,
    HIGH_PROTEIN: 'dietary.highProtein' as const,

    // Religious
    HALAL: 'dietary.halal' as const,
    KOSHER: 'dietary.kosher' as const,
  },

  // ==================== COOKING METHOD (2-level hierarchy) ====================
  COOKING_METHOD: {
    // Dry heat methods
    DRY_HEAT: 'cookingMethod.dryHeat' as const,
    BAKING: 'cookingMethod.dryHeat.baking' as const,
    ROASTING: 'cookingMethod.dryHeat.roasting' as const,
    GRILLING: 'cookingMethod.dryHeat.grilling' as const,
    BROILING: 'cookingMethod.dryHeat.broiling' as const,
    SEARING: 'cookingMethod.dryHeat.searing' as const,

    // Moist heat methods
    MOIST_HEAT: 'cookingMethod.moistHeat' as const,
    BOILING: 'cookingMethod.moistHeat.boiling' as const,
    STEAMING: 'cookingMethod.moistHeat.steaming' as const,
    POACHING: 'cookingMethod.moistHeat.poaching' as const,
    SIMMERING: 'cookingMethod.moistHeat.simmering' as const,
    BRAISING: 'cookingMethod.moistHeat.braising' as const,
    STEWING: 'cookingMethod.moistHeat.stewing' as const,

    // Fat-based methods
    FAT_BASED: 'cookingMethod.fatBased' as const,
    FRYING: 'cookingMethod.fatBased.frying' as const,
    DEEP_FRYING: 'cookingMethod.fatBased.deepFrying' as const,
    PAN_FRYING: 'cookingMethod.fatBased.panFrying' as const,
    SAUTEING: 'cookingMethod.fatBased.sauteing' as const,
    STIR_FRYING: 'cookingMethod.fatBased.stirFrying' as const,

    // Specialized equipment
    SLOW_COOKER: 'cookingMethod.slowCooker' as const,
    INSTANT_POT: 'cookingMethod.instantPot' as const,
    PRESSURE_COOKER: 'cookingMethod.pressureCooker' as const,
    AIR_FRYER: 'cookingMethod.airFryer' as const,
    SMOKER: 'cookingMethod.smoker' as const,

    // No-cook
    NO_COOK: 'cookingMethod.noCook' as const,
    RAW: 'cookingMethod.raw' as const,
  },

  // ==================== MAIN INGREDIENT (2-level hierarchy) ====================
  MAIN_INGREDIENT: {
    // Protein - Meat
    PROTEIN: 'mainIngredient.protein' as const,
    CHICKEN: 'mainIngredient.protein.chicken' as const,
    BEEF: 'mainIngredient.protein.beef' as const,
    PORK: 'mainIngredient.protein.pork' as const,
    LAMB: 'mainIngredient.protein.lamb' as const,
    TURKEY: 'mainIngredient.protein.turkey' as const,

    // Protein - Seafood
    SEAFOOD: 'mainIngredient.protein.seafood' as const,
    FISH: 'mainIngredient.protein.fish' as const,
    SALMON: 'mainIngredient.protein.salmon' as const,
    TUNA: 'mainIngredient.protein.tuna' as const,
    SHRIMP: 'mainIngredient.protein.shrimp' as const,
    CRAB: 'mainIngredient.protein.crab' as const,
    LOBSTER: 'mainIngredient.protein.lobster' as const,

    // Protein - Plant-based
    TOFU: 'mainIngredient.protein.tofu' as const,
    TEMPEH: 'mainIngredient.protein.tempeh' as const,
    SEITAN: 'mainIngredient.protein.seitan' as const,

    // Grains
    GRAIN: 'mainIngredient.grain' as const,
    RICE: 'mainIngredient.grain.rice' as const,
    PASTA: 'mainIngredient.grain.pasta' as const,
    NOODLES: 'mainIngredient.grain.noodles' as const,
    QUINOA: 'mainIngredient.grain.quinoa' as const,
    BREAD: 'mainIngredient.grain.bread' as const,

    // Legumes
    LEGUME: 'mainIngredient.legume' as const,
    BEANS: 'mainIngredient.legume.beans' as const,
    LENTILS: 'mainIngredient.legume.lentils' as const,
    CHICKPEAS: 'mainIngredient.legume.chickpeas' as const,

    // Vegetables
    VEGETABLE: 'mainIngredient.vegetable' as const,
    POTATOES: 'mainIngredient.vegetable.potatoes' as const,
    MUSHROOMS: 'mainIngredient.vegetable.mushrooms' as const,
    TOMATOES: 'mainIngredient.vegetable.tomatoes' as const,
    PEPPERS: 'mainIngredient.vegetable.peppers' as const,

    // Dairy
    DAIRY: 'mainIngredient.dairy' as const,
    CHEESE: 'mainIngredient.dairy.cheese' as const,
    YOGURT: 'mainIngredient.dairy.yogurt' as const,
    MILK: 'mainIngredient.dairy.milk' as const,

    // Eggs
    EGGS: 'mainIngredient.eggs' as const,

    // Fruit
    FRUIT: 'mainIngredient.fruit' as const,
    BERRIES: 'mainIngredient.fruit.berries' as const,
    CITRUS: 'mainIngredient.fruit.citrus' as const,
    APPLES: 'mainIngredient.fruit.apples' as const,
  },

  // ==================== SEASON (Flat with holiday sub-tags) ====================
  SEASON: {
    SPRING: 'season.spring' as const,
    SUMMER: 'season.summer' as const,
    FALL: 'season.fall' as const,
    AUTUMN: 'season.autumn' as const, // Synonym for fall
    WINTER: 'season.winter' as const,
    YEAR_ROUND: 'season.yearRound' as const,

    // Holidays
    HOLIDAY: 'season.holiday' as const,
    THANKSGIVING: 'season.holiday.thanksgiving' as const,
    CHRISTMAS: 'season.holiday.christmas' as const,
    EASTER: 'season.holiday.easter' as const,
    HALLOWEEN: 'season.holiday.halloween' as const,
    NEW_YEAR: 'season.holiday.newYear' as const,
    VALENTINES: 'season.holiday.valentines' as const,
    FOURTH_JULY: 'season.holiday.fourthJuly' as const,
  },

  // ==================== PLANNING (NEW - Flat) ====================
  PLANNING: {
    QUICK: 'planning.quick' as const, // < 30 minutes
    MAKE_AHEAD: 'planning.makeAhead' as const,
    FREEZER_FRIENDLY: 'planning.freezerFriendly' as const,
    MEAL_PREP: 'planning.mealPrep' as const,
    LEFTOVER_FRIENDLY: 'planning.leftoverFriendly' as const,
    ONE_POT: 'planning.onePot' as const,
    ONE_PAN: 'planning.onePan' as const,
    SHEET_PAN: 'planning.sheetPan' as const,
    SLOW_COOKER_FRIENDLY: 'planning.slowCookerFriendly' as const,
    OVERNIGHT: 'planning.overnight' as const,
    BATCH_COOKING: 'planning.batchCooking' as const,
  },

  // ==================== CHARACTERISTICS (NEW - Flat) ====================
  CHARACTERISTICS: {
    COMFORT_FOOD: 'characteristics.comfortFood' as const,
    KID_FRIENDLY: 'characteristics.kidFriendly' as const,
    CROWD_PLEASER: 'characteristics.crowdPleaser' as const,
    BUDGET_FRIENDLY: 'characteristics.budgetFriendly' as const,
    HEALTHY: 'characteristics.healthy' as const,
    LIGHT: 'characteristics.light' as const,
    HEARTY: 'characteristics.hearty' as const,
    SPICY: 'characteristics.spicy' as const,
    MILD: 'characteristics.mild' as const,
    SWEET: 'characteristics.sweet' as const,
    SAVORY: 'characteristics.savory' as const,
    TANGY: 'characteristics.tangy' as const,
    CRISPY: 'characteristics.crispy' as const,
    CREAMY: 'characteristics.creamy' as const,
    FRESH: 'characteristics.fresh' as const,
    GOURMET: 'characteristics.gourmet' as const,
    RUSTIC: 'characteristics.rustic' as const,
    ELEGANT: 'characteristics.elegant' as const,
    PARTY_FOOD: 'characteristics.partyFood' as const,
    PICNIC: 'characteristics.picnic' as const,
    UMAMI: 'characteristics.umami' as const,
  },

  // ==================== OTHER (Catchall) ====================
  OTHER: {
    OTHER: 'other.uncategorized' as const,
  },
} as const;

/**
 * Extract all tag IDs as a union type
 * Useful for type-safe tag validation
 */
export type KnownTagId = typeof TAG_IDS[keyof typeof TAG_IDS][keyof typeof TAG_IDS[keyof typeof TAG_IDS]];

/**
 * Type guard to check if a tag ID is valid
 */
export function isKnownTagId(tagId: string): tagId is KnownTagId {
  const allTagIds = Object.values(TAG_IDS).flatMap(category => Object.values(category));
  return allTagIds.includes(tagId as any);
}

/**
 * Extract category from tag ID
 * Examples:
 * - "cuisine.italian" → TagCategory.Cuisine
 * - "cuisine.italian.sicilian" → TagCategory.Cuisine
 */
export function getCategoryFromTagId(tagId: TagId): TagCategory {
  const parts = tagId.split('.');
  const categoryKey = parts[0];

  // Map string to enum
  const categoryMap: Record<string, TagCategory> = {
    cuisine: TagCategory.Cuisine,
    mealType: TagCategory.MealType,
    course: TagCategory.Course,
    dishType: TagCategory.DishType,
    dietary: TagCategory.Dietary,
    cookingMethod: TagCategory.CookingMethod,
    mainIngredient: TagCategory.MainIngredient,
    season: TagCategory.Season,
    planning: TagCategory.Planning,
    difficulty: TagCategory.Difficulty,
    characteristics: TagCategory.Characteristics,
    other: TagCategory.Other,
  };

  return categoryMap[categoryKey] || TagCategory.Other;
}

/**
 * Check if a tag ID has hierarchy (2+ levels)
 */
export function isHierarchicalTag(tagId: TagId): boolean {
  return tagId.split('.').length > 2;
}

/**
 * Get parent tag ID from hierarchical tag
 * Examples:
 * - "cuisine.italian.sicilian" → "cuisine.italian"
 * - "cuisine.italian" → null
 */
export function getParentTagId(tagId: TagId): TagId | null {
  const parts = tagId.split('.');
  if (parts.length <= 2) return null;

  return parts.slice(0, -1).join('.');
}

/**
 * Get all tag IDs for a specific category
 */
export function getTagIdsByCategory(category: TagCategory): TagId[] {
  const categoryMap: Record<TagCategory, TagId[]> = {
    [TagCategory.Cuisine]: Object.values(TAG_IDS.CUISINE),
    [TagCategory.MealType]: Object.values(TAG_IDS.MEAL_TYPE),
    [TagCategory.Course]: Object.values(TAG_IDS.COURSE),
    [TagCategory.DishType]: Object.values(TAG_IDS.DISH_TYPE),
    [TagCategory.Dietary]: Object.values(TAG_IDS.DIETARY),
    [TagCategory.CookingMethod]: Object.values(TAG_IDS.COOKING_METHOD),
    [TagCategory.MainIngredient]: Object.values(TAG_IDS.MAIN_INGREDIENT),
    [TagCategory.Season]: Object.values(TAG_IDS.SEASON),
    [TagCategory.Planning]: Object.values(TAG_IDS.PLANNING),
    [TagCategory.Difficulty]: Object.values(TAG_IDS.DIFFICULTY),
    [TagCategory.Characteristics]: Object.values(TAG_IDS.CHARACTERISTICS),
    [TagCategory.Other]: Object.values(TAG_IDS.OTHER),
  };

  return categoryMap[category] || [];
}
