# Recipe Tag Hierarchy Examples

**Date**: 2025-10-18
**Purpose**: Visual examples of recommended tag hierarchies
**Related**: `RECIPE_TAG_TAXONOMY_RESEARCH.md`

---

## Overview

This document provides concrete examples of how hierarchical tags should be structured in the Recipe Manager system. All hierarchies follow the **2-level maximum depth** rule for optimal UX.

---

## 1. Cuisine Hierarchies

### Italian Cuisine (2 Levels)

```
Italian
├── Sicilian
│   └── Examples: Arancini, Caponata, Pasta alla Norma
├── Tuscan
│   └── Examples: Ribollita, Panzanella, Bistecca alla Fiorentina
├── Neapolitan
│   └── Examples: Pizza Margherita, Spaghetti alle Vongole
├── Roman
│   └── Examples: Cacio e Pepe, Carbonara, Amatriciana
├── Venetian
│   └── Examples: Risotto al Nero di Seppia, Sarde in Saor
└── Emilian
    └── Examples: Tortellini, Ragù Bolognese, Lasagna
```

**Usage**:
- Tag with MOST SPECIFIC applicable: "Sicilian" > "Italian"
- If not regional-specific, use parent: "Italian"
- Don't double-tag (not both "Italian" AND "Sicilian")

**Query Behavior**:
- Searching "Italian" returns all Italian + regional children
- Searching "Sicilian" returns only Sicilian recipes

---

### Chinese Cuisine (2 Levels)

```
Chinese
├── Cantonese
│   └── Examples: Dim Sum, Char Siu, Wonton Soup
├── Szechuan (Sichuan)
│   └── Examples: Mapo Tofu, Kung Pao Chicken, Dan Dan Noodles
├── Hunan
│   └── Examples: Orange Chicken, Hunan Beef, Chili Shrimp
├── Shanghainese
│   └── Examples: Xiaolongbao, Red Braised Pork, Drunken Chicken
└── Mandarin
    └── Examples: Peking Duck, Hot and Sour Soup
```

**Rationale**: Regional Chinese cuisines are distinct (different ingredients, techniques, spice levels)

---

### Indian Cuisine (2 Levels)

```
Indian
├── North Indian
│   └── Examples: Butter Chicken, Naan, Palak Paneer, Samosas
├── South Indian
│   └── Examples: Dosa, Idli, Sambar, Coconut Chutney
├── Bengali
│   └── Examples: Machher Jhol, Shukto, Rasgulla
├── Punjabi
│   └── Examples: Chole Bhature, Tandoori Chicken, Sarson ka Saag
└── Goan
    └── Examples: Vindaloo, Fish Curry, Bebinca
```

**Usage Note**: "North Indian" is broad but user-recognizable; "Punjabi" is more specific

---

### Mediterranean Cuisine (No Children)

```
Mediterranean (Pan-Regional)
└── Examples: Greek Salad, Hummus, Tabbouleh, Shakshuka
```

**Rationale**: "Mediterranean" spans multiple countries (Greece, Turkey, Lebanon, Morocco, Spain). Instead of making it a parent, we have separate country tags:
- Greek
- Turkish
- Middle Eastern
- Spanish
- Moroccan

**Special Case**: A recipe can be tagged with BOTH "Mediterranean" (regional style) AND "Greek" (specific country)

---

### American Cuisine (Regional Variants)

```
American
├── Southern (US South)
│   └── Examples: Fried Chicken, Biscuits and Gravy, Gumbo
├── Southwestern
│   └── Examples: Chili, Fajitas, Cornbread
├── Cajun/Creole
│   └── Examples: Jambalaya, Étouffée, Red Beans and Rice
└── New England
    └── Examples: Clam Chowder, Lobster Roll, Boston Baked Beans
```

**Usage**: "American" is often too broad; regional variants are more descriptive

---

### Fusion Cuisines (Flat)

```
Asian Fusion
Tex-Mex
California Cuisine
Modern Australian
```

**Rationale**: Fusion cuisines don't fit strict hierarchies; treat as standalone tags

---

## 2. Dietary Hierarchies

### Vegetarian Family (2 Levels)

```
Vegetarian (No meat, poultry, or fish)
└── Vegan (No animal products)
    └── Examples: Any vegan recipe is also vegetarian
```

**Hierarchical Relationship**: Vegan ⊂ Vegetarian
- All vegan recipes are vegetarian-friendly
- Not all vegetarian recipes are vegan (may have dairy/eggs)

**Query Behavior**:
- Filtering "Vegetarian" should include vegan recipes
- Filtering "Vegan" shows only vegan (stricter)

**Tagging Rule**: Tag with MOST SPECIFIC:
- If recipe is vegan → tag "Vegan" only (not both)
- System infers vegetarian-friendliness

---

### Allergen-Free Family (2 Levels)

```
Allergen-Free (Conceptual Parent - not a tag)
├── Dairy-Free
│   └── Examples: No milk, cheese, butter, yogurt, cream
├── Gluten-Free
│   └── Examples: No wheat, barley, rye, malt
├── Nut-Free
│   └── Examples: No tree nuts, peanuts
├── Egg-Free
│   └── Examples: No eggs or egg products
├── Soy-Free
│   └── Examples: No soy sauce, tofu, edamame
├── Shellfish-Free
│   └── Examples: No shrimp, crab, lobster, clams
└── Sesame-Free
    └── Examples: No sesame oil, tahini, seeds
```

**Usage**:
- "Allergen-Free" is NOT a tag (too vague)
- Tag with SPECIFIC allergens avoided
- Multiple allergen tags allowed (e.g., "Dairy-Free" + "Gluten-Free")

---

### Low-Carb Family (Subset Relationships)

```
Low-Carb (< 50g carbs/day)
├── Keto (< 20-30g net carbs/day)
│   └── Strict Keto (< 20g net carbs/day)
└── Paleo (No grains, legumes, dairy)
```

**Hierarchical Note**: Keto ⊂ Low-Carb, but Paleo is NOT a subset (different criteria)

**Tagging Rule**:
- If Strict Keto → tag "Keto" only
- If Keto → tag "Keto" (system infers low-carb)
- If Paleo → tag both "Paleo" AND "Low-Carb" if applicable

---

### Other Dietary Tags (Flat)

```
Pescatarian (No meat except fish)
Flexitarian (Mostly plant-based)
Whole30 (No sugar, grains, dairy, legumes)
Diabetic-Friendly
Heart-Healthy
High-Protein
Low-Sodium
Low-Fat
Sugar-Free
Halal (Islamic dietary law)
Kosher (Jewish dietary law)
```

**No Hierarchy**: These are independent restrictions

---

## 3. Cooking Method Hierarchies

### Primary Heat Method (2 Levels)

```
Dry Heat (Air or fat, no liquid)
├── Baking/Roasting (Oven, 300-450°F)
│   └── Examples: Roasted Chicken, Baked Cookies
├── Grilling (Direct heat from below)
│   └── Examples: Grilled Steak, BBQ Ribs
├── Broiling (Direct heat from above)
│   └── Examples: Broiled Fish, Melted Cheese
├── Sautéing (Stovetop, small amount fat)
│   └── Examples: Sautéed Vegetables, Pan-Seared Scallops
├── Pan-Frying (Stovetop, moderate fat)
│   └── Examples: Fried Chicken, Latkes
├── Stir-Frying (High heat, constant motion)
│   └── Examples: Beef and Broccoli, Pad Thai
├── Deep Frying (Submerged in oil)
│   └── Examples: French Fries, Tempura
└── Air Frying (Hot air circulation)
    └── Examples: Air Fryer Chicken Wings, Crispy Tofu

Moist Heat (Water, steam, or liquid)
├── Boiling (212°F, rapid bubbles)
│   └── Examples: Pasta, Boiled Eggs
├── Simmering (185-205°F, gentle bubbles)
│   └── Examples: Soup, Stock, Bolognese
├── Steaming (Steam heat, no water contact)
│   └── Examples: Steamed Dumplings, Vegetables
├── Poaching (160-180°F, no bubbles)
│   └── Examples: Poached Eggs, Poached Salmon
└── Blanching (Brief boil + ice bath)
    └── Examples: Blanched Green Beans, Tomato Peeling

Combination Methods (Dry + Moist)
├── Braising (Sear + liquid simmer)
│   └── Examples: Pot Roast, Short Ribs, Coq au Vin
├── Stewing (Similar to braising, smaller pieces)
│   └── Examples: Beef Stew, Chicken Stew
└── Pot Roasting (Sear + oven with liquid)
    └── Examples: Pot Roast, Osso Buco
```

**Tagging Rule**:
- Tag with LEAF NODE only (e.g., "Braising", not "Combination Methods")
- Parent categories are for UI filtering/browsing only
- Don't double-tag method + parent

**UI Behavior**:
- Filter "Dry Heat" → shows all child methods (Baking, Grilling, etc.)
- Recipe tagged "Baking" appears in "Dry Heat" filter

---

### Appliance-Specific Methods (Flat)

```
Slow Cooker (Crock-Pot)
├── Examples: Pulled Pork, Chili, Pot Roast
└── Typical Time: 4-8 hours on low

Instant Pot (Pressure Cooker)
├── Examples: Chicken Noodle Soup, Pulled Chicken, Rice
└── Typical Time: 10-40 minutes

Air Fryer
├── Examples: Chicken Wings, French Fries, Brussels Sprouts
└── Typical Time: 10-25 minutes

Sous Vide (Precision water bath)
├── Examples: Steak, Salmon, Eggs
└── Typical Time: 1-4 hours

Rice Cooker
├── Examples: Steamed Rice, Quinoa, Oatmeal
└── Typical Time: 20-40 minutes

Microwave
├── Examples: Mug Cake, Steamed Vegetables
└── Typical Time: 2-10 minutes
```

**Rationale**: Appliance-specific methods are flat (no hierarchy needed)

---

### Specialty Methods (Flat)

```
Smoking (Low heat + wood smoke)
└── Examples: Smoked Brisket, Smoked Salmon

Fermenting (Bacterial/yeast transformation)
└── Examples: Sauerkraut, Kimchi, Kombucha, Sourdough

Curing (Salt/sugar preservation)
└── Examples: Bacon, Gravlax, Prosciutto

Pickling (Acid preservation)
└── Examples: Pickles, Pickled Onions, Escabeche

Dehydrating (Moisture removal)
└── Examples: Jerky, Dried Fruit, Fruit Leather

No-Cook (No heat applied)
└── Examples: Salad, Ceviche, Overnight Oats, Smoothie
```

**Usage**: These methods often combine with others (e.g., "Smoked" + "Grilled")

---

## 4. Main Ingredient Hierarchies

### Protein (2 Levels)

```
Protein (Conceptual Parent - not a tag)
├── Meat
│   ├── Beef
│   │   └── Examples: Steak, Ground Beef, Brisket
│   ├── Pork
│   │   └── Examples: Pork Chops, Bacon, Ham
│   ├── Lamb
│   │   └── Examples: Lamb Chops, Leg of Lamb
│   └── Game (Venison, Bison, Duck, Rabbit)
│       └── Examples: Venison Stew, Duck Confit
├── Poultry
│   ├── Chicken
│   │   └── Examples: Roasted Chicken, Chicken Breast
│   ├── Turkey
│   │   └── Examples: Roasted Turkey, Turkey Burgers
│   └── Duck
│       └── Examples: Duck à l'Orange, Peking Duck
├── Seafood
│   ├── Fish
│   │   ├── Salmon
│   │   ├── Tuna
│   │   ├── Cod
│   │   ├── Halibut
│   │   └── Tilapia
│   └── Shellfish
│       ├── Shrimp
│       ├── Crab
│       ├── Lobster
│       ├── Scallops
│       └── Mussels/Clams
└── Plant Protein
    ├── Tofu/Tempeh
    │   └── Examples: Stir-Fried Tofu, Tempeh Bacon
    ├── Beans/Legumes
    │   └── Examples: Black Beans, Chickpeas, Lentils
    └── Nuts/Seeds
        └── Examples: Almond Butter, Chia Pudding
```

**Tagging Rule**:
- Tag with MOST SPECIFIC: "Salmon" > "Seafood" > "Protein"
- Don't tag with intermediate levels (not "Salmon" AND "Fish" AND "Seafood")

**UI Behavior**:
- Filtering "Seafood" shows all fish and shellfish recipes
- Filtering "Salmon" shows only salmon recipes

---

### Grains & Starches (2 Levels)

```
Grains
├── Rice
│   ├── White Rice
│   ├── Brown Rice
│   ├── Jasmine/Basmati
│   └── Wild Rice
├── Pasta
│   ├── Italian Pasta (Spaghetti, Penne, Rigatoni)
│   ├── Asian Noodles (Ramen, Udon, Rice Noodles)
│   └── Filled Pasta (Ravioli, Tortellini)
├── Quinoa
├── Couscous
├── Farro
├── Barley
└── Bread/Baked Goods
    ├── Sourdough
    ├── Baguette
    └── Whole Wheat
```

**Usage**: Tag with specific grain type; hierarchy helps browsing

---

### Vegetables (2 Levels)

```
Vegetables
├── Leafy Greens
│   ├── Spinach
│   ├── Kale
│   ├── Arugula
│   └── Lettuce/Cabbage
├── Root Vegetables
│   ├── Potatoes
│   ├── Sweet Potatoes
│   ├── Carrots
│   └── Beets
├── Cruciferous
│   ├── Broccoli
│   ├── Cauliflower
│   ├── Brussels Sprouts
│   └── Cabbage
├── Nightshades
│   ├── Tomatoes
│   ├── Peppers (Bell/Chili)
│   ├── Eggplant
│   └── Potatoes (also root veg)
├── Squash
│   ├── Zucchini/Summer Squash
│   ├── Butternut Squash
│   ├── Acorn Squash
│   └── Pumpkin
└── Alliums
    ├── Onions
    ├── Garlic
    ├── Shallots
    └── Leeks
```

**Tagging Rule**: Tag with SPECIFIC vegetable, not category
- "Broccoli" is a tag, "Cruciferous" is a browsing filter

---

## 5. Dish Type Hierarchy (Flat)

```
Soup (Liquid-based dish)
├── Examples: Chicken Noodle, Tomato, Minestrone, Pho
└── Subcategories: Broth-based, Cream-based, Chunky, Puréed

Salad (Cold, mixed ingredients)
├── Examples: Caesar, Greek, Cobb, Caprese
└── Subcategories: Green salad, Grain salad, Pasta salad

Sandwich (Between bread)
├── Examples: BLT, Club, Panini, Banh Mi
└── Subcategories: Hot, Cold, Open-faced

Pizza (Flatbread with toppings)
├── Examples: Margherita, Pepperoni, Hawaiian
└── Subcategories: Thin crust, Deep dish, Neapolitan

Casserole (Baked dish in one pan)
├── Examples: Lasagna, Mac and Cheese, Shepherd's Pie
└── Subcategories: Pasta casserole, Vegetable casserole

Pasta (Pasta-based dish)
├── Examples: Spaghetti Carbonara, Fettuccine Alfredo
└── Subcategories: Baked pasta, Pasta salad, Soup with pasta

Bowl (Composed dish in a bowl)
├── Examples: Buddha Bowl, Poke Bowl, Burrito Bowl
└── Subcategories: Grain bowl, Noodle bowl, Smoothie bowl

Stew (Thick, slow-cooked)
├── Examples: Beef Stew, Chicken Stew, Ratatouille
└── Subcategories: Similar to soup but thicker

Curry (Sauce-based, spiced)
├── Examples: Chicken Tikka Masala, Thai Green Curry
└── Subcategories: Indian curry, Thai curry, Japanese curry

Wrap/Burrito (Rolled in tortilla)
├── Examples: Burrito, Wrap, Quesadilla, Fajitas
└── Subcategories: Hot, Cold

Taco (Tortilla with fillings)
├── Examples: Beef Tacos, Fish Tacos, Vegetarian Tacos
└── Subcategories: Hard shell, Soft shell

Stir-Fry (Quick-cooked in wok/pan)
├── Examples: Beef and Broccoli, Pad Thai, Fried Rice
└── Subcategories: With noodles, With rice, Vegetable only
```

**Rationale**: Dish types are structural, not hierarchical. They describe WHAT the dish is.

**Usage**: Can overlap with Course
- "Soup" can be Appetizer or Main Course
- "Salad" can be Side Dish or Main Course
- "Pizza" is typically Main Course

---

## 6. Season/Holiday Hierarchy (Flat)

```
Seasons
├── Spring (March-May)
│   └── Examples: Asparagus, Peas, Strawberries, Lamb
├── Summer (June-August)
│   └── Examples: Tomatoes, Corn, Berries, Grilling
├── Fall/Autumn (September-November)
│   └── Examples: Pumpkin, Squash, Apples, Root Vegetables
└── Winter (December-February)
    └── Examples: Citrus, Hearty Soups, Stews, Roasts

Holidays (US-Centric, expand for other cultures)
├── Thanksgiving (4th Thursday November)
│   └── Examples: Turkey, Stuffing, Cranberry Sauce, Pumpkin Pie
├── Christmas (December 25)
│   └── Examples: Ham, Roast Beef, Gingerbread, Eggnog
├── Easter (Movable: March-April)
│   └── Examples: Ham, Lamb, Hot Cross Buns, Deviled Eggs
├── Halloween (October 31)
│   └── Examples: Pumpkin Carving, Candy, Caramel Apples
├── Fourth of July (July 4)
│   └── Examples: BBQ, Hamburgers, Hot Dogs, Watermelon
├── Valentine's Day (February 14)
│   └── Examples: Chocolate, Romantic Dinners, Desserts
├── New Year's Eve/Day (December 31 / January 1)
│   └── Examples: Champagne, Appetizers, Black-Eyed Peas (South)
├── Passover (Movable: March-April)
│   └── Examples: Matzah, Brisket, Charoset
├── Hanukkah (Movable: November-December)
│   └── Examples: Latkes, Sufganiyot, Brisket
└── Diwali (Movable: October-November)
    └── Examples: Sweets, Samosas, Ladoo
```

**Rationale**: Seasons and holidays are independent (no hierarchy needed)

**Usage**: Can tag with BOTH season and holiday
- Example: "Pumpkin Pie" → "Fall" + "Thanksgiving"

---

## 7. Planning Category (Flat)

```
Make-Ahead (Can be prepared in advance)
└── Examples: Lasagna, Overnight Oats, Marinated Meats

Freezer-Friendly (Can be frozen and reheated)
└── Examples: Soup, Casseroles, Cookie Dough, Burrito Bowls

Meal Prep (Designed for batch cooking)
└── Examples: Sheet Pan Meals, Grain Bowls, Marinated Proteins

Batch Cooking (Large quantities for multiple meals)
└── Examples: Chili, Soup, Sauce, Rice

Leftovers-Friendly (Tastes good reheated)
└── Examples: Curry, Stew, Pasta Bakes

One-Pot/One-Pan (Minimal cleanup)
└── Examples: Sheet Pan Dinners, One-Pot Pasta, Skillet Meals

No-Prep (Minimal preparation required)
└── Examples: Dump-and-Go Slow Cooker, Instant Pot Recipes
```

**Rationale**: These describe meal planning WORKFLOW, not cooking technique

**Usage**: Multiple planning tags allowed
- "Make-Ahead" + "Freezer-Friendly" + "Meal Prep" all applicable to same recipe

---

## 8. Characteristics Category (Flat)

```
Comfort Food (Nostalgic, hearty, indulgent)
└── Examples: Mac and Cheese, Meatloaf, Chicken Pot Pie

Kid-Friendly (Appeals to children, mild flavors)
└── Examples: Chicken Nuggets, Spaghetti, Grilled Cheese

Healthy (Nutrient-dense, balanced)
└── Examples: Salads, Grilled Chicken, Quinoa Bowls

Spicy (Significant heat level)
└── Examples: Szechuan dishes, Thai curry, Jalapeño poppers

Party/Entertaining (Serves a crowd, impressive)
└── Examples: Charcuterie Board, Beef Wellington, Layered Dip

Budget-Friendly (Low cost per serving)
└── Examples: Beans and Rice, Pasta, Soup

Gourmet/Elegant (Sophisticated, special occasion)
└── Examples: Beef Wellington, Lobster Thermidor, Soufflé

Quick & Easy (Minimal effort, fast)
└── Examples: Stir-Fry, Sandwiches, Salads

Crowd-Pleaser (Universally liked)
└── Examples: Pizza, Tacos, Burgers

Restaurant Copycat (Recreates restaurant dish)
└── Examples: Chipotle Burrito Bowl, Panera Broccoli Soup

Authentic/Traditional (Stays true to original recipe)
└── Examples: Traditional Italian Carbonara, Classic French Onion Soup

Modern/Fusion (Contemporary twist)
└── Examples: Sushi Burrito, Ramen Burger
```

**Rationale**: Subjective descriptors that aid discovery

**Usage**: Limit to 1-2 characteristic tags (avoid over-tagging)

---

## 9. Hierarchy Visualization

### Full Tag Taxonomy Tree (Simplified)

```
Recipe Tags (Root)
│
├── Cuisine (2 levels)
│   ├── Italian
│   │   └── Sicilian, Tuscan, Neapolitan, Roman
│   ├── Chinese
│   │   └── Cantonese, Szechuan, Hunan
│   └── Indian
│       └── North Indian, South Indian, Bengali
│
├── Meal Type (Flat)
│   └── Breakfast, Lunch, Dinner, Snack, Brunch
│
├── Course (Flat)
│   └── Appetizer, Main Course, Side Dish, Dessert
│
├── Dish Type (Flat)
│   └── Soup, Salad, Sandwich, Pizza, Casserole, Bowl
│
├── Dietary (2 levels)
│   ├── Vegetarian
│   │   └── Vegan
│   └── Allergen-Free
│       └── Dairy-Free, Gluten-Free, Nut-Free, Egg-Free
│
├── Cooking Method (2 levels)
│   ├── Dry Heat
│   │   └── Baking, Grilling, Sautéing, Frying
│   ├── Moist Heat
│   │   └── Boiling, Steaming, Poaching
│   └── Combination
│       └── Braising, Stewing
│
├── Main Ingredient (2 levels)
│   ├── Protein
│   │   └── Chicken, Beef, Seafood, Tofu
│   ├── Grains
│   │   └── Rice, Pasta, Quinoa
│   └── Vegetables
│       └── Leafy Greens, Root Vegetables, Cruciferous
│
├── Season/Holiday (Flat)
│   └── Spring, Summer, Fall, Winter, Thanksgiving, Christmas
│
├── Planning (Flat)
│   └── Make-Ahead, Freezer-Friendly, Meal Prep, One-Pot
│
├── Characteristics (Flat)
│   └── Comfort Food, Kid-Friendly, Healthy, Spicy, Party
│
└── Other (Flat)
    └── Catchall for uncategorized tags
```

---

## 10. Tagging Decision Tree

### How to Choose the Right Tags

```
START: I have a recipe to tag

STEP 1: What is the cuisine origin?
├── Clear origin → Tag with specific cuisine (e.g., "Italian", "Sicilian")
└── Mixed/Fusion → Tag with fusion type (e.g., "Tex-Mex") or skip

STEP 2: When is it typically eaten?
├── Specific time → Tag with Meal Type (e.g., "Breakfast", "Dinner")
└── Anytime → Skip or tag "Snack"

STEP 3: What is the dish structure?
├── Soup, Salad, Pizza, etc. → Tag with Dish Type
└── Doesn't fit categories → Skip

STEP 4: Position in a meal?
├── Appetizer, Main, Side, Dessert → Tag with Course
└── Flexible → Skip or tag based on primary use

STEP 5: Any dietary restrictions met?
├── Vegan, Vegetarian, Gluten-Free → Tag with Dietary (most specific)
└── No restrictions → Skip

STEP 6: How is it cooked?
├── Dominant method → Tag with Cooking Method (e.g., "Baked", "Grilled")
└── Multiple methods → Tag with primary method only

STEP 7: What's the main ingredient?
├── 1-2 key ingredients → Tag with Main Ingredient (e.g., "Chicken", "Pasta")
└── Many equal ingredients → Tag with most prominent

STEP 8: Seasonal or holiday?
├── Seasonal ingredient → Tag with Season (e.g., "Summer", "Fall")
├── Holiday tradition → Tag with Holiday (e.g., "Thanksgiving")
└── Year-round → Skip

STEP 9: Any meal planning characteristics?
├── Make-Ahead, Freezer, etc. → Tag with Planning
└── Cook and serve immediately → Skip

STEP 10: Any special characteristics?
├── Comfort Food, Spicy, Kid-Friendly → Tag with 1-2 Characteristics
└── Neutral → Skip

RESULT: 3-5 tags across multiple categories ✅
```

---

## 11. Real-World Examples

### Example 1: "Classic Chicken Noodle Soup"

**Tags**:
1. **Dish Type**: Soup
2. **Main Ingredient**: Chicken
3. **Course**: Main Course (or Appetizer, depending on serving)
4. **Planning**: Freezer-Friendly
5. **Characteristics**: Comfort Food

**Total**: 5 tags ✅

**Why these tags?**
- "Soup" = structural form
- "Chicken" = primary protein
- "Main Course" = typically eaten as main
- "Freezer-Friendly" = can be frozen and reheated
- "Comfort Food" = nostalgic, hearty

**NOT tagged**:
- Cuisine: American (too generic, implied)
- Meal Type: Lunch/Dinner (too broad)
- Cooking Method: Boiling (obvious for soup)

---

### Example 2: "Vegan Thai Red Curry"

**Tags**:
1. **Cuisine**: Thai
2. **Dietary**: Vegan
3. **Dish Type**: Curry
4. **Main Ingredient**: Vegetables (or Tofu if using tofu)
5. **Characteristics**: Spicy

**Total**: 5 tags ✅

**Why these tags?**
- "Thai" = specific cuisine origin
- "Vegan" = meets dietary restriction (implies Vegetarian)
- "Curry" = dish type/structure
- "Vegetables" = main ingredient focus
- "Spicy" = characteristic flavor profile

---

### Example 3: "Air Fryer Buffalo Chicken Wings"

**Tags**:
1. **Main Ingredient**: Chicken
2. **Cooking Method**: Air Fryer
3. **Cuisine**: American
4. **Course**: Appetizer
5. **Characteristics**: Party

**Total**: 5 tags ✅

**Why these tags?**
- "Chicken" = primary ingredient
- "Air Fryer" = specific cooking method/appliance
- "American" = cuisine origin
- "Appetizer" = typical serving context
- "Party" = often served for entertaining

---

### Example 4: "Overnight Oats with Berries"

**Tags**:
1. **Meal Type**: Breakfast
2. **Main Ingredient**: Grains (or "Oats" if we add it)
3. **Planning**: Make-Ahead, Overnight (2 planning tags)
4. **Dietary**: Vegetarian (or Vegan if no dairy)
5. **Characteristics**: Healthy

**Total**: 6 tags ✅

**Why these tags?**
- "Breakfast" = when typically eaten
- "Grains" = primary ingredient category
- "Make-Ahead" + "Overnight" = planning strategy
- "Vegetarian" or "Vegan" = dietary classification
- "Healthy" = characteristic descriptor

---

### Example 5: "Sicilian Arancini (Fried Rice Balls)"

**Tags**:
1. **Cuisine**: Sicilian (child of Italian)
2. **Course**: Appetizer
3. **Main Ingredient**: Rice
4. **Cooking Method**: Fried
5. **Characteristics**: Authentic

**Total**: 5 tags ✅

**Why these tags?**
- "Sicilian" = specific regional cuisine (NOT "Italian" + "Sicilian")
- "Appetizer" = typical serving context
- "Rice" = main ingredient
- "Fried" = cooking method
- "Authentic" = traditional preparation

**Hierarchy in Action**:
- Tagged "Sicilian" (child), not "Italian" (parent)
- Searching "Italian" will still find this (hierarchy query)

---

## 12. Anti-Patterns (What NOT to Do)

### ❌ Anti-Pattern 1: Over-Tagging
```
BAD: [Italian, Sicilian, Mediterranean, European, Pasta,
      Dinner, Main Course, Baked, Easy, Quick, Comfort Food,
      Traditional, Authentic, Family-Friendly] (14 tags!)

GOOD: [Sicilian, Pasta, Dinner, Baked, Comfort Food] (5 tags)
```

**Why**: Dilutes SEO signal, overwhelming to users, redundant

---

### ❌ Anti-Pattern 2: Double-Tagging Hierarchy
```
BAD: [Italian, Sicilian] (both parent and child)
GOOD: [Sicilian] (most specific only)
```

**Why**: Hierarchy implies parent relationship; double-tagging is redundant

---

### ❌ Anti-Pattern 3: Using Parent Categories as Tags
```
BAD: [Protein, Chicken] (both parent category and specific)
GOOD: [Chicken] (leaf node only)
```

**Why**: "Protein" is a conceptual grouping, not a useful tag

---

### ❌ Anti-Pattern 4: Vague Tags
```
BAD: [Good, Delicious, Yummy, Tasty]
GOOD: [Comfort Food, Kid-Friendly, Crowd-Pleaser]
```

**Why**: Subjective without context; use specific characteristic tags instead

---

### ❌ Anti-Pattern 5: Mixing Categories
```
BAD: [Dinner, Main Course] (both Meal Type and Course for same purpose)
GOOD: [Dinner] OR [Main Course] (pick one based on context)
```

**Why**: Redundant; Meal Type = when, Course = position in meal

---

## 13. Summary

### Key Principles

1. **Maximum 2 Levels**: Parent → Child, never deeper
2. **Tag with Leaf Nodes**: Use most specific applicable tag
3. **2-5 Tags Per Recipe**: Optimal for SEO and UX
4. **Mix Categories**: Cover multiple dimensions (cuisine + dietary + method)
5. **Avoid Redundancy**: Don't tag parent and child together
6. **Use Hierarchies for Filtering**: Parents aggregate children in search results

---

### Hierarchy Benefits

- ✅ **Better Organization**: Groups related tags logically
- ✅ **Improved Search**: "Italian" returns Italian + regional variations
- ✅ **Educational Value**: Users learn cuisine/method relationships
- ✅ **Scalability**: Easy to add new regional cuisines under existing parents

---

### Implementation Notes

- **Database**: No changes needed (tags still stored as string arrays)
- **Code**: `hierarchy.parent` and `hierarchy.children` in SemanticTag interface
- **UI**: Filtering logic handles parent-child queries
- **Migration**: Existing tags compatible (no breaking changes)

---

**Questions?** See main research report: `RECIPE_TAG_TAXONOMY_RESEARCH.md`
