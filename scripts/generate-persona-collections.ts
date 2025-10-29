#!/usr/bin/env tsx

/**
 * Generate Public Collections for 47 Personas
 *
 * This script creates 100+ themed public collections based on persona characteristics,
 * cuisine types, dietary themes, occasions, and skill levels. Collections are curated
 * using the tag-based ontology system to ensure relevance.
 *
 * Usage:
 *   pnpm tsx scripts/generate-persona-collections.ts
 *
 * Features:
 *   - Generates 100+ diverse collection themes
 *   - Tag-based recipe matching using ontology system
 *   - Persona-appropriate collection assignment
 *   - 10-20 recipes per collection
 *   - All collections marked public (is_public = true)
 *   - Idempotent (can be run multiple times safely)
 */

import { randomUUID } from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import personas from '../data/synth-users/generated/personas.json';
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { collectionRecipes, collections } from '../src/lib/db/user-discovery-schema';

// ============================================================================
// COLLECTION TEMPLATES
// ============================================================================

interface CollectionTemplate {
  nameTemplate: string;
  description: string;
  tagFilters: string[]; // Tags to match (case-insensitive)
  personaArchetypes: string[]; // Which persona archetypes this fits
  minRecipes: number;
  maxRecipes: number;
  difficultyFilter?: 'easy' | 'medium' | 'hard';
  cuisineFilter?: string;
}

const collectionTemplates: CollectionTemplate[] = [
  // ===== Italian Collections =====
  {
    nameTemplate: 'Classic Italian Comfort Food',
    description:
      'Hearty, soul-warming dishes from the heart of Italy. From traditional pasta to rustic stews, these recipes bring authentic Italian flavors to your table.',
    tagFilters: ['italian', 'comfort', 'pasta'],
    personaArchetypes: ['Traditional Home Cook', 'Gourmet Enthusiast', 'Senior Cook'],
    minRecipes: 15,
    maxRecipes: 20,
    cuisineFilter: 'Italian',
  },
  {
    nameTemplate: 'Italian Pasta Perfection',
    description:
      "Master the art of Italian pasta with this curated collection of traditional and modern pasta dishes. Fresh, dried, filled, and baked - every pasta lover's dream.",
    tagFilters: ['italian', 'pasta'],
    personaArchetypes: ['Traditional Home Cook', 'Gourmet Enthusiast'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Italian Desserts & Dolci',
    description:
      "Indulge in Italy's sweetest traditions. From tiramisu to panna cotta, these authentic Italian desserts will transport you to a Roman café.",
    tagFilters: ['italian', 'dessert'],
    personaArchetypes: ['Baking Enthusiast', 'Gourmet Enthusiast'],
    minRecipes: 10,
    maxRecipes: 15,
  },

  // ===== Mediterranean Collections =====
  {
    nameTemplate: 'Mediterranean Fresh & Healthy',
    description:
      'Sun-kissed flavors from the Mediterranean coast. Light, fresh, and packed with nutrients - the perfect collection for healthy, delicious eating.',
    tagFilters: ['mediterranean', 'healthy', 'salad'],
    personaArchetypes: ['Health Conscious', 'Plant-Based Cook'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Greek Island Favorites',
    description:
      'Travel to the Greek islands with these authentic recipes. Fresh herbs, olive oil, and bright flavors define this collection of Mediterranean classics.',
    tagFilters: ['greek', 'mediterranean'],
    personaArchetypes: ['International Cuisine Lover', 'Foodie Explorer'],
    minRecipes: 12,
    maxRecipes: 18,
  },

  // ===== Mexican Collections =====
  {
    nameTemplate: 'Authentic Mexican Street Food',
    description:
      'Experience the vibrant flavors of Mexican street cuisine. Tacos, tortas, elotes, and more - bring the mercado to your kitchen.',
    tagFilters: ['mexican', 'street food', 'tacos'],
    personaArchetypes: ['Foodie Explorer', 'International Cuisine Lover'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Mexican Comfort Classics',
    description:
      'Traditional Mexican home cooking at its finest. These hearty, flavorful dishes are perfect for family gatherings and special occasions.',
    tagFilters: ['mexican', 'comfort'],
    personaArchetypes: ['Traditional Home Cook', 'Busy Parent'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Quick Mexican Weeknight Dinners',
    description:
      "Fast, flavorful Mexican-inspired meals for busy weeknights. Ready in 30 minutes or less, these recipes don't sacrifice taste for speed.",
    tagFilters: ['mexican', 'quick', '30 minutes'],
    personaArchetypes: ['Busy Parent', 'Quick & Easy Specialist'],
    minRecipes: 15,
    maxRecipes: 20,
    difficultyFilter: 'easy',
  },

  // ===== Asian Collections =====
  {
    nameTemplate: 'Japanese Home Cooking Essentials',
    description:
      'Master the fundamentals of Japanese cuisine. From perfect rice to authentic ramen, these recipes form the foundation of Japanese cooking.',
    tagFilters: ['japanese'],
    personaArchetypes: ['International Cuisine Lover', 'Gourmet Enthusiast'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Thai Bold & Spicy',
    description:
      "Experience the explosive flavors of Thai cuisine. Sweet, sour, salty, and spicy - these recipes showcase Thailand's complex flavor profiles.",
    tagFilters: ['thai', 'spicy'],
    personaArchetypes: ['Foodie Explorer', 'International Cuisine Lover'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Indian Curry Collection',
    description:
      'Explore the rich, aromatic world of Indian curries. From creamy kormas to fiery vindaloos, discover the diversity of Indian cuisine.',
    tagFilters: ['indian', 'curry'],
    personaArchetypes: ['International Cuisine Lover', 'Gourmet Enthusiast'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Korean Kitchen Staples',
    description:
      'Essential Korean recipes for your home cooking repertoire. Kimchi, bulgogi, and bibimbap - master the flavors of Korea.',
    tagFilters: ['korean'],
    personaArchetypes: ['Foodie Explorer', 'International Cuisine Lover'],
    minRecipes: 10,
    maxRecipes: 15,
  },
  {
    nameTemplate: 'Vietnamese Fresh Flavors',
    description:
      "Light, fresh, and herbaceous Vietnamese cuisine. Pho, banh mi, and summer rolls showcase Vietnam's balanced flavors.",
    tagFilters: ['vietnamese'],
    personaArchetypes: ['Health Conscious', 'Foodie Explorer'],
    minRecipes: 10,
    maxRecipes: 15,
  },

  // ===== French Collections =====
  {
    nameTemplate: 'French Bistro Classics',
    description:
      'Timeless French dishes that define bistro cooking. Master coq au vin, beef bourguignon, and other Parisian café favorites.',
    tagFilters: ['french', 'classic'],
    personaArchetypes: ['Gourmet Enthusiast', 'Professional Chef', 'Senior Cook'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'French Pastry & Baking',
    description:
      'The art of French patisserie at home. Croissants, macarons, and tarts - master the techniques of French baking.',
    tagFilters: ['french', 'baking', 'dessert'],
    personaArchetypes: ['Baking Enthusiast', 'Gourmet Enthusiast'],
    minRecipes: 12,
    maxRecipes: 18,
  },

  // ===== American Collections =====
  {
    nameTemplate: 'Classic American Comfort Food',
    description:
      'Nostalgic American favorites that warm the soul. Mac and cheese, pot roast, and apple pie - comfort food at its best.',
    tagFilters: ['american', 'comfort'],
    personaArchetypes: ['Traditional Home Cook', 'Busy Parent'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'BBQ & Grilling Masters',
    description:
      'Fire up the grill with these American BBQ classics. Ribs, brisket, and all the fixings for the perfect cookout.',
    tagFilters: ['american', 'grilled', 'bbq'],
    personaArchetypes: ['Gourmet Enthusiast', 'Foodie Explorer'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Southern Soul Food',
    description:
      'Rich traditions of Southern cooking. Fried chicken, collard greens, and cornbread - taste the flavors of the American South.',
    tagFilters: ['american', 'southern', 'comfort'],
    personaArchetypes: ['Traditional Home Cook', 'Senior Cook'],
    minRecipes: 12,
    maxRecipes: 18,
  },

  // ===== Dietary Collections =====
  {
    nameTemplate: 'Plant-Powered Favorites',
    description:
      'Delicious, satisfying vegan meals that prove plant-based eating is anything but boring. Nutrient-dense and flavor-packed.',
    tagFilters: ['vegan', 'plant-based'],
    personaArchetypes: ['Plant-Based Cook', 'Health Conscious'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Vegetarian Comfort Classics',
    description:
      'Hearty vegetarian dishes that satisfy even the most devoted meat-eaters. Comfort food without compromise.',
    tagFilters: ['vegetarian'],
    personaArchetypes: ['Plant-Based Cook', 'Health Conscious', 'Budget Cook'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Gluten-Free Made Easy',
    description:
      "Delicious gluten-free recipes that don't sacrifice flavor or texture. From bread to pasta, discover the possibilities.",
    tagFilters: ['gluten-free'],
    personaArchetypes: ['Health Conscious'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Low-Carb High-Flavor',
    description:
      "Satisfying low-carb meals that keep you full and energized. Keto-friendly options that don't skimp on taste.",
    tagFilters: ['low-carb', 'keto'],
    personaArchetypes: ['Health Conscious'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'High-Protein Power Meals',
    description:
      'Fuel your body with these protein-packed recipes. Perfect for active lifestyles and muscle building.',
    tagFilters: ['high-protein'],
    personaArchetypes: ['Health Conscious'],
    minRecipes: 12,
    maxRecipes: 18,
  },

  // ===== Meal Type Collections =====
  {
    nameTemplate: 'Breakfast Champions',
    description:
      'Start your day right with these energizing breakfast recipes. From quick weekday options to leisurely weekend brunches.',
    tagFilters: ['breakfast'],
    personaArchetypes: ['Health Conscious', 'Busy Parent', 'Quick & Easy Specialist'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Brunch Delights',
    description:
      'Impressive brunch recipes for weekend gatherings. Elegant yet approachable dishes that wow your guests.',
    tagFilters: ['brunch', 'breakfast'],
    personaArchetypes: ['Gourmet Enthusiast', 'Foodie Explorer'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Quick Lunch Solutions',
    description:
      'Satisfying lunches ready in 30 minutes or less. Perfect for work-from-home days or meal prep.',
    tagFilters: ['lunch', 'quick'],
    personaArchetypes: ['Quick & Easy Specialist', 'Meal Prepper'],
    minRecipes: 15,
    maxRecipes: 20,
    difficultyFilter: 'easy',
  },
  {
    nameTemplate: 'Weeknight Dinner Winners',
    description: 'Fast, family-friendly dinners for busy weeknights. Minimal prep, maximum flavor.',
    tagFilters: ['dinner', 'quick', '30 minutes'],
    personaArchetypes: ['Busy Parent', 'Quick & Easy Specialist'],
    minRecipes: 15,
    maxRecipes: 20,
    difficultyFilter: 'easy',
  },
  {
    nameTemplate: 'Snack Attack',
    description:
      'Healthy, satisfying snacks for any time of day. From protein bites to veggie chips, keep hunger at bay.',
    tagFilters: ['snack'],
    personaArchetypes: ['Health Conscious', 'Busy Parent'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Appetizer Party Starters',
    description:
      'Crowd-pleasing appetizers for any gathering. Impress your guests before the main course arrives.',
    tagFilters: ['appetizer'],
    personaArchetypes: ['Gourmet Enthusiast', 'Foodie Explorer'],
    minRecipes: 15,
    maxRecipes: 20,
  },

  // ===== Dessert Collections =====
  {
    nameTemplate: 'Decadent Chocolate Creations',
    description:
      "For serious chocolate lovers only. Rich, indulgent desserts that celebrate the world's favorite flavor.",
    tagFilters: ['dessert', 'chocolate'],
    personaArchetypes: ['Baking Enthusiast'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Baking Basics & Beyond',
    description:
      'Essential baking recipes every home baker should master. From cookies to cakes, build your baking repertoire.',
    tagFilters: ['baking', 'dessert'],
    personaArchetypes: ['Baking Enthusiast', 'Beginner Chef'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'No-Bake Desserts',
    description:
      "Delicious desserts that don't require an oven. Perfect for hot summer days or when you need something quick.",
    tagFilters: ['dessert', 'no-bake'],
    personaArchetypes: ['Quick & Easy Specialist', 'Beginner Chef'],
    minRecipes: 10,
    maxRecipes: 15,
  },

  // ===== Occasion Collections =====
  {
    nameTemplate: 'Holiday Feast Collection',
    description:
      'Show-stopping dishes for holiday celebrations. Impress your family with these festive favorites.',
    tagFilters: ['holiday', 'thanksgiving', 'christmas'],
    personaArchetypes: ['Traditional Home Cook', 'Gourmet Enthusiast', 'Senior Cook'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Date Night Dinners',
    description:
      'Romantic, restaurant-quality meals for two. Create memorable evenings at home with these elegant recipes.',
    tagFilters: ['dinner', 'romantic'],
    personaArchetypes: ['Gourmet Enthusiast', 'Foodie Explorer'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Family Gathering Favorites',
    description:
      'Crowd-pleasing recipes for family get-togethers. Feed a crowd with these make-ahead, scale-up dishes.',
    tagFilters: ['dinner', 'comfort'],
    personaArchetypes: ['Traditional Home Cook', 'Busy Parent', 'Senior Cook'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Game Day Eats',
    description:
      'Party food that scores big. Wings, dips, and finger foods perfect for watching the big game.',
    tagFilters: ['appetizer', 'snack', 'american'],
    personaArchetypes: ['Foodie Explorer', 'Gourmet Enthusiast'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Summer BBQ & Picnic',
    description:
      'Light, fresh recipes perfect for outdoor dining. Grilled favorites and portable dishes for picnics.',
    tagFilters: ['summer', 'grilled', 'salad'],
    personaArchetypes: ['Gourmet Enthusiast', 'Foodie Explorer'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Cozy Winter Warmers',
    description:
      'Hearty soups, stews, and comfort food for cold weather. Warm up with these soul-satisfying recipes.',
    tagFilters: ['winter', 'soup', 'stew', 'comfort'],
    personaArchetypes: ['Traditional Home Cook', 'Senior Cook'],
    minRecipes: 15,
    maxRecipes: 20,
  },

  // ===== Skill Level Collections =====
  {
    nameTemplate: "Beginner's Kitchen Basics",
    description:
      'Essential recipes for cooking newbies. Build your confidence with these foolproof, foundational dishes.',
    tagFilters: ['easy', 'quick'],
    personaArchetypes: ['Beginner Chef', 'College Student'],
    minRecipes: 15,
    maxRecipes: 20,
    difficultyFilter: 'easy',
  },
  {
    nameTemplate: '30-Minute Meals',
    description:
      'Fast, delicious meals for busy schedules. From prep to plate in half an hour or less.',
    tagFilters: ['quick', '30 minutes'],
    personaArchetypes: ['Quick & Easy Specialist', 'Busy Parent'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'One-Pot Wonders',
    description:
      'Minimal cleanup, maximum flavor. Everything cooks in a single pot for easy weeknight dinners.',
    tagFilters: ['one-pot'],
    personaArchetypes: ['Busy Parent', 'Quick & Easy Specialist', 'College Student'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Advanced Techniques',
    description:
      'Challenge yourself with these advanced cooking techniques. For experienced home cooks ready to level up.',
    tagFilters: ['advanced'],
    personaArchetypes: ['Professional Chef', 'Gourmet Enthusiast'],
    minRecipes: 10,
    maxRecipes: 15,
    difficultyFilter: 'hard',
  },
  {
    nameTemplate: 'Slow Cooker Favorites',
    description:
      'Set it and forget it with these slow cooker classics. Come home to delicious, ready-to-eat meals.',
    tagFilters: ['slow cooker', 'instant pot'],
    personaArchetypes: ['Busy Parent', 'Meal Prepper'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Instant Pot Magic',
    description:
      'Harness the power of your pressure cooker. Fast, flavorful meals with minimal effort.',
    tagFilters: ['instant pot', 'pressure cooker'],
    personaArchetypes: ['Busy Parent', 'Meal Prepper'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Air Fryer Essentials',
    description:
      'Crispy, delicious recipes made healthier in the air fryer. Master your favorite appliance.',
    tagFilters: ['air fryer'],
    personaArchetypes: ['Health Conscious', 'Quick & Easy Specialist'],
    minRecipes: 12,
    maxRecipes: 18,
  },

  // ===== Meal Prep Collections =====
  {
    nameTemplate: 'Meal Prep Mastery',
    description:
      'Batch-cook your way to stress-free weekdays. Prep once, eat all week with these make-ahead recipes.',
    tagFilters: ['meal prep'],
    personaArchetypes: ['Meal Prepper'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Freezer-Friendly Meals',
    description:
      'Stock your freezer with homemade convenience. These recipes freeze beautifully for future meals.',
    tagFilters: ['meal prep', 'freezer'],
    personaArchetypes: ['Meal Prepper', 'Busy Parent'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Lunch Box Ideas',
    description: 'Creative, portable lunches for work or school. Say goodbye to boring sandwiches.',
    tagFilters: ['lunch', 'meal prep'],
    personaArchetypes: ['Meal Prepper', 'Busy Parent'],
    minRecipes: 15,
    maxRecipes: 20,
  },

  // ===== Budget Collections =====
  {
    nameTemplate: 'Budget-Friendly Favorites',
    description:
      "Delicious meals that won't break the bank. Economical recipes with gourmet results.",
    tagFilters: ['budget', 'cheap'],
    personaArchetypes: ['Budget Cook', 'College Student'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Pantry Staples Meals',
    description:
      "Make magic with what's already in your pantry. Emergency meals using common ingredients.",
    tagFilters: ['budget', 'quick'],
    personaArchetypes: ['Budget Cook', 'Quick & Easy Specialist'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'College Budget Cooking',
    description:
      'Affordable, easy recipes perfect for dorm and apartment cooking. Ramen upgrade included.',
    tagFilters: ['budget', 'easy', 'quick'],
    personaArchetypes: ['College Student', 'Beginner Chef'],
    minRecipes: 15,
    maxRecipes: 20,
  },

  // ===== Cooking Method Collections =====
  {
    nameTemplate: 'Perfectly Grilled',
    description:
      'Master the grill with these foolproof techniques. From burgers to vegetables, become a grill master.',
    tagFilters: ['grilled'],
    personaArchetypes: ['Gourmet Enthusiast', 'Foodie Explorer'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Roasted to Perfection',
    description: 'The magic of oven roasting. Caramelized, crispy, and full of flavor.',
    tagFilters: ['roasted', 'baked'],
    personaArchetypes: ['Traditional Home Cook', 'Gourmet Enthusiast'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Stir-Fry Suppers',
    description:
      'Fast, flavorful stir-fries for busy nights. Master the wok and create restaurant-quality meals.',
    tagFilters: ['stir-fry'],
    personaArchetypes: ['Quick & Easy Specialist', 'Foodie Explorer'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Soup & Stew Classics',
    description:
      'Comforting bowls of goodness. From light broths to hearty stews, soup for every season.',
    tagFilters: ['soup', 'stew'],
    personaArchetypes: ['Traditional Home Cook', 'Senior Cook'],
    minRecipes: 15,
    maxRecipes: 20,
  },

  // ===== Ingredient-Focused Collections =====
  {
    nameTemplate: 'Chicken Every Way',
    description:
      'Never boring chicken recipes. From fried to roasted, explore the versatility of this kitchen staple.',
    tagFilters: ['chicken'],
    personaArchetypes: ['Traditional Home Cook', 'Busy Parent'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Beef Masterclass',
    description:
      'From steaks to stews, master cooking with beef. Techniques for every cut and occasion.',
    tagFilters: ['beef'],
    personaArchetypes: ['Gourmet Enthusiast', 'Traditional Home Cook'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Seafood Sensations',
    description:
      'Fresh fish and shellfish recipes. Bring the coast to your kitchen with these ocean-inspired dishes.',
    tagFilters: ['seafood', 'fish'],
    personaArchetypes: ['Health Conscious', 'Gourmet Enthusiast'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Vegetable Forward',
    description:
      'Vegetables take center stage. Celebrate seasonal produce with these veggie-focused recipes.',
    tagFilters: ['vegetables', 'vegetarian'],
    personaArchetypes: ['Plant-Based Cook', 'Health Conscious'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Pasta Paradise',
    description:
      'Pasta lovers unite! Fresh, dried, filled, and baked - every pasta possibility explored.',
    tagFilters: ['pasta', 'noodles'],
    personaArchetypes: ['Traditional Home Cook', 'Gourmet Enthusiast'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Rice & Grain Bowls',
    description:
      'Wholesome grain bowls packed with flavor. Perfect for meal prep and healthy eating.',
    tagFilters: ['rice', 'quinoa', 'bowl'],
    personaArchetypes: ['Health Conscious', 'Meal Prepper'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Bread Baking Basics',
    description: 'The art and science of bread baking. From sourdough starters to quick breads.',
    tagFilters: ['bread', 'baking'],
    personaArchetypes: ['Baking Enthusiast', 'Traditional Home Cook'],
    minRecipes: 10,
    maxRecipes: 15,
  },

  // ===== Middle Eastern & Other Cuisines =====
  {
    nameTemplate: 'Middle Eastern Mezze',
    description:
      'Small plates, big flavors. Explore the diverse mezze tradition with hummus, falafel, and more.',
    tagFilters: ['middle eastern', 'appetizer'],
    personaArchetypes: ['International Cuisine Lover', 'Foodie Explorer'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Caribbean Heat',
    description:
      'Island-inspired dishes with bold, spicy flavors. Jerk chicken, rice and peas, and tropical delights.',
    tagFilters: ['caribbean'],
    personaArchetypes: ['Foodie Explorer', 'International Cuisine Lover'],
    minRecipes: 10,
    maxRecipes: 15,
  },
  {
    nameTemplate: 'Spanish Tapas Collection',
    description:
      'Small plates, big impact. Master the art of Spanish tapas for entertaining or grazing.',
    tagFilters: ['spanish', 'appetizer'],
    personaArchetypes: ['International Cuisine Lover', 'Gourmet Enthusiast'],
    minRecipes: 12,
    maxRecipes: 18,
  },

  // ===== Fusion & Modern Collections =====
  {
    nameTemplate: 'Fusion Food Adventures',
    description:
      'Creative cross-cultural recipes that blend the best of multiple cuisines. Unexpected flavor combinations.',
    tagFilters: ['fusion'],
    personaArchetypes: ['Foodie Explorer', 'Gourmet Enthusiast', 'Professional Chef'],
    minRecipes: 10,
    maxRecipes: 15,
  },
  {
    nameTemplate: 'Modern Comfort Food',
    description:
      'Classic comfort dishes with modern twists. Elevated takes on nostalgic favorites.',
    tagFilters: ['comfort', 'modern'],
    personaArchetypes: ['Gourmet Enthusiast', 'Professional Chef'],
    minRecipes: 12,
    maxRecipes: 18,
  },

  // ===== Restaurant-Style Collections =====
  {
    nameTemplate: 'Restaurant Copycat Classics',
    description:
      'Recreate your favorite restaurant dishes at home. From chain restaurants to fine dining.',
    tagFilters: ['restaurant'],
    personaArchetypes: ['Gourmet Enthusiast', 'Foodie Explorer'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Fancy Plating & Presentation',
    description:
      'Make your dishes Instagram-worthy. Learn plating techniques for restaurant-quality presentation.',
    tagFilters: ['advanced', 'dinner'],
    personaArchetypes: ['Professional Chef', 'Gourmet Enthusiast'],
    minRecipes: 10,
    maxRecipes: 15,
  },

  // ===== Health & Wellness Collections =====
  {
    nameTemplate: 'Clean Eating Essentials',
    description:
      'Whole foods, minimal processing. Nourish your body with these clean eating recipes.',
    tagFilters: ['healthy', 'whole foods'],
    personaArchetypes: ['Health Conscious'],
    minRecipes: 15,
    maxRecipes: 20,
  },
  {
    nameTemplate: 'Anti-Inflammatory Kitchen',
    description:
      'Foods that fight inflammation. Delicious recipes packed with anti-inflammatory ingredients.',
    tagFilters: ['healthy'],
    personaArchetypes: ['Health Conscious'],
    minRecipes: 12,
    maxRecipes: 18,
  },
  {
    nameTemplate: 'Energy-Boosting Meals',
    description:
      'Fuel your active lifestyle with nutrient-dense recipes. Sustained energy from whole ingredients.',
    tagFilters: ['healthy', 'high-protein'],
    personaArchetypes: ['Health Conscious'],
    minRecipes: 12,
    maxRecipes: 18,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a URL-friendly slug from a collection name
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Find recipes matching the collection template's tag filters
 */
async function findMatchingRecipes(template: CollectionTemplate): Promise<string[]> {
  const { tagFilters, difficultyFilter, cuisineFilter, minRecipes, maxRecipes } = template;

  try {
    // Build tag filter conditions (case-insensitive LIKE)
    const tagConditions = tagFilters.map(
      (tag) => sql`LOWER(${recipes.tags})::text LIKE LOWER(${`%${tag}%`})`
    );

    // Build WHERE clause
    const whereConditions = [
      eq(recipes.is_public, true), // Only public recipes
      or(...tagConditions), // Match any of the tags
    ];

    // Add difficulty filter if specified
    if (difficultyFilter) {
      whereConditions.push(eq(recipes.difficulty, difficultyFilter));
    }

    // Add cuisine filter if specified
    if (cuisineFilter) {
      whereConditions.push(sql`LOWER(${recipes.cuisine})::text = LOWER(${cuisineFilter})`);
    }

    // Query recipes
    const matchingRecipes = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(...whereConditions))
      .limit(maxRecipes);

    const recipeIds = matchingRecipes.map((r) => r.id);

    // Check if we have minimum required recipes
    if (recipeIds.length < minRecipes) {
      console.log(
        `⚠️  Template "${template.nameTemplate}" only found ${recipeIds.length}/${minRecipes} recipes (skipping)`
      );
      return [];
    }

    return recipeIds;
  } catch (error) {
    console.error(`Error finding recipes for template "${template.nameTemplate}":`, error);
    return [];
  }
}

/**
 * Check if persona archetype matches template
 */
function personaMatchesTemplate(personaArchetype: string, template: CollectionTemplate): boolean {
  return template.personaArchetypes.some(
    (archetype) => archetype.toLowerCase() === personaArchetype.toLowerCase()
  );
}

/**
 * Create a collection for a persona
 */
async function createCollectionForPersona(
  persona: any,
  template: CollectionTemplate,
  recipeIds: string[]
): Promise<{ success: boolean; collectionId?: string }> {
  const slug = createSlug(template.nameTemplate);

  try {
    // Check if collection already exists for this user
    const existingCollection = await db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.user_id, persona.id), // persona.id is the Clerk user ID
          eq(collections.slug, slug)
        )
      )
      .limit(1);

    if (existingCollection.length > 0) {
      console.log(
        `  ℹ️  Collection "${template.nameTemplate}" already exists for ${persona.username} (skipping)`
      );
      return { success: false };
    }

    // Create collection
    const [newCollection] = await db
      .insert(collections)
      .values({
        id: randomUUID(),
        user_id: persona.id,
        name: template.nameTemplate,
        slug,
        description: template.description,
        is_public: true, // Always public
        recipe_count: recipeIds.length,
        created_at: new Date(),
        updated_at: new Date(),
        last_recipe_added_at: new Date(),
      })
      .returning();

    // Add recipes to collection
    const collectionRecipeEntries = recipeIds.map((recipeId, index) => ({
      id: randomUUID(),
      collection_id: newCollection.id,
      recipe_id: recipeId,
      position: index,
      added_at: new Date(),
    }));

    await db.insert(collectionRecipes).values(collectionRecipeEntries);

    console.log(
      `  ✅ Created "${template.nameTemplate}" for ${persona.username} with ${recipeIds.length} recipes`
    );

    return { success: true, collectionId: newCollection.id };
  } catch (error) {
    console.error(
      `  ❌ Error creating collection "${template.nameTemplate}" for ${persona.username}:`,
      error
    );
    return { success: false };
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function generatePersonaCollections() {
  console.log('\n🎨 Generating Public Collections for 47 Personas\n');
  console.log('='.repeat(70));
  console.log(`Total Templates: ${collectionTemplates.length}`);
  console.log(`Total Personas: ${personas.length}`);
  console.log('='.repeat(70));

  let totalCollectionsCreated = 0;
  const totalRecipesUsed = new Set<string>();
  const personasWithCollections = new Set<string>();

  // Process each template
  for (const template of collectionTemplates) {
    console.log(`\n📦 Processing Template: "${template.nameTemplate}"`);

    // Find matching recipes for this template
    const matchingRecipeIds = await findMatchingRecipes(template);

    if (matchingRecipeIds.length === 0) {
      console.log(`  ⏭️  No matching recipes found, skipping template`);
      continue;
    }

    console.log(`  Found ${matchingRecipeIds.length} matching recipes`);

    // Find matching personas
    const matchingPersonas = personas.filter((persona) =>
      personaMatchesTemplate(persona.archetype, template)
    );

    if (matchingPersonas.length === 0) {
      console.log(`  ⏭️  No matching personas found, skipping template`);
      continue;
    }

    console.log(`  Found ${matchingPersonas.length} matching personas`);

    // Create collection for each matching persona
    for (const persona of matchingPersonas) {
      const result = await createCollectionForPersona(persona, template, matchingRecipeIds);

      if (result.success) {
        totalCollectionsCreated++;
        matchingRecipeIds.forEach((id) => totalRecipesUsed.add(id));
        personasWithCollections.add(persona.id);
      }
    }
  }

  // Final statistics
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 FINAL STATISTICS');
  console.log('='.repeat(70));
  console.log(`Total Collections Created: ${totalCollectionsCreated}`);
  console.log(`Unique Recipes Used: ${totalRecipesUsed.size}`);
  console.log(`Personas with Collections: ${personasWithCollections.size}/${personas.length}`);
  console.log('='.repeat(70));

  // Show personas without collections
  const personasWithoutCollections = personas.filter((p) => !personasWithCollections.has(p.id));
  if (personasWithoutCollections.length > 0) {
    console.log('\n⚠️  Personas without collections:');
    personasWithoutCollections.forEach((p) => {
      console.log(`  - ${p.username} (${p.archetype})`);
    });
  }

  console.log('\n✨ Collection generation complete!\n');
}

// Execute script
generatePersonaCollections()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
