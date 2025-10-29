import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

// Ontology mapping
const ONTOLOGY = {
  FRESH_PRODUCE: {
    vegetables_leafy: ['spinach', 'lettuce', 'kale', 'arugula', 'chard'],
    vegetables_root: ['carrot', 'potato', 'beet', 'turnip', 'radish'],
    vegetables_nightshade: ['tomato', 'pepper', 'eggplant'],
    vegetables_cruciferous: ['broccoli', 'cauliflower', 'cabbage', 'brussels sprout'],
    vegetables_allium: ['onion', 'garlic', 'shallot', 'leek', 'scallion', 'green onion'],
    vegetables_squash: ['zucchini', 'butternut squash', 'pumpkin'],
    vegetables_other: ['cucumber', 'celery', 'asparagus', 'green bean'],
    fruits_citrus: ['lemon', 'lime', 'orange', 'grapefruit'],
    fruits_berries: ['strawberry', 'blueberry', 'raspberry', 'blackberry'],
    fruits_stone: ['peach', 'plum', 'cherry', 'apricot'],
    fruits_tropical: ['banana', 'pineapple', 'mango', 'papaya'],
    fruits_melons: ['watermelon', 'cantaloupe', 'honeydew'],
    fruits_other: ['apple', 'pear', 'grape'],
    herbs_fresh: ['basil', 'cilantro', 'parsley', 'mint', 'dill', 'thyme', 'rosemary'],
  },
  PROTEINS: {
    meat_beef: ['beef', 'steak', 'ground beef', 'roast', 'short rib'],
    meat_pork: ['pork', 'bacon', 'ham', 'sausage'],
    meat_lamb: ['lamb'],
    meat_game: ['venison', 'bison', 'duck'],
    poultry_chicken: ['chicken'],
    poultry_turkey: ['turkey'],
    poultry_other: ['quail', 'cornish hen'],
    seafood_fish: ['salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'fish'],
    seafood_shellfish: ['shrimp', 'scallop', 'lobster', 'crab'],
    seafood_mollusks: ['clam', 'mussel', 'oyster', 'squid'],
    plant_legumes: ['chickpea', 'lentil', 'bean'],
    plant_soy: ['tofu', 'tempeh', 'edamame'],
    plant_other: ['seitan'],
  },
  DAIRY_EGGS: {
    milk_products: ['milk', 'cream', 'half and half', 'half & half'],
    cheese_soft: ['mozzarella', 'ricotta', 'cream cheese', 'feta', 'goat cheese'],
    cheese_hard: ['cheddar', 'parmesan', 'swiss', 'gruyere'],
    cheese_aged: ['blue cheese', 'gorgonzola'],
    cheese_fresh: ['fresh mozzarella', 'burrata', 'cottage cheese'],
    cultured_products: ['yogurt', 'greek yogurt', 'sour cream', 'kefir'],
    butter_fats: ['butter', 'ghee'],
    eggs: ['egg'],
  },
  PANTRY_STAPLES: {
    grains_rice: ['rice'],
    grains_wheat: ['flour', 'pasta'],
    grains_specialty: ['quinoa', 'farro', 'barley', 'couscous'],
    oils_cooking: ['vegetable oil', 'canola oil', 'peanut oil'],
    oils_finishing: ['olive oil', 'sesame oil'],
    fats_solid: ['lard', 'shortening', 'coconut oil'],
    sweeteners_sugar: ['sugar'],
    sweeteners_liquid: ['honey', 'maple syrup', 'agave', 'molasses'],
    condiments_vinegar: ['vinegar'],
    condiments_sauce: ['soy sauce', 'fish sauce', 'worcestershire', 'hot sauce'],
    condiments_paste: ['tomato paste'],
    spices_ground: ['cumin', 'paprika', 'cinnamon', 'ginger', 'turmeric'],
    spices_whole: ['peppercorn', 'star anise'],
    spices_salt: ['salt'],
    spices_pepper: ['pepper'],
  },
  BAKING_SPECIALTY: {
    leavening: ['baking powder', 'baking soda', 'yeast'],
    chocolate: ['cocoa', 'chocolate'],
    extracts: ['vanilla extract', 'almond extract'],
    nuts_tree: ['almond', 'walnut', 'pecan', 'cashew', 'hazelnut'],
    nuts_seeds: ['sunflower seed', 'pumpkin seed', 'chia seed'],
    nut_butters: ['peanut butter', 'almond butter'],
    dried_fruits: ['raisin', 'cranberry', 'date'],
    thickeners: ['corn starch', 'gelatin'],
  },
};

async function classifyIngredient(
  name: string,
  existing_category?: string
): Promise<{ type: string; subtype: string }> {
  const nameLower = name.toLowerCase();

  // Rule-based classification for common patterns
  for (const [type, subtypes] of Object.entries(ONTOLOGY)) {
    for (const [subtype, keywords] of Object.entries(subtypes)) {
      if (keywords.some((kw) => nameLower.includes(kw))) {
        return { type, subtype };
      }
    }
  }

  // If no match, categorize as OTHER with best guess subtype
  if (existing_category) {
    return {
      type: 'PANTRY_STAPLES',
      subtype: `${existing_category}_other`,
    };
  }

  return { type: 'PANTRY_STAPLES', subtype: 'other' };
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!);

  console.log('\n🔄 Classifying ingredients using ontology...\n');

  // Fetch all ingredients
  const ingredients = await client`
    SELECT id, name, display_name, category
    FROM ingredients
    ORDER BY usage_count DESC
  `;

  console.log(`Total ingredients to classify: ${ingredients.length}\n`);

  let classified = 0;
  const skipped = 0;

  for (const ing of ingredients) {
    const { type, subtype } = await classifyIngredient(ing.name, ing.category);

    await client`
      UPDATE ingredients
      SET type = ${type}, subtype = ${subtype}
      WHERE id = ${ing.id}
    `;

    classified++;

    if (classified % 100 === 0) {
      console.log(`✓ Classified ${classified}/${ingredients.length} ingredients...`);
    }
  }

  console.log(`\n✅ Classification complete!`);
  console.log(`   Classified: ${classified}`);
  console.log(`   Skipped: ${skipped}`);

  // Show distribution
  const distribution = await client`
    SELECT type, subtype, COUNT(*) as count
    FROM ingredients
    WHERE type IS NOT NULL
    GROUP BY type, subtype
    ORDER BY type, count DESC
  `;

  console.log('\n📊 Distribution by type:');
  let currentType = '';
  for (const row of distribution) {
    if (row.type !== currentType) {
      currentType = row.type;
      console.log(`\n${currentType}:`);
    }
    console.log(`  ${row.subtype}: ${row.count}`);
  }

  await client.end();
}

main().catch(console.error);
