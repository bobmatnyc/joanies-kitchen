/**
 * Tag Hierarchy System
 *
 * Defines hierarchical relationships between tags:
 * - Parent-child relationships (e.g., Italian → Sicilian)
 * - Synonyms for backward compatibility (old string tags → new IDs)
 * - Related tags for suggestions
 */

import { TagCategory, type TagId, TAG_IDS } from './tag-ids';

/**
 * Tag node in the hierarchy
 * Contains metadata about each tag and its relationships
 */
export interface TagNode {
  /** Tag ID (e.g., "cuisine.italian") */
  id: TagId;
  /** Tag category */
  category: TagCategory;
  /** Child tag IDs (for 2-level hierarchies) */
  children?: TagId[];
  /** Parent tag ID (for child tags) */
  parent?: TagId;
  /** Synonyms for backward compatibility with old string tags */
  synonyms?: string[];
  /** Related tag IDs for suggestions */
  relatedTags?: TagId[];
  /** Popularity score (0-100, higher = more common) */
  popularity?: number;
}

/**
 * Complete tag hierarchy
 * Maps tag IDs to their metadata and relationships
 */
export const TAG_HIERARCHY: Record<TagId, TagNode> = {
  // ==================== DIFFICULTY ====================
  [TAG_IDS.DIFFICULTY.BEGINNER]: {
    id: TAG_IDS.DIFFICULTY.BEGINNER,
    category: TagCategory.Difficulty,
    synonyms: ['beginner', 'easy', 'simple', 'basic'],
    relatedTags: [TAG_IDS.PLANNING.QUICK, TAG_IDS.CHARACTERISTICS.KID_FRIENDLY],
    popularity: 95,
  },
  [TAG_IDS.DIFFICULTY.INTERMEDIATE]: {
    id: TAG_IDS.DIFFICULTY.INTERMEDIATE,
    category: TagCategory.Difficulty,
    synonyms: ['intermediate', 'medium', 'moderate'],
    relatedTags: [],
    popularity: 75,
  },
  [TAG_IDS.DIFFICULTY.ADVANCED]: {
    id: TAG_IDS.DIFFICULTY.ADVANCED,
    category: TagCategory.Difficulty,
    synonyms: ['advanced', 'hard', 'challenging'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.GOURMET],
    popularity: 40,
  },
  [TAG_IDS.DIFFICULTY.EXPERT]: {
    id: TAG_IDS.DIFFICULTY.EXPERT,
    category: TagCategory.Difficulty,
    synonyms: ['expert', 'professional', 'complex', 'difficult'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.GOURMET, TAG_IDS.CHARACTERISTICS.ELEGANT],
    popularity: 20,
  },

  // ==================== CUISINE ====================
  // Italian
  [TAG_IDS.CUISINE.ITALIAN]: {
    id: TAG_IDS.CUISINE.ITALIAN,
    category: TagCategory.Cuisine,
    children: [
      TAG_IDS.CUISINE.SICILIAN,
      TAG_IDS.CUISINE.TUSCAN,
      TAG_IDS.CUISINE.NEAPOLITAN,
      TAG_IDS.CUISINE.ROMAN,
    ],
    synonyms: ['italian', 'italy', 'italiano'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.PASTA, TAG_IDS.CUISINE.MEDITERRANEAN],
    popularity: 95,
  },
  [TAG_IDS.CUISINE.SICILIAN]: {
    id: TAG_IDS.CUISINE.SICILIAN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.ITALIAN,
    synonyms: ['sicilian', 'sicily'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.SEAFOOD, TAG_IDS.CUISINE.MEDITERRANEAN],
    popularity: 40,
  },
  [TAG_IDS.CUISINE.TUSCAN]: {
    id: TAG_IDS.CUISINE.TUSCAN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.ITALIAN,
    synonyms: ['tuscan', 'tuscany'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.VEGETABLE, TAG_IDS.CHARACTERISTICS.RUSTIC],
    popularity: 45,
  },
  [TAG_IDS.CUISINE.NEAPOLITAN]: {
    id: TAG_IDS.CUISINE.NEAPOLITAN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.ITALIAN,
    synonyms: ['neapolitan', 'naples'],
    relatedTags: [TAG_IDS.DISH_TYPE.PIZZA],
    popularity: 35,
  },
  [TAG_IDS.CUISINE.ROMAN]: {
    id: TAG_IDS.CUISINE.ROMAN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.ITALIAN,
    synonyms: ['roman', 'rome'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.PASTA],
    popularity: 30,
  },

  // Mexican
  [TAG_IDS.CUISINE.MEXICAN]: {
    id: TAG_IDS.CUISINE.MEXICAN,
    category: TagCategory.Cuisine,
    children: [TAG_IDS.CUISINE.TEX_MEX, TAG_IDS.CUISINE.YUCATAN],
    synonyms: ['mexican', 'mexico'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY, TAG_IDS.DISH_TYPE.TACO],
    popularity: 90,
  },
  [TAG_IDS.CUISINE.TEX_MEX]: {
    id: TAG_IDS.CUISINE.TEX_MEX,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.MEXICAN,
    synonyms: ['tex-mex', 'texmex'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.CHEESE],
    popularity: 50,
  },
  [TAG_IDS.CUISINE.YUCATAN]: {
    id: TAG_IDS.CUISINE.YUCATAN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.MEXICAN,
    synonyms: ['yucatan', 'yucatecan'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY],
    popularity: 25,
  },

  // Chinese
  [TAG_IDS.CUISINE.CHINESE]: {
    id: TAG_IDS.CUISINE.CHINESE,
    category: TagCategory.Cuisine,
    children: [TAG_IDS.CUISINE.CANTONESE, TAG_IDS.CUISINE.SZECHUAN, TAG_IDS.CUISINE.HUNAN],
    synonyms: ['chinese', 'china'],
    relatedTags: [TAG_IDS.COOKING_METHOD.STIR_FRYING, TAG_IDS.MAIN_INGREDIENT.RICE],
    popularity: 85,
  },
  [TAG_IDS.CUISINE.CANTONESE]: {
    id: TAG_IDS.CUISINE.CANTONESE,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.CHINESE,
    synonyms: ['cantonese', 'guangdong'],
    relatedTags: [TAG_IDS.COOKING_METHOD.STEAMING],
    popularity: 40,
  },
  [TAG_IDS.CUISINE.SZECHUAN]: {
    id: TAG_IDS.CUISINE.SZECHUAN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.CHINESE,
    synonyms: ['szechuan', 'sichuan', 'szechwan'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY],
    popularity: 45,
  },
  [TAG_IDS.CUISINE.HUNAN]: {
    id: TAG_IDS.CUISINE.HUNAN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.CHINESE,
    synonyms: ['hunan'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY],
    popularity: 30,
  },

  // Other Asian cuisines
  [TAG_IDS.CUISINE.JAPANESE]: {
    id: TAG_IDS.CUISINE.JAPANESE,
    category: TagCategory.Cuisine,
    synonyms: ['japanese', 'japan'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.SEAFOOD, TAG_IDS.MAIN_INGREDIENT.RICE],
    popularity: 80,
  },
  [TAG_IDS.CUISINE.KOREAN]: {
    id: TAG_IDS.CUISINE.KOREAN,
    category: TagCategory.Cuisine,
    synonyms: ['korean', 'korea'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY],
    popularity: 75,
  },
  [TAG_IDS.CUISINE.THAI]: {
    id: TAG_IDS.CUISINE.THAI,
    category: TagCategory.Cuisine,
    synonyms: ['thai', 'thailand'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY, TAG_IDS.DISH_TYPE.CURRY],
    popularity: 80,
  },
  [TAG_IDS.CUISINE.VIETNAMESE]: {
    id: TAG_IDS.CUISINE.VIETNAMESE,
    category: TagCategory.Cuisine,
    synonyms: ['vietnamese', 'vietnam'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.FRESH, TAG_IDS.CHARACTERISTICS.LIGHT],
    popularity: 65,
  },
  [TAG_IDS.CUISINE.INDIAN]: {
    id: TAG_IDS.CUISINE.INDIAN,
    category: TagCategory.Cuisine,
    synonyms: ['indian', 'india'],
    relatedTags: [TAG_IDS.DISH_TYPE.CURRY, TAG_IDS.CHARACTERISTICS.SPICY],
    popularity: 85,
  },

  // French
  [TAG_IDS.CUISINE.FRENCH]: {
    id: TAG_IDS.CUISINE.FRENCH,
    category: TagCategory.Cuisine,
    children: [TAG_IDS.CUISINE.PROVENCAL],
    synonyms: ['french', 'france'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.GOURMET, TAG_IDS.CHARACTERISTICS.ELEGANT],
    popularity: 75,
  },
  [TAG_IDS.CUISINE.PROVENCAL]: {
    id: TAG_IDS.CUISINE.PROVENCAL,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.FRENCH,
    synonyms: ['provencal', 'provence'],
    relatedTags: [TAG_IDS.CUISINE.MEDITERRANEAN],
    popularity: 35,
  },

  // Mediterranean & European
  [TAG_IDS.CUISINE.MEDITERRANEAN]: {
    id: TAG_IDS.CUISINE.MEDITERRANEAN,
    category: TagCategory.Cuisine,
    synonyms: ['mediterranean', 'med'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY, TAG_IDS.MAIN_INGREDIENT.VEGETABLE],
    popularity: 85,
  },
  [TAG_IDS.CUISINE.GREEK]: {
    id: TAG_IDS.CUISINE.GREEK,
    category: TagCategory.Cuisine,
    synonyms: ['greek', 'greece'],
    relatedTags: [TAG_IDS.CUISINE.MEDITERRANEAN, TAG_IDS.COURSE.SALAD],
    popularity: 70,
  },
  [TAG_IDS.CUISINE.SPANISH]: {
    id: TAG_IDS.CUISINE.SPANISH,
    category: TagCategory.Cuisine,
    synonyms: ['spanish', 'spain'],
    relatedTags: [TAG_IDS.CUISINE.MEDITERRANEAN, TAG_IDS.MAIN_INGREDIENT.SEAFOOD],
    popularity: 70,
  },

  // American
  [TAG_IDS.CUISINE.AMERICAN]: {
    id: TAG_IDS.CUISINE.AMERICAN,
    category: TagCategory.Cuisine,
    children: [TAG_IDS.CUISINE.SOUTHERN, TAG_IDS.CUISINE.CAJUN],
    synonyms: ['american', 'usa', 'united states'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.COMFORT_FOOD],
    popularity: 85,
  },
  [TAG_IDS.CUISINE.SOUTHERN]: {
    id: TAG_IDS.CUISINE.SOUTHERN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.AMERICAN,
    synonyms: ['southern', 'soul food'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.COMFORT_FOOD, TAG_IDS.CHARACTERISTICS.HEARTY],
    popularity: 60,
  },
  [TAG_IDS.CUISINE.CAJUN]: {
    id: TAG_IDS.CUISINE.CAJUN,
    category: TagCategory.Cuisine,
    parent: TAG_IDS.CUISINE.AMERICAN,
    synonyms: ['cajun', 'creole'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY],
    popularity: 50,
  },

  // Other European
  [TAG_IDS.CUISINE.GERMAN]: {
    id: TAG_IDS.CUISINE.GERMAN,
    category: TagCategory.Cuisine,
    synonyms: ['german', 'germany'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEARTY],
    popularity: 55,
  },
  [TAG_IDS.CUISINE.BRITISH]: {
    id: TAG_IDS.CUISINE.BRITISH,
    category: TagCategory.Cuisine,
    synonyms: ['british', 'british', 'uk'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.COMFORT_FOOD],
    popularity: 50,
  },
  [TAG_IDS.CUISINE.IRISH]: {
    id: TAG_IDS.CUISINE.IRISH,
    category: TagCategory.Cuisine,
    synonyms: ['irish', 'ireland'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEARTY],
    popularity: 45,
  },

  // Middle Eastern & African
  [TAG_IDS.CUISINE.MIDDLE_EASTERN]: {
    id: TAG_IDS.CUISINE.MIDDLE_EASTERN,
    category: TagCategory.Cuisine,
    synonyms: ['middle-eastern', 'middle eastern', 'levantine', 'arabic'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.CHICKPEAS, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 65,
  },
  [TAG_IDS.CUISINE.MOROCCAN]: {
    id: TAG_IDS.CUISINE.MOROCCAN,
    category: TagCategory.Cuisine,
    synonyms: ['moroccan', 'morocco'],
    relatedTags: [TAG_IDS.CUISINE.MIDDLE_EASTERN],
    popularity: 50,
  },
  [TAG_IDS.CUISINE.ETHIOPIAN]: {
    id: TAG_IDS.CUISINE.ETHIOPIAN,
    category: TagCategory.Cuisine,
    synonyms: ['ethiopian', 'ethiopia'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY],
    popularity: 40,
  },
  [TAG_IDS.CUISINE.TURKISH]: {
    id: TAG_IDS.CUISINE.TURKISH,
    category: TagCategory.Cuisine,
    synonyms: ['turkish', 'turkey'],
    relatedTags: [TAG_IDS.CUISINE.MIDDLE_EASTERN],
    popularity: 55,
  },

  // Latin American & Caribbean
  [TAG_IDS.CUISINE.BRAZILIAN]: {
    id: TAG_IDS.CUISINE.BRAZILIAN,
    category: TagCategory.Cuisine,
    synonyms: ['brazilian', 'brazil'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.BEEF],
    popularity: 55,
  },
  [TAG_IDS.CUISINE.CARIBBEAN]: {
    id: TAG_IDS.CUISINE.CARIBBEAN,
    category: TagCategory.Cuisine,
    synonyms: ['caribbean', 'west indian'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SPICY, TAG_IDS.SEASON.SUMMER],
    popularity: 50,
  },

  // ==================== MEAL TYPE ====================
  [TAG_IDS.MEAL_TYPE.BREAKFAST]: {
    id: TAG_IDS.MEAL_TYPE.BREAKFAST,
    category: TagCategory.MealType,
    synonyms: ['breakfast', 'morning'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.EGGS, TAG_IDS.PLANNING.QUICK],
    popularity: 90,
  },
  [TAG_IDS.MEAL_TYPE.BRUNCH]: {
    id: TAG_IDS.MEAL_TYPE.BRUNCH,
    category: TagCategory.MealType,
    synonyms: ['brunch'],
    relatedTags: [TAG_IDS.MEAL_TYPE.BREAKFAST, TAG_IDS.MEAL_TYPE.LUNCH],
    popularity: 70,
  },
  [TAG_IDS.MEAL_TYPE.LUNCH]: {
    id: TAG_IDS.MEAL_TYPE.LUNCH,
    category: TagCategory.MealType,
    synonyms: ['lunch', 'midday'],
    relatedTags: [TAG_IDS.DISH_TYPE.SANDWICH, TAG_IDS.COURSE.SALAD],
    popularity: 85,
  },
  [TAG_IDS.MEAL_TYPE.DINNER]: {
    id: TAG_IDS.MEAL_TYPE.DINNER,
    category: TagCategory.MealType,
    synonyms: ['dinner', 'supper', 'evening'],
    relatedTags: [TAG_IDS.COURSE.MAIN],
    popularity: 95,
  },
  [TAG_IDS.MEAL_TYPE.SNACK]: {
    id: TAG_IDS.MEAL_TYPE.SNACK,
    category: TagCategory.MealType,
    synonyms: ['snack', 'nibbles'],
    relatedTags: [TAG_IDS.PLANNING.QUICK, TAG_IDS.CHARACTERISTICS.KID_FRIENDLY],
    popularity: 80,
  },
  [TAG_IDS.MEAL_TYPE.DESSERT]: {
    id: TAG_IDS.MEAL_TYPE.DESSERT,
    category: TagCategory.MealType,
    synonyms: ['dessert', 'sweet'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.SWEET, TAG_IDS.COOKING_METHOD.BAKING],
    popularity: 90,
  },
  [TAG_IDS.MEAL_TYPE.APPETIZER]: {
    id: TAG_IDS.MEAL_TYPE.APPETIZER,
    category: TagCategory.MealType,
    synonyms: ['appetizer', 'starter', 'hors d\'oeuvre'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.PARTY_FOOD],
    popularity: 75,
  },
  [TAG_IDS.MEAL_TYPE.BEVERAGE]: {
    id: TAG_IDS.MEAL_TYPE.BEVERAGE,
    category: TagCategory.MealType,
    synonyms: ['beverage', 'drink'],
    relatedTags: [TAG_IDS.DISH_TYPE.SMOOTHIE],
    popularity: 60,
  },

  // ==================== COURSE ====================
  [TAG_IDS.COURSE.APPETIZER]: {
    id: TAG_IDS.COURSE.APPETIZER,
    category: TagCategory.Course,
    synonyms: ['appetizer', 'starter'],
    relatedTags: [TAG_IDS.MEAL_TYPE.APPETIZER],
    popularity: 75,
  },
  [TAG_IDS.COURSE.SOUP]: {
    id: TAG_IDS.COURSE.SOUP,
    category: TagCategory.Course,
    synonyms: ['soup'],
    relatedTags: [TAG_IDS.DISH_TYPE.SOUP, TAG_IDS.CHARACTERISTICS.COMFORT_FOOD],
    popularity: 85,
  },
  [TAG_IDS.COURSE.SALAD]: {
    id: TAG_IDS.COURSE.SALAD,
    category: TagCategory.Course,
    synonyms: ['salad'],
    relatedTags: [TAG_IDS.DISH_TYPE.SALAD, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 85,
  },
  [TAG_IDS.COURSE.MAIN]: {
    id: TAG_IDS.COURSE.MAIN,
    category: TagCategory.Course,
    synonyms: ['main', 'main course', 'entree'],
    relatedTags: [TAG_IDS.MEAL_TYPE.DINNER],
    popularity: 95,
  },
  [TAG_IDS.COURSE.SIDE]: {
    id: TAG_IDS.COURSE.SIDE,
    category: TagCategory.Course,
    synonyms: ['side', 'side dish'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.VEGETABLE],
    popularity: 80,
  },
  [TAG_IDS.COURSE.DESSERT]: {
    id: TAG_IDS.COURSE.DESSERT,
    category: TagCategory.Course,
    synonyms: ['dessert'],
    relatedTags: [TAG_IDS.MEAL_TYPE.DESSERT, TAG_IDS.CHARACTERISTICS.SWEET],
    popularity: 90,
  },
  [TAG_IDS.COURSE.BEVERAGE]: {
    id: TAG_IDS.COURSE.BEVERAGE,
    category: TagCategory.Course,
    synonyms: ['beverage', 'drink'],
    relatedTags: [TAG_IDS.MEAL_TYPE.BEVERAGE],
    popularity: 60,
  },

  // ==================== DISH TYPE ====================
  [TAG_IDS.DISH_TYPE.SOUP]: {
    id: TAG_IDS.DISH_TYPE.SOUP,
    category: TagCategory.DishType,
    synonyms: ['soup', 'broth'],
    relatedTags: [TAG_IDS.COURSE.SOUP, TAG_IDS.CHARACTERISTICS.COMFORT_FOOD],
    popularity: 90,
  },
  [TAG_IDS.DISH_TYPE.STEW]: {
    id: TAG_IDS.DISH_TYPE.STEW,
    category: TagCategory.DishType,
    synonyms: ['stew'],
    relatedTags: [TAG_IDS.COOKING_METHOD.STEWING, TAG_IDS.CHARACTERISTICS.HEARTY],
    popularity: 75,
  },
  [TAG_IDS.DISH_TYPE.SALAD]: {
    id: TAG_IDS.DISH_TYPE.SALAD,
    category: TagCategory.DishType,
    synonyms: ['salad'],
    relatedTags: [TAG_IDS.COURSE.SALAD, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 85,
  },
  [TAG_IDS.DISH_TYPE.SANDWICH]: {
    id: TAG_IDS.DISH_TYPE.SANDWICH,
    category: TagCategory.DishType,
    synonyms: ['sandwich', 'sub'],
    relatedTags: [TAG_IDS.MEAL_TYPE.LUNCH, TAG_IDS.PLANNING.QUICK],
    popularity: 85,
  },
  [TAG_IDS.DISH_TYPE.WRAP]: {
    id: TAG_IDS.DISH_TYPE.WRAP,
    category: TagCategory.DishType,
    synonyms: ['wrap', 'burrito'],
    relatedTags: [TAG_IDS.MEAL_TYPE.LUNCH],
    popularity: 70,
  },
  [TAG_IDS.DISH_TYPE.PIZZA]: {
    id: TAG_IDS.DISH_TYPE.PIZZA,
    category: TagCategory.DishType,
    synonyms: ['pizza', 'pie'],
    relatedTags: [TAG_IDS.CUISINE.ITALIAN, TAG_IDS.COOKING_METHOD.BAKING],
    popularity: 90,
  },
  [TAG_IDS.DISH_TYPE.PASTA]: {
    id: TAG_IDS.DISH_TYPE.PASTA,
    category: TagCategory.DishType,
    synonyms: ['pasta'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.PASTA, TAG_IDS.CUISINE.ITALIAN],
    popularity: 95,
  },
  [TAG_IDS.DISH_TYPE.CASSEROLE]: {
    id: TAG_IDS.DISH_TYPE.CASSEROLE,
    category: TagCategory.DishType,
    synonyms: ['casserole', 'bake'],
    relatedTags: [TAG_IDS.PLANNING.MAKE_AHEAD, TAG_IDS.CHARACTERISTICS.COMFORT_FOOD],
    popularity: 80,
  },
  [TAG_IDS.DISH_TYPE.STIR_FRY]: {
    id: TAG_IDS.DISH_TYPE.STIR_FRY,
    category: TagCategory.DishType,
    synonyms: ['stir-fry', 'stir fry'],
    relatedTags: [TAG_IDS.COOKING_METHOD.STIR_FRYING, TAG_IDS.CUISINE.CHINESE],
    popularity: 80,
  },
  [TAG_IDS.DISH_TYPE.CURRY]: {
    id: TAG_IDS.DISH_TYPE.CURRY,
    category: TagCategory.DishType,
    synonyms: ['curry'],
    relatedTags: [TAG_IDS.CUISINE.INDIAN, TAG_IDS.CUISINE.THAI],
    popularity: 75,
  },
  [TAG_IDS.DISH_TYPE.BOWL]: {
    id: TAG_IDS.DISH_TYPE.BOWL,
    category: TagCategory.DishType,
    synonyms: ['bowl', 'poke bowl', 'buddha bowl'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 70,
  },
  [TAG_IDS.DISH_TYPE.TACO]: {
    id: TAG_IDS.DISH_TYPE.TACO,
    category: TagCategory.DishType,
    synonyms: ['taco', 'tacos'],
    relatedTags: [TAG_IDS.CUISINE.MEXICAN],
    popularity: 85,
  },
  [TAG_IDS.DISH_TYPE.BURGER]: {
    id: TAG_IDS.DISH_TYPE.BURGER,
    category: TagCategory.DishType,
    synonyms: ['burger', 'hamburger'],
    relatedTags: [TAG_IDS.CUISINE.AMERICAN],
    popularity: 90,
  },
  [TAG_IDS.DISH_TYPE.SMOOTHIE]: {
    id: TAG_IDS.DISH_TYPE.SMOOTHIE,
    category: TagCategory.DishType,
    synonyms: ['smoothie', 'shake'],
    relatedTags: [TAG_IDS.MEAL_TYPE.BREAKFAST, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 75,
  },

  // ==================== DIETARY ====================
  // Vegetarian family
  [TAG_IDS.DIETARY.VEGETARIAN]: {
    id: TAG_IDS.DIETARY.VEGETARIAN,
    category: TagCategory.Dietary,
    children: [TAG_IDS.DIETARY.VEGAN],
    synonyms: ['vegetarian', 'veggie', 'meatless'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.VEGETABLE, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 95,
  },
  [TAG_IDS.DIETARY.VEGAN]: {
    id: TAG_IDS.DIETARY.VEGAN,
    category: TagCategory.Dietary,
    parent: TAG_IDS.DIETARY.VEGETARIAN,
    synonyms: ['vegan', 'plant-based'],
    relatedTags: [TAG_IDS.DIETARY.DAIRY_FREE, TAG_IDS.DIETARY.EGG_FREE],
    popularity: 90,
  },

  // Allergen-free
  [TAG_IDS.DIETARY.GLUTEN_FREE]: {
    id: TAG_IDS.DIETARY.GLUTEN_FREE,
    category: TagCategory.Dietary,
    synonyms: ['gluten-free', 'gluten free', 'gf', 'celiac'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 85,
  },
  [TAG_IDS.DIETARY.DAIRY_FREE]: {
    id: TAG_IDS.DIETARY.DAIRY_FREE,
    category: TagCategory.Dietary,
    synonyms: ['dairy-free', 'dairy free', 'lactose-free', 'no-dairy'],
    relatedTags: [TAG_IDS.DIETARY.VEGAN],
    popularity: 80,
  },
  [TAG_IDS.DIETARY.NUT_FREE]: {
    id: TAG_IDS.DIETARY.NUT_FREE,
    category: TagCategory.Dietary,
    synonyms: ['nut-free', 'nut free'],
    relatedTags: [],
    popularity: 70,
  },
  [TAG_IDS.DIETARY.EGG_FREE]: {
    id: TAG_IDS.DIETARY.EGG_FREE,
    category: TagCategory.Dietary,
    synonyms: ['egg-free', 'egg free', 'no-egg'],
    relatedTags: [TAG_IDS.DIETARY.VEGAN],
    popularity: 65,
  },
  [TAG_IDS.DIETARY.SOY_FREE]: {
    id: TAG_IDS.DIETARY.SOY_FREE,
    category: TagCategory.Dietary,
    synonyms: ['soy-free', 'soy free'],
    relatedTags: [],
    popularity: 60,
  },

  // Low-carb family
  [TAG_IDS.DIETARY.LOW_CARB]: {
    id: TAG_IDS.DIETARY.LOW_CARB,
    category: TagCategory.Dietary,
    children: [TAG_IDS.DIETARY.KETO],
    synonyms: ['low-carb', 'low carb', 'lowcarb'],
    relatedTags: [TAG_IDS.DIETARY.HIGH_PROTEIN],
    popularity: 80,
  },
  [TAG_IDS.DIETARY.KETO]: {
    id: TAG_IDS.DIETARY.KETO,
    category: TagCategory.Dietary,
    parent: TAG_IDS.DIETARY.LOW_CARB,
    synonyms: ['keto', 'ketogenic'],
    relatedTags: [TAG_IDS.DIETARY.HIGH_PROTEIN],
    popularity: 85,
  },

  // Other diets
  [TAG_IDS.DIETARY.PALEO]: {
    id: TAG_IDS.DIETARY.PALEO,
    category: TagCategory.Dietary,
    synonyms: ['paleo', 'paleolithic', 'caveman'],
    relatedTags: [TAG_IDS.DIETARY.GLUTEN_FREE, TAG_IDS.DIETARY.DAIRY_FREE],
    popularity: 70,
  },
  [TAG_IDS.DIETARY.WHOLE30]: {
    id: TAG_IDS.DIETARY.WHOLE30,
    category: TagCategory.Dietary,
    synonyms: ['whole30', 'whole-30', 'w30'],
    relatedTags: [TAG_IDS.DIETARY.PALEO],
    popularity: 60,
  },
  [TAG_IDS.DIETARY.LOW_FAT]: {
    id: TAG_IDS.DIETARY.LOW_FAT,
    category: TagCategory.Dietary,
    synonyms: ['low-fat', 'low fat', 'lowfat'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 65,
  },
  [TAG_IDS.DIETARY.LOW_SODIUM]: {
    id: TAG_IDS.DIETARY.LOW_SODIUM,
    category: TagCategory.Dietary,
    synonyms: ['low-sodium', 'low sodium', 'low-salt'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 60,
  },
  [TAG_IDS.DIETARY.SUGAR_FREE]: {
    id: TAG_IDS.DIETARY.SUGAR_FREE,
    category: TagCategory.Dietary,
    synonyms: ['sugar-free', 'sugar free', 'no-sugar'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 70,
  },
  [TAG_IDS.DIETARY.HIGH_PROTEIN]: {
    id: TAG_IDS.DIETARY.HIGH_PROTEIN,
    category: TagCategory.Dietary,
    synonyms: ['high-protein', 'high protein', 'protein'],
    relatedTags: [TAG_IDS.DIETARY.LOW_CARB],
    popularity: 75,
  },

  // Religious
  [TAG_IDS.DIETARY.HALAL]: {
    id: TAG_IDS.DIETARY.HALAL,
    category: TagCategory.Dietary,
    synonyms: ['halal'],
    relatedTags: [],
    popularity: 50,
  },
  [TAG_IDS.DIETARY.KOSHER]: {
    id: TAG_IDS.DIETARY.KOSHER,
    category: TagCategory.Dietary,
    synonyms: ['kosher'],
    relatedTags: [],
    popularity: 50,
  },

  // ==================== COOKING METHOD (2-level) ====================
  // Dry heat
  [TAG_IDS.COOKING_METHOD.DRY_HEAT]: {
    id: TAG_IDS.COOKING_METHOD.DRY_HEAT,
    category: TagCategory.CookingMethod,
    children: [
      TAG_IDS.COOKING_METHOD.BAKING,
      TAG_IDS.COOKING_METHOD.ROASTING,
      TAG_IDS.COOKING_METHOD.GRILLING,
      TAG_IDS.COOKING_METHOD.BROILING,
      TAG_IDS.COOKING_METHOD.SEARING,
    ],
    synonyms: ['dry-heat', 'dry heat'],
    relatedTags: [],
    popularity: 40,
  },
  [TAG_IDS.COOKING_METHOD.BAKING]: {
    id: TAG_IDS.COOKING_METHOD.BAKING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.DRY_HEAT,
    synonyms: ['baking', 'baked', 'oven'],
    relatedTags: [TAG_IDS.MEAL_TYPE.DESSERT],
    popularity: 90,
  },
  [TAG_IDS.COOKING_METHOD.ROASTING]: {
    id: TAG_IDS.COOKING_METHOD.ROASTING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.DRY_HEAT,
    synonyms: ['roasting', 'roasted', 'roast'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.CHICKEN, TAG_IDS.MAIN_INGREDIENT.VEGETABLE],
    popularity: 85,
  },
  [TAG_IDS.COOKING_METHOD.GRILLING]: {
    id: TAG_IDS.COOKING_METHOD.GRILLING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.DRY_HEAT,
    synonyms: ['grilling', 'grilled', 'bbq', 'barbecue'],
    relatedTags: [TAG_IDS.SEASON.SUMMER],
    popularity: 85,
  },
  [TAG_IDS.COOKING_METHOD.BROILING]: {
    id: TAG_IDS.COOKING_METHOD.BROILING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.DRY_HEAT,
    synonyms: ['broiling', 'broiled', 'broil'],
    relatedTags: [],
    popularity: 60,
  },
  [TAG_IDS.COOKING_METHOD.SEARING]: {
    id: TAG_IDS.COOKING_METHOD.SEARING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.DRY_HEAT,
    synonyms: ['searing', 'seared', 'sear'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.BEEF],
    popularity: 65,
  },

  // Moist heat
  [TAG_IDS.COOKING_METHOD.MOIST_HEAT]: {
    id: TAG_IDS.COOKING_METHOD.MOIST_HEAT,
    category: TagCategory.CookingMethod,
    children: [
      TAG_IDS.COOKING_METHOD.BOILING,
      TAG_IDS.COOKING_METHOD.STEAMING,
      TAG_IDS.COOKING_METHOD.POACHING,
      TAG_IDS.COOKING_METHOD.SIMMERING,
      TAG_IDS.COOKING_METHOD.BRAISING,
      TAG_IDS.COOKING_METHOD.STEWING,
    ],
    synonyms: ['moist-heat', 'moist heat'],
    relatedTags: [],
    popularity: 35,
  },
  [TAG_IDS.COOKING_METHOD.BOILING]: {
    id: TAG_IDS.COOKING_METHOD.BOILING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.MOIST_HEAT,
    synonyms: ['boiling', 'boiled', 'boil'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.PASTA],
    popularity: 75,
  },
  [TAG_IDS.COOKING_METHOD.STEAMING]: {
    id: TAG_IDS.COOKING_METHOD.STEAMING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.MOIST_HEAT,
    synonyms: ['steaming', 'steamed', 'steam'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY, TAG_IDS.MAIN_INGREDIENT.VEGETABLE],
    popularity: 70,
  },
  [TAG_IDS.COOKING_METHOD.POACHING]: {
    id: TAG_IDS.COOKING_METHOD.POACHING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.MOIST_HEAT,
    synonyms: ['poaching', 'poached', 'poach'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.EGGS, TAG_IDS.MAIN_INGREDIENT.FISH],
    popularity: 55,
  },
  [TAG_IDS.COOKING_METHOD.SIMMERING]: {
    id: TAG_IDS.COOKING_METHOD.SIMMERING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.MOIST_HEAT,
    synonyms: ['simmering', 'simmered', 'simmer'],
    relatedTags: [TAG_IDS.DISH_TYPE.SOUP],
    popularity: 70,
  },
  [TAG_IDS.COOKING_METHOD.BRAISING]: {
    id: TAG_IDS.COOKING_METHOD.BRAISING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.MOIST_HEAT,
    synonyms: ['braising', 'braised', 'braise'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.BEEF],
    popularity: 60,
  },
  [TAG_IDS.COOKING_METHOD.STEWING]: {
    id: TAG_IDS.COOKING_METHOD.STEWING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.MOIST_HEAT,
    synonyms: ['stewing', 'stewed', 'stew'],
    relatedTags: [TAG_IDS.DISH_TYPE.STEW],
    popularity: 65,
  },

  // Fat-based
  [TAG_IDS.COOKING_METHOD.FAT_BASED]: {
    id: TAG_IDS.COOKING_METHOD.FAT_BASED,
    category: TagCategory.CookingMethod,
    children: [
      TAG_IDS.COOKING_METHOD.FRYING,
      TAG_IDS.COOKING_METHOD.DEEP_FRYING,
      TAG_IDS.COOKING_METHOD.PAN_FRYING,
      TAG_IDS.COOKING_METHOD.SAUTEING,
      TAG_IDS.COOKING_METHOD.STIR_FRYING,
    ],
    synonyms: ['fat-based'],
    relatedTags: [],
    popularity: 30,
  },
  [TAG_IDS.COOKING_METHOD.FRYING]: {
    id: TAG_IDS.COOKING_METHOD.FRYING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.FAT_BASED,
    synonyms: ['frying', 'fried', 'fry'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.CRISPY],
    popularity: 75,
  },
  [TAG_IDS.COOKING_METHOD.DEEP_FRYING]: {
    id: TAG_IDS.COOKING_METHOD.DEEP_FRYING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.FAT_BASED,
    synonyms: ['deep-frying', 'deep frying', 'deep-fried'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.CRISPY],
    popularity: 60,
  },
  [TAG_IDS.COOKING_METHOD.PAN_FRYING]: {
    id: TAG_IDS.COOKING_METHOD.PAN_FRYING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.FAT_BASED,
    synonyms: ['pan-frying', 'pan frying', 'pan-fried'],
    relatedTags: [],
    popularity: 70,
  },
  [TAG_IDS.COOKING_METHOD.SAUTEING]: {
    id: TAG_IDS.COOKING_METHOD.SAUTEING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.FAT_BASED,
    synonyms: ['sauteing', 'sautéing', 'sauteed', 'sauté'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.VEGETABLE],
    popularity: 80,
  },
  [TAG_IDS.COOKING_METHOD.STIR_FRYING]: {
    id: TAG_IDS.COOKING_METHOD.STIR_FRYING,
    category: TagCategory.CookingMethod,
    parent: TAG_IDS.COOKING_METHOD.FAT_BASED,
    synonyms: ['stir-frying', 'stir frying', 'stir-fried', 'wok'],
    relatedTags: [TAG_IDS.CUISINE.CHINESE, TAG_IDS.DISH_TYPE.STIR_FRY],
    popularity: 80,
  },

  // Specialized equipment
  [TAG_IDS.COOKING_METHOD.SLOW_COOKER]: {
    id: TAG_IDS.COOKING_METHOD.SLOW_COOKER,
    category: TagCategory.CookingMethod,
    synonyms: ['slow-cooker', 'slow cooker', 'crock-pot', 'crockpot'],
    relatedTags: [TAG_IDS.PLANNING.MAKE_AHEAD, TAG_IDS.CHARACTERISTICS.COMFORT_FOOD],
    popularity: 85,
  },
  [TAG_IDS.COOKING_METHOD.INSTANT_POT]: {
    id: TAG_IDS.COOKING_METHOD.INSTANT_POT,
    category: TagCategory.CookingMethod,
    synonyms: ['instant-pot', 'instant pot', 'instapot'],
    relatedTags: [TAG_IDS.PLANNING.QUICK, TAG_IDS.PLANNING.ONE_POT],
    popularity: 80,
  },
  [TAG_IDS.COOKING_METHOD.PRESSURE_COOKER]: {
    id: TAG_IDS.COOKING_METHOD.PRESSURE_COOKER,
    category: TagCategory.CookingMethod,
    synonyms: ['pressure-cooker', 'pressure cooker'],
    relatedTags: [TAG_IDS.COOKING_METHOD.INSTANT_POT],
    popularity: 65,
  },
  [TAG_IDS.COOKING_METHOD.AIR_FRYER]: {
    id: TAG_IDS.COOKING_METHOD.AIR_FRYER,
    category: TagCategory.CookingMethod,
    synonyms: ['air-fryer', 'air fryer', 'air-fried'],
    relatedTags: [TAG_IDS.PLANNING.QUICK, TAG_IDS.CHARACTERISTICS.CRISPY],
    popularity: 85,
  },
  [TAG_IDS.COOKING_METHOD.SMOKER]: {
    id: TAG_IDS.COOKING_METHOD.SMOKER,
    category: TagCategory.CookingMethod,
    synonyms: ['smoker', 'smoking', 'smoked'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.BEEF, TAG_IDS.MAIN_INGREDIENT.PORK],
    popularity: 55,
  },

  // No-cook
  [TAG_IDS.COOKING_METHOD.NO_COOK]: {
    id: TAG_IDS.COOKING_METHOD.NO_COOK,
    category: TagCategory.CookingMethod,
    synonyms: ['no-cook', 'no cook', 'no-bake'],
    relatedTags: [TAG_IDS.PLANNING.QUICK, TAG_IDS.SEASON.SUMMER],
    popularity: 70,
  },
  [TAG_IDS.COOKING_METHOD.RAW]: {
    id: TAG_IDS.COOKING_METHOD.RAW,
    category: TagCategory.CookingMethod,
    synonyms: ['raw'],
    relatedTags: [TAG_IDS.COOKING_METHOD.NO_COOK, TAG_IDS.CHARACTERISTICS.FRESH],
    popularity: 50,
  },

  // ==================== MAIN INGREDIENT (2-level) ====================
  // Protein category
  [TAG_IDS.MAIN_INGREDIENT.PROTEIN]: {
    id: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    category: TagCategory.MainIngredient,
    children: [
      TAG_IDS.MAIN_INGREDIENT.CHICKEN,
      TAG_IDS.MAIN_INGREDIENT.BEEF,
      TAG_IDS.MAIN_INGREDIENT.PORK,
      TAG_IDS.MAIN_INGREDIENT.LAMB,
      TAG_IDS.MAIN_INGREDIENT.TURKEY,
      TAG_IDS.MAIN_INGREDIENT.SEAFOOD,
      TAG_IDS.MAIN_INGREDIENT.FISH,
      TAG_IDS.MAIN_INGREDIENT.SALMON,
      TAG_IDS.MAIN_INGREDIENT.TUNA,
      TAG_IDS.MAIN_INGREDIENT.SHRIMP,
      TAG_IDS.MAIN_INGREDIENT.CRAB,
      TAG_IDS.MAIN_INGREDIENT.LOBSTER,
      TAG_IDS.MAIN_INGREDIENT.TOFU,
      TAG_IDS.MAIN_INGREDIENT.TEMPEH,
      TAG_IDS.MAIN_INGREDIENT.SEITAN,
    ],
    synonyms: ['protein', 'meat'],
    relatedTags: [TAG_IDS.DIETARY.HIGH_PROTEIN],
    popularity: 95,
  },
  [TAG_IDS.MAIN_INGREDIENT.CHICKEN]: {
    id: TAG_IDS.MAIN_INGREDIENT.CHICKEN,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['chicken', 'poultry'],
    relatedTags: [TAG_IDS.COOKING_METHOD.ROASTING, TAG_IDS.COOKING_METHOD.GRILLING],
    popularity: 95,
  },
  [TAG_IDS.MAIN_INGREDIENT.BEEF]: {
    id: TAG_IDS.MAIN_INGREDIENT.BEEF,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['beef', 'steak', 'ground beef'],
    relatedTags: [TAG_IDS.COOKING_METHOD.GRILLING, TAG_IDS.COOKING_METHOD.SEARING],
    popularity: 90,
  },
  [TAG_IDS.MAIN_INGREDIENT.PORK]: {
    id: TAG_IDS.MAIN_INGREDIENT.PORK,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['pork', 'bacon', 'ham'],
    relatedTags: [TAG_IDS.COOKING_METHOD.ROASTING],
    popularity: 85,
  },
  [TAG_IDS.MAIN_INGREDIENT.LAMB]: {
    id: TAG_IDS.MAIN_INGREDIENT.LAMB,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['lamb'],
    relatedTags: [TAG_IDS.CUISINE.MIDDLE_EASTERN],
    popularity: 55,
  },
  [TAG_IDS.MAIN_INGREDIENT.TURKEY]: {
    id: TAG_IDS.MAIN_INGREDIENT.TURKEY,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['turkey'],
    relatedTags: [TAG_IDS.SEASON.THANKSGIVING],
    popularity: 65,
  },
  [TAG_IDS.MAIN_INGREDIENT.SEAFOOD]: {
    id: TAG_IDS.MAIN_INGREDIENT.SEAFOOD,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['seafood', 'shellfish'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 85,
  },
  [TAG_IDS.MAIN_INGREDIENT.FISH]: {
    id: TAG_IDS.MAIN_INGREDIENT.FISH,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['fish'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 80,
  },
  [TAG_IDS.MAIN_INGREDIENT.SALMON]: {
    id: TAG_IDS.MAIN_INGREDIENT.SALMON,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['salmon'],
    relatedTags: [TAG_IDS.COOKING_METHOD.GRILLING, TAG_IDS.COOKING_METHOD.BAKING],
    popularity: 75,
  },
  [TAG_IDS.MAIN_INGREDIENT.TUNA]: {
    id: TAG_IDS.MAIN_INGREDIENT.TUNA,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['tuna'],
    relatedTags: [TAG_IDS.COURSE.SALAD],
    popularity: 65,
  },
  [TAG_IDS.MAIN_INGREDIENT.SHRIMP]: {
    id: TAG_IDS.MAIN_INGREDIENT.SHRIMP,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['shrimp', 'prawns'],
    relatedTags: [TAG_IDS.COOKING_METHOD.GRILLING, TAG_IDS.COOKING_METHOD.SAUTEING],
    popularity: 80,
  },
  [TAG_IDS.MAIN_INGREDIENT.CRAB]: {
    id: TAG_IDS.MAIN_INGREDIENT.CRAB,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['crab'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.SEAFOOD],
    popularity: 60,
  },
  [TAG_IDS.MAIN_INGREDIENT.LOBSTER]: {
    id: TAG_IDS.MAIN_INGREDIENT.LOBSTER,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['lobster'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.GOURMET],
    popularity: 50,
  },
  [TAG_IDS.MAIN_INGREDIENT.TOFU]: {
    id: TAG_IDS.MAIN_INGREDIENT.TOFU,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['tofu', 'bean curd'],
    relatedTags: [TAG_IDS.DIETARY.VEGAN, TAG_IDS.DIETARY.VEGETARIAN],
    popularity: 70,
  },
  [TAG_IDS.MAIN_INGREDIENT.TEMPEH]: {
    id: TAG_IDS.MAIN_INGREDIENT.TEMPEH,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['tempeh'],
    relatedTags: [TAG_IDS.DIETARY.VEGAN],
    popularity: 50,
  },
  [TAG_IDS.MAIN_INGREDIENT.SEITAN]: {
    id: TAG_IDS.MAIN_INGREDIENT.SEITAN,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.PROTEIN,
    synonyms: ['seitan', 'wheat gluten'],
    relatedTags: [TAG_IDS.DIETARY.VEGAN],
    popularity: 40,
  },

  // Grains
  [TAG_IDS.MAIN_INGREDIENT.GRAIN]: {
    id: TAG_IDS.MAIN_INGREDIENT.GRAIN,
    category: TagCategory.MainIngredient,
    children: [
      TAG_IDS.MAIN_INGREDIENT.RICE,
      TAG_IDS.MAIN_INGREDIENT.PASTA,
      TAG_IDS.MAIN_INGREDIENT.NOODLES,
      TAG_IDS.MAIN_INGREDIENT.QUINOA,
      TAG_IDS.MAIN_INGREDIENT.BREAD,
    ],
    synonyms: ['grain', 'grains'],
    relatedTags: [],
    popularity: 90,
  },
  [TAG_IDS.MAIN_INGREDIENT.RICE]: {
    id: TAG_IDS.MAIN_INGREDIENT.RICE,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.GRAIN,
    synonyms: ['rice'],
    relatedTags: [TAG_IDS.CUISINE.CHINESE, TAG_IDS.CUISINE.JAPANESE],
    popularity: 95,
  },
  [TAG_IDS.MAIN_INGREDIENT.PASTA]: {
    id: TAG_IDS.MAIN_INGREDIENT.PASTA,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.GRAIN,
    synonyms: ['pasta', 'spaghetti'],
    relatedTags: [TAG_IDS.CUISINE.ITALIAN, TAG_IDS.DISH_TYPE.PASTA],
    popularity: 95,
  },
  [TAG_IDS.MAIN_INGREDIENT.NOODLES]: {
    id: TAG_IDS.MAIN_INGREDIENT.NOODLES,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.GRAIN,
    synonyms: ['noodles'],
    relatedTags: [TAG_IDS.CUISINE.CHINESE, TAG_IDS.DISH_TYPE.STIR_FRY],
    popularity: 85,
  },
  [TAG_IDS.MAIN_INGREDIENT.QUINOA]: {
    id: TAG_IDS.MAIN_INGREDIENT.QUINOA,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.GRAIN,
    synonyms: ['quinoa'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.HEALTHY, TAG_IDS.DIETARY.GLUTEN_FREE],
    popularity: 70,
  },
  [TAG_IDS.MAIN_INGREDIENT.BREAD]: {
    id: TAG_IDS.MAIN_INGREDIENT.BREAD,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.GRAIN,
    synonyms: ['bread'],
    relatedTags: [TAG_IDS.DISH_TYPE.SANDWICH],
    popularity: 85,
  },

  // Legumes
  [TAG_IDS.MAIN_INGREDIENT.LEGUME]: {
    id: TAG_IDS.MAIN_INGREDIENT.LEGUME,
    category: TagCategory.MainIngredient,
    children: [
      TAG_IDS.MAIN_INGREDIENT.BEANS,
      TAG_IDS.MAIN_INGREDIENT.LENTILS,
      TAG_IDS.MAIN_INGREDIENT.CHICKPEAS,
    ],
    synonyms: ['legume', 'legumes', 'pulses'],
    relatedTags: [TAG_IDS.DIETARY.VEGETARIAN, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 75,
  },
  [TAG_IDS.MAIN_INGREDIENT.BEANS]: {
    id: TAG_IDS.MAIN_INGREDIENT.BEANS,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.LEGUME,
    synonyms: ['beans'],
    relatedTags: [TAG_IDS.CUISINE.MEXICAN],
    popularity: 80,
  },
  [TAG_IDS.MAIN_INGREDIENT.LENTILS]: {
    id: TAG_IDS.MAIN_INGREDIENT.LENTILS,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.LEGUME,
    synonyms: ['lentils'],
    relatedTags: [TAG_IDS.CUISINE.INDIAN, TAG_IDS.DIETARY.VEGETARIAN],
    popularity: 65,
  },
  [TAG_IDS.MAIN_INGREDIENT.CHICKPEAS]: {
    id: TAG_IDS.MAIN_INGREDIENT.CHICKPEAS,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.LEGUME,
    synonyms: ['chickpeas', 'garbanzo beans'],
    relatedTags: [TAG_IDS.CUISINE.MIDDLE_EASTERN],
    popularity: 70,
  },

  // Vegetables
  [TAG_IDS.MAIN_INGREDIENT.VEGETABLE]: {
    id: TAG_IDS.MAIN_INGREDIENT.VEGETABLE,
    category: TagCategory.MainIngredient,
    children: [
      TAG_IDS.MAIN_INGREDIENT.POTATOES,
      TAG_IDS.MAIN_INGREDIENT.MUSHROOMS,
      TAG_IDS.MAIN_INGREDIENT.TOMATOES,
      TAG_IDS.MAIN_INGREDIENT.PEPPERS,
    ],
    synonyms: ['vegetable', 'vegetables', 'veggies'],
    relatedTags: [TAG_IDS.DIETARY.VEGETARIAN, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 90,
  },
  [TAG_IDS.MAIN_INGREDIENT.POTATOES]: {
    id: TAG_IDS.MAIN_INGREDIENT.POTATOES,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.VEGETABLE,
    synonyms: ['potatoes', 'potato'],
    relatedTags: [TAG_IDS.COOKING_METHOD.ROASTING, TAG_IDS.COOKING_METHOD.BAKING],
    popularity: 90,
  },
  [TAG_IDS.MAIN_INGREDIENT.MUSHROOMS]: {
    id: TAG_IDS.MAIN_INGREDIENT.MUSHROOMS,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.VEGETABLE,
    synonyms: ['mushrooms', 'mushroom'],
    relatedTags: [TAG_IDS.DIETARY.VEGETARIAN, TAG_IDS.CHARACTERISTICS.UMAMI],
    popularity: 75,
  },
  [TAG_IDS.MAIN_INGREDIENT.TOMATOES]: {
    id: TAG_IDS.MAIN_INGREDIENT.TOMATOES,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.VEGETABLE,
    synonyms: ['tomatoes', 'tomato'],
    relatedTags: [TAG_IDS.CUISINE.ITALIAN],
    popularity: 85,
  },
  [TAG_IDS.MAIN_INGREDIENT.PEPPERS]: {
    id: TAG_IDS.MAIN_INGREDIENT.PEPPERS,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.VEGETABLE,
    synonyms: ['peppers', 'bell peppers'],
    relatedTags: [TAG_IDS.COOKING_METHOD.ROASTING],
    popularity: 70,
  },

  // Dairy
  [TAG_IDS.MAIN_INGREDIENT.DAIRY]: {
    id: TAG_IDS.MAIN_INGREDIENT.DAIRY,
    category: TagCategory.MainIngredient,
    children: [
      TAG_IDS.MAIN_INGREDIENT.CHEESE,
      TAG_IDS.MAIN_INGREDIENT.YOGURT,
      TAG_IDS.MAIN_INGREDIENT.MILK,
    ],
    synonyms: ['dairy'],
    relatedTags: [],
    popularity: 85,
  },
  [TAG_IDS.MAIN_INGREDIENT.CHEESE]: {
    id: TAG_IDS.MAIN_INGREDIENT.CHEESE,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.DAIRY,
    synonyms: ['cheese'],
    relatedTags: [TAG_IDS.DISH_TYPE.PIZZA, TAG_IDS.DISH_TYPE.PASTA],
    popularity: 90,
  },
  [TAG_IDS.MAIN_INGREDIENT.YOGURT]: {
    id: TAG_IDS.MAIN_INGREDIENT.YOGURT,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.DAIRY,
    synonyms: ['yogurt', 'yoghurt'],
    relatedTags: [TAG_IDS.MEAL_TYPE.BREAKFAST, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 75,
  },
  [TAG_IDS.MAIN_INGREDIENT.MILK]: {
    id: TAG_IDS.MAIN_INGREDIENT.MILK,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.DAIRY,
    synonyms: ['milk'],
    relatedTags: [TAG_IDS.MEAL_TYPE.BREAKFAST],
    popularity: 70,
  },

  // Eggs
  [TAG_IDS.MAIN_INGREDIENT.EGGS]: {
    id: TAG_IDS.MAIN_INGREDIENT.EGGS,
    category: TagCategory.MainIngredient,
    synonyms: ['eggs', 'egg'],
    relatedTags: [TAG_IDS.MEAL_TYPE.BREAKFAST, TAG_IDS.COOKING_METHOD.POACHING],
    popularity: 90,
  },

  // Fruit
  [TAG_IDS.MAIN_INGREDIENT.FRUIT]: {
    id: TAG_IDS.MAIN_INGREDIENT.FRUIT,
    category: TagCategory.MainIngredient,
    children: [
      TAG_IDS.MAIN_INGREDIENT.BERRIES,
      TAG_IDS.MAIN_INGREDIENT.CITRUS,
      TAG_IDS.MAIN_INGREDIENT.APPLES,
    ],
    synonyms: ['fruit', 'fruits'],
    relatedTags: [TAG_IDS.MEAL_TYPE.DESSERT, TAG_IDS.CHARACTERISTICS.SWEET],
    popularity: 80,
  },
  [TAG_IDS.MAIN_INGREDIENT.BERRIES]: {
    id: TAG_IDS.MAIN_INGREDIENT.BERRIES,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.FRUIT,
    synonyms: ['berries', 'strawberries', 'blueberries'],
    relatedTags: [TAG_IDS.MEAL_TYPE.BREAKFAST, TAG_IDS.CHARACTERISTICS.FRESH],
    popularity: 75,
  },
  [TAG_IDS.MAIN_INGREDIENT.CITRUS]: {
    id: TAG_IDS.MAIN_INGREDIENT.CITRUS,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.FRUIT,
    synonyms: ['citrus', 'lemon', 'orange', 'lime'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.TANGY],
    popularity: 70,
  },
  [TAG_IDS.MAIN_INGREDIENT.APPLES]: {
    id: TAG_IDS.MAIN_INGREDIENT.APPLES,
    category: TagCategory.MainIngredient,
    parent: TAG_IDS.MAIN_INGREDIENT.FRUIT,
    synonyms: ['apples', 'apple'],
    relatedTags: [TAG_IDS.MEAL_TYPE.DESSERT, TAG_IDS.SEASON.FALL],
    popularity: 75,
  },

  // ==================== SEASON ====================
  [TAG_IDS.SEASON.SPRING]: {
    id: TAG_IDS.SEASON.SPRING,
    category: TagCategory.Season,
    synonyms: ['spring'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.VEGETABLE, TAG_IDS.CHARACTERISTICS.FRESH],
    popularity: 65,
  },
  [TAG_IDS.SEASON.SUMMER]: {
    id: TAG_IDS.SEASON.SUMMER,
    category: TagCategory.Season,
    synonyms: ['summer'],
    relatedTags: [TAG_IDS.COOKING_METHOD.GRILLING, TAG_IDS.COURSE.SALAD],
    popularity: 80,
  },
  [TAG_IDS.SEASON.FALL]: {
    id: TAG_IDS.SEASON.FALL,
    category: TagCategory.Season,
    synonyms: ['fall', 'autumn'],
    relatedTags: [TAG_IDS.DISH_TYPE.SOUP, TAG_IDS.CHARACTERISTICS.COMFORT_FOOD],
    popularity: 70,
  },
  [TAG_IDS.SEASON.AUTUMN]: {
    id: TAG_IDS.SEASON.AUTUMN,
    category: TagCategory.Season,
    synonyms: ['autumn', 'fall'],
    relatedTags: [TAG_IDS.SEASON.FALL],
    popularity: 70,
  },
  [TAG_IDS.SEASON.WINTER]: {
    id: TAG_IDS.SEASON.WINTER,
    category: TagCategory.Season,
    synonyms: ['winter'],
    relatedTags: [TAG_IDS.DISH_TYPE.SOUP, TAG_IDS.DISH_TYPE.STEW],
    popularity: 75,
  },
  [TAG_IDS.SEASON.YEAR_ROUND]: {
    id: TAG_IDS.SEASON.YEAR_ROUND,
    category: TagCategory.Season,
    synonyms: ['year-round', 'year round', 'all season'],
    relatedTags: [],
    popularity: 50,
  },

  // Holidays
  [TAG_IDS.SEASON.HOLIDAY]: {
    id: TAG_IDS.SEASON.HOLIDAY,
    category: TagCategory.Season,
    children: [
      TAG_IDS.SEASON.THANKSGIVING,
      TAG_IDS.SEASON.CHRISTMAS,
      TAG_IDS.SEASON.EASTER,
      TAG_IDS.SEASON.HALLOWEEN,
      TAG_IDS.SEASON.NEW_YEAR,
      TAG_IDS.SEASON.VALENTINES,
      TAG_IDS.SEASON.FOURTH_JULY,
    ],
    synonyms: ['holiday', 'holidays', 'celebration'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.CROWD_PLEASER],
    popularity: 75,
  },
  [TAG_IDS.SEASON.THANKSGIVING]: {
    id: TAG_IDS.SEASON.THANKSGIVING,
    category: TagCategory.Season,
    parent: TAG_IDS.SEASON.HOLIDAY,
    synonyms: ['thanksgiving', 'turkey day'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.TURKEY, TAG_IDS.SEASON.FALL],
    popularity: 65,
  },
  [TAG_IDS.SEASON.CHRISTMAS]: {
    id: TAG_IDS.SEASON.CHRISTMAS,
    category: TagCategory.Season,
    parent: TAG_IDS.SEASON.HOLIDAY,
    synonyms: ['christmas', 'xmas'],
    relatedTags: [TAG_IDS.SEASON.WINTER, TAG_IDS.MEAL_TYPE.DESSERT],
    popularity: 70,
  },
  [TAG_IDS.SEASON.EASTER]: {
    id: TAG_IDS.SEASON.EASTER,
    category: TagCategory.Season,
    parent: TAG_IDS.SEASON.HOLIDAY,
    synonyms: ['easter'],
    relatedTags: [TAG_IDS.SEASON.SPRING],
    popularity: 55,
  },
  [TAG_IDS.SEASON.HALLOWEEN]: {
    id: TAG_IDS.SEASON.HALLOWEEN,
    category: TagCategory.Season,
    parent: TAG_IDS.SEASON.HOLIDAY,
    synonyms: ['halloween'],
    relatedTags: [TAG_IDS.SEASON.FALL, TAG_IDS.MEAL_TYPE.DESSERT],
    popularity: 60,
  },
  [TAG_IDS.SEASON.NEW_YEAR]: {
    id: TAG_IDS.SEASON.NEW_YEAR,
    category: TagCategory.Season,
    parent: TAG_IDS.SEASON.HOLIDAY,
    synonyms: ['new year', 'new years'],
    relatedTags: [TAG_IDS.SEASON.WINTER],
    popularity: 55,
  },
  [TAG_IDS.SEASON.VALENTINES]: {
    id: TAG_IDS.SEASON.VALENTINES,
    category: TagCategory.Season,
    parent: TAG_IDS.SEASON.HOLIDAY,
    synonyms: ['valentines', 'valentine\'s day'],
    relatedTags: [TAG_IDS.MEAL_TYPE.DESSERT, TAG_IDS.CHARACTERISTICS.ELEGANT],
    popularity: 50,
  },
  [TAG_IDS.SEASON.FOURTH_JULY]: {
    id: TAG_IDS.SEASON.FOURTH_JULY,
    category: TagCategory.Season,
    parent: TAG_IDS.SEASON.HOLIDAY,
    synonyms: ['fourth of july', '4th of july', 'independence day'],
    relatedTags: [TAG_IDS.SEASON.SUMMER, TAG_IDS.COOKING_METHOD.GRILLING],
    popularity: 50,
  },

  // ==================== PLANNING ====================
  [TAG_IDS.PLANNING.QUICK]: {
    id: TAG_IDS.PLANNING.QUICK,
    category: TagCategory.Planning,
    synonyms: ['quick', 'fast', '30 minutes', 'weeknight'],
    relatedTags: [TAG_IDS.DIFFICULTY.BEGINNER],
    popularity: 95,
  },
  [TAG_IDS.PLANNING.MAKE_AHEAD]: {
    id: TAG_IDS.PLANNING.MAKE_AHEAD,
    category: TagCategory.Planning,
    synonyms: ['make-ahead', 'make ahead', 'prep ahead'],
    relatedTags: [TAG_IDS.PLANNING.MEAL_PREP],
    popularity: 75,
  },
  [TAG_IDS.PLANNING.FREEZER_FRIENDLY]: {
    id: TAG_IDS.PLANNING.FREEZER_FRIENDLY,
    category: TagCategory.Planning,
    synonyms: ['freezer-friendly', 'freezer friendly', 'freezable'],
    relatedTags: [TAG_IDS.PLANNING.MEAL_PREP],
    popularity: 70,
  },
  [TAG_IDS.PLANNING.MEAL_PREP]: {
    id: TAG_IDS.PLANNING.MEAL_PREP,
    category: TagCategory.Planning,
    synonyms: ['meal-prep', 'meal prep', 'mealprep'],
    relatedTags: [TAG_IDS.PLANNING.MAKE_AHEAD, TAG_IDS.PLANNING.BATCH_COOKING],
    popularity: 80,
  },
  [TAG_IDS.PLANNING.LEFTOVER_FRIENDLY]: {
    id: TAG_IDS.PLANNING.LEFTOVER_FRIENDLY,
    category: TagCategory.Planning,
    synonyms: ['leftover-friendly', 'leftover friendly', 'leftovers'],
    relatedTags: [TAG_IDS.PLANNING.MAKE_AHEAD],
    popularity: 65,
  },
  [TAG_IDS.PLANNING.ONE_POT]: {
    id: TAG_IDS.PLANNING.ONE_POT,
    category: TagCategory.Planning,
    synonyms: ['one-pot', 'one pot', 'onepot'],
    relatedTags: [TAG_IDS.PLANNING.QUICK],
    popularity: 85,
  },
  [TAG_IDS.PLANNING.ONE_PAN]: {
    id: TAG_IDS.PLANNING.ONE_PAN,
    category: TagCategory.Planning,
    synonyms: ['one-pan', 'one pan', 'onepan'],
    relatedTags: [TAG_IDS.PLANNING.QUICK],
    popularity: 80,
  },
  [TAG_IDS.PLANNING.SHEET_PAN]: {
    id: TAG_IDS.PLANNING.SHEET_PAN,
    category: TagCategory.Planning,
    synonyms: ['sheet-pan', 'sheet pan', 'sheetpan'],
    relatedTags: [TAG_IDS.PLANNING.ONE_PAN],
    popularity: 75,
  },
  [TAG_IDS.PLANNING.SLOW_COOKER_FRIENDLY]: {
    id: TAG_IDS.PLANNING.SLOW_COOKER_FRIENDLY,
    category: TagCategory.Planning,
    synonyms: ['slow-cooker-friendly', 'slow cooker friendly'],
    relatedTags: [TAG_IDS.COOKING_METHOD.SLOW_COOKER, TAG_IDS.PLANNING.MAKE_AHEAD],
    popularity: 75,
  },
  [TAG_IDS.PLANNING.OVERNIGHT]: {
    id: TAG_IDS.PLANNING.OVERNIGHT,
    category: TagCategory.Planning,
    synonyms: ['overnight', '8 hours'],
    relatedTags: [TAG_IDS.PLANNING.MAKE_AHEAD, TAG_IDS.MEAL_TYPE.BREAKFAST],
    popularity: 60,
  },
  [TAG_IDS.PLANNING.BATCH_COOKING]: {
    id: TAG_IDS.PLANNING.BATCH_COOKING,
    category: TagCategory.Planning,
    synonyms: ['batch-cooking', 'batch cooking', 'bulk cooking'],
    relatedTags: [TAG_IDS.PLANNING.MEAL_PREP, TAG_IDS.PLANNING.FREEZER_FRIENDLY],
    popularity: 65,
  },

  // ==================== CHARACTERISTICS ====================
  [TAG_IDS.CHARACTERISTICS.COMFORT_FOOD]: {
    id: TAG_IDS.CHARACTERISTICS.COMFORT_FOOD,
    category: TagCategory.Characteristics,
    synonyms: ['comfort-food', 'comfort food', 'comforting'],
    relatedTags: [TAG_IDS.SEASON.WINTER, TAG_IDS.DISH_TYPE.SOUP],
    popularity: 85,
  },
  [TAG_IDS.CHARACTERISTICS.KID_FRIENDLY]: {
    id: TAG_IDS.CHARACTERISTICS.KID_FRIENDLY,
    category: TagCategory.Characteristics,
    synonyms: ['kid-friendly', 'kid friendly', 'kids'],
    relatedTags: [TAG_IDS.DIFFICULTY.BEGINNER],
    popularity: 80,
  },
  [TAG_IDS.CHARACTERISTICS.CROWD_PLEASER]: {
    id: TAG_IDS.CHARACTERISTICS.CROWD_PLEASER,
    category: TagCategory.Characteristics,
    synonyms: ['crowd-pleaser', 'crowd pleaser'],
    relatedTags: [TAG_IDS.SEASON.HOLIDAY],
    popularity: 75,
  },
  [TAG_IDS.CHARACTERISTICS.BUDGET_FRIENDLY]: {
    id: TAG_IDS.CHARACTERISTICS.BUDGET_FRIENDLY,
    category: TagCategory.Characteristics,
    synonyms: ['budget-friendly', 'budget friendly', 'cheap', 'affordable'],
    relatedTags: [TAG_IDS.PLANNING.MEAL_PREP],
    popularity: 70,
  },
  [TAG_IDS.CHARACTERISTICS.HEALTHY]: {
    id: TAG_IDS.CHARACTERISTICS.HEALTHY,
    category: TagCategory.Characteristics,
    synonyms: ['healthy', 'nutritious', 'wholesome'],
    relatedTags: [TAG_IDS.DIETARY.VEGETARIAN, TAG_IDS.MAIN_INGREDIENT.VEGETABLE],
    popularity: 90,
  },
  [TAG_IDS.CHARACTERISTICS.LIGHT]: {
    id: TAG_IDS.CHARACTERISTICS.LIGHT,
    category: TagCategory.Characteristics,
    synonyms: ['light', 'refreshing'],
    relatedTags: [TAG_IDS.SEASON.SUMMER, TAG_IDS.CHARACTERISTICS.HEALTHY],
    popularity: 70,
  },
  [TAG_IDS.CHARACTERISTICS.HEARTY]: {
    id: TAG_IDS.CHARACTERISTICS.HEARTY,
    category: TagCategory.Characteristics,
    synonyms: ['hearty', 'filling', 'substantial'],
    relatedTags: [TAG_IDS.SEASON.WINTER, TAG_IDS.DISH_TYPE.STEW],
    popularity: 75,
  },
  [TAG_IDS.CHARACTERISTICS.SPICY]: {
    id: TAG_IDS.CHARACTERISTICS.SPICY,
    category: TagCategory.Characteristics,
    synonyms: ['spicy', 'hot'],
    relatedTags: [TAG_IDS.CUISINE.MEXICAN, TAG_IDS.CUISINE.THAI],
    popularity: 80,
  },
  [TAG_IDS.CHARACTERISTICS.MILD]: {
    id: TAG_IDS.CHARACTERISTICS.MILD,
    category: TagCategory.Characteristics,
    synonyms: ['mild', 'gentle'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.KID_FRIENDLY],
    popularity: 60,
  },
  [TAG_IDS.CHARACTERISTICS.SWEET]: {
    id: TAG_IDS.CHARACTERISTICS.SWEET,
    category: TagCategory.Characteristics,
    synonyms: ['sweet'],
    relatedTags: [TAG_IDS.MEAL_TYPE.DESSERT],
    popularity: 85,
  },
  [TAG_IDS.CHARACTERISTICS.SAVORY]: {
    id: TAG_IDS.CHARACTERISTICS.SAVORY,
    category: TagCategory.Characteristics,
    synonyms: ['savory', 'savoury'],
    relatedTags: [TAG_IDS.COURSE.MAIN],
    popularity: 80,
  },
  [TAG_IDS.CHARACTERISTICS.TANGY]: {
    id: TAG_IDS.CHARACTERISTICS.TANGY,
    category: TagCategory.Characteristics,
    synonyms: ['tangy', 'tart'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.CITRUS],
    popularity: 60,
  },
  [TAG_IDS.CHARACTERISTICS.CRISPY]: {
    id: TAG_IDS.CHARACTERISTICS.CRISPY,
    category: TagCategory.Characteristics,
    synonyms: ['crispy', 'crunchy'],
    relatedTags: [TAG_IDS.COOKING_METHOD.FRYING, TAG_IDS.COOKING_METHOD.AIR_FRYER],
    popularity: 75,
  },
  [TAG_IDS.CHARACTERISTICS.CREAMY]: {
    id: TAG_IDS.CHARACTERISTICS.CREAMY,
    category: TagCategory.Characteristics,
    synonyms: ['creamy', 'rich'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.DAIRY],
    popularity: 70,
  },
  [TAG_IDS.CHARACTERISTICS.FRESH]: {
    id: TAG_IDS.CHARACTERISTICS.FRESH,
    category: TagCategory.Characteristics,
    synonyms: ['fresh'],
    relatedTags: [TAG_IDS.SEASON.SUMMER, TAG_IDS.COURSE.SALAD],
    popularity: 75,
  },
  [TAG_IDS.CHARACTERISTICS.GOURMET]: {
    id: TAG_IDS.CHARACTERISTICS.GOURMET,
    category: TagCategory.Characteristics,
    synonyms: ['gourmet', 'fancy', 'upscale'],
    relatedTags: [TAG_IDS.DIFFICULTY.ADVANCED, TAG_IDS.CHARACTERISTICS.ELEGANT],
    popularity: 50,
  },
  [TAG_IDS.CHARACTERISTICS.RUSTIC]: {
    id: TAG_IDS.CHARACTERISTICS.RUSTIC,
    category: TagCategory.Characteristics,
    synonyms: ['rustic', 'homestyle', 'country'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.COMFORT_FOOD],
    popularity: 55,
  },
  [TAG_IDS.CHARACTERISTICS.ELEGANT]: {
    id: TAG_IDS.CHARACTERISTICS.ELEGANT,
    category: TagCategory.Characteristics,
    synonyms: ['elegant', 'refined', 'sophisticated'],
    relatedTags: [TAG_IDS.CHARACTERISTICS.GOURMET],
    popularity: 45,
  },
  [TAG_IDS.CHARACTERISTICS.PARTY_FOOD]: {
    id: TAG_IDS.CHARACTERISTICS.PARTY_FOOD,
    category: TagCategory.Characteristics,
    synonyms: ['party-food', 'party food', 'entertaining'],
    relatedTags: [TAG_IDS.MEAL_TYPE.APPETIZER],
    popularity: 70,
  },
  [TAG_IDS.CHARACTERISTICS.PICNIC]: {
    id: TAG_IDS.CHARACTERISTICS.PICNIC,
    category: TagCategory.Characteristics,
    synonyms: ['picnic', 'outdoor'],
    relatedTags: [TAG_IDS.SEASON.SUMMER],
    popularity: 50,
  },
  [TAG_IDS.CHARACTERISTICS.UMAMI]: {
    id: TAG_IDS.CHARACTERISTICS.UMAMI,
    category: TagCategory.Characteristics,
    synonyms: ['umami', 'savory-rich'],
    relatedTags: [TAG_IDS.MAIN_INGREDIENT.MUSHROOMS, TAG_IDS.CHARACTERISTICS.SAVORY],
    popularity: 40,
  },

  // ==================== OTHER ====================
  [TAG_IDS.OTHER.OTHER]: {
    id: TAG_IDS.OTHER.OTHER,
    category: TagCategory.Other,
    synonyms: ['other', 'misc', 'miscellaneous'],
    relatedTags: [],
    popularity: 10,
  },
};

/**
 * Get tag node by ID
 */
export function getTagNode(tagId: TagId): TagNode | null {
  return TAG_HIERARCHY[tagId] || null;
}

/**
 * Get children of a tag
 */
export function getChildTags(tagId: TagId): TagNode[] {
  const node = TAG_HIERARCHY[tagId];
  if (!node || !node.children) return [];

  return node.children
    .map(childId => TAG_HIERARCHY[childId])
    .filter((child): child is TagNode => !!child);
}

/**
 * Get parent of a tag
 */
export function getParentTag(tagId: TagId): TagNode | null {
  const node = TAG_HIERARCHY[tagId];
  if (!node || !node.parent) return null;

  return TAG_HIERARCHY[node.parent] || null;
}

/**
 * Get related tags for suggestions
 */
export function getRelatedTagNodes(tagId: TagId): TagNode[] {
  const node = TAG_HIERARCHY[tagId];
  if (!node || !node.relatedTags) return [];

  return node.relatedTags
    .map(relatedId => TAG_HIERARCHY[relatedId])
    .filter((tag): tag is TagNode => !!tag);
}

/**
 * Get all synonyms for a tag (for backward compatibility)
 */
export function getTagSynonyms(tagId: TagId): string[] {
  const node = TAG_HIERARCHY[tagId];
  return node?.synonyms || [];
}

/**
 * Find tag ID by synonym (old string tag format)
 */
export function findTagIdBySynonym(synonym: string): TagId | null {
  const normalized = synonym.toLowerCase().trim();

  for (const [tagId, node] of Object.entries(TAG_HIERARCHY)) {
    if (node.synonyms?.some(s => s.toLowerCase() === normalized)) {
      return tagId as TagId;
    }
  }

  return null;
}

/**
 * Check if tag has children (is a parent tag)
 */
export function isParentTag(tagId: TagId): boolean {
  const node = TAG_HIERARCHY[tagId];
  return !!node?.children && node.children.length > 0;
}

/**
 * Check if tag is a child tag
 */
export function isChildTag(tagId: TagId): boolean {
  const node = TAG_HIERARCHY[tagId];
  return !!node?.parent;
}

/**
 * Get all ancestors of a tag (parent, grandparent, etc.)
 */
export function getAncestors(tagId: TagId): TagNode[] {
  const ancestors: TagNode[] = [];
  let currentNode = getParentTag(tagId);

  while (currentNode) {
    ancestors.push(currentNode);
    currentNode = getParentTag(currentNode.id);
  }

  return ancestors;
}

/**
 * Get all descendants of a tag (children, grandchildren, etc.)
 */
export function getDescendants(tagId: TagId): TagNode[] {
  const descendants: TagNode[] = [];
  const children = getChildTags(tagId);

  for (const child of children) {
    descendants.push(child);
    descendants.push(...getDescendants(child.id));
  }

  return descendants;
}
