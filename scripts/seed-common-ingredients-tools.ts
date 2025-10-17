/**
 * Seed Common Ingredients and Tools
 *
 * Pre-populate the database with commonly used ingredients and essential kitchen tools
 * to speed up recipe normalization and provide a foundation for meal planning.
 */

import 'dotenv/config';
import { db } from '../src/lib/db';
import { ingredients, tools, type NewIngredient, type NewTool } from '../src/lib/db/schema';

const commonIngredients: NewIngredient[] = [
  // Produce
  { name: 'yellow-onion', display_name: 'Yellow Onion', category: 'produce', subcategory: 'vegetables', standard_unit: 'whole', unit_type: 'count', is_common: true, storage_location: 'counter', shelf_life_days: 14 },
  { name: 'red-onion', display_name: 'Red Onion', category: 'produce', subcategory: 'vegetables', standard_unit: 'whole', unit_type: 'count', is_common: true, storage_location: 'refrigerator', shelf_life_days: 14 },
  { name: 'garlic', display_name: 'Garlic', category: 'produce', subcategory: 'vegetables', standard_unit: 'clove', unit_type: 'count', is_common: true, storage_location: 'counter', shelf_life_days: 30 },
  { name: 'tomato', display_name: 'Tomato', category: 'produce', subcategory: 'vegetables', standard_unit: 'whole', unit_type: 'count', storage_location: 'counter', shelf_life_days: 7 },
  { name: 'carrot', display_name: 'Carrot', category: 'produce', subcategory: 'vegetables', standard_unit: 'whole', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 21 },
  { name: 'celery', display_name: 'Celery', category: 'produce', subcategory: 'vegetables', standard_unit: 'stalk', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 14 },
  { name: 'bell-pepper', display_name: 'Bell Pepper', category: 'produce', subcategory: 'vegetables', standard_unit: 'whole', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 7 },
  { name: 'potato', display_name: 'Potato', category: 'produce', subcategory: 'vegetables', standard_unit: 'whole', unit_type: 'count', storage_location: 'pantry', shelf_life_days: 30 },
  { name: 'lemon', display_name: 'Lemon', category: 'produce', subcategory: 'citrus', standard_unit: 'whole', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 21 },
  { name: 'lime', display_name: 'Lime', category: 'produce', subcategory: 'citrus', standard_unit: 'whole', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 21 },

  // Herbs & Spices
  { name: 'basil', display_name: 'Fresh Basil', category: 'produce', subcategory: 'herbs', standard_unit: 'bunch', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 5 },
  { name: 'parsley', display_name: 'Fresh Parsley', category: 'produce', subcategory: 'herbs', standard_unit: 'bunch', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 7 },
  { name: 'cilantro', display_name: 'Fresh Cilantro', category: 'produce', subcategory: 'herbs', standard_unit: 'bunch', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 7 },
  { name: 'thyme', display_name: 'Fresh Thyme', category: 'produce', subcategory: 'herbs', standard_unit: 'bunch', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 10 },
  { name: 'rosemary', display_name: 'Fresh Rosemary', category: 'produce', subcategory: 'herbs', standard_unit: 'bunch', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 14 },

  // Spices (dried)
  { name: 'salt', display_name: 'Salt', category: 'spices', standard_unit: 'tsp', unit_type: 'volume', is_common: true, storage_location: 'pantry', shelf_life_days: 3650 },
  { name: 'black-pepper', display_name: 'Black Pepper', category: 'spices', standard_unit: 'tsp', unit_type: 'volume', is_common: true, storage_location: 'pantry', shelf_life_days: 1095 },
  { name: 'paprika', display_name: 'Paprika', category: 'spices', standard_unit: 'tsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'cumin', display_name: 'Ground Cumin', category: 'spices', standard_unit: 'tsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'oregano', display_name: 'Dried Oregano', category: 'spices', standard_unit: 'tsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },

  // Dairy
  { name: 'butter', display_name: 'Butter', category: 'dairy', standard_unit: 'tbsp', unit_type: 'volume', is_common: true, storage_location: 'refrigerator', shelf_life_days: 30 },
  { name: 'milk', display_name: 'Milk', category: 'dairy', standard_unit: 'cup', unit_type: 'volume', is_common: true, storage_location: 'refrigerator', shelf_life_days: 7 },
  { name: 'heavy-cream', display_name: 'Heavy Cream', category: 'dairy', standard_unit: 'cup', unit_type: 'volume', storage_location: 'refrigerator', shelf_life_days: 14 },
  { name: 'sour-cream', display_name: 'Sour Cream', category: 'dairy', standard_unit: 'cup', unit_type: 'volume', storage_location: 'refrigerator', shelf_life_days: 14 },
  { name: 'cheddar-cheese', display_name: 'Cheddar Cheese', category: 'dairy', standard_unit: 'oz', unit_type: 'weight', storage_location: 'refrigerator', shelf_life_days: 21 },
  { name: 'parmesan-cheese', display_name: 'Parmesan Cheese', category: 'dairy', standard_unit: 'oz', unit_type: 'weight', storage_location: 'refrigerator', shelf_life_days: 60 },
  { name: 'egg', display_name: 'Large Egg', category: 'dairy', standard_unit: 'whole', unit_type: 'count', is_common: true, storage_location: 'refrigerator', shelf_life_days: 28 },

  // Meat & Seafood
  { name: 'chicken-breast', display_name: 'Chicken Breast', category: 'meat', subcategory: 'chicken', standard_unit: 'lb', unit_type: 'weight', storage_location: 'refrigerator', shelf_life_days: 2 },
  { name: 'chicken-thigh', display_name: 'Chicken Thigh', category: 'meat', subcategory: 'chicken', standard_unit: 'lb', unit_type: 'weight', storage_location: 'refrigerator', shelf_life_days: 2 },
  { name: 'ground-beef', display_name: 'Ground Beef', category: 'meat', subcategory: 'beef', standard_unit: 'lb', unit_type: 'weight', storage_location: 'refrigerator', shelf_life_days: 2 },
  { name: 'bacon', display_name: 'Bacon', category: 'meat', subcategory: 'pork', standard_unit: 'slice', unit_type: 'count', storage_location: 'refrigerator', shelf_life_days: 7 },
  { name: 'salmon', display_name: 'Salmon Fillet', category: 'seafood', standard_unit: 'lb', unit_type: 'weight', storage_location: 'refrigerator', shelf_life_days: 2 },
  { name: 'shrimp', display_name: 'Shrimp', category: 'seafood', standard_unit: 'lb', unit_type: 'weight', storage_location: 'refrigerator', shelf_life_days: 2 },

  // Grains & Pasta
  { name: 'all-purpose-flour', display_name: 'All-Purpose Flour', category: 'baking', standard_unit: 'cup', unit_type: 'volume', is_common: true, grams_per_cup: '125', storage_location: 'pantry', shelf_life_days: 365 },
  { name: 'white-rice', display_name: 'White Rice', category: 'grains', standard_unit: 'cup', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'pasta', display_name: 'Pasta', category: 'grains', standard_unit: 'oz', unit_type: 'weight', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'bread', display_name: 'Bread', category: 'grains', standard_unit: 'slice', unit_type: 'count', storage_location: 'counter', shelf_life_days: 5 },

  // Baking
  { name: 'sugar', display_name: 'Granulated Sugar', category: 'baking', standard_unit: 'cup', unit_type: 'volume', is_common: true, grams_per_cup: '200', storage_location: 'pantry', shelf_life_days: 3650 },
  { name: 'brown-sugar', display_name: 'Brown Sugar', category: 'baking', standard_unit: 'cup', unit_type: 'volume', grams_per_cup: '220', storage_location: 'pantry', shelf_life_days: 365 },
  { name: 'baking-powder', display_name: 'Baking Powder', category: 'baking', standard_unit: 'tsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 365 },
  { name: 'baking-soda', display_name: 'Baking Soda', category: 'baking', standard_unit: 'tsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'vanilla-extract', display_name: 'Vanilla Extract', category: 'baking', standard_unit: 'tsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 1825 },

  // Oils & Condiments
  { name: 'olive-oil', display_name: 'Olive Oil', category: 'condiments', standard_unit: 'tbsp', unit_type: 'volume', is_common: true, storage_location: 'pantry', shelf_life_days: 365 },
  { name: 'vegetable-oil', display_name: 'Vegetable Oil', category: 'condiments', standard_unit: 'tbsp', unit_type: 'volume', is_common: true, storage_location: 'pantry', shelf_life_days: 365 },
  { name: 'soy-sauce', display_name: 'Soy Sauce', category: 'condiments', standard_unit: 'tbsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'worcestershire-sauce', display_name: 'Worcestershire Sauce', category: 'condiments', standard_unit: 'tbsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 1095 },
  { name: 'hot-sauce', display_name: 'Hot Sauce', category: 'condiments', standard_unit: 'tsp', unit_type: 'volume', storage_location: 'refrigerator', shelf_life_days: 365 },

  // Canned & Preserved
  { name: 'chicken-broth', display_name: 'Chicken Broth', category: 'canned', standard_unit: 'cup', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'beef-broth', display_name: 'Beef Broth', category: 'canned', standard_unit: 'cup', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'diced-tomatoes', display_name: 'Canned Diced Tomatoes', category: 'canned', standard_unit: 'can', unit_type: 'count', storage_location: 'pantry', shelf_life_days: 730 },
  { name: 'tomato-paste', display_name: 'Tomato Paste', category: 'canned', standard_unit: 'tbsp', unit_type: 'volume', storage_location: 'pantry', shelf_life_days: 730 },
];

const essentialTools: NewTool[] = [
  // Knives
  { name: 'chef-knife', display_name: "Chef's Knife (8-inch)", category: 'knives', is_essential: true, description: 'Primary cutting knife for chopping, slicing, dicing' },
  { name: 'paring-knife', display_name: 'Paring Knife', category: 'knives', is_essential: true, description: 'Small knife for detail work and peeling' },
  { name: 'bread-knife', display_name: 'Bread Knife (Serrated)', category: 'knives', is_essential: false, description: 'Serrated knife for slicing bread and tomatoes' },

  // Cutting & Prep
  { name: 'cutting-board', display_name: 'Cutting Board', category: 'prep', is_essential: true, description: 'Large cutting surface for food preparation' },
  { name: 'mixing-bowl-large', display_name: 'Large Mixing Bowl', category: 'prep', is_essential: true, description: 'Large bowl for mixing and combining ingredients' },
  { name: 'mixing-bowl-medium', display_name: 'Medium Mixing Bowl', category: 'prep', is_essential: true, description: 'Medium bowl for prep work' },
  { name: 'colander', display_name: 'Colander', category: 'prep', is_essential: true, description: 'For draining pasta, washing vegetables' },

  // Cookware
  { name: 'large-pot', display_name: 'Large Pot (6-8 quart)', category: 'cookware', is_essential: true, description: 'For boiling pasta, making soups and stocks' },
  { name: 'medium-pot', display_name: 'Medium Pot (3-4 quart)', category: 'cookware', is_essential: true, description: 'For sauces, rice, smaller batches' },
  { name: 'large-skillet', display_name: 'Large Skillet (12-inch)', category: 'cookware', is_essential: true, description: 'For sautéing, frying, searing' },
  { name: 'medium-skillet', display_name: 'Medium Skillet (10-inch)', category: 'cookware', is_essential: true, description: 'For smaller portions, eggs, single servings' },
  { name: 'cast-iron-skillet', display_name: 'Cast Iron Skillet', category: 'cookware', is_essential: false, description: 'For high-heat searing, oven-to-stovetop cooking' },
  { name: 'dutch-oven', display_name: 'Dutch Oven (5-7 quart)', category: 'cookware', is_essential: false, description: 'For braising, stews, bread baking' },
  { name: 'sauce-pan', display_name: 'Saucepan (2 quart)', category: 'cookware', is_essential: true, description: 'For sauces, heating liquids, small portions' },

  // Bakeware
  { name: 'baking-sheet', display_name: 'Baking Sheet (Half-Sheet)', category: 'bakeware', is_essential: true, description: 'For roasting vegetables, baking cookies' },
  { name: '9x13-pan', display_name: '9x13-inch Baking Pan', category: 'bakeware', is_essential: true, description: 'For casseroles, brownies, sheet cakes' },
  { name: '9-inch-round-pan', display_name: '9-inch Round Cake Pan', category: 'bakeware', is_essential: false, description: 'For layer cakes' },
  { name: 'muffin-tin', display_name: 'Muffin Tin (12-cup)', category: 'bakeware', is_essential: false, description: 'For muffins, cupcakes' },

  // Utensils
  { name: 'wooden-spoon', display_name: 'Wooden Spoon', category: 'utensils', is_essential: true, description: 'For stirring, mixing, non-reactive' },
  { name: 'silicone-spatula', display_name: 'Silicone Spatula', category: 'utensils', is_essential: true, description: 'For folding, scraping bowls, heat-resistant' },
  { name: 'metal-spatula', display_name: 'Metal Spatula', category: 'utensils', is_essential: true, description: 'For flipping, turning food' },
  { name: 'whisk', display_name: 'Whisk', category: 'utensils', is_essential: true, description: 'For beating eggs, mixing batters' },
  { name: 'tongs', display_name: 'Tongs', category: 'utensils', is_essential: true, description: 'For gripping, turning, serving' },
  { name: 'ladle', display_name: 'Ladle', category: 'utensils', is_essential: true, description: 'For serving soups, stews, sauces' },
  { name: 'slotted-spoon', display_name: 'Slotted Spoon', category: 'utensils', is_essential: true, description: 'For draining while scooping' },

  // Measuring
  { name: 'measuring-cups-dry', display_name: 'Dry Measuring Cups', category: 'measuring', is_essential: true, description: 'For measuring flour, sugar, dry ingredients' },
  { name: 'measuring-cups-liquid', display_name: 'Liquid Measuring Cup', category: 'measuring', is_essential: true, description: 'For measuring water, milk, liquids' },
  { name: 'measuring-spoons', display_name: 'Measuring Spoons', category: 'measuring', is_essential: true, description: 'For measuring small amounts' },

  // Appliances
  { name: 'stand-mixer', display_name: 'Stand Mixer', category: 'appliances', is_essential: false, is_specialized: true, description: 'For mixing dough, beating cream, heavy mixing' },
  { name: 'hand-mixer', display_name: 'Hand Mixer', category: 'appliances', is_essential: false, description: 'For whipping, beating, lighter mixing tasks' },
  { name: 'food-processor', display_name: 'Food Processor', category: 'appliances', is_essential: false, is_specialized: true, description: 'For chopping, shredding, pureeing' },
  { name: 'blender', display_name: 'Blender', category: 'appliances', is_essential: false, description: 'For smoothies, soups, pureeing' },
];

async function main() {
  console.log('🌾 Seeding Common Ingredients and Tools');
  console.log('========================================\n');

  console.log('Seeding ingredients...');
  let ingredientCount = 0;
  for (const ingredient of commonIngredients) {
    try {
      await db.insert(ingredients).values(ingredient).onConflictDoNothing();
      ingredientCount++;
      console.log(`  ✓ ${ingredient.display_name}`);
    } catch (error) {
      console.log(`  ⚠ Skipped ${ingredient.display_name} (already exists)`);
    }
  }
  console.log(`\n✅ Seeded ${ingredientCount} ingredients\n`);

  console.log('Seeding tools...');
  let toolCount = 0;
  for (const tool of essentialTools) {
    try {
      await db.insert(tools).values(tool).onConflictDoNothing();
      toolCount++;
      console.log(`  ✓ ${tool.display_name}`);
    } catch (error) {
      console.log(`  ⚠ Skipped ${tool.display_name} (already exists)`);
    }
  }
  console.log(`\n✅ Seeded ${toolCount} tools\n`);

  console.log('🎉 Seeding complete!');
  console.log(`Total: ${ingredientCount} ingredients, ${toolCount} tools`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
