# Chefs Needing Recipe Scraping - Analysis Report

**Generated:** 2025-10-23
**Analysis Script:** `scripts/find-chefs-needing-recipes.ts`

---

## Executive Summary

**15 active, verified chefs** in the database currently have **zero recipes** and require content acquisition through ethical scraping, licensing partnerships, or manual curation.

**Key Findings:**
- ✅ All 15 chefs are verified and have websites
- 🌱 **9 of 15 (60%)** are sustainability-focused chefs (perfect mission alignment)
- 📋 **Recommended total recipes to scrape: 195** across all chefs
- 🎯 **Priority distribution**: 15 HIGH priority, 0 MEDIUM, 0 LOW

---

## Priority Chef Rankings

### 🔴 TIER 1: ZERO-WASTE MISSION LEADERS (Highest Priority)

These 9 chefs have explicit sustainability credentials and should be prioritized for Joanie's Kitchen's zero-waste pivot:

#### 1. Anne-Marie Bonneau (@anne-marie-bonneau) ⭐ **HIGHEST PRIORITY**
- **Priority Score**: 66 (highest)
- **Website**: https://www.zerowastechef.com
- **Sustainability Focus**: Zero-waste, fermentation, sourdough, plastic-free, waste-reduction, condiments
- **Recipe Recommendation**: 15 recipes
- **Rationale**:
  - Author of "The Zero-Waste Chef" book
  - 300-400+ recipes available on website with Schema.org markup
  - **PERFECT mission alignment** with Joanie's Kitchen
  - Explicit zero-waste expertise (not just sustainable, but zero-waste focused)
- **Scraping Approach**:
  - ⚠️ **Permission required** (WordPress.com ToS restricts commercial scraping)
  - Contact via zerowastechef.com/about/
  - Tool: recipe-scrapers Python library (WPRM plugin supported)
  - Rate limit: 5-10 requests/minute
- **Status**: See sustainable-chefs.md for detailed implementation plan

---

#### 2. Dan Barber (@dan-barber)
- **Priority Score**: 36
- **Website**: https://www.bluehillfarm.com
- **Sustainability Focus**: Farm-to-table, regenerative agriculture, biodiversity, nose-to-tail, seed-saving
- **Recipe Recommendation**: 15 recipes
- **Rationale**: Blue Hill at Stone Barns pioneer, "The Third Plate" author
- **Scraping Approach**:
  - ❌ **Restaurant promotional site - 0 recipes available**
  - ✅ **Alternative**: Cookbook licensing ("The Third Plate") or partnership for Food for Soul content
  - Contact: Williams-Sonoma published recipes (~5 available)
- **Status**: Cookbook licensing recommended

---

#### 3. René Redzepi (@rene-redzepi)
- **Priority Score**: 36
- **Website**: https://noma.dk
- **Sustainability Focus**: Nordic cuisine, foraging, fermentation, seasonal, local
- **Recipe Recommendation**: 15 recipes
- **Rationale**: Noma (3 Michelin stars, #1 World's 50 Best 5x), New Nordic cuisine pioneer
- **Scraping Approach**:
  - ❌ **Password-protected recipes + explicit ToS prohibition**
  - ✅ **Alternative**: License "The Noma Guide to Fermentation" (100+ recipes)
  - Publisher: Artisan/Hachette
- **Status**: Cookbook licensing required

---

#### 4. Skye Gyngell (@skye-gyngell)
- **Priority Score**: 36
- **Website**: https://springrestaurant.co.uk
- **Sustainability Focus**: Seasonal, organic, simple, vegetables, British
- **Recipe Recommendation**: 15 recipes
- **Rationale**: Australian chef, "Spring" cookbook author, former Petersham Nurseries head chef
- **Scraping Approach**:
  - ❌ **Restaurant site - 1-2 recipes only**
  - ⚠️ **Alternative**: Great British Chefs has 10-20 Skye Gyngell recipes (scrapable with attribution)
  - ✅ **Best option**: Cookbook licensing (4 books, 300-400 recipes total)
- **Status**: Multi-source approach (GBC + cookbook licensing)

---

#### 5. Bren Smith (@bren-smith)
- **Priority Score**: 26
- **Website**: https://www.greenwave.org
- **Sustainability Focus**: Ocean-farming, seaweed, bycatch, regenerative aquaculture, climate
- **Recipe Recommendation**: 15 recipes
- **Rationale**: GreenWave founder, regenerative ocean farming pioneer
- **Scraping Approach**:
  - ⚠️ **Educational nonprofit site - limited recipe content**
  - ✅ **Partnership approach**: Contact for original recipe development focusing on bycatch/seaweed
- **Status**: Partnership recommended

---

#### 6. Cristina Scarpaleggia (@cristina-scarpaleggia)
- **Priority Score**: 26
- **Website**: https://www.tuscanvistas.com
- **Sustainability Focus**: Cucina povera (peasant cooking), Tuscan tradition, seasonal
- **Recipe Recommendation**: 15 recipes
- **Rationale**: Tuscan food writer, "Cucina Povera" cookbook author
- **Scraping Approach**:
  - ⚠️ **Note**: Website is tuscanvistas.com (not julskitchen.com - see Giulia Scarpaleggia below)
  - Check website for recipe availability
- **Status**: Needs verification - may be confused with Giulia Scarpaleggia

---

#### 7. Jeremy Fox (@jeremy-fox)
- **Priority Score**: 26
- **Website**: https://www.rusticcanyonrestaurant.com
- **Sustainability Focus**: Vegetables, California cuisine, seasonal, Michelin-starred, technique
- **Recipe Recommendation**: 15 recipes
- **Rationale**: Rustic Canyon chef/owner, "On Vegetables" author, former Ubuntu Michelin star chef
- **Scraping Approach**:
  - ❌ **Restaurant site with explicit anti-scraping ToS - 0 recipes**
  - ⭐ **EXCELLENT COOKBOOK OPPORTUNITY**: "On Vegetables" (160 recipes) + "On Meat" (160 recipes) = **320 total**
  - Publisher: Phaidon Press
  - **Highest cookbook ROI**
- **Status**: Cookbook licensing (top priority)

---

#### 8. Massimo Bottura (@massimo-bottura)
- **Priority Score**: 26
- **Website**: https://www.osteriafrancescana.it
- **Sustainability Focus**: Food waste, surplus ingredients, social impact, Italian, modern
- **Recipe Recommendation**: 15 recipes
- **Rationale**: Osteria Francescana (3 Michelin stars, #1 World's 50 Best), Food for Soul founder
- **Scraping Approach**:
  - ❌ **Restaurant promotional site - 0 free recipes**
  - ✅ **"Bread is Gold" licensing** (150+ surplus ingredient recipes, royalties support Food for Soul)
  - Publisher: Phaidon Press
- **Status**: Cookbook licensing (mission-aligned)

---

#### 9. Tamar Adler (@tamar-adler)
- **Priority Score**: 26
- **Website**: https://tamareadler.com
- **Sustainability Focus**: Leftovers, scraps, intuitive cooking, philosophy, economy
- **Recipe Recommendation**: 15 recipes
- **Rationale**: "An Everlasting Meal" author, leftover transformation specialist
- **Scraping Approach**:
  - ❌ **Portfolio site - 0 recipes**
  - ✅ **Cookbook licensing**: "The Everlasting Meal Cookbook" (1,500+ recipe ideas)
  - Publisher: Simon & Schuster
- **Status**: Cookbook licensing

---

### 🟡 TIER 2: FEATURED CHEFS (High Visibility)

These 6 chefs are verified and have websites but lack explicit sustainability tags. Still high priority for platform visibility:

#### 10. Alton Brown (@alton-brown)
- **Priority Score**: 16
- **Website**: https://altonbrown.com
- **Specialties**: American, Food Science, Technique, Baking
- **Recipe Recommendation**: 10 recipes
- **Rationale**: Food Network personality, food science educator
- **Scraping Approach**: Check website for recipe availability
- **Status**: Needs investigation

---

#### 11. Bryant Terry (@bryant-terry)
- **Priority Score**: 16
- **Website**: https://www.bryant-terry.com
- **Specialties**: Afro-vegan, plant-based, cultural storytelling, justice, vegetables
- **Recipe Recommendation**: 10 recipes
- **Rationale**: James Beard winner, "Vegetable Kingdom" author
- **Scraping Approach**: Website check + cookbook licensing
- **Status**: Needs investigation

---

#### 12. David Zilber (@david-zilber)
- **Priority Score**: 16
- **Website**: https://www.instagram.com/david.zilber
- **Specialties**: Fermentation, koji, miso, preservation, science
- **Recipe Recommendation**: 10 recipes
- **Rationale**: Former Noma fermentation lab head, "The Noma Guide to Fermentation" co-author
- **Scraping Approach**:
  - ❌ **Instagram link - not a recipe website**
  - ✅ **Cookbook licensing**: Co-author of "The Noma Guide to Fermentation"
- **Status**: Cookbook licensing

---

#### 13. Ina Garten (@ina-garten)
- **Priority Score**: 16
- **Website**: https://barefootcontessa.com
- **Specialties**: American, comfort food, entertaining, simple elegance, baking
- **Recipe Recommendation**: 10 recipes
- **Rationale**: Barefoot Contessa, bestselling cookbook author
- **Scraping Approach**:
  - ⚠️ **Food Network website with extensive recipe database**
  - Check terms of service for scraping permissions
  - Alternative: Cookbook licensing (10+ bestselling books)
- **Status**: Needs legal review

---

#### 14. Kirsten and Christopher Shockey (@kirsten-christopher-shockey)
- **Priority Score**: 16
- **Website**: https://www.thefermentationschool.com
- **Specialties**: Fermentation, vegetables, preservation, live culture, teaching
- **Recipe Recommendation**: 10 recipes
- **Rationale**: "Fermented Vegetables" authors, fermentation experts (250K+ books sold)
- **Scraping Approach**:
  - ⚠️ **Educational platform - 10-15 blog recipes**
  - ⭐ **EXCELLENT BOOK LICENSING**: "Fermented Vegetables" (120 recipes) + 4 other books (400+ total)
  - Publisher: Storey Publishing/Hachette
- **Status**: Cookbook licensing (highest fermentation content ROI)

---

#### 15. Nik Sharma (@nik-sharma)
- **Priority Score**: 16
- **Website**: https://www.abrowntable.com
- **Specialties**: Science, flavor, photography, fusion, Indian-American
- **Recipe Recommendation**: 10 recipes
- **Rationale**: James Beard winner, "Season" and "The Flavor Equation" author
- **Scraping Approach**:
  - Website has recipe blog
  - Check Schema.org markup and scraping permissions
  - Alternative: Cookbook licensing (2 published books)
- **Status**: Needs investigation

---

## Summary Statistics

### Recipe Acquisition Breakdown
| Priority | Chefs | Recommended Recipes | Total |
|----------|-------|---------------------|-------|
| **HIGH (Sustainability)** | 9 | 15 each | 135 |
| **HIGH (Featured)** | 6 | 10 each | 60 |
| **TOTAL** | **15** | - | **195** |

### Content Acquisition Strategy
| Method | Chefs | Estimated Recipes | Notes |
|--------|-------|-------------------|-------|
| **Permission-based scraping** | 2-3 | 50-100 | Bonneau, Garten (if approved) |
| **Cookbook licensing** | 6-8 | 800-1,200 | Fox, Shockeys, Redzepi, Bottura, Zilber |
| **Partnership development** | 3-5 | 50-200 | Smith, Terry, custom content |
| **No viable path** | 2-3 | 0 | Restaurant sites with no recipes |

### Sustainability Alignment
- 🌱 **60% of chefs** (9/15) have explicit sustainability credentials
- 🎯 **Perfect mission alignment** with Joanie's Kitchen zero-waste pivot
- ♻️ **Key sustainability themes**: Fermentation, zero-waste, seasonal, regenerative, nose-to-tail, bycatch

---

## Recommended Action Plan

### Phase 1: Immediate Priorities (Nov 1-15, 2025)

**🔴 TOP 3 PRIORITY CHEFS:**

1. **Anne-Marie Bonneau** (Zero-Waste Chef)
   - **Action**: Email permission request via contact form
   - **Timeline**: 1 week for response, 1 week scraping
   - **Yield**: 300-400 recipes (if approved)
   - **Rationale**: HIGHEST mission alignment, most scrapable content

2. **Jeremy Fox** (Cookbook Licensing)
   - **Action**: Contact Phaidon Press for licensing
   - **Timeline**: 4-6 weeks negotiation
   - **Yield**: 320 recipes ("On Vegetables" + "On Meat")
   - **Rationale**: Largest cookbook recipe volume, modern vegetable focus

3. **Kirsten & Christopher Shockey** (Fermentation Experts)
   - **Action**: Contact Storey Publishing/Hachette
   - **Timeline**: 4-6 weeks negotiation
   - **Yield**: 400+ recipes across 5 books
   - **Rationale**: Fermentation authority, bestselling authors

---

### Phase 2: Secondary Priorities (Nov 16-Dec 15, 2025)

4. **René Redzepi** - "The Noma Guide to Fermentation" (100 recipes)
5. **Massimo Bottura** - "Bread is Gold" (150 recipes, mission-aligned)
6. **Skye Gyngell** - Great British Chefs + cookbook licensing (300-400 recipes)
7. **Bren Smith** - Partnership for bycatch/seaweed original content
8. **Nik Sharma** - Website scraping (if permitted) or cookbook licensing

---

### Phase 3: Long-term Partnerships (Jan-Mar 2026)

9. **Bryant Terry** - Afro-vegan expertise, James Beard winner
10. **David Zilber** - Fermentation science (Noma connection)
11. **Ina Garten** - Comfort food/entertaining (mass appeal)
12. **Alton Brown** - Food science education
13. **Dan Barber** - Regenerative agriculture thought leadership
14. **Tamar Adler** - Leftover philosophy
15. **Cristina Scarpaleggia** - Cucina povera (needs clarification vs. Giulia Scarpaleggia)

---

## Legal and Ethical Considerations

### ⚠️ CRITICAL: Permission Requirements

**DO NOT SCRAPE without explicit permission:**
- Anne-Marie Bonneau (WordPress.com ToS)
- Ina Garten (Food Network content)
- Nik Sharma (personal website)
- Any chef without documented consent

**ABSOLUTE NO-GO (Explicit prohibitions):**
- René Redzepi (Noma ToS + password-protected)
- Jeremy Fox (Rustic Canyon ToS)
- Restaurant promotional sites (0 recipes available)

### ✅ Ethical Scraping Checklist

For any approved scraping:
- [ ] Written permission from chef or publisher
- [ ] Attribution template approved by chef
- [ ] Rate limiting implemented (5-10 requests/minute)
- [ ] User agent identification: "JoaniesKitchen-Bot/1.0"
- [ ] robots.txt compliance verified
- [ ] Copyright notices displayed on all recipes
- [ ] Original source URLs linked (rel="nofollow")
- [ ] Image rights secured or platform-generated alternatives used

---

## Technical Implementation

### Scraping Infrastructure Required

**For permission-granted chefs:**

```bash
# Install dependencies
pnpm add recipe-scrapers  # Python library via child_process
pnpm add cheerio          # HTML parsing
pnpm add axios            # HTTP client
pnpm add rate-limiter-flexible  # Rate limiting

# Run scraping script (after permission granted)
pnpm tsx scripts/scrape-chef-recipes.ts [chef-slug] --limit [count]
```

**Database fields already prepared:**
- ✅ `chefs.is_verified` - Sustainability verification badge
- ✅ `recipes.chef_id` - Chef attribution
- ✅ `recipes.source` - Original URL
- ✅ `recipes.license` - License type
- ✅ `chef_recipes` junction table - Chef-recipe links

---

## Success Metrics

### Target Recipe Volume by Quarter

| Quarter | Chefs Integrated | Recipes | Method |
|---------|------------------|---------|--------|
| **Q4 2025 (Nov-Dec)** | 2-3 | 50-150 | Permission scraping + 1 cookbook |
| **Q1 2026 (Jan-Mar)** | 5-7 | 300-500 | 3-4 cookbooks + partnerships |
| **Q2 2026 (Apr-Jun)** | 10-12 | 600-800 | Full licensing portfolio |
| **Q3-Q4 2026** | All 15 | 1,000-1,500 | Complete integration |

### Quality Thresholds
- ✅ **100%** have chef attribution and copyright notices
- ✅ **100%** have source URLs (web recipes)
- ✅ **90%** have prep/cook times and servings
- ✅ **80%** have images (licensed or platform-generated)
- ✅ **70%** have sustainability/zero-waste notes

---

## Conclusion

**Key Takeaways:**

1. ✅ **All 15 chefs are verified and have websites** - Strong foundation
2. 🌱 **60% sustainability-focused** - Perfect zero-waste mission alignment
3. ⚠️ **Web scraping limited** - Only 2-3 chefs viable (with permission)
4. 📚 **Cookbook licensing is primary path** - 6-8 chefs, 800-1,200 recipes
5. 🤝 **Partnership development** - 3-5 chefs, original content
6. 🚀 **Phased approach realistic** - 50-150 by Dec 2025, 1,000+ by end 2026

**Next Steps:**
1. Run `pnpm tsx scripts/find-chefs-needing-recipes.ts` for updated analysis
2. Review sustainable-chefs.md PRD for detailed implementation guide
3. Draft legal permission request templates
4. Contact top 3 priority chefs (Bonneau, Fox publisher, Shockeys publisher)
5. Budget $20-50K for cookbook licensing negotiations

---

**Generated by:** `scripts/find-chefs-needing-recipes.ts`
**Documentation:** See `docs/roadmap/sustainable-chefs.md` for full PRD
**Database Schema:** `src/lib/db/chef-schema.ts`
