# Recipe Source Extraction - Technical Implementation Plan

## Executive Summary

This plan provides actionable implementation steps for extracting recipes from 60+ identified sources to scale Joanie's Kitchen from 3,276 to 10,000+ recipes. The approach prioritizes legal certainty (public domain first), maintains attribution standards, and builds on existing Firecrawl integration while adding Python-based extraction tooling.

**Timeline**: 8-10 weeks
**Target**: 10,000+ recipes with complete attribution
**Risk Level**: Low (starts with public domain sources)

**Related Documents**:
- **Roadmap Integration**: `ROADMAP.md` (Version 0.55.0 - Recipe Extraction & Content Expansion)
- **Progress Tracker**: `docs/scraping/PROGRESS.md` for implementation status and milestones
- **Previous Work**: `docs/scraping/lidia-bastianich-scraping-report.md` for scraping methodology reference

---

## Architecture Overview

### Technology Stack

**Core Components:**
- **Firecrawl**: Primary scraping engine (already integrated)
- **Python recipe-scrapers**: Schema.org extraction library
- **TypeScript/Next.js**: Data processing and database integration
- **Drizzle ORM**: Database operations
- **PostgreSQL**: Recipe storage with existing schema

**New Infrastructure Needed:**
1. Python extraction scripts (separate from Next.js app)
2. Data validation pipeline
3. Attribution tracking system
4. Quality control dashboard
5. Import/transformation layer

### Data Flow

```
Source Websites/APIs
    ↓
[Firecrawl / Python Scrapers / API Clients]
    ↓
Raw JSON/CSV Files (./data/imports/)
    ↓
Validation & Transformation Layer
    ↓
Staging Tables (PostgreSQL)
    ↓
Quality Review (Manual + Automated)
    ↓
Production Recipe Tables
    ↓
Joanie's Kitchen Platform
```# Recipe Source Extraction - Technical Implementation Plan

## Executive Summary

This plan provides actionable implementation steps for extracting recipes from 60+ identified sources to scale Joanie's Kitchen from 3,276 to 10,000+ recipes. The approach prioritizes legal certainty (public domain first), maintains attribution standards, and builds on existing Firecrawl integration while adding Python-based extraction tooling.

**Timeline**: 8-10 weeks
**Target**: 10,000+ recipes with complete attribution
**Risk Level**: Low (starts with public domain sources)

**Related Documents**:
- **Roadmap Integration**: `ROADMAP.md` (Version 0.55.0 - Recipe Extraction & Content Expansion)
- **Progress Tracker**: `docs/scraping/PROGRESS.md` for implementation status and milestones
- **Previous Work**: `docs/scraping/lidia-bastianich-scraping-report.md` for scraping methodology reference

---

## Architecture Overview

### Technology Stack

**Core Components:**
- **Firecrawl**: Primary scraping engine (already integrated)
- **Python recipe-scrapers**: Schema.org extraction library
- **TypeScript/Next.js**: Data processing and database integration
- **Drizzle ORM**: Database operations
- **PostgreSQL**: Recipe storage with existing schema

**New Infrastructure Needed:**
1. Python extraction scripts (separate from Next.js app)
2. Data validation pipeline
3. Attribution tracking system
4. Quality control dashboard
5. Import/transformation layer

### Data Flow

```
Source Websites/APIs
    ↓
[Firecrawl / Python Scrapers / API Clients]
    ↓
Raw JSON/CSV Files (./data/imports/)
    ↓
Validation & Transformation Layer
    ↓
Staging Tables (PostgreSQL)
    ↓
Quality Review (Manual + Automated)
    ↓
Production Recipe Tables
    ↓
Joanie's Kitchen Platform
```

---

## Phase 1: Foundation - Public Domain Sources (Weeks 1-2)

**Goal**: Extract 3,500-4,000 recipes with zero legal risk

### Task 1.1: USDA Recipe Extraction

**Sources:**
1. What's Cooking? USDA Mixing Bowl: `whatscooking.fns.usda.gov`
2. Institute of Child Nutrition Recipe Box: `theicn.org/cnrb`
3. Team Nutrition: `fns.usda.gov/tn/recipes`

**Technical Approach:**

Create a TypeScript interface defining the USDA recipe structure with fields for: title, description, ingredients array, instructions array, prep/cook times, servings, nutrition object (calories, protein, carbs, fat, fiber, sodium), MyPlate categories, meal type, cuisine, cost level, source URL/name, and PUBLIC_DOMAIN license.

**Implementation Steps:**

1. **Firecrawl extraction for What's Cooking:**
   - Initialize Firecrawl with API key from environment
   - Target the search results page at whatscooking.fns.usda.gov/recipes/search
   - Configure crawler to include only `/recipes/*` paths, exclude `/recipes/search`, limit to 2000 pages
   - Enable onlyMainContent option to reduce noise
   - Process each crawled page to parse markdown into recipe structure
   - Look for consistent sections: Ingredients, Directions, Nutrition Facts
   - Handle pagination if search results span multiple pages

2. **Python fallback scraper for HTML parsing:**
   - Create USDARecipeScraper class with base_url and user-agent header
   - Implement get_recipe_urls() method that paginates through search pages (estimate 50 pages)
   - Use BeautifulSoup to extract recipe links with class 'recipe-link' or similar
   - Add 2-second delays between page requests for rate limiting
   - Implement scrape_recipe(url) that first checks for Schema.org JSON-LD
   - If Schema.org present, parse structured data directly
   - If not, fall back to HTML parsing with BeautifulSoup selectors
   - Parse duration strings (ISO 8601 format like PT30M) to minutes
   - Parse nutrition object from structured data
   - Save all recipes to ./data/imports/usda-recipes.json
   - Log errors for failed URLs but continue processing

3. **Institute of Child Nutrition extraction:**
   - Check if theicn.org/cnrb offers CSV bulk download option
   - If yes, download CSV and parse with pandas or csv module
   - If no, implement similar scraping to USDA approach
   - ICN uses a database interface - may need to discover URL patterns
   - Potentially requires login/registration - document if needed
   - Target 800+ standardized recipes with meal pattern crediting info

**Deliverables:**
- `./data/imports/usda-whatscooking.json` (~1,000 recipes)
- `./data/imports/usda-icn.json` (~800 recipes)
- `./data/imports/usda-teamnutrition.json` (~500 recipes)
- Extraction logs with success/failure counts
- Data quality report (completeness, validation errors)

### Task 1.2: University Extension Recipes

**Priority Universities:**
1. Oregon State Extension: `extension.oregonstate.edu/food/recipes`
2. Cornell Cooperative Extension: `cortland.cce.cornell.edu/food-nutrition/recipes`
3. University of Maine Extension: `extension.umaine.edu/food-health/recipes`
4. Penn State Extension: `extension.psu.edu/food`
5. NC State Extension: `food.ces.ncsu.edu/recipes`

**Technical Approach:**

Create a UniversityRecipe interface with fields for: title, university name, extension program, ingredients, instructions, nutrition (optional), tags, source URL, license (PUBLIC_DOMAIN or CC_BY or EDUCATIONAL_USE), and testing info (who taste-tested, nutrition label source).

Build a configuration array with one object per university containing: university name, base URL, recipes path, and CSS selectors for: recipe cards, recipe links, title, ingredients list, and instructions.

**Implementation Steps:**

1. **Configure university-specific scrapers:**
   - Create configuration objects for each of the 5 priority universities
   - Research each site's HTML structure to determine correct selectors
   - Note: each university uses different CMSs, so selectors vary significantly
   - Document whether recipes are on individual pages or in searchable databases

2. **Use Firecrawl for each university:**
   - For each configured university, call Firecrawl with base URL + recipes path
   - Set crawler to include only recipe subdirectories (e.g., `/food/recipes/*`)
   - Limit to 500 pages per university to avoid overload
   - Parse markdown output into UniversityRecipe format
   - Extract institution name from URL or page metadata

3. **Handle special cases:**
   - Some extensions provide PDF recipe cards - note these for manual processing
   - Some use video content with recipes in description - extract from video metadata
   - Cornell has strict nutrition standards - capture this in testing metadata
   - Maine provides FDA nutrition labels - flag these as high-quality nutrition data

4. **Attribution requirements:**
   - All recipes must credit the land-grant university extension
   - Include state name in attribution (e.g., "Oregon State University Extension")
   - Note funding source (USDA NIFA) for context
   - License is typically public domain or CC-BY - verify per university

**Deliverables:**
- `./data/imports/extensions/oregon-state.json`
- `./data/imports/extensions/cornell.json`
- `./data/imports/extensions/maine.json`
- `./data/imports/extensions/penn-state.json`
- `./data/imports/extensions/nc-state.json`
- Combined: ~1,000-1,500 recipes

### Task 1.3: CulinaryDB Integration

**Source:** `cosylab.iiitd.edu.in/culinarydb/`

**Technical Approach:**

CulinaryDB provides CSV downloads with four files:
- Recipe_Details.csv (recipe metadata)
- Ingredients.csv (ingredient master list)
- Recipe-Ingredients.csv (junction table)
- Ingredient-Alias.csv (alternate names)

**Implementation Steps:**

1. **Download CSV files:**
   - Visit CulinaryDB website and locate download section
   - Download all four CSV files to ./data/imports/culinarydb/
   - May require manual download - check for direct download links or API

2. **Create Python import script:**
   - Use pandas to read all four CSV files
   - Join Recipe_Details with Recipe-Ingredients on Recipe_ID
   - Join with Ingredients on Ingredient_ID to get ingredient names
   - Parse amounts and units from Recipe-Ingredients table
   - Handle potential encoding issues (international characters)

3. **Merge and enrich data:**
   - For each recipe in Recipe_Details, fetch all associated ingredients
   - Build complete ingredient list with amounts and units where available
   - Parse instructions field (may need splitting on newlines or periods)
   - Extract cuisine and region metadata
   - Create sourcing attribution: "CulinaryDB (IIIT-Delhi)"

4. **License verification:**
   - **CRITICAL**: Verify license for commercial use
   - CulinaryDB is academic research database
   - May require citation or permission for commercial platform
   - Document license terms in ./data/legal/culinarydb-license.txt

5. **Save processed output:**
   - Write enriched recipes to ./data/imports/culinarydb-recipes.json
   - Format should match standard recipe interface
   - Include all available metadata (cuisine, region, cooking methods)

**Deliverables:**
- `./data/imports/culinarydb-recipes.json` (thousands of international recipes)
- License verification document
- Data quality assessment report

**Phase 1 Total Expected Output:** 3,500-4,000 public domain recipes

---

## Phase 2: Free API Integration (Weeks 2-3)

**Goal**: Add 300-500 recipes via APIs with clear licensing

### Task 2.1: TheMealDB Integration

**Source:** `themealdb.com/api.php`

**Technical Approach:**

Build a TheMealDB client class that interfaces with their JSON API. API requires a key obtained through Patreon supporter status ($5-20/month). The API uses test key "1" for development but requires paid key for commercial use.

**Data Structure:**
TheMealDB recipes include: meal ID, name, category (e.g., "Seafood"), area/cuisine, instructions (plain text), thumbnail image URL, optional YouTube video link, and up to 20 ingredient/measure pairs (strIngredient1-20, strMeasure1-20).

**Implementation Steps:**

1. **Set up API authentication:**
   - Sign up for TheMealDB Patreon supporter status
   - Obtain API key from supporter dashboard
   - Store key in environment variables as THEMEALDB_API_KEY
   - Base URL: `https://www.themealdb.com/api/json/v1/{API_KEY}`

2. **Build client class:**
   - Create class with methods for: getAllRecipes(), getCategories(), getRecipesByCategory(), getRecipeById()
   - Implement rate limiting with 1-second delays between requests
   - Handle API pagination if present (TheMealDB doesn't paginate but good practice)

3. **Extraction workflow:**
   - First, fetch all category names using /categories.php endpoint
   - For each category, fetch recipe list using /filter.php?c={category}
   - For each recipe in list, fetch full details using /lookup.php?i={id}
   - Full details include all 20 ingredient slots and complete instructions

4. **Transform to internal format:**
   - Parse ingredient slots (strIngredient1-20) - stop when empty
   - Combine ingredient with corresponding measure (strMeasure1-20)
   - Build ingredients array from non-empty slots
   - Split instructions on newlines or periods for step-by-step format
   - Map strArea to cuisine field
   - Store strMealThumb as imageUrl
   - Store strYoutube as videoUrl if present
   - Set sourceName to "TheMealDB" and license to "PATREON_SUPPORTER"

5. **Save extracted data:**
   - Write all transformed recipes to ./data/imports/themealdb-recipes.json
   - Include external ID (idMeal) for potential updates
   - Log total recipe count (should be ~280 in free database)

**Deliverables:**
- `./data/imports/themealdb-recipes.json` (~280 recipes)
- Patreon supporter subscription setup documentation
- API integration testing report

### Task 2.2: USDA FoodData Central API Setup

**Purpose:** Nutritional enrichment infrastructure, not recipe import

**Technical Approach:**

USDA FoodData Central provides comprehensive nutritional data for 350,000+ food items. This is used to calculate nutrition for recipes from sources that lack nutritional information.

**Implementation Steps:**

1. **Obtain API key:**
   - Register at fdc.nal.usda.gov for free API key
   - Default rate limit: 1,000 requests/hour
   - Store in environment as USDA_FOODDATA_API_KEY
   - Base URL: `https://api.nal.usda.gov/fdc/v1`

2. **Build API client:**
   - Create methods for searchFood(query) and getFood(fdcId)
   - searchFood returns array of matching food items with nutrition
   - getFood returns detailed nutrition for specific food by ID
   - Both return JSON with nutrient arrays

3. **Implement recipe nutrition calculation:**
   - Create calculateRecipeNutrition(ingredients) method
   - For each ingredient, search USDA database for best match
   - Use first/best match (may need fuzzy matching logic)
   - Scale nutrition values based on ingredient amount and unit
   - Requires unit conversion logic (cups to grams, etc.)
   - Sum all nutrients across ingredients for total recipe nutrition

4. **Unit conversion system:**
   - Build or integrate unit conversion library
   - Handle common recipe units: cups, tablespoons, teaspoons, ounces, grams, pounds
   - USDA data is typically per 100g serving
   - Create conversion factors for each unit to grams

5. **Integration point:**
   - This is a SERVICE, not a bulk import
   - Used when processing recipes that lack nutrition data
   - Called during import pipeline validation step
   - Results stored in recipe_nutrition table

**Deliverables:**
- USDA FoodData Central API client implementation
- Recipe nutrition calculation service
- Unit conversion system
- API key setup and rate limit monitoring
- Documentation of supported units and conversions

### Task 2.3: Nutritionix/FatSecret Free Tier Setup

**Purpose:** Supplementary nutrition validation and common dish database

**Technical Approach for Nutritionix:**

Nutritionix offers natural language nutrition queries and a curated database of 1,000+ common dishes maintained by registered dietitians. Free tier: 5,000 requests/day.

**Implementation Steps:**

1. **API setup:**
   - Register at nutritionix.com for app ID and app key
   - Free tier sufficient for validation use case
   - Base URL: `https://trackapi.nutritionix.com/v2`
   - Headers require both x-app-id and x-app-key

2. **Build client with methods:**
   - getNaturalNutrition(query) - natural language parsing ("1 cup rice")
   - searchInstant(query) - search branded and common foods
   - getCommonFoods() - access curated common dishes database

3. **Use case - common dish validation:**
   - Download or cache the 1,000+ common dishes
   - Use to validate/cross-reference nutrition data from other sources
   - Natural language endpoint useful for parsing complex ingredient strings

**Technical Approach for FatSecret:**

FatSecret has 17,000+ curated recipes across 24 languages. Free tier: 5,000 requests/day.

**Implementation Steps:**

1. **API setup:**
   - Register at platform.fatsecret.com
   - OAuth 1.0 authentication (more complex than simple API key)
   - Request recipe data endpoint access

2. **Use case - international recipe cross-reference:**
   - Focus on international recipes (56+ countries represented)
   - Use to validate translations and regional variations
   - Nutrition data is verified, good for cross-checking

**Deliverables:**
- Nutritionix API client implementation
- FatSecret API client implementation
- Common dish nutrition database cache (~1,000 entries)
- Nutrition validation service
- Documentation of when to use each API

**Phase 2 Total Expected Output:** 300-500 recipes + nutrition infrastructure

---

## Phase 3: Celebrity Chefs & Prestige Sources (Weeks 3-6)

**Goal**: Extract 1,000-2,000 prestige recipes with careful legal compliance

### Task 3.1: Terms of Service Review Framework

**Critical**: Before any scraping, implement systematic ToS review

**Create Site Review System:**

Build a data structure for each site containing:
- Domain name
- robots.txt URL and full content
- Whether robots.txt allows /recipes paths
- Terms of Service URL
- Manual ToS review status (boolean - requires human review)
- Whether scraping is explicitly prohibited (from ToS)
- API availability status
- Schema.org presence (boolean)
- Final decision: APPROVED / REQUIRES_PARTNERSHIP / PROHIBITED
- Review notes
- Reviewer name and date

**Implementation Process:**

1. **Automated checks for each site:**
   - Fetch robots.txt from domain/robots.txt
   - Parse robots.txt to check if recipes paths are disallowed
   - Check if entire site is disallowed for bots
   - Fetch sample recipe page (find one manually first)
   - Search HTML for 'application/ld+json' and '"@type": "Recipe"'
   - Flag Schema.org presence as positive indicator

2. **Manual review requirements:**
   - Human must read full Terms of Service for each site
   - Document specific clauses about scraping/automation
   - Note whether site offers official API as alternative
   - Record any attribution requirements found in ToS
   - Make final go/no-go decision per site

3. **Sites to review:**
   - jamesbeard.org
   - jacquespepin.com
   - barefootcontessa.com
   - seriouseats.com
   - food52.com
   - bonappetit.com
   - foodandwine.com
   - saveur.com
   - ciafoodies.com (Culinary Institute of America)

4. **Generate review log:**
   - Save all reviews to ./data/legal/site-reviews.json
   - Create summary document with decisions
   - Flag sites requiring partnership discussions
   - Identify sites approved for ethical scraping

**Deliverables:**
- `./data/legal/site-reviews.json` with manual review status
- Legal assessment document summarizing findings
- Decision matrix (scrape / partner / skip for each source)
- Partnership outreach list for highest-value sources

### Task 3.2: Recipe-Scrapers Python Library Integration

**Install and configure the recipe-scrapers open-source library**

The recipe-scrapers library (github.com/hhursev/recipe-scrapers) supports 100+ websites with automatic Schema.org parsing. This is the gold standard for ethical recipe extraction.

**Setup Steps:**

1. **Environment setup:**
   - Create Python virtual environment for scraping scripts
   - Install dependencies: recipe-scrapers, requests, beautifulsoup4, lxml
   - Install logging library for tracking extraction progress
   - Test installation by importing recipe_scrapers module

2. **Build scraper class:**
   - Create SchemaRecipeScraper class with rate limiting (configurable seconds between requests)
   - Set user agent to identify as "Joanies-Kitchen-Aggregator/1.0 (Educational Recipe Platform)"
   - Implement scrape_recipe(url) method that uses recipe_scrapers.scrape_me(url)
   - Extract all available fields: title, total_time, yields, ingredients, instructions, image, host, author, description, cuisine, category, nutrients

3. **Handle optional fields:**
   - Wrap optional field extraction in try-except blocks
   - recipe_scrapers raises exceptions for missing fields
   - Fields like author, description, cuisine, category, nutrients may not be present
   - Log missing fields but continue processing

4. **Batch processing:**
   - Create scrape_batch(urls, output_file) method
   - Accepts list of URLs and output JSON path
   - Iterate through URLs with progress logging (e.g., "Scraping 15/100")
   - Apply rate limiting between each URL (default 3 seconds)
   - Save successful recipes to output file after each batch
   - Continue processing on individual failures

5. **Error handling:**
   - Log detailed error messages for failed URLs
   - Don't stop batch on single failure
   - Track success rate in log output
   - Save partial results even if some URLs fail

**Deliverables:**
- Python scraping environment setup in /scripts/extract/
- SchemaRecipeScraper class implementation
- Logging configuration for tracking extraction
- Error handling and retry logic

### Task 3.3: High-Value Source Extraction

**Priority List (process only after ToS approval):**

1. James Beard Foundation - jamesbeard.org
2. Jacques Pépin - jacquespepin.com
3. Ina Garten - barefootcontessa.com
4. Food52 - food52.com
5. Serious Eats - seriouseats.com
6. Culinary Institute of America - ciafoodies.com

**For Each Approved Source:**

**Step 1: URL Discovery**
- Build source-specific discovery script
- Start with search/browse/archive pages
- Extract all recipe page URLs
- Handle pagination (multiple pages of results)
- Use BeautifulSoup or similar to find recipe links
- Filter for actual recipe URLs (not articles/blog posts)
- Save URL list to ./data/urls/{source}-urls.txt

**Step 2: Scraping Execution**
- Load URL list from discovery step
- Run SchemaRecipeScraper.scrape_batch() with URLs
- Configure rate limiting: 3 seconds minimum between requests
- Schedule during off-peak hours (e.g., 2-6 AM source site timezone)
- Monitor for rate limit errors or blocks
- Save raw results to ./data/imports/{source}-raw.json

**Step 3: Post-Processing**
- Review extracted recipes for completeness
- Add source-specific metadata (chef name if applicable)
- Verify author attribution present
- Check image URLs are valid
- Transform to standardized recipe format
- Save to ./data/imports/{source}-recipes.json

**Step 4: Validation**
- Run validation script on extracted recipes
- Check required fields present (title, ingredients, instructions)
- Verify sourceUrl and sourceName populated
- Flag any quality issues for manual review
- Generate extraction report with stats

**Example Workflow for James Beard Foundation:**

1. **URL Discovery:**
   - Navigate to jamesbeard.org/recipes
   - Identify structure (search results, category pages, etc.)
   - Build discovery script targeting recipe URLs
   - Extract ~1,800+ recipe URLs based on site structure
   - Save to ./data/urls/james-beard-urls.txt

2. **Ethical Scraping:**
   - Schedule for off-peak hours
   - Rate limit: 3-second delays minimum
   - Expected duration: ~90 minutes for 1,800 recipes
   - Monitor for any blocking/errors
   - Save results incrementally (every 100 recipes)

3. **Attribution Enhancement:**
   - James Beard recipes often have chef attribution
   - Extract chef name from author field or page metadata
   - Add "James Beard Foundation" as sourceName
   - Include recipe URL for all attributions
   - Flag recipes from JBF Award winners for special tagging

4. **Quality Review:**
   - Manually review sample of 20-30 recipes
   - Verify ingredient parsing accuracy
   - Check instructions are complete and ordered
   - Validate images loaded correctly
   - Document any systematic issues

**Deliverables per Source:**
- URL discovery script (./scripts/discover/{source}.py)
- Complete URL list (./data/urls/{source}-urls.txt)
- Extracted recipes (./data/imports/{source}-recipes.json)
- Extraction log with timestamps and stats
- Attribution verification report
- Quality assessment with sample review

**Expected Outputs:**
- James Beard: 1,000-1,500 recipes
- Jacques Pépin: 300-500 recipes
- Ina Garten: 200-300 recipes
- Food52: 500-800 recipes (select curated/awarded)
- Serious Eats: 300-500 recipes (focus on tested recipes)
- CIA: 300-500 recipes

**Phase 3 Total Expected Output:** 1,000-2,000 prestige recipes (varies by ToS approvals)

---

## Phase 4: Specialized Cuisine Sources (Weeks 4-8)

**Goal**: Fill diversity gaps with 1,500-2,000 culturally authentic recipes

### Task 4.1-4.7: Cuisine-Specific Extraction

**Process applies to all specialized cuisine sources below**

**General Implementation Pattern:**

1. **Source identification and ToS review:**
   - Review robots.txt for each source
   - Check for Schema.org markup presence
   - Document any scraping restrictions
   - Verify site allows educational/indexing use

2. **URL discovery:**
   - Build discovery script per source
   - Handle site-specific navigation (categories, tags, archives)
   - Extract all recipe page URLs
   - Save to ./data/urls/cuisine/{cuisine}-{source}-urls.txt

3. **Extraction with SchemaRecipeScraper:**
   - Use recipe-scrapers library for Schema.org sites
   - Fall back to custom parsing for non-Schema.org sites
   - Apply 2-second rate limiting minimum
   - Schedule during off-peak hours

4. **Metadata enrichment:**
   - Add cuisine type (Thai, African, Latin American, etc.)
   - Add region/subregion if applicable
   - Add cultural context field where relevant
   - Preserve author/chef attribution
   - Mark as culturally authentic source

5. **Quality validation:**
   - Verify ingredient names use authentic terminology
   - Check instructions reference traditional techniques
   - Validate against known dishes from that cuisine
   - Flag any Americanized versions for review

**Task 4.1: Asian Cuisine Extraction**

**Sources:**
- EzyThaiCooking: `ezythaicooking.com` (200+ recipes)
- Temple of Thai: `templeofthai.com/recipes` (100+ recipes)
- Chef Lola's Kitchen (Asian section): `cheflolaskitchen.com`

**Implementation:**
- EzyThaiCooking has categories: appetizers, soups, curries, stir-fries, desserts
- Discover URLs from each category page
- Extract cultural context from recipe descriptions
- Tag with "Authentic Thai home cooking"
- Save to ./data/imports/cuisine/thai-*.json

**Expected Output:** 300-400 Thai recipes

**Task 4.2: African Cuisine Extraction**

**Sources:**
- Chef Lola's Kitchen: `cheflolaskitchen.com/african-recipes`
- Yummy Medley: `yummymedley.com/category/african-cuisine/west-african-food-recipes`

**Implementation:**
- Chef Lola organizes by country (Nigerian, Ghanaian, Kenyan, Ethiopian, Moroccan, South African)
- Extract each country category separately
- Add region metadata (West African, East African, North African)
- Preserve traditional ingredient names
- Document cultural significance where mentioned
- Save combined to ./data/imports/cuisine/african-recipes.json

**Expected Output:** 200-300 African recipes

**Task 4.3: Latin American Cuisine Extraction**

**Sources:**
- LANIC Network: `lanic.utexas.edu/la/region/food/` (directory of sites)
- Jewish Food Society Latin American: `jewishfoodsociety.org/collections/latin-american`

**Implementation for LANIC:**
- LANIC is curated directory, not recipe host
- Extract all linked recipe site URLs
- Review each linked site for ToS compliance
- Prioritize university and cultural organization sites
- Save vetted site list to ./data/legal/lanic-approved-sites.json
- Scrape only approved sites

**Implementation for Jewish Food Society:**
- Small curated collection (~20 recipes)
- High cultural value - diaspora fusion
- Extract with standard SchemaRecipeScraper
- Add metadata: "Jewish-Latin American Diaspora"
- Include family stories if present in descriptions
- Save to ./data/imports/cuisine/latin-jewish-diaspora.json

**Expected Output:** 300-400 Latin American recipes

**Task 4.4: Indigenous North American Cuisine**

**Sources:**
- First Nations Development Institute: `firstnations.org/knowledge-center/recipes`
- NATIFS: `natifs.org/resources`
- University of Kansas: `aihd.ku.edu/recipes`

**Implementation:**
- First Nations provides PDF cookbooks
- Download PDFs from resources page
- Use PyPDF2 or pdfminer to extract text
- Parse recipe format (varies by cookbook)
- May require OCR for scanned PDFs
- Extract traditional ingredient names
- Add metadata: cuisine="Indigenous North American", foodSovereignty=true
- Document tribal affiliation if specified
- Save to ./data/imports/cuisine/indigenous-recipes.json

**Expected Output:** 150-200 Indigenous recipes

**Task 4.5: Middle Eastern Cuisine**

**Sources:**
- Feasting At Home: `feastingathome.com/category/ethnic-cuisine/middle-eastern-recipes`
- Fufu's Kitchen: `fufuskitchen.com`

**Implementation:**
- Both sources use Schema.org markup
- Feasting At Home: Lebanese, Israeli, Turkish, Persian focus
- Fufu's Kitchen: Palestinian specialization with cultural stories
- Extract cultural context from post content
- Flag recipes with traditional preparation methods
- Save to ./data/imports/cuisine/middle-eastern-recipes.json

**Expected Output:** 200-250 Middle Eastern recipes

**Task 4.6: Nordic/Scandinavian Cuisine**

**Sources:**
- Nordic Food Living: `nordicfoodliving.com`
- True North Kitchen: `true-north-kitchen.com`

**Implementation:**
- Nordic Food Living covers Denmark, Norway, Sweden, Finland, Iceland
- Extract country-specific tags from posts
- Note New Nordic cuisine approach vs traditional
- Include foraging and preservation techniques
- Save to ./data/imports/cuisine/nordic-recipes.json

**Expected Output:** 150-200 Nordic recipes

**Task 4.7: Eastern European Cuisine**

**Sources:**
- Natasha's Kitchen: `natashaskitchen.com/category/russianukrainian`
- Where Is My Spoon: `whereismyspoon.co/category/other-recipes-by-region/eastern-europe`

**Implementation:**
- Natasha's Kitchen: Russian, Ukrainian, Eastern European
- Where Is My Spoon: Romanian, Polish, Croatian, Russian, Serbian
- Note regional variations in recipe metadata
- Preserve traditional dish names in native languages
- Extract family/cultural stories from post content
- Save to ./data/imports/cuisine/eastern-european-recipes.json

**Expected Output:** 200-250 Eastern European recipes

**Phase 4 Total Expected Output:** 1,500-2,000 culturally diverse recipes

**Deliverables for Phase 4:**
- ./data/imports/cuisine/{cuisine}-recipes.json for each cuisine
- URL discovery scripts for each source
- Cultural metadata extraction documentation
- Attribution verification for all sources
- Combined cuisine diversity report

---

## Phase 5: Data Processing & Quality Assurance (Ongoing)

**Goal**: Validate, transform, and import all extracted recipes with quality controls

### Task 5.1: Data Validation Pipeline

**Build comprehensive validation system**

**Create validation schema using Zod or similar:**
- Title: string, 3-200 characters, required
- Description: string, optional
- Ingredients: array of objects, minimum 2 items, each with name (required), amount (optional), unit (optional)
- Instructions: array of strings, minimum 2 steps, required
- Prep time: positive number, optional
- Cook time: positive number, optional
- Servings: number or string, optional
- Cuisine: string, optional
- Category: string, optional
- Tags: array of strings, optional
- Image URL: valid URL format, optional
- Source URL: valid URL format, required
- Source name: string, required
- License: enum of allowed types (PUBLIC_DOMAIN, CC_BY, EDUCATIONAL_USE, etc.), required
- Author: string, optional
- Nutrition: object with optional fields (calories, protein, carbs, fat, fiber, sodium), all numbers

**Validation process:**
1. Load JSON file of imported recipes
2. For each recipe, attempt to parse against schema
3. Collect valid recipes in one array
4. Collect invalid recipes with error details in separate array
5. Track statistics: missing images, missing nutrition, missing instructions
6. Generate validation report with counts and percentages

**Validation report structure:**
- Total recipes processed
- Valid recipe count and percentage
- Invalid recipe count with error breakdowns
- Missing data analysis (images, nutrition, instructions)
- Per-source validation rates
- Recommendations for improvement

**Run validation on all import files:**
- Use glob pattern to find all ./data/imports/**/*.json files
- Validate each file separately
- Generate per-file reports
- Create master validation summary
- Save to ./data/validation/validation-report.json

**Deliverables:**
- Validation schema definition
- Validation script that processes all imports
- Per-file validation reports
- Master validation summary report
- Error log with specific validation failures

### Task 5.2: Database Import Pipeline

**Build import system that loads validated recipes into PostgreSQL**

**Import workflow:**
1. Run validation first to ensure data quality
2. Load only valid recipes (skip invalid)
3. Check for duplicates by sourceUrl before inserting
4. Create or find chef/author records
5. Insert recipe main record
6. Insert associated ingredients (with linking table)
7. Insert nutrition data if available
8. Log import progress and errors

**Duplicate handling:**
- Query database for existing recipe with same sourceUrl
- If found, skip with log message
- Prevents re-importing same recipe from multiple runs
- Tracks skipped duplicates in import report

**Chef/author management:**
- Search for existing chef by name
- If not found, create new chef record with: name, biography (generic), isVerified=false
- Return chef ID for recipe linkage
- Accumulate chefs during import for batch efficiency

**Ingredient linkage:**
- For each recipe ingredient, search ingredients table by name
- If not found, create new ingredient record
- Insert into recipe_ingredients junction table with: recipeId, ingredientId, amount, unit
- Handle missing amounts/units gracefully (store as null)

**Batch processing:**
- Import recipes in batches of 50 to manage memory and transactions
- Commit each batch separately
- Log progress after each batch
- Continue on individual recipe errors

**Import all validated files:**
- Glob pattern for all ./data/imports/**/*.json
- Process each file in sequence
- Track total recipes imported across all files
- Generate final import summary report

**Deliverables:**
- Database import script with batch processing
- Duplicate detection logic
- Chef/author management system
- Ingredient linkage system
- Import progress logging
- Final import summary with statistics

### Task 5.3: Attribution Tracking System

**Build system to verify and track attribution compliance**

**Attribution record structure:**
- Recipe ID
- Source URL (must be present)
- Source name (must be present)
- Author name (optional but tracked)
- License type (must be valid enum)
- Scraped timestamp
- Last verified timestamp
- Attribution displayed (boolean - verified in UI)
- Attribution text (formatted string for display)

**Generate attribution report:**
- Query all recipes from database
- Group by license type - count recipes per license
- Group by source name - count recipes per source
- Identify recipes missing required attribution fields
- Flag recipes requiring legal review (ACADEMIC_USE, EDUCATIONAL_USE licenses)
- Calculate attribution completeness percentage

**Report structure:**
- Total recipes in database
- Breakdown by license type (counts and percentages)
- Breakdown by source name (counts)
- List of recipe IDs with missing attribution
- List of recipe IDs requiring legal review
- Recommendations for fixing attribution gaps

**Attribution verification:**
- For given recipe ID, check all required fields present
- sourceUrl: must be valid URL
- sourceName: must be non-empty string
- license: must be from valid enum
- Return true if all present, false otherwise

**Run regular attribution audits:**
- Schedule weekly or before major releases
- Generate updated attribution report
- Flag any new gaps since last audit
- Track improvement over time

**Deliverables:**
- Attribution tracking data model
- Attribution report generator
- Attribution verification function
- Audit scheduling documentation
- Attribution completeness dashboard

### Task 5.4: Quality Control Dashboard

**Build internal admin dashboard for monitoring import quality**

**Dashboard sections:**

**1. Validation Status Section:**
- Display total recipes across all sources
- Show valid recipe count and percentage
- Show invalid recipe count
- Highlight validation rate (target >95%)
- Color-code by quality level (green/yellow/red)

**2. Attribution Status Section:**
- Count of recipes with complete attribution
- Count of recipes missing attribution fields
- Count of recipes requiring legal review
- Public domain recipe count (lowest risk)
- Color-code by compliance level

**3. Source Breakdown Table:**
- List all sources alphabetically
- For each: recipe count, license type, validation rate, attribution status
- Sortable columns
- Filter by license type or status
- Export to CSV capability

**4. Recent Imports View:**
- Show last 100 imported recipes
- Display: title, source, chef, import date, validation status
- Link to recipe detail page
- Filter and search capabilities

**5. Data Quality Metrics:**
- Percentage with images (target >80%)
- Percentage with nutrition data (target >60%)
- Percentage with complete instructions
- Average ingredients per recipe
- Average steps per recipe

**6. Actions Panel:**
- Button to run validation on all imports
- Button to generate attribution report
- Button to re-import specific source
- Button to export quality metrics

**Technical implementation:**
- Create Next.js admin route at /admin/quality-control
- Require authentication (admin role only)
- Query database for all statistics
- Load validation reports from file system
- Load attribution reports from file system
- Render with responsive tables and charts
- Update in real-time or on-demand refresh

**Deliverables:**
- Quality control dashboard UI
- Real-time statistics calculations
- Report loading and display
- Admin authentication and access control
- Export functionality for reports

---

## Phase 6: Integration Testing & Deployment (Week 10)

**Goal**: Verify complete pipeline and prepare for production

### Task 6.1: End-to-End Testing

**Test complete import pipeline:**

**Unit tests:**
- Validation schema correctly identifies valid/invalid recipes
- Database import handles duplicates correctly
- Chef/author creation and lookup works
- Ingredient linkage creates proper associations
- Attribution tracking captures all required fields

**Integration tests:**
- Complete workflow: scrape → validate → import → verify
- Use test dataset of 50-100 recipes
- Verify all recipes appear in database
- Verify attribution display on frontend
- Verify search functionality finds imported recipes
- Verify chef pages link to their recipes

**Test specific sources:**
- USDA recipes import correctly with PUBLIC_DOMAIN license
- TheMealDB recipes have PATREON_SUPPORTER license
- Prestige chef recipes have proper attribution
- Cuisine-specific recipes have correct metadata

**Performance tests:**
- Validation runs in reasonable time (<1 minute per 1000 recipes)
- Import performance acceptable (<5 minutes per 1000 recipes)
- Database queries remain fast with 10,000+ recipes
- Frontend recipe loading performs well

**Create automated test suite:**
- Tests run on CI/CD pipeline
- Test data fixtures included in repo
- Mock external APIs (TheMealDB, USDA FoodData)
- Assertions for expected counts and data quality

**Deliverables:**
- Complete test suite with unit and integration tests
- Test data fixtures
- CI/CD pipeline configuration
- Performance benchmarks
- Test coverage report

### Task 6.2: Production Deployment Checklist

**Pre-deployment verification:**

**Legal Compliance:**
- [ ] All ToS reviews documented in ./data/legal/
- [ ] Attribution displayed correctly on all recipe pages (spot check 50 recipes)
- [ ] robots.txt compliance verified for all scraped sources
- [ ] Partnership agreements in place (if applicable)
- [ ] License types clearly marked in database
- [ ] No recipes from prohibited sources

**Data Quality:**
- [ ] Validation report shows >95% valid recipes
- [ ] All recipes have sourceName and sourceUrl
- [ ] Zero duplicate recipes (same sourceUrl)
- [ ] Images present for >80% of recipes
- [ ] Nutrition data present for >60% of recipes
- [ ] All prestige sources properly attributed

**Technical:**
- [ ] Database indexes created on: title, cuisine, sourceName, license, chefId
- [ ] Semantic search embeddings generated for all recipes
- [ ] Image URLs tested and functional
- [ ] CDN configured for image serving (Vercel/Cloudflare)
- [ ] Rate limiting enabled on all API endpoints
- [ ] Error tracking configured (Sentry or similar)
- [ ] Performance monitoring active (Vercel Analytics)

**Content:**
- [ ] 10,000+ recipes imported
- [ ] Diversity goals met: Asian, African, Latin, Indigenous, Middle Eastern, Nordic, Eastern European all represented
- [ ] Celebrity chef recipes properly attributed with chef pages
- [ ] Public domain recipes clearly marked
- [ ] Quality ratings calculated for all recipes
- [ ] All chef profiles linked to their recipes

**Testing:**
- [ ] Recipe search returns relevant results
- [ ] Attribution links work correctly
- [ ] Mobile responsiveness tested on iOS and Android
- [ ] Load testing completed (simulated 1000 concurrent users)
- [ ] SEO metadata present on all recipe pages
- [ ] Accessibility spot checks passed (WCAG critical issues)

**Documentation:**
- [ ] User guide written (how to search, browse, use features)
- [ ] FAQ document created
- [ ] Privacy policy includes data sources
- [ ] Terms of service updated
- [ ] Admin documentation for managing imports

**Monitoring Setup:**
- [ ] Error tracking alerts configured
- [ ] Performance alerts configured
- [ ] Database backup schedule configured
- [ ] Uptime monitoring active
- [ ] Usage analytics dashboards created

**Deployment Process:**
1. Run final validation on all imports
2. Import all validated recipes to production database
3. Generate production embeddings for semantic search
4. Verify search functionality works
5. Spot check 100 random recipes for attribution
6. Test mobile experience on actual devices
7. Run load testing
8. Enable monitoring and alerts
9. Deploy to production (Vercel or similar)
10. Verify production environment
11. Monitor for first 24 hours continuously

**Rollback Plan:**
- Database backup taken before import
- Ability to restore previous state if critical issues found
- Feature flags to disable new recipes if needed
- Documented rollback procedure

**Post-Deployment:**
- Monitor error rates for first week
- Track search query patterns
- Monitor performance metrics
- Gather user feedback
- Plan v1.1 features based on usage

**Deliverables:**
- Completed pre-deployment checklist
- Deployment runbook
- Rollback procedure documentation
- Monitoring dashboard
- Post-deployment report after first week

---

## Appendix A: Required File Structure

**Create these directories:**
```
./data/
├── imports/              # Raw extracted recipe JSONs
│   ├── cuisine/         # Specialized cuisine recipes
│   ├── extensions/      # University extension recipes
│   ├── prestige/        # Celebrity chef recipes
│   └── ...
├── urls/                # Discovered recipe URLs
│   ├── cuisine/
│   └── ...
├── validation/          # Validation reports
├── attribution/         # Attribution reports
└── legal/               # ToS reviews and decisions

./scripts/
├── extract/             # Python extraction scripts
├── discover/            # URL discovery scripts
├── validate/            # Validation scripts
├── import/              # Database import scripts
└── legal/               # ToS checking scripts
```

## Appendix B: Environment Variables Required

```
# Firecrawl
FIRECRAWL_API_KEY=

# Recipe APIs
THEMEALDB_API_KEY=
USDA_FOODDATA_API_KEY=
NUTRITIONIX_APP_ID=
NUTRITIONIX_APP_KEY=

# Database
DATABASE_URL=

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

## Appendix C: Success Metrics

**Track these metrics throughout extraction process:**

**Volume Metrics:**
- Total recipes extracted: Target 10,000+
- Public domain recipes: 3,500-4,000
- API recipes: 300-500
- Prestige sources: 1,000-2,000
- Specialized cuisines: 1,500-2,000

**Quality Metrics:**
- Validation pass rate: Target >95%
- Recipes with images: Target >80%
- Recipes with nutrition: Target >60%
- Complete attribution: Target 100%

**Diversity Metrics:**
- Cuisines represented: Target 20+
- Geographic diversity: All continents
- Chef attribution: 1,000+ unique chefs
- Cultural context documented: Target 30%

**Legal Metrics:**
- Public domain recipes: 35%+
- Licensed API recipes: 3-5%
- Ethically scraped with attribution: 60%+
- Zero prohibited sources: 100%

**Performance Metrics:**
- Extraction time: <10 hours total compute
- Validation time: <1 hour for all
- Import time: <2 hours for 10,000 recipes
- Search performance: <100ms average