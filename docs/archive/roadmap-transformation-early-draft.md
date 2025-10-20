# Joanie's Kitchen - Roadmap Transformation Guide

## Core Philosophy Shift

### FROM: Premier Recipe Platform with AI Enhancement
**Old Mission:** "AI-powered recipe management and meal planning platform targeting foodies with semantic search, social features, and chef homage"

### TO: Zero-Waste Cooking Platform with AI-Powered Resourcefulness
**New Mission:** "Help home cooks create delicious meals from what they already have, fight food waste through FIFO intelligence and substitution mastery, and connect with chefs who share Joanie's resourcefulness philosophy"

**Guiding Principle:** Technology serves waste reduction, not recipe perfection.

---

## Feature Transformation Matrix

### TIER 1: Core Features - Build First (Weeks 1-4)

#### ✅ KEEP & ENHANCE: Semantic Search
**Old approach:** Search for recipes by flavor, cuisine, ingredients you want
**New approach:** Search by "what I have" with substitution intelligence

**Transformations:**
- Add query mode: "I have X, Y, Z - what can I make?"
- Weight results by ingredient overlap (use more of what you have)
- Surface recipes with flexible substitution notes
- De-emphasize exact ingredient matching

**Technical:** Keep pgvector embeddings, modify ranking algorithm to prioritize ingredient flexibility

---

#### ⚡ NEW PRIORITY: Joanie's Fridge (Inventory System)
**Replaces:** Synthetic user generation, which is now unnecessary

**Core functionality:**
- **Manual input:** Text entry "I have: lettuce, carrots, chicken breast, half an onion"
- **Structured input:** Autocomplete ingredient list with optional quantities
- **Freshness tracking:** User estimates "days left" or "bought on [date]"
- **FIFO flagging:** Visual indicators for "use soon" ingredients
- **Category organization:** Produce, proteins, dairy, pantry, freezer

**MVP Features (November):**
- Manual text or structured input
- Simple freshness estimation (user provides)
- Basic FIFO flagging (3-day, 5-day, 7-day thresholds)
- Integration with meal suggestions

**V1.1 Features (Post-launch):**
- Photo recognition using VLM
- Learning from user waste patterns
- Automatic shelf-life suggestions based on ingredient type
- Historical tracking of what gets wasted

**Why this matters:** This is the "highlight of Joanie's life" feature. It must work in November.

---

#### ⚡ NEW PRIORITY: Substitution Engine
**Leverages:** Your computational gastronomy research, but reframed

**Core functionality:**
- Given recipe + user's available ingredients → suggest substitutions
- Flavor compound overlap scoring (Western-style complementary pairing)
- Nutritional equivalence checking
- Texture and cooking time considerations
- Cultural appropriateness flags

**Implementation approach:**
- Use FlavorDB data for compound matching
- Apply food-bridging for non-obvious substitutions
- Weight by: flavor similarity (40%), nutritional match (30%), texture (20%), availability (10%)
- Provide confidence scores for each substitution

**User experience:**
- Recipe shows "I don't have [ingredient]" → Suggests alternatives from user's inventory
- "Close enough" mode vs. "exact match" mode
- Explains WHY substitution works (flavor compounds, similar texture, etc.)

**Example:**
```
Recipe calls for: Spinach
You have: Wilting lettuce
Substitution: ✓ High confidence (85%)
Why: Both are mild greens. Sauté the lettuce instead of using raw. 
Similar compounds: Both contain chlorophyll-based aromatics.
Cooking adjustment: Wilt quickly over high heat with garlic.
```

---

#### 🔄 REFOCUS: Meal Planning System
**Old approach:** Plan meals based on preferences, variety, nutrition goals
**New approach:** Plan meals based on inventory, FIFO priorities, minimal waste

**New planning workflow:**

**Step 1: Inventory Analysis**
- What do you have?
- What needs to be used first? (FIFO priority)
- What's about to go bad?

**Step 2: Priority Meal Suggestions**
- Generate 3-5 meal options that use FIFO ingredients
- Show ingredient overlap percentages
- Display "waste reduction score" for each option

**Step 3: Minimal Gap Shopping List**
- Only suggest buying what you truly need
- Prefer pantry staples over specialty items
- Suggest quantity: "You need 1 clove garlic, not a whole bulb"

**Step 4: Flexible Execution**
- Each meal includes substitution options
- Techniques over rigid recipes
- Expected yield vs. actual usage tracking

**What changes in existing meal planner:**
- Remove: "Build your ideal week" preference-first flow
- Add: Inventory input as first step
- Add: FIFO priority weighting in meal suggestions
- Add: Waste reduction impact visualization ("You'll use 8/10 ingredients you already have")

---

#### 🔄 REFOCUS: Recipe Database (3,276 → Substitution-Enhanced)
**Old metadata:** Cuisine, difficulty, rating, ingredients, instructions, nutrition
**New metadata additions:**

**Substitution Flexibility Fields:**
```typescript
interface Recipe {
  // ... existing fields
  
  // NEW FIELDS
  substitutionNotes: {
    ingredientName: string;
    category: 'protein' | 'vegetable' | 'grain' | 'fat' | 'acid' | 'aromatics';
    substitutions: {
      alternative: string;
      confidence: number; // 0-100
      reason: string;
      cookingAdjustment?: string;
    }[];
  }[];
  
  wasteReductionTags: string[]; // 'uses-scraps', 'aging-produce', 'one-pot', 'leftovers'
  scrapUtilization?: string; // "Save chicken bones for stock. Carrot tops for pesto."
  environmentalNotes?: string; // "Local, seasonal ingredients reduce carbon footprint"
  resourcefulness: number; // 1-5 scale: How flexible/forgiving is this recipe?
}
```

**Enrichment process:**
- Run AI pass over existing 3,276 recipes to generate substitution notes
- Add waste reduction tags based on recipe characteristics
- Calculate resourcefulness score based on ingredient flexibility
- Extract any existing scrap/sustainability mentions

**Display changes:**
- Recipe pages show prominent "Substitutions" section
- "What you can use instead" for each ingredient
- Waste reduction potential highlighted
- Scrap utilization tips surfaced

---

### TIER 2: Supporting Features - Build Next (Weeks 5-6)

#### 🔄 REFOCUS: Chef Profiles
**Old curation:** Celebrate culinary excellence broadly
**New curation:** Celebrate resourceful, sustainable, zero-waste chefs

**Keep these chef types:**
- **Nose-to-tail advocates:** Fergus Henderson, April Bloomfield
- **Root-to-stem practitioners:** Dan Barber, Alice Waters
- **Fermentation experts:** Sandor Katz, René Redzepi
- **Sustainable seafood:** Barton Seaver, Josh Niland
- **Home cooking resourcefulness:** Lidia Bastianich, Joanie (featured prominently)

**Remove or deprioritize:**
- Celebrity chefs without sustainability focus
- Fine dining that emphasizes ingredient perfection over flexibility
- Chefs known for expensive, specialized ingredients

**New chef profile sections:**
- "Philosophy on food waste"
- "Signature resourceful techniques"
- "Favorite substitutions and improvisations"
- Environmental impact of their approach

**Joanie's profile becomes exemplar:**
- FIFO principle explained
- Zero-waste kitchen tour
- "Making a meal from anything" philosophy
- Garden-to-compost-to-kitchen cycle
- Her famous "wilting lettuce becomes sautéed greens" story

---

#### 🔄 REFOCUS: AI Recipe Generation
**Old use case:** "Generate a Thai curry from scratch"
**New use case:** "I have these 6 ingredients about to go bad, create a meal"

**New generation parameters:**
```typescript
interface RecipeGenerationRequest {
  availableIngredients: string[]; // REQUIRED
  expiringIngredients: string[]; // Prioritize these
  cuisinePreference?: string; // Optional, not required
  dietaryRestrictions?: string[];
  cookingTime?: number;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  
  // NEW
  allowSubstitutions: boolean; // Default true
  minimizeWaste: boolean; // Default true
  useExactIngredients: boolean; // Default false - flexibility encouraged
}
```

**AI prompt changes:**
- Emphasize using what user has
- Encourage substitution creativity
- Include scrap utilization
- Suggest "what's left over" uses

**Rate limiting still applies, but purpose is different:**
- Not "create perfect recipes"
- But "rescue ingredients from waste"

---

#### ✅ KEEP: Recipe Import from URLs
**No change needed:** Still valuable for adding tested recipes to database
**Enhancement:** After import, run substitution enrichment pass

---

### TIER 3: Defer or Cut (Post-November)

#### ❌ CUT: Synthetic User Generation
**Reason:** No longer needed. Platform isn't about fake social validation.

You were planning 10 synthetic users with 50 recipes. This doesn't serve the zero-waste mission. Real users sharing real waste reduction wins is more valuable.

**Replace with:** 5-10 example "rescue stories" from beta testers
- "I saved this wilting lettuce by making X"
- "These three ingredients became tonight's dinner"
- Real photos, real stories, real impact

---

#### ❌ CUT: Recipe Forking System
**Reason:** Doesn't align with resourcefulness philosophy

Recipe forking is about perfecting and iterating on recipes. Joanie's approach is about flexibility and "good enough." These are incompatible.

**Defer to:** V1.2+ only if there's a substitution-tracking use case
- Fork to document "I used X instead of Y"
- Could work, but not core mission

---

#### ❌ CUT: Activity Feeds
**Reason:** Generic social feature that doesn't serve mission

Traditional activity feed ("User X liked Recipe Y") doesn't help anyone waste less food.

**Alternative (V1.1):** Waste reduction feed
- "Sarah saved 2 lbs of produce this week"
- "Mike used aging carrots in 3 different meals"
- Impact-focused, not vanity metrics

---

#### ❌ CUT: Badges & Achievements
**Reason:** Gamification doesn't fit philosophy

Badges feel like arbitrary gamification. Joanie's motivation is cheapness and environmentalism, not collecting digital trophies.

**Alternative (V1.2):** Impact visualization
- "You've saved 50 lbs of food waste"
- "That's equivalent to X meals / $Y saved / Z carbon offset"
- Real impact over fake achievements

---

#### ⚠️ DEFER: Comments System (V1.1)
**Reason:** Moderation complexity, but could work if substitution-focused

If comments focus on "I tried this substitution and it worked" - that's valuable and aligned with mission.

**Conditions for V1.1:**
- Simple moderation tools in place
- Focus on substitution sharing and waste reduction wins
- Not generic recipe reviews

---

#### ⚠️ DEFER: Collections (V1.1)
**Reason:** Could work if reframed

Collections as "My zero-waste favorites" or "Recipes that rescue wilting greens" - that fits.

Generic "My favorite desserts" - doesn't fit as well.

**Conditions for V1.1:**
- Emphasize collections around resourcefulness themes
- "Uses aging produce"
- "One-pot wonders"
- "Scrap utilization masters"

---

#### ⚠️ DEFER: Follow System (V1.1)
**Reason:** Could work but not core to waste reduction

Following chefs who share this philosophy? Yes.
Following for generic social reasons? No.

**Conditions for V1.1:**
- Chef-focused (not general users)
- Curated list of sustainability-champion chefs
- Not a popularity contest

---

### TIER 4: Social Features - Transformed

#### ✅ KEEP: Recipe Likes/Favorites (Reframed)
**Old purpose:** Bookmarking recipes you want to try
**New purpose:** Marking recipes that helped reduce waste

**Implementation change:**
- Rename "favorites" to "saved recipes" (less consumer-y)
- Optional note: "Why this worked for me" with substitution details
- Private by default (not vanity metric)

---

#### ⚡ NEW: Waste Tracking
**This is the meaningful metric**

**User dashboard shows:**
- Ingredients rescued from waste (count and weight)
- Money saved by not buying new ingredients
- Environmental impact estimate (carbon, water, land)
- Trend over time

**Implementation:**
- Track inventory usage vs. expiration
- Calculate "would have wasted" vs. "actually used"
- Simple impact formulas (backed by research)
- Celebratory milestones

**Example:**
```
This month you:
✓ Used 12 ingredients before they expired
✓ Saved ~$45 in groceries
✓ Prevented 8 lbs of food waste
✓ Equivalent to 32 lbs CO2 not emitted

Keep it up! 🌱
```

---

#### ⚡ NEW: Substitution Sharing
**Community learns from each other's improvisations**

**User can share:**
- "In [Recipe], I used [Y] instead of [X]"
- How it worked (great, good, okay)
- Any cooking adjustments needed
- Photo optional

**This crowdsources substitution knowledge:**
- Builds better substitution engine over time
- Creates community around resourcefulness
- Practical, mission-aligned social feature

**Example:**
```
Sarah's Substitution in "Simple Chicken Soup"
Used: Collard greens (wilting in fridge)
Instead of: Kale
Result: ⭐⭐⭐⭐ (Great!)
Notes: "Cooked a bit longer since collards are tougher. 
       Delicious and saved greens from trash!"
```

---

## Technical Architecture Changes

### Database Schema Additions

**New tables:**
```sql
-- User inventory tracking
CREATE TABLE user_inventory (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  ingredient_name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  acquisition_date DATE,
  estimated_expiry_date DATE,
  freshness_score INTEGER, -- 1-10
  status TEXT, -- 'fresh', 'use_soon', 'expiring'
  created_at TIMESTAMP,
  used_at TIMESTAMP
);

-- Waste reduction tracking
CREATE TABLE waste_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  ingredient_name TEXT,
  quantity NUMERIC,
  outcome TEXT, -- 'used', 'wasted', 'composted'
  recipe_id UUID REFERENCES recipes(id),
  impact_weight_lbs NUMERIC,
  impact_cost_usd NUMERIC,
  created_at TIMESTAMP
);

-- Substitution crowdsourcing
CREATE TABLE user_substitutions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  recipe_id UUID REFERENCES recipes(id),
  original_ingredient TEXT,
  substituted_ingredient TEXT,
  rating INTEGER, -- 1-5
  notes TEXT,
  cooking_adjustments TEXT,
  created_at TIMESTAMP
);
```

**Modified tables:**
```sql
-- Add to recipes table
ALTER TABLE recipes ADD COLUMN resourcefulness_score INTEGER; -- 1-5
ALTER TABLE recipes ADD COLUMN waste_reduction_tags TEXT[];
ALTER TABLE recipes ADD COLUMN scrap_utilization_notes TEXT;
ALTER TABLE recipes ADD COLUMN substitution_data JSONB;
```

---

### API Endpoint Changes

**New endpoints:**
```
POST   /api/inventory              # Add ingredients to user's inventory
GET    /api/inventory              # Get user's current inventory
PUT    /api/inventory/:id          # Update ingredient freshness
DELETE /api/inventory/:id          # Mark ingredient as used/wasted

GET    /api/meals/suggestions      # Get FIFO-prioritized meal suggestions
POST   /api/substitutions/suggest  # Get substitution recommendations
POST   /api/substitutions/share    # Share successful substitution

GET    /api/impact                 # Get user's waste reduction impact stats
```

**Modified endpoints:**
```
GET /api/recipes/search
  # Add query modes:
  - ?mode=ingredient_match&ingredients=X,Y,Z
  - ?mode=fifo&user_id=UUID
  - ?prioritize=waste_reduction

POST /api/recipes/generate
  # New required parameter: availableIngredients
  # New optional parameters: expiringIngredients, minimizeWaste
```

---

### AI/ML Component Changes

**Semantic Search Modifications:**
- Keep pgvector embeddings
- Add "ingredient flexibility" weight to ranking
- Prioritize recipes with substitution notes
- De-emphasize exact ingredient matching

**New ML Components:**

1. **FIFO Intelligence**
   - Predict optimal usage order for ingredients
   - Learn from user's waste patterns
   - Suggest recipes before ingredients expire

2. **Substitution Confidence Scoring**
   - Flavor compound overlap (FlavorDB)
   - Nutritional similarity
   - Texture compatibility
   - Cooking time adjustments needed
   - Confidence: 0-100 score

3. **Waste Impact Calculation**
   - Track inventory → usage → waste
   - Calculate environmental impact (CO2, water, land)
   - Money saved estimation
   - Trend analysis

---

## Content Strategy Changes

### Recipe Import Priorities (Phase 3-4 Adjustments)

**Prioritize sources with:**
- Zero-waste cooking techniques
- Root-to-stem/nose-to-tail recipes
- Flexible, forgiving recipes (not precision-required)
- Scrap utilization guidance
- Seasonal/local emphasis

**Deprioritize sources with:**
- Recipes requiring specialty ingredients
- Fine dining precision c