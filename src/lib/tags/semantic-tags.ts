/**
 * Semantic Tag System
 *
 * Provides structured tag definitions with categories, synonyms, and relationships
 * for intelligent tag suggestions and organization.
 */

import type { TagCategory } from '../tag-ontology';

export interface SemanticTag {
  /** Canonical tag name (lowercase, hyphenated) */
  id: string;
  /** Display name for UI */
  name: string;
  /** Tag category for grouping */
  category: TagCategory;
  /** Brief description for tooltips */
  description?: string;
  /** Alternative terms that map to this tag */
  synonyms?: string[];
  /** Related tags for suggestions */
  relatedTags?: string[];
  /** Hierarchical relationships */
  hierarchy?: {
    parent?: string;
    children?: string[];
  };
  /** Common usage frequency (0-100, higher = more common) */
  popularity?: number;
}

/**
 * Master semantic tag definitions
 * Organized by category for maintainability
 */
export const SEMANTIC_TAGS: Record<string, SemanticTag> = {
  // ==================== CUISINE TAGS ====================
  'italian': {
    id: 'italian',
    name: 'Italian',
    category: 'Cuisine',
    description: 'Italian cuisine and cooking traditions',
    synonyms: ['italy', 'italiano'],
    relatedTags: ['pasta', 'mediterranean', 'pizza'],
    hierarchy: {
      children: ['sicilian', 'tuscan', 'neapolitan'],
    },
    popularity: 95,
  },
  'sicilian': {
    id: 'sicilian',
    name: 'Sicilian',
    category: 'Cuisine',
    description: 'Sicilian regional Italian cuisine',
    hierarchy: { parent: 'italian' },
    relatedTags: ['italian', 'seafood', 'mediterranean'],
    popularity: 40,
  },
  'mexican': {
    id: 'mexican',
    name: 'Mexican',
    category: 'Cuisine',
    description: 'Mexican cuisine and traditions',
    synonyms: ['mexico', 'tex-mex'],
    relatedTags: ['latin-american', 'spicy', 'tacos'],
    popularity: 90,
  },
  'chinese': {
    id: 'chinese',
    name: 'Chinese',
    category: 'Cuisine',
    description: 'Chinese cuisine and cooking styles',
    synonyms: ['china', 'cantonese', 'szechuan'],
    relatedTags: ['asian', 'stir-fried', 'rice'],
    popularity: 85,
  },
  'japanese': {
    id: 'japanese',
    name: 'Japanese',
    category: 'Cuisine',
    description: 'Japanese cuisine and traditions',
    synonyms: ['japan', 'sushi', 'ramen'],
    relatedTags: ['asian', 'seafood', 'rice'],
    popularity: 80,
  },
  'indian': {
    id: 'indian',
    name: 'Indian',
    category: 'Cuisine',
    description: 'Indian cuisine and spices',
    synonyms: ['india', 'curry'],
    relatedTags: ['asian', 'spicy', 'vegetarian'],
    popularity: 85,
  },
  'french': {
    id: 'french',
    name: 'French',
    category: 'Cuisine',
    description: 'French cuisine and cooking techniques',
    synonyms: ['france', 'provencal'],
    relatedTags: ['european', 'baked'],
    popularity: 75,
  },
  'thai': {
    id: 'thai',
    name: 'Thai',
    category: 'Cuisine',
    description: 'Thai cuisine with bold flavors',
    synonyms: ['thailand'],
    relatedTags: ['asian', 'spicy', 'curry'],
    popularity: 80,
  },
  'mediterranean': {
    id: 'mediterranean',
    name: 'Mediterranean',
    category: 'Cuisine',
    description: 'Mediterranean regional cuisine',
    synonyms: ['med', 'greco-roman'],
    relatedTags: ['greek', 'italian', 'healthy'],
    popularity: 85,
  },
  'greek': {
    id: 'greek',
    name: 'Greek',
    category: 'Cuisine',
    description: 'Greek cuisine and traditions',
    synonyms: ['greece', 'hellenic'],
    relatedTags: ['mediterranean', 'seafood', 'salad'],
    popularity: 70,
  },
  'korean': {
    id: 'korean',
    name: 'Korean',
    category: 'Cuisine',
    description: 'Korean cuisine with fermented foods',
    synonyms: ['korea', 'k-food'],
    relatedTags: ['asian', 'spicy', 'kimchi'],
    popularity: 75,
  },
  'vietnamese': {
    id: 'vietnamese',
    name: 'Vietnamese',
    category: 'Cuisine',
    description: 'Vietnamese cuisine with fresh herbs',
    synonyms: ['vietnam', 'pho'],
    relatedTags: ['asian', 'healthy', 'noodles'],
    popularity: 65,
  },
  'spanish': {
    id: 'spanish',
    name: 'Spanish',
    category: 'Cuisine',
    description: 'Spanish cuisine and tapas',
    synonyms: ['spain', 'iberian'],
    relatedTags: ['mediterranean', 'european', 'seafood'],
    popularity: 70,
  },
  'middle-eastern': {
    id: 'middle-eastern',
    name: 'Middle Eastern',
    category: 'Cuisine',
    description: 'Middle Eastern regional cuisine',
    synonyms: ['levantine', 'arabic', 'persian'],
    relatedTags: ['mediterranean', 'vegetarian', 'spicy'],
    popularity: 65,
  },

  // ==================== MEAL TYPE TAGS ====================
  'breakfast': {
    id: 'breakfast',
    name: 'Breakfast',
    category: 'Meal Type',
    description: 'Morning meal recipes',
    synonyms: ['brunch', 'morning'],
    relatedTags: ['eggs', 'quick', 'easy'],
    popularity: 90,
  },
  'lunch': {
    id: 'lunch',
    name: 'Lunch',
    category: 'Meal Type',
    description: 'Midday meal recipes',
    synonyms: ['luncheon', 'midday'],
    relatedTags: ['sandwich', 'salad', 'quick'],
    popularity: 85,
  },
  'dinner': {
    id: 'dinner',
    name: 'Dinner',
    category: 'Meal Type',
    description: 'Evening main meal recipes',
    synonyms: ['supper', 'evening'],
    relatedTags: ['main-course', 'family'],
    popularity: 95,
  },
  'snack': {
    id: 'snack',
    name: 'Snack',
    category: 'Meal Type',
    description: 'Light snacks and appetizers',
    synonyms: ['appetizer', 'finger-food'],
    relatedTags: ['quick', 'easy', 'party'],
    popularity: 80,
  },
  'dessert': {
    id: 'dessert',
    name: 'Dessert',
    category: 'Meal Type',
    description: 'Sweet treats and desserts',
    synonyms: ['sweet', 'pastry', 'cake'],
    relatedTags: ['baked', 'chocolate', 'fruit'],
    popularity: 90,
  },
  'brunch': {
    id: 'brunch',
    name: 'Brunch',
    category: 'Meal Type',
    description: 'Late morning meal combining breakfast and lunch',
    synonyms: ['weekend-breakfast'],
    relatedTags: ['breakfast', 'lunch', 'eggs'],
    popularity: 70,
  },

  // ==================== DIETARY TAGS ====================
  'vegetarian': {
    id: 'vegetarian',
    name: 'Vegetarian',
    category: 'Dietary',
    description: 'No meat or fish',
    synonyms: ['veggie', 'meatless'],
    relatedTags: ['healthy', 'vegetables', 'plant-based'],
    hierarchy: {
      children: ['vegan'],
    },
    popularity: 95,
  },
  'vegan': {
    id: 'vegan',
    name: 'Vegan',
    category: 'Dietary',
    description: 'No animal products',
    synonyms: ['plant-based', 'dairy-free'],
    relatedTags: ['vegetarian', 'healthy', 'dairy-free'],
    hierarchy: {
      parent: 'vegetarian',
    },
    popularity: 90,
  },
  'gluten-free': {
    id: 'gluten-free',
    name: 'Gluten-Free',
    category: 'Dietary',
    description: 'No wheat, barley, or rye',
    synonyms: ['gf', 'celiac'],
    relatedTags: ['healthy', 'dairy-free'],
    popularity: 85,
  },
  'dairy-free': {
    id: 'dairy-free',
    name: 'Dairy-Free',
    category: 'Dietary',
    description: 'No milk products',
    synonyms: ['lactose-free', 'no-dairy'],
    relatedTags: ['vegan', 'healthy'],
    popularity: 80,
  },
  'keto': {
    id: 'keto',
    name: 'Keto',
    category: 'Dietary',
    description: 'Ketogenic diet (high fat, low carb)',
    synonyms: ['ketogenic', 'low-carb'],
    relatedTags: ['low-carb', 'high-protein', 'healthy'],
    popularity: 85,
  },
  'low-carb': {
    id: 'low-carb',
    name: 'Low-Carb',
    category: 'Dietary',
    description: 'Reduced carbohydrate content',
    synonyms: ['low-carbohydrate', 'atkins'],
    relatedTags: ['keto', 'healthy', 'high-protein'],
    popularity: 80,
  },
  'paleo': {
    id: 'paleo',
    name: 'Paleo',
    category: 'Dietary',
    description: 'Paleolithic diet (whole foods, no grains)',
    synonyms: ['caveman', 'primal'],
    relatedTags: ['healthy', 'gluten-free', 'dairy-free'],
    popularity: 70,
  },
  'whole30': {
    id: 'whole30',
    name: 'Whole30',
    category: 'Dietary',
    description: 'Whole30 compliant (no sugar, grains, dairy)',
    synonyms: ['whole-30', 'w30'],
    relatedTags: ['paleo', 'healthy', 'clean-eating'],
    popularity: 60,
  },
  'high-protein': {
    id: 'high-protein',
    name: 'High-Protein',
    category: 'Dietary',
    description: 'Protein-rich recipes',
    synonyms: ['protein', 'bodybuilding'],
    relatedTags: ['healthy', 'low-carb', 'fitness'],
    popularity: 75,
  },

  // ==================== COOKING METHOD TAGS ====================
  'baked': {
    id: 'baked',
    name: 'Baked',
    category: 'Cooking Method',
    description: 'Cooked in an oven',
    synonyms: ['oven', 'roasted'],
    relatedTags: ['easy', 'dessert'],
    popularity: 90,
  },
  'grilled': {
    id: 'grilled',
    name: 'Grilled',
    category: 'Cooking Method',
    description: 'Cooked on a grill',
    synonyms: ['bbq', 'barbecue', 'charred'],
    relatedTags: ['summer', 'outdoor', 'meat'],
    popularity: 85,
  },
  'fried': {
    id: 'fried',
    name: 'Fried',
    category: 'Cooking Method',
    description: 'Deep fried or pan-fried',
    synonyms: ['deep-fried', 'pan-fried'],
    relatedTags: ['quick', 'crispy'],
    popularity: 75,
  },
  'stir-fried': {
    id: 'stir-fried',
    name: 'Stir-Fried',
    category: 'Cooking Method',
    description: 'Quick cooking in a wok or pan',
    synonyms: ['wok', 'stir-fry'],
    relatedTags: ['chinese', 'quick', 'asian'],
    popularity: 80,
  },
  'slow-cooked': {
    id: 'slow-cooked',
    name: 'Slow-Cooked',
    category: 'Cooking Method',
    description: 'Long, slow cooking process',
    synonyms: ['slow-cooker', 'crock-pot'],
    relatedTags: ['easy', 'make-ahead', 'tender'],
    popularity: 85,
  },
  'instant-pot': {
    id: 'instant-pot',
    name: 'Instant Pot',
    category: 'Cooking Method',
    description: 'Pressure cooker recipes',
    synonyms: ['pressure-cooker', 'multi-cooker'],
    relatedTags: ['quick', 'easy', 'one-pot'],
    popularity: 80,
  },
  'air-fryer': {
    id: 'air-fryer',
    name: 'Air Fryer',
    category: 'Cooking Method',
    description: 'Cooked in an air fryer',
    synonyms: ['air-fried'],
    relatedTags: ['quick', 'healthy', 'crispy'],
    popularity: 85,
  },
  'no-cook': {
    id: 'no-cook',
    name: 'No-Cook',
    category: 'Cooking Method',
    description: 'No cooking required',
    synonyms: ['raw', 'cold', 'no-bake'],
    relatedTags: ['quick', 'easy', 'summer'],
    popularity: 70,
  },

  // ==================== MAIN INGREDIENT TAGS ====================
  'chicken': {
    id: 'chicken',
    name: 'Chicken',
    category: 'Main Ingredient',
    description: 'Chicken-based recipes',
    synonyms: ['poultry', 'fowl'],
    relatedTags: ['protein', 'meat'],
    popularity: 95,
  },
  'beef': {
    id: 'beef',
    name: 'Beef',
    category: 'Main Ingredient',
    description: 'Beef-based recipes',
    synonyms: ['steak', 'ground-beef'],
    relatedTags: ['protein', 'meat'],
    popularity: 90,
  },
  'pork': {
    id: 'pork',
    name: 'Pork',
    category: 'Main Ingredient',
    description: 'Pork-based recipes',
    synonyms: ['bacon', 'ham'],
    relatedTags: ['protein', 'meat'],
    popularity: 85,
  },
  'seafood': {
    id: 'seafood',
    name: 'Seafood',
    category: 'Main Ingredient',
    description: 'Fish and shellfish recipes',
    synonyms: ['fish', 'shellfish'],
    relatedTags: ['protein', 'healthy'],
    hierarchy: {
      children: ['salmon', 'shrimp', 'tuna'],
    },
    popularity: 85,
  },
  'pasta': {
    id: 'pasta',
    name: 'Pasta',
    category: 'Main Ingredient',
    description: 'Pasta-based dishes',
    synonyms: ['noodles', 'spaghetti'],
    relatedTags: ['italian', 'dinner', 'carbs'],
    popularity: 95,
  },
  'vegetables': {
    id: 'vegetables',
    name: 'Vegetables',
    category: 'Main Ingredient',
    description: 'Vegetable-focused recipes',
    synonyms: ['veggies', 'produce'],
    relatedTags: ['vegetarian', 'healthy', 'plant-based'],
    popularity: 90,
  },

  // ==================== COURSE TAGS ====================
  'salad': {
    id: 'salad',
    name: 'Salad',
    category: 'Course',
    description: 'Fresh salad recipes',
    synonyms: ['greens'],
    relatedTags: ['healthy', 'vegetables', 'lunch'],
    popularity: 85,
  },
  'soup': {
    id: 'soup',
    name: 'Soup',
    category: 'Course',
    description: 'Soup and broth recipes',
    synonyms: ['broth', 'stew'],
    relatedTags: ['comfort-food', 'winter', 'healthy'],
    popularity: 90,
  },
  'sandwich': {
    id: 'sandwich',
    name: 'Sandwich',
    category: 'Course',
    description: 'Sandwich recipes',
    synonyms: ['sub', 'wrap'],
    relatedTags: ['lunch', 'quick', 'bread'],
    popularity: 85,
  },
  'pizza': {
    id: 'pizza',
    name: 'Pizza',
    category: 'Course',
    description: 'Pizza recipes',
    synonyms: ['pie'],
    relatedTags: ['italian', 'dinner', 'baked'],
    popularity: 90,
  },

  // ==================== SEASON TAGS ====================
  'summer': {
    id: 'summer',
    name: 'Summer',
    category: 'Season',
    description: 'Summer seasonal recipes',
    synonyms: ['warm-weather'],
    relatedTags: ['grilled', 'salad', 'fresh'],
    popularity: 80,
  },
  'winter': {
    id: 'winter',
    name: 'Winter',
    category: 'Season',
    description: 'Winter comfort food',
    synonyms: ['cold-weather'],
    relatedTags: ['soup', 'comfort-food', 'slow-cooked'],
    popularity: 75,
  },
  'fall': {
    id: 'fall',
    name: 'Fall',
    category: 'Season',
    description: 'Autumn harvest recipes',
    synonyms: ['autumn', 'harvest'],
    relatedTags: ['pumpkin', 'squash', 'thanksgiving'],
    popularity: 70,
  },
  'spring': {
    id: 'spring',
    name: 'Spring',
    category: 'Season',
    description: 'Spring seasonal recipes',
    synonyms: ['fresh', 'renewal'],
    relatedTags: ['vegetables', 'light', 'fresh'],
    popularity: 65,
  },
  'holiday': {
    id: 'holiday',
    name: 'Holiday',
    category: 'Season',
    description: 'Holiday celebration recipes',
    synonyms: ['celebration', 'festive'],
    relatedTags: ['christmas', 'thanksgiving', 'special'],
    popularity: 75,
  },
  'christmas': {
    id: 'christmas',
    name: 'Christmas',
    category: 'Season',
    description: 'Christmas recipes',
    synonyms: ['xmas', 'holiday'],
    relatedTags: ['holiday', 'winter', 'dessert'],
    popularity: 70,
  },
  'thanksgiving': {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    category: 'Season',
    description: 'Thanksgiving recipes',
    synonyms: ['turkey-day'],
    relatedTags: ['holiday', 'fall', 'turkey'],
    popularity: 65,
  },

  // ==================== DIFFICULTY TAGS ====================
  'easy': {
    id: 'easy',
    name: 'Easy',
    category: 'Difficulty',
    description: 'Simple recipes for beginners',
    synonyms: ['simple', 'beginner'],
    relatedTags: ['quick', 'weeknight'],
    popularity: 95,
  },
  'medium': {
    id: 'medium',
    name: 'Medium',
    category: 'Difficulty',
    description: 'Intermediate cooking skills',
    synonyms: ['intermediate', 'moderate'],
    relatedTags: [],
    popularity: 75,
  },
  'hard': {
    id: 'hard',
    name: 'Hard',
    category: 'Difficulty',
    description: 'Advanced cooking techniques',
    synonyms: ['advanced', 'expert', 'complex'],
    relatedTags: ['gourmet', 'special-occasion'],
    popularity: 40,
  },

  // ==================== TIME TAGS ====================
  'quick': {
    id: 'quick',
    name: 'Quick',
    category: 'Time',
    description: 'Fast recipes (under 30 min)',
    synonyms: ['fast', '30-minute', 'weeknight'],
    relatedTags: ['easy', 'weeknight'],
    popularity: 95,
  },
  'make-ahead': {
    id: 'make-ahead',
    name: 'Make-Ahead',
    category: 'Time',
    description: 'Can be prepared in advance',
    synonyms: ['prep-ahead', 'advance'],
    relatedTags: ['meal-prep', 'freezer'],
    popularity: 75,
  },
  'overnight': {
    id: 'overnight',
    name: 'Overnight',
    category: 'Time',
    description: 'Requires overnight preparation',
    synonyms: ['8-hour', 'slow'],
    relatedTags: ['make-ahead', 'breakfast'],
    popularity: 60,
  },
};

/**
 * Get semantic tag by ID or name
 */
export function getSemanticTag(query: string): SemanticTag | null {
  const normalized = query.toLowerCase().trim();

  // Direct ID match
  if (SEMANTIC_TAGS[normalized]) {
    return SEMANTIC_TAGS[normalized];
  }

  // Search by name or synonym
  const tag = Object.values(SEMANTIC_TAGS).find(
    (t) =>
      t.name.toLowerCase() === normalized ||
      t.synonyms?.some((s) => s.toLowerCase() === normalized)
  );

  return tag || null;
}

/**
 * Get all tags for a category
 */
export function getTagsByCategory(category: TagCategory): SemanticTag[] {
  return Object.values(SEMANTIC_TAGS).filter((tag) => tag.category === category);
}

/**
 * Find semantic tags matching a search query
 */
export function searchSemanticTags(query: string, limit = 10): SemanticTag[] {
  if (!query.trim()) return [];

  const normalized = query.toLowerCase().trim();
  const results: { tag: SemanticTag; score: number }[] = [];

  for (const tag of Object.values(SEMANTIC_TAGS)) {
    let score = 0;

    // Exact ID match (highest priority)
    if (tag.id === normalized) {
      score = 1000;
    }
    // Exact name match
    else if (tag.name.toLowerCase() === normalized) {
      score = 900;
    }
    // Starts with query
    else if (tag.name.toLowerCase().startsWith(normalized)) {
      score = 800 + (tag.popularity || 0);
    }
    // Synonym match
    else if (tag.synonyms?.some((s) => s.toLowerCase().includes(normalized))) {
      score = 700 + (tag.popularity || 0);
    }
    // Contains query
    else if (tag.name.toLowerCase().includes(normalized)) {
      score = 600 + (tag.popularity || 0);
    }
    // Description match
    else if (tag.description?.toLowerCase().includes(normalized)) {
      score = 500 + (tag.popularity || 0);
    }

    if (score > 0) {
      results.push({ tag, score });
    }
  }

  // Sort by score (descending) and return tags
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.tag);
}

/**
 * Normalize a plain text tag to its semantic equivalent
 * Returns the canonical tag ID if found, otherwise the original tag
 */
export function normalizeTag(plainTag: string): string {
  const semanticTag = getSemanticTag(plainTag);
  return semanticTag ? semanticTag.id : plainTag.toLowerCase().trim();
}

/**
 * Get related tags for suggestions
 */
export function getRelatedTags(tagId: string): SemanticTag[] {
  const tag = SEMANTIC_TAGS[tagId];
  if (!tag || !tag.relatedTags) return [];

  return tag.relatedTags
    .map((relatedId) => SEMANTIC_TAGS[relatedId])
    .filter((t): t is SemanticTag => !!t);
}

/**
 * Get popular tags sorted by popularity
 */
export function getPopularTags(limit = 20): SemanticTag[] {
  return Object.values(SEMANTIC_TAGS)
    .filter((tag) => (tag.popularity || 0) >= 70)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, limit);
}
