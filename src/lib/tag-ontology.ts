/**
 * Tag Ontology System for Recipe Manager
 * Categorizes recipe tags into a hierarchical structure
 */

export type TagCategory =
  | 'Cuisine'
  | 'Meal Type'
  | 'Dietary'
  | 'Cooking Method'
  | 'Main Ingredient'
  | 'Course'
  | 'Season'
  | 'Difficulty'
  | 'Time'
  | 'Other';

/**
 * Tag ontology mapping - defines which tags belong to which category
 */
export const TAG_ONTOLOGY: Record<TagCategory, string[]> = {
  'Cuisine': [
    'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'French',
    'Thai', 'Mediterranean', 'American', 'Greek', 'Korean', 'Vietnamese',
    'Spanish', 'Middle Eastern', 'Brazilian', 'Caribbean', 'German',
    'British', 'Irish', 'Ethiopian', 'Moroccan', 'Turkish'
  ],
  'Meal Type': [
    'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Appetizer',
    'Beverage', 'Brunch', 'Side', 'Main'
  ],
  'Dietary': [
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Low-Carb',
    'Keto', 'Paleo', 'Whole30', 'Sugar-Free', 'Nut-Free', 'Low-Fat',
    'High-Protein', 'Low-Sodium', 'Halal', 'Kosher'
  ],
  'Cooking Method': [
    'Baked', 'Grilled', 'Fried', 'Steamed', 'Roasted', 'Slow-Cooked',
    'Instant Pot', 'Air Fryer', 'Pressure Cooker', 'Sautéed', 'Broiled',
    'Poached', 'Braised', 'Stir-Fried', 'Smoked', 'No-Cook', 'Raw'
  ],
  'Main Ingredient': [
    'Chicken', 'Beef', 'Pork', 'Fish', 'Seafood', 'Vegetables', 'Pasta',
    'Rice', 'Beans', 'Eggs', 'Tofu', 'Lamb', 'Turkey', 'Quinoa', 'Lentils',
    'Potatoes', 'Mushrooms', 'Cheese', 'Bread', 'Noodles'
  ],
  'Course': [
    'Main Course', 'Side Dish', 'Salad', 'Soup', 'Sauce', 'Condiment',
    'Bread', 'Stew', 'Casserole', 'Sandwich', 'Wrap', 'Bowl', 'Pizza'
  ],
  'Season': [
    'Spring', 'Summer', 'Fall', 'Winter', 'Holiday', 'Thanksgiving',
    'Christmas', 'Easter', 'Halloween', 'New Year', 'Fourth of July',
    'Valentine\'s Day'
  ],
  'Difficulty': [
    'Easy', 'Medium', 'Hard', 'Beginner', 'Intermediate', 'Advanced', 'Quick'
  ],
  'Time': [
    'Quick', 'Medium', 'Long', 'Under 30 Minutes', '30-60 Minutes', 'Over 1 Hour',
    'Make-Ahead', 'Overnight'
  ],
  'Other': []
};

/**
 * Categorize a single tag into its appropriate category
 * Uses case-insensitive matching and partial matching for flexibility
 */
export function categorizeTag(tag: string): TagCategory {
  const normalizedTag = tag.toLowerCase().trim();

  for (const [category, tags] of Object.entries(TAG_ONTOLOGY)) {
    // Check for exact match (case-insensitive)
    if (tags.some(t => t.toLowerCase() === normalizedTag)) {
      return category as TagCategory;
    }

    // Check for partial match (tag contains category tag or vice versa)
    if (tags.some(t => {
      const normalizedCategoryTag = t.toLowerCase();
      return normalizedTag.includes(normalizedCategoryTag) ||
             normalizedCategoryTag.includes(normalizedTag);
    })) {
      return category as TagCategory;
    }
  }

  return 'Other';
}

/**
 * Categorize an array of tags into a structured object
 * Returns a record where keys are categories and values are arrays of tags
 */
export function categorizeTags(tags: string[]): Record<TagCategory, string[]> {
  const categorized: Record<TagCategory, string[]> = {
    'Cuisine': [],
    'Meal Type': [],
    'Dietary': [],
    'Cooking Method': [],
    'Main Ingredient': [],
    'Course': [],
    'Season': [],
    'Difficulty': [],
    'Time': [],
    'Other': []
  };

  for (const tag of tags) {
    const category = categorizeTag(tag);
    categorized[category].push(tag);
  }

  // Remove empty categories
  return Object.fromEntries(
    Object.entries(categorized).filter(([_, tags]) => tags.length > 0)
  ) as Record<TagCategory, string[]>;
}

/**
 * Get category color for UI display
 */
export function getCategoryColor(category: TagCategory): string {
  const colors: Record<TagCategory, string> = {
    'Cuisine': 'bg-blue-100 text-blue-800 border-blue-300',
    'Meal Type': 'bg-purple-100 text-purple-800 border-purple-300',
    'Dietary': 'bg-green-100 text-green-800 border-green-300',
    'Cooking Method': 'bg-orange-100 text-orange-800 border-orange-300',
    'Main Ingredient': 'bg-red-100 text-red-800 border-red-300',
    'Course': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Season': 'bg-pink-100 text-pink-800 border-pink-300',
    'Difficulty': 'bg-indigo-100 text-indigo-800 border-indigo-300',
    'Time': 'bg-teal-100 text-teal-800 border-teal-300',
    'Other': 'bg-gray-100 text-gray-800 border-gray-300'
  };

  return colors[category];
}

/**
 * Get category icon name for UI display
 */
export function getCategoryIcon(category: TagCategory): string {
  const icons: Record<TagCategory, string> = {
    'Cuisine': 'globe',
    'Meal Type': 'utensils',
    'Dietary': 'leaf',
    'Cooking Method': 'flame',
    'Main Ingredient': 'carrot',
    'Course': 'plate',
    'Season': 'calendar',
    'Difficulty': 'gauge',
    'Time': 'clock',
    'Other': 'tag'
  };

  return icons[category];
}
