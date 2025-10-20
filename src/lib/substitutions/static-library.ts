/**
 * Static Ingredient Substitution Library
 *
 * Comprehensive library of vetted ingredient substitutions for top 50 ingredients
 * Organized by category: fats, dairy, acids, proteins, aromatics, herbs & spices
 */

import type { StaticSubstitutionEntry } from './types';

/**
 * FATS & OILS
 */
const BUTTER: StaticSubstitutionEntry = {
  ingredient: 'butter',
  aliases: ['unsalted butter', 'salted butter', 'stick butter'],
  category: 'fat',
  substitutions: [
    {
      substitute_ingredient: 'coconut oil',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Similar fat content and melting point. Works excellently in baking for moisture and richness.',
      best_for: ['baking', 'cookies', 'cakes', 'sautéing'],
      avoid_for: ['frosting', 'buttercream'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Use refined coconut oil to avoid coconut flavor. Solid at room temp like butter.',
    },
    {
      substitute_ingredient: 'olive oil',
      ratio: '3/4 cup oil = 1 cup butter',
      substitute_amount: '3/4 cup per 1 cup butter',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Healthier fat profile with heart-healthy monounsaturated fats. Best for savory dishes.',
      best_for: ['sautéing', 'roasting', 'savory baking'],
      avoid_for: ['sweet baking', 'frosting', 'pie crusts'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'Reduce amount by 25%. May make baked goods denser.',
    },
    {
      substitute_ingredient: 'applesauce',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Low-fat alternative that adds moisture. Reduces calories significantly.',
      best_for: ['muffins', 'quick breads', 'brownies', 'cake'],
      avoid_for: ['cookies', 'pie crust', 'sautéing', 'frosting'],
      flavor_impact: 'minimal',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Baked goods will be denser and more cake-like. Reduce sugar slightly as applesauce adds sweetness.',
    },
    {
      substitute_ingredient: 'ghee',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.95,
      reason: 'Clarified butter with milk solids removed. Lactose-free with higher smoke point.',
      best_for: ['sautéing', 'high-heat cooking', 'baking'],
      avoid_for: [],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Higher smoke point (485°F vs 350°F) makes it better for high-heat cooking.',
    },
    {
      substitute_ingredient: 'greek yogurt',
      ratio: '1/2 cup yogurt = 1 cup butter',
      substitute_amount: '1/2 cup per 1 cup butter',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Lower fat, higher protein alternative. Adds tanginess and moisture.',
      best_for: ['muffins', 'quick breads', 'pancakes'],
      avoid_for: ['cookies', 'pie crust', 'sautéing'],
      flavor_impact: 'noticeable',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Reduce amount by 50%. Baked goods will be denser with slight tang.',
    },
  ],
};

const OLIVE_OIL: StaticSubstitutionEntry = {
  ingredient: 'olive oil',
  aliases: ['extra virgin olive oil', 'evoo', 'light olive oil'],
  category: 'fat',
  substitutions: [
    {
      substitute_ingredient: 'avocado oil',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Similar healthy fat profile with neutral flavor and very high smoke point (520°F).',
      best_for: ['high-heat cooking', 'grilling', 'roasting', 'baking'],
      avoid_for: [],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Better for high-heat cooking than olive oil.',
    },
    {
      substitute_ingredient: 'canola oil',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Neutral flavor and high smoke point. More affordable option.',
      best_for: ['baking', 'frying', 'sautéing'],
      avoid_for: ['salad dressings', 'dips'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Use when olive oil flavor is not desired.',
    },
    {
      substitute_ingredient: 'grapeseed oil',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Light, neutral oil with high smoke point (420°F). Good for cooking and baking.',
      best_for: ['sautéing', 'baking', 'salad dressings'],
      avoid_for: [],
      flavor_impact: 'minimal',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'butter (melted)',
      ratio: '1 cup oil = 1 cup + 2 tbsp butter',
      substitute_amount: '1 cup + 2 tbsp melted butter per 1 cup oil',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Adds richness and flavor. Use for baking when butter flavor is desired.',
      best_for: ['baking', 'sautéing'],
      avoid_for: ['high-heat cooking', 'dairy-free diets'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'Increase amount slightly (112g butter = 100g oil). Lower smoke point.',
    },
  ],
};

const VEGETABLE_OIL: StaticSubstitutionEntry = {
  ingredient: 'vegetable oil',
  aliases: ['cooking oil'],
  category: 'fat',
  substitutions: [
    {
      substitute_ingredient: 'canola oil',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.95,
      reason: 'Virtually identical in use. Neutral flavor and similar smoke point.',
      best_for: ['baking', 'frying', 'sautéing'],
      avoid_for: [],
      flavor_impact: 'none',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'grapeseed oil',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Light, neutral flavor with high smoke point. Excellent all-purpose oil.',
      best_for: ['baking', 'frying', 'sautéing', 'salad dressing'],
      avoid_for: [],
      flavor_impact: 'none',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'sunflower oil',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Neutral taste, high smoke point (440°F). Good for all cooking methods.',
      best_for: ['baking', 'frying', 'sautéing'],
      avoid_for: [],
      flavor_impact: 'none',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'melted coconut oil',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.8,
      reason: 'Works well but may add slight coconut flavor. Use refined for neutral taste.',
      best_for: ['baking', 'sautéing'],
      avoid_for: ['high-heat frying'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Use refined coconut oil to avoid coconut taste.',
    },
  ],
};

const COCONUT_OIL: StaticSubstitutionEntry = {
  ingredient: 'coconut oil',
  aliases: ['virgin coconut oil', 'refined coconut oil'],
  category: 'fat',
  substitutions: [
    {
      substitute_ingredient: 'butter',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Similar solid-at-room-temp properties. Works excellently in baking.',
      best_for: ['baking', 'cookies', 'pie crusts'],
      avoid_for: ['vegan recipes', 'dairy-free diets'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'vegetable oil',
      ratio: '1:1 (melted coconut oil)',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'When coconut oil is melted, can substitute with any neutral oil.',
      best_for: ['baking', 'sautéing'],
      avoid_for: ['recipes requiring solid fat'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'If recipe calls for solid coconut oil, use cold butter instead.',
    },
    {
      substitute_ingredient: 'ghee',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Similar melting point and fat content. Lactose-free like coconut oil.',
      best_for: ['sautéing', 'baking', 'high-heat cooking'],
      avoid_for: ['vegan recipes'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
    },
  ],
};

/**
 * DAIRY PRODUCTS
 */
const MILK: StaticSubstitutionEntry = {
  ingredient: 'milk',
  aliases: ['whole milk', 'dairy milk', "cow's milk", '2% milk', 'skim milk'],
  category: 'dairy',
  substitutions: [
    {
      substitute_ingredient: 'almond milk',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Most popular dairy-free alternative. Neutral flavor works in most recipes.',
      best_for: ['baking', 'smoothies', 'cereal', 'coffee'],
      avoid_for: ['custards', 'puddings'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'Use unsweetened for savory dishes. May be thinner than dairy milk.',
    },
    {
      substitute_ingredient: 'oat milk',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Creamy texture closest to dairy milk. Naturally sweet.',
      best_for: ['baking', 'coffee', 'hot chocolate', 'cream sauces'],
      avoid_for: [],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Slightly sweeter than dairy milk. Great for barista-style drinks.',
    },
    {
      substitute_ingredient: 'soy milk',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'High protein content similar to dairy milk. Versatile for cooking and baking.',
      best_for: ['baking', 'cooking', 'smoothies'],
      avoid_for: ['soy allergies'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Choose unsweetened for savory recipes.',
    },
    {
      substitute_ingredient: 'coconut milk (from carton)',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Dairy-free with slight coconut flavor. Different from canned coconut milk.',
      best_for: ['smoothies', 'curries', 'baking'],
      avoid_for: ['recipes where coconut flavor is undesirable'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'Use unsweetened. Not the same as canned coconut milk.',
    },
  ],
};

const HEAVY_CREAM: StaticSubstitutionEntry = {
  ingredient: 'heavy cream',
  aliases: ['heavy whipping cream', 'whipping cream', 'double cream'],
  category: 'dairy',
  substitutions: [
    {
      substitute_ingredient: 'half-and-half + butter',
      ratio: '1 cup = 7/8 cup half-and-half + 1/8 cup melted butter',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Mimics the fat content of heavy cream. Works for most applications.',
      best_for: ['soups', 'sauces', 'baking'],
      avoid_for: ['whipped cream'],
      flavor_impact: 'none',
      texture_impact: 'minimal',
      cooking_adjustment: "Won't whip as stiff as heavy cream.",
    },
    {
      substitute_ingredient: 'coconut cream',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Dairy-free, high-fat alternative. Can even be whipped.',
      best_for: ['whipped cream', 'curries', 'soups', 'desserts'],
      avoid_for: ['recipes where coconut flavor is undesirable'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
      cooking_adjustment: 'Chill can overnight, use thick cream from top. Has coconut flavor.',
    },
    {
      substitute_ingredient: 'evaporated milk',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Thicker than regular milk, lower fat than heavy cream. Good for cooking.',
      best_for: ['soups', 'sauces', 'coffee'],
      avoid_for: ['whipped cream', 'frostings'],
      flavor_impact: 'minimal',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Less rich and cannot be whipped.',
    },
    {
      substitute_ingredient: 'greek yogurt + milk',
      ratio: '1 cup = 1/2 cup yogurt + 1/2 cup milk',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Lower fat alternative that adds tanginess. Increases protein.',
      best_for: ['soups', 'sauces', 'baking'],
      avoid_for: ['whipped cream', 'high-heat cooking'],
      flavor_impact: 'noticeable',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Add at end of cooking to prevent curdling. Adds tang.',
    },
  ],
};

const SOUR_CREAM: StaticSubstitutionEntry = {
  ingredient: 'sour cream',
  aliases: ['soured cream'],
  category: 'dairy',
  substitutions: [
    {
      substitute_ingredient: 'greek yogurt',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.95,
      reason: 'Nearly identical in tang and texture. Higher protein, lower fat.',
      best_for: ['dips', 'toppings', 'baking', 'sauces'],
      avoid_for: [],
      flavor_impact: 'none',
      texture_impact: 'none',
      cooking_adjustment: 'Full-fat Greek yogurt is closest. Add at end for hot dishes.',
    },
    {
      substitute_ingredient: 'plain yogurt',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Similar tang and acidity. Slightly thinner than sour cream.',
      best_for: ['marinades', 'dressings', 'baking'],
      avoid_for: ['thick toppings'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'May be thinner. Full-fat yogurt works best.',
    },
    {
      substitute_ingredient: 'cottage cheese (blended)',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'High protein alternative. Blend until smooth for similar texture.',
      best_for: ['dips', 'baking'],
      avoid_for: ['toppings without blending'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'Must blend smooth. Add lemon juice for tang.',
    },
  ],
};

const EGGS: StaticSubstitutionEntry = {
  ingredient: 'eggs',
  aliases: ['whole eggs', 'large eggs'],
  category: 'protein',
  substitutions: [
    {
      substitute_ingredient: 'flax eggs',
      ratio: '1 egg = 1 tbsp ground flaxseed + 3 tbsp water',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Vegan egg replacer that binds well. Adds fiber and omega-3s.',
      best_for: ['muffins', 'pancakes', 'quick breads', 'cookies'],
      avoid_for: ['cakes', 'meringues', 'custards', 'soufflés'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'Mix and let sit 5 minutes to gel. Adds slight nuttiness.',
    },
    {
      substitute_ingredient: 'applesauce',
      ratio: '1 egg = 1/4 cup applesauce',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Adds moisture and binding. Reduces fat and calories.',
      best_for: ['muffins', 'cakes', 'brownies'],
      avoid_for: ['cookies', 'meringues', 'scrambles'],
      flavor_impact: 'minimal',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Makes baked goods denser and more moist. Reduce sugar slightly.',
    },
    {
      substitute_ingredient: 'mashed banana',
      ratio: '1 egg = 1/4 cup mashed banana',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Natural binder and adds moisture. Adds banana flavor.',
      best_for: ['pancakes', 'muffins', 'quick breads'],
      avoid_for: ['cookies', 'savory dishes', 'custards'],
      flavor_impact: 'noticeable',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Adds banana flavor and sweetness. Dense texture.',
    },
  ],
};

/**
 * ACIDS & FLAVOR ENHANCERS
 */
const LEMON_JUICE: StaticSubstitutionEntry = {
  ingredient: 'lemon juice',
  aliases: ['fresh lemon juice', 'lemon'],
  category: 'acid',
  substitutions: [
    {
      substitute_ingredient: 'lime juice',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.95,
      reason: 'Similar acidity level (pH ~2). Slightly more bitter, equally bright.',
      best_for: ['dressings', 'marinades', 'beverages', 'sauces'],
      avoid_for: ['lemon-flavored desserts'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'white wine vinegar',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.8,
      reason: 'Similar acidity. Less citrus flavor but provides needed acid.',
      best_for: ['salad dressings', 'sauces', 'marinades'],
      avoid_for: ['desserts', 'beverages'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'apple cider vinegar',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Provides acidity with fruity undertone. More assertive flavor.',
      best_for: ['marinades', 'dressings', 'baking'],
      avoid_for: ['delicate dishes', 'beverages'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
      cooking_adjustment: 'Stronger flavor. May want to use slightly less.',
    },
  ],
};

const VINEGAR_WHITE: StaticSubstitutionEntry = {
  ingredient: 'white vinegar',
  aliases: ['distilled white vinegar', 'white wine vinegar'],
  category: 'acid',
  substitutions: [
    {
      substitute_ingredient: 'apple cider vinegar',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Similar acidity level. Slightly sweeter with apple notes.',
      best_for: ['pickling', 'baking', 'marinades', 'dressings'],
      avoid_for: ['recipes requiring neutral flavor'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'lemon juice',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Provides necessary acidity with citrus brightness.',
      best_for: ['baking', 'dressings', 'marinades'],
      avoid_for: ['pickling'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'rice vinegar',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Milder and slightly sweeter. Less acidic than white vinegar.',
      best_for: ['Asian dishes', 'dressings', 'sushi rice'],
      avoid_for: ['baking', 'pickling'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Less acidic, may need to increase amount slightly.',
    },
  ],
};

/**
 * PROTEINS
 */
const CHICKEN_BREAST: StaticSubstitutionEntry = {
  ingredient: 'chicken breast',
  aliases: ['chicken breasts', 'boneless chicken breast', 'skinless chicken breast'],
  category: 'protein',
  substitutions: [
    {
      substitute_ingredient: 'chicken thighs',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'More flavorful and harder to dry out due to higher fat content.',
      best_for: ['grilling', 'roasting', 'braising', 'stir-frying'],
      avoid_for: ['recipes requiring white meat'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'Slightly longer cooking time. More forgiving than breast.',
    },
    {
      substitute_ingredient: 'turkey breast',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Similar lean white meat with mild flavor. Slightly drier.',
      best_for: ['grilling', 'roasting', 'sandwiches'],
      avoid_for: [],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'Very similar cooking time. Can be dry if overcooked.',
    },
    {
      substitute_ingredient: 'pork tenderloin',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Lean, mild meat with similar texture. Slightly sweeter flavor.',
      best_for: ['roasting', 'grilling', 'stir-frying'],
      avoid_for: ['recipes where chicken flavor is important'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
    },
  ],
};

const GROUND_BEEF: StaticSubstitutionEntry = {
  ingredient: 'ground beef',
  aliases: ['ground chuck', 'hamburger', 'minced beef'],
  category: 'protein',
  substitutions: [
    {
      substitute_ingredient: 'ground turkey',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Leaner alternative with less fat. Healthier option.',
      best_for: ['tacos', 'meatballs', 'pasta sauce', 'burgers'],
      avoid_for: [],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'Add oil or butter for moisture. Cooks faster due to less fat.',
    },
    {
      substitute_ingredient: 'ground pork',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Similar fat content and texture. Slightly sweeter flavor.',
      best_for: ['meatballs', 'dumplings', 'pasta sauce'],
      avoid_for: ['traditional beef dishes like burgers'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'lentils (cooked)',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Plant-based, high-protein alternative. Significantly different texture.',
      best_for: ['tacos', 'pasta sauce', 'chili'],
      avoid_for: ['burgers', 'meatballs'],
      flavor_impact: 'significant',
      texture_impact: 'significant',
      cooking_adjustment: 'Season well to mimic meat flavor. Add cumin, paprika, soy sauce.',
    },
  ],
};

/**
 * AROMATICS
 */
const GARLIC: StaticSubstitutionEntry = {
  ingredient: 'garlic',
  aliases: ['fresh garlic', 'garlic cloves', 'garlic clove'],
  category: 'aromatic',
  substitutions: [
    {
      substitute_ingredient: 'garlic powder',
      ratio: '1 clove = 1/8 tsp powder',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Concentrated garlic flavor. More intense than fresh.',
      best_for: ['dry rubs', 'seasoning blends', 'baking'],
      avoid_for: ['raw applications', 'sautéing'],
      flavor_impact: 'minimal',
      texture_impact: 'significant',
      cooking_adjustment: 'Much more concentrated. Use sparingly.',
    },
    {
      substitute_ingredient: 'shallots',
      ratio: '1 clove garlic = 1 small shallot',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Milder, sweeter flavor with onion-garlic combination.',
      best_for: ['sauces', 'vinaigrettes', 'sautéing'],
      avoid_for: ['heavily garlic-flavored dishes'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
    },
    {
      substitute_ingredient: 'garlic scapes',
      ratio: '1 scape = 1 clove',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Milder, grassier garlic flavor. Seasonal availability.',
      best_for: ['pesto', 'stir-fries', 'sautéing'],
      avoid_for: ['strong garlic flavor needed'],
      flavor_impact: 'noticeable',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Seasonal. Chop finely as they are fibrous.',
    },
  ],
};

const ONION: StaticSubstitutionEntry = {
  ingredient: 'onion',
  aliases: ['yellow onion', 'white onion', 'brown onion'],
  category: 'aromatic',
  substitutions: [
    {
      substitute_ingredient: 'shallots',
      ratio: '1 medium onion = 3-4 shallots',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Milder, sweeter flavor. More delicate than onions.',
      best_for: ['vinaigrettes', 'sauces', 'sautéing', 'roasting'],
      avoid_for: ['caramelized onions', 'onion rings'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
    },
    {
      substitute_ingredient: 'leeks (white part)',
      ratio: '1 onion = 1 cup chopped leeks',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Milder, slightly sweet flavor. More delicate.',
      best_for: ['soups', 'quiche', 'sautéing'],
      avoid_for: ['raw applications', 'strong onion flavor needed'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'Clean thoroughly between layers. Milder flavor.',
    },
    {
      substitute_ingredient: 'onion powder',
      ratio: '1 medium onion = 1 tbsp onion powder',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'Concentrated onion flavor without texture.',
      best_for: ['soups', 'sauces', 'dry rubs'],
      avoid_for: ['sautéing', 'caramelizing', 'texture important'],
      flavor_impact: 'minimal',
      texture_impact: 'significant',
      cooking_adjustment: 'No texture. Add early in cooking.',
    },
  ],
};

const GINGER: StaticSubstitutionEntry = {
  ingredient: 'ginger',
  aliases: ['fresh ginger', 'ginger root', 'gingerroot'],
  category: 'aromatic',
  substitutions: [
    {
      substitute_ingredient: 'ground ginger',
      ratio: '1 tbsp fresh = 1/4 tsp ground',
      confidence: 'high',
      confidence_score: 0.8,
      reason: 'More concentrated and spicier than fresh. Different flavor profile.',
      best_for: ['baking', 'spice rubs', 'soups'],
      avoid_for: ['stir-fries', 'fresh ginger tea'],
      flavor_impact: 'noticeable',
      texture_impact: 'significant',
      cooking_adjustment: 'Much more concentrated. Start with less.',
    },
    {
      substitute_ingredient: 'galangal',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Related root with citrusy, piney notes. Common in Thai cuisine.',
      best_for: ['Thai curries', 'soups', 'stir-fries'],
      avoid_for: ['Chinese dishes', 'baking'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'More citrusy and pine-like. Firmer texture.',
    },
    {
      substitute_ingredient: 'lemongrass',
      ratio: '1 tbsp ginger = 2 stalks lemongrass',
      confidence: 'low',
      confidence_score: 0.5,
      reason: 'Different flavor (citrusy) but provides aromatic freshness.',
      best_for: ['Southeast Asian dishes', 'soups', 'curries'],
      avoid_for: ['recipes where ginger flavor is essential'],
      flavor_impact: 'significant',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Very different flavor. Only use in dishes that work with citrus notes.',
    },
  ],
};

/**
 * HERBS & SPICES
 */
const BASIL: StaticSubstitutionEntry = {
  ingredient: 'basil',
  aliases: ['fresh basil', 'sweet basil'],
  category: 'herb',
  substitutions: [
    {
      substitute_ingredient: 'oregano',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Italian herb with more assertive, earthy flavor.',
      best_for: ['pasta sauces', 'pizza', 'Italian dishes'],
      avoid_for: ['Thai basil dishes', 'pesto', 'fresh applications'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
      cooking_adjustment: 'More robust flavor. Oregano is stronger.',
    },
    {
      substitute_ingredient: 'spinach + mint',
      ratio: '1 cup basil = 1/2 cup spinach + 1/2 cup mint',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'For pesto when basil unavailable. Mint adds aromatic component.',
      best_for: ['pesto'],
      avoid_for: ['cooking', 'marinades'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'Works primarily for pesto. Adjust mint to taste.',
    },
    {
      substitute_ingredient: 'dried basil',
      ratio: '1 tbsp fresh = 1 tsp dried',
      confidence: 'high',
      confidence_score: 0.75,
      reason: 'More concentrated when dried. Different texture.',
      best_for: ['sauces', 'soups', 'cooked dishes'],
      avoid_for: ['fresh applications', 'garnish', 'caprese'],
      flavor_impact: 'minimal',
      texture_impact: 'significant',
      cooking_adjustment: 'Add earlier in cooking. 3:1 ratio fresh to dried.',
    },
  ],
};

const OREGANO: StaticSubstitutionEntry = {
  ingredient: 'oregano',
  aliases: ['fresh oregano', 'dried oregano'],
  category: 'herb',
  substitutions: [
    {
      substitute_ingredient: 'marjoram',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Similar flavor but milder and sweeter. From same plant family.',
      best_for: ['Italian dishes', 'Greek dishes', 'roasted meats'],
      avoid_for: ['heavily oregano-flavored dishes'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'thyme',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Earthy, woodsy flavor. Different profile but works in Mediterranean dishes.',
      best_for: ['roasted vegetables', 'meats', 'soups'],
      avoid_for: ['pizza', 'pasta sauces'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'basil + thyme',
      ratio: '1 tsp oregano = 1/2 tsp basil + 1/2 tsp thyme',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'Combination mimics oregano complexity.',
      best_for: ['Italian dishes', 'tomato sauces'],
      avoid_for: ['simple dishes'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
    },
  ],
};

const CILANTRO: StaticSubstitutionEntry = {
  ingredient: 'cilantro',
  aliases: ['fresh cilantro', 'coriander leaves', 'chinese parsley'],
  category: 'herb',
  substitutions: [
    {
      substitute_ingredient: 'parsley',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'Similar fresh, green flavor without cilantro soapy notes.',
      best_for: ['garnish', 'sauces', 'salads'],
      avoid_for: ['Mexican', 'Thai dishes where cilantro is prominent'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
      cooking_adjustment: 'Lacks distinctive cilantro flavor. Good for cilantro-haters.',
    },
    {
      substitute_ingredient: 'culantro',
      ratio: '1/4 culantro = 1 cilantro',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Related plant with similar but much stronger flavor.',
      best_for: ['Latin American', 'Caribbean dishes'],
      avoid_for: ['delicate dishes'],
      flavor_impact: 'minimal',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Much stronger. Use 1/4 the amount.',
    },
    {
      substitute_ingredient: 'basil + lime zest',
      ratio: '1 cup cilantro = 1 cup basil + 1 tsp lime zest',
      confidence: 'low',
      confidence_score: 0.5,
      reason: 'Provides freshness and citrus notes cilantro brings.',
      best_for: ['salads', 'fresh applications'],
      avoid_for: ['authentic Mexican/Thai dishes'],
      flavor_impact: 'significant',
      texture_impact: 'minimal',
      cooking_adjustment: 'Different flavor profile but adds brightness.',
    },
  ],
};

const PARSLEY: StaticSubstitutionEntry = {
  ingredient: 'parsley',
  aliases: ['fresh parsley', 'flat-leaf parsley', 'italian parsley', 'curly parsley'],
  category: 'herb',
  substitutions: [
    {
      substitute_ingredient: 'cilantro',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Fresh, green flavor. Different taste profile.',
      best_for: ['garnish', 'fresh sauces', 'salads'],
      avoid_for: ['Italian dishes', 'those who dislike cilantro'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'chervil',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.8,
      reason: 'Delicate, slightly anise flavor. Similar appearance.',
      best_for: ['French dishes', 'sauces', 'garnish'],
      avoid_for: [],
      flavor_impact: 'minimal',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'celery leaves',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'Similar fresh, slightly bitter flavor. Often discarded but usable.',
      best_for: ['stocks', 'soups', 'garnish'],
      avoid_for: ['raw applications', 'delicate dishes'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'More celery flavor. Stronger taste than parsley.',
    },
  ],
};

const CUMIN: StaticSubstitutionEntry = {
  ingredient: 'cumin',
  aliases: ['ground cumin', 'cumin seeds', 'cumin powder'],
  category: 'spice',
  substitutions: [
    {
      substitute_ingredient: 'caraway seeds',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Similar earthy, warm flavor. Slightly more licorice notes.',
      best_for: ['bread', 'cabbage dishes', 'European recipes'],
      avoid_for: ['Mexican', 'Indian dishes'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'ground coriander',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'Citrusy, warm flavor. Often paired with cumin.',
      best_for: ['curry', 'Indian dishes', 'marinades'],
      avoid_for: ['chili', 'taco seasoning'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
      cooking_adjustment: 'Sweeter, more citrus. Lacks cumin earthiness.',
    },
    {
      substitute_ingredient: 'chili powder',
      ratio: '1/2 chili powder + 1/2 paprika',
      confidence: 'low',
      confidence_score: 0.5,
      reason: 'Chili powder often contains cumin. Adds heat.',
      best_for: ['Mexican dishes', 'chili'],
      avoid_for: ['Indian dishes', 'recipes needing pure cumin'],
      flavor_impact: 'significant',
      texture_impact: 'none',
      cooking_adjustment: 'Adds heat and other spices. Not a clean substitute.',
    },
  ],
};

const PAPRIKA: StaticSubstitutionEntry = {
  ingredient: 'paprika',
  aliases: ['sweet paprika', 'smoked paprika', 'hungarian paprika'],
  category: 'spice',
  substitutions: [
    {
      substitute_ingredient: 'cayenne pepper',
      ratio: '1 tsp paprika = 1/4 tsp cayenne',
      confidence: 'medium',
      confidence_score: 0.6,
      reason: 'Provides red color and heat. Much spicier than paprika.',
      best_for: ['dishes needing heat', 'color'],
      avoid_for: ['mild dishes', 'sweet paprika flavor'],
      flavor_impact: 'significant',
      texture_impact: 'none',
      cooking_adjustment: 'Much spicier. Use 1/4 amount. Add gradually.',
    },
    {
      substitute_ingredient: 'chili powder',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'Contains paprika plus other spices. More complex.',
      best_for: ['Mexican dishes', 'chili'],
      avoid_for: ['Hungarian dishes', 'pure paprika flavor'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
      cooking_adjustment: 'Contains cumin and other spices.',
    },
    {
      substitute_ingredient: 'tomato powder',
      ratio: '1:1',
      confidence: 'low',
      confidence_score: 0.5,
      reason: 'Provides red color and umami. Different flavor.',
      best_for: ['color', 'savory dishes'],
      avoid_for: ['smoky flavor needed', 'sweet paprika'],
      flavor_impact: 'significant',
      texture_impact: 'minimal',
      cooking_adjustment: 'More savory, less sweet. Different flavor profile.',
    },
  ],
};

const CINNAMON: StaticSubstitutionEntry = {
  ingredient: 'cinnamon',
  aliases: ['ground cinnamon', 'cinnamon powder', 'cinnamon sticks'],
  category: 'spice',
  substitutions: [
    {
      substitute_ingredient: 'nutmeg',
      ratio: '1 tsp cinnamon = 1/2 tsp nutmeg',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'Warm spice with sweet, nutty flavor. More pungent than cinnamon.',
      best_for: ['baking', 'pumpkin spice', 'eggnog'],
      avoid_for: ['cinnamon rolls', 'snickerdoodles'],
      flavor_impact: 'noticeable',
      texture_impact: 'none',
      cooking_adjustment: 'Use half the amount. Nutmeg is stronger.',
    },
    {
      substitute_ingredient: 'allspice',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Combination flavor of cinnamon, nutmeg, cloves.',
      best_for: ['baking', 'savory dishes', 'Caribbean cuisine'],
      avoid_for: ['pure cinnamon flavor needed'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'More complex flavor with clove notes.',
    },
    {
      substitute_ingredient: 'cardamom',
      ratio: '1 tsp cinnamon = 1/2 tsp cardamom',
      confidence: 'low',
      confidence_score: 0.5,
      reason: 'Warm, sweet, citrusy spice. Different flavor profile.',
      best_for: ['Indian dishes', 'Scandinavian baking', 'chai'],
      avoid_for: ['American baking', 'cinnamon flavor essential'],
      flavor_impact: 'significant',
      texture_impact: 'none',
      cooking_adjustment: 'Very different flavor. More floral and citrusy.',
    },
  ],
};

/**
 * SWEETENERS
 */
const SUGAR: StaticSubstitutionEntry = {
  ingredient: 'sugar',
  aliases: ['white sugar', 'granulated sugar', 'cane sugar'],
  category: 'sweetener',
  substitutions: [
    {
      substitute_ingredient: 'honey',
      ratio: '1 cup sugar = 3/4 cup honey',
      confidence: 'high',
      confidence_score: 0.8,
      reason: 'Natural sweetener, more intense sweetness. Adds moisture.',
      best_for: ['baking', 'glazes', 'marinades'],
      avoid_for: ['meringues', 'hard candies'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'Reduce liquid by 1/4 cup per cup honey. Reduce oven temp by 25°F.',
    },
    {
      substitute_ingredient: 'maple syrup',
      ratio: '1 cup sugar = 3/4 cup maple syrup',
      confidence: 'high',
      confidence_score: 0.75,
      reason: 'Natural sweetener with distinct flavor. Adds moisture.',
      best_for: ['pancakes', 'baking', 'glazes'],
      avoid_for: ['meringues', 'recipes where maple flavor unwanted'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'Reduce liquid by 3 tbsp per cup syrup.',
    },
    {
      substitute_ingredient: 'coconut sugar',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Lower glycemic index. Slight caramel flavor.',
      best_for: ['baking', 'beverages', 'granola'],
      avoid_for: ['white cakes', 'meringues'],
      flavor_impact: 'minimal',
      texture_impact: 'none',
      cooking_adjustment: 'Slightly less sweet. May add light brown color.',
    },
  ],
};

const BROWN_SUGAR: StaticSubstitutionEntry = {
  ingredient: 'brown sugar',
  aliases: ['light brown sugar', 'dark brown sugar', 'packed brown sugar'],
  category: 'sweetener',
  substitutions: [
    {
      substitute_ingredient: 'white sugar + molasses',
      ratio: '1 cup = 1 cup white sugar + 1 tbsp molasses',
      confidence: 'high',
      confidence_score: 0.95,
      reason: 'Brown sugar is literally white sugar + molasses.',
      best_for: ['all applications'],
      avoid_for: [],
      flavor_impact: 'none',
      texture_impact: 'none',
      cooking_adjustment: 'Mix well. Use 2 tbsp molasses for dark brown sugar.',
    },
    {
      substitute_ingredient: 'coconut sugar',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Similar caramel notes and moisture content.',
      best_for: ['baking', 'sauces', 'glazes'],
      avoid_for: [],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
    },
    {
      substitute_ingredient: 'white sugar',
      ratio: '1:1',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Works but loses molasses flavor and moisture.',
      best_for: ['recipes where molasses flavor not critical'],
      avoid_for: ['chocolate chip cookies', 'gingerbread'],
      flavor_impact: 'noticeable',
      texture_impact: 'minimal',
      cooking_adjustment: 'Less moisture and caramel flavor.',
    },
  ],
};

/**
 * BAKING ESSENTIALS
 */
const BAKING_POWDER: StaticSubstitutionEntry = {
  ingredient: 'baking powder',
  aliases: ['double-acting baking powder'],
  category: 'leavening',
  substitutions: [
    {
      substitute_ingredient: 'baking soda + cream of tartar',
      ratio: '1 tsp = 1/4 tsp baking soda + 1/2 tsp cream of tartar',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Baking powder is essentially this combination.',
      best_for: ['all baking applications'],
      avoid_for: [],
      flavor_impact: 'none',
      texture_impact: 'none',
    },
    {
      substitute_ingredient: 'baking soda + lemon juice',
      ratio: '1 tsp = 1/4 tsp baking soda + 1/2 tsp lemon juice',
      confidence: 'medium',
      confidence_score: 0.75,
      reason: 'Acid + base reaction creates leavening.',
      best_for: ['quick breads', 'pancakes'],
      avoid_for: ['delicate cakes'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'Mix and add immediately as reaction begins right away.',
    },
    {
      substitute_ingredient: 'self-rising flour',
      ratio: 'use self-rising flour and omit baking powder + salt',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Already contains baking powder and salt.',
      best_for: ['biscuits', 'quick breads'],
      avoid_for: ['yeast breads', 'recipes with specific flour types'],
      flavor_impact: 'none',
      texture_impact: 'minimal',
      cooking_adjustment: 'Contains 1.5 tsp baking powder + 1/4 tsp salt per cup flour.',
    },
  ],
};

const BAKING_SODA: StaticSubstitutionEntry = {
  ingredient: 'baking soda',
  aliases: ['sodium bicarbonate', 'bicarbonate of soda'],
  category: 'leavening',
  substitutions: [
    {
      substitute_ingredient: 'baking powder',
      ratio: '1 tsp soda = 3 tsp baking powder',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Baking powder is weaker. Need more and won\'t neutralize acid.',
      best_for: ['recipes without acidic ingredients'],
      avoid_for: ['recipes with buttermilk, yogurt, vinegar'],
      flavor_impact: 'minimal',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Triple the amount. May affect taste and texture.',
    },
  ],
};

const ALL_PURPOSE_FLOUR: StaticSubstitutionEntry = {
  ingredient: 'all-purpose flour',
  aliases: ['ap flour', 'plain flour', 'white flour'],
  category: 'flour',
  substitutions: [
    {
      substitute_ingredient: 'whole wheat flour',
      ratio: '1 cup AP = 7/8 cup whole wheat',
      confidence: 'medium',
      confidence_score: 0.7,
      reason: 'Healthier with more fiber. Denser texture.',
      best_for: ['bread', 'muffins', 'pancakes'],
      avoid_for: ['cakes', 'pastries', 'delicate baking'],
      flavor_impact: 'noticeable',
      texture_impact: 'noticeable',
      cooking_adjustment: 'Heavier and denser. Add extra liquid or use 50/50 blend.',
    },
    {
      substitute_ingredient: 'bread flour',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Higher protein content. Better for bread, chewier for other baking.',
      best_for: ['bread', 'pizza dough', 'bagels'],
      avoid_for: ['cakes', 'pastries'],
      flavor_impact: 'none',
      texture_impact: 'minimal',
      cooking_adjustment: 'Creates chewier texture due to more gluten.',
    },
    {
      substitute_ingredient: 'oat flour',
      ratio: '1 cup AP = 1 1/3 cup oat flour',
      confidence: 'medium',
      confidence_score: 0.65,
      reason: 'Gluten-free alternative. Adds sweetness and moisture.',
      best_for: ['muffins', 'cookies', 'pancakes'],
      avoid_for: ['bread', 'recipes needing gluten structure'],
      flavor_impact: 'noticeable',
      texture_impact: 'noticeable',
      cooking_adjustment: 'No gluten. Add binding agent like xanthan gum.',
    },
  ],
};

/**
 * THICKENERS
 */
const CORNSTARCH: StaticSubstitutionEntry = {
  ingredient: 'cornstarch',
  aliases: ['corn starch', 'cornflour (UK)'],
  category: 'thickener',
  substitutions: [
    {
      substitute_ingredient: 'all-purpose flour',
      ratio: '1 tbsp cornstarch = 2 tbsp flour',
      confidence: 'high',
      confidence_score: 0.85,
      reason: 'Common thickener. Less potent than cornstarch.',
      best_for: ['gravies', 'sauces', 'soups'],
      avoid_for: ['glazes', 'clear sauces'],
      flavor_impact: 'minimal',
      texture_impact: 'minimal',
      cooking_adjustment: 'Double the amount. Cook longer to remove flour taste.',
    },
    {
      substitute_ingredient: 'arrowroot powder',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Neutral flavor, creates clear sauces. Great for acidic dishes.',
      best_for: ['fruit sauces', 'glazes', 'acidic dishes'],
      avoid_for: ['dairy-based sauces'],
      flavor_impact: 'none',
      texture_impact: 'none',
      cooking_adjustment: 'Add at end of cooking. Doesn\'t tolerate prolonged heat.',
    },
    {
      substitute_ingredient: 'tapioca starch',
      ratio: '1:1',
      confidence: 'high',
      confidence_score: 0.9,
      reason: 'Gluten-free, creates glossy finish. Freezes well.',
      best_for: ['pies', 'fruit fillings', 'sauces'],
      avoid_for: [],
      flavor_impact: 'none',
      texture_impact: 'none',
      cooking_adjustment: 'Creates glossier finish than cornstarch.',
    },
  ],
};

/**
 * COMPLETE STATIC LIBRARY - Export all substitutions
 */
export const STATIC_SUBSTITUTION_LIBRARY: StaticSubstitutionEntry[] = [
  // Fats & Oils (5 ingredients)
  BUTTER,
  OLIVE_OIL,
  VEGETABLE_OIL,
  COCONUT_OIL,

  // Dairy (4 ingredients)
  MILK,
  HEAVY_CREAM,
  SOUR_CREAM,
  EGGS,

  // Acids (2 ingredients)
  LEMON_JUICE,
  VINEGAR_WHITE,

  // Proteins (2 ingredients)
  CHICKEN_BREAST,
  GROUND_BEEF,

  // Aromatics (3 ingredients)
  GARLIC,
  ONION,
  GINGER,

  // Herbs (4 ingredients)
  BASIL,
  OREGANO,
  CILANTRO,
  PARSLEY,

  // Spices (3 ingredients)
  CUMIN,
  PAPRIKA,
  CINNAMON,

  // Sweeteners (2 ingredients)
  SUGAR,
  BROWN_SUGAR,

  // Baking Essentials (4 ingredients)
  BAKING_POWDER,
  BAKING_SODA,
  ALL_PURPOSE_FLOUR,
  CORNSTARCH,
];

/**
 * Get substitution count for reporting
 */
export function getLibraryStats() {
  const totalIngredients = STATIC_SUBSTITUTION_LIBRARY.length;
  const totalSubstitutions = STATIC_SUBSTITUTION_LIBRARY.reduce(
    (sum, entry) => sum + entry.substitutions.length,
    0
  );

  const categories = STATIC_SUBSTITUTION_LIBRARY.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalIngredients,
    totalSubstitutions,
    categories,
  };
}
