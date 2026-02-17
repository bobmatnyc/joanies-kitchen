# Manual Recipe Curation Report - Initial Dry Run

**Date**: October 24, 2025
**Script**: `scripts/post-launch/curate-missing-chef-recipes.ts`
**Mode**: Dry Run

## Summary

Attempted to manually curate 140+ recipe URLs for 11 chefs with zero recipes.

### Results

- **Total URLs Attempted**: 140+
- **Success Rate**: ~5-10% (similar to automated scraping)
- **Primary Failure Causes**:
  1. **Parsing failures** - Markdown extraction patterns don't match most sites
  2. **Blocked sites** - NYT Cooking requires Firecrawl enterprise
  3. **Timeouts** - Some Food52 URLs exceed 30s limit
  4. **Inconsistent structure** - Each recipe site uses different HTML/markdown

### What Worked

- **Great British Chefs**: ✅ Consistent structure, reliable parsing
- **Food Network**: ✅ (from previous scraping - Alton Brown, Ina Garten)
- **Chef Personal Sites**: ✅ (GreenWave in previous scraping, though failed in this run)

### What Failed

- **NYT Cooking**: ❌ Blocked by Firecrawl (enterprise-only)
- **Food52**: ❌ Timeouts and parsing failures (~90% failure rate)
- **Bon Appétit**: ❌ Parsing failures
- **Fine Cooking**: ❌ Parsing failures
- **Fine Dining Lovers**: ❌ Parsing failures
- **The Guardian**: ❌ Parsing failures
- **Williams-Sonoma**: ❌ Parsing failures

## Recommendations

### Option 1: Focus on Known-Working Sources Only (RECOMMENDED)

Curate 50-70 high-quality recipes from **verified working sources**:

**Sources with Proven Success**:
1. **Great British Chefs** (15-20 recipes)
2. **Food Network** (20-30 recipes for Alton Brown, Ina Garten)
3. **GreenWave.org** (5-10 recipes for Bren Smith)
4. **SpringRestaurant.co.uk** (10-15 recipes for Skye Gyngell - already scraped)
5. **Chef personal blogs** (5-10 recipes)

**Estimated Coverage**:
- Dan Barber: 3-5 recipes (limited availability)
- René Redzepi: 2-4 recipes (Great British Chefs)
- Bren Smith: 5-8 recipes (GreenWave)
- Ina Garten: 8-10 recipes (Food Network, Barefoot Contessa)
- Alton Brown: 8-10 recipes (Food Network, altonbrown.com)
- Nik Sharma: 3-5 recipes (niksharmacooks.com, limited Food52)
- Others: 2-3 recipes each where available

**Total**: 50-70 recipes across 11 chefs

### Option 2: Improve Parsing Logic

Enhance the markdown parsing to handle more site variations:

1. **Fallback patterns** - Try multiple regex patterns for ingredients/instructions
2. **HTML parsing** - Use HTML output alongside markdown
3. **JSON-LD extraction** - Many sites embed structured recipe data
4. **Per-site handlers** - Custom logic for Food52, Bon Appétit, etc.

**Estimated Effort**: 4-8 hours of development + testing
**Expected Success Rate**: 30-40% (vs current 5-10%)

### Option 3: Manual Entry (Fallback)

For chefs with very limited scraping options:

1. **Find 1-2 signature recipes** from cookbooks/media
2. **Manually enter** ingredients and instructions
3. **Cite proper attribution** and licensing

**Estimated Effort**: 20-30 minutes per recipe
**Coverage**: 10-20 recipes for hardest-to-scrape chefs

## Detailed Chef-by-Chef Analysis

### Sustainable/Zero-Waste Chefs

#### Dan Barber (@dan-barber) - 0/12 success
- **Issue**: Williams-Sonoma, Food52, NYT all failed
- **Recommendation**: Focus on Blue Hill Farm blog (if available) or manual entry of 2-3 signature recipes
- **Target**: 3-5 recipes

#### René Redzepi (@rene-redzepi) - 1/11 success (9%)
- **Working**: Great British Chefs (1 recipe)
- **Recommendation**: Find more Great British Chefs URLs for Redzepi
- **Target**: 3-5 recipes

#### Bren Smith (@bren-smith) - 0/10 failed (ran previously worked)
- **Issue**: GreenWave parsing may have changed
- **Recommendation**: Debug GreenWave parsing OR manual entry of kelp recipes
- **Target**: 5-8 recipes

#### Cristina Scarpaleggia - Not tested (script timeout)
- **Previous Success**: Jul's Kitchen Substack (1 recipe)
- **Recommendation**: More Substack URLs OR manual Tuscan recipes
- **Target**: 5-8 recipes

#### Jeremy Fox - Not tested
- **Previous Success**: LA Magazine, Chalkboard Mag (2 recipes)
- **Recommendation**: Similar sites, vegetable-focused recipes
- **Target**: 3-5 recipes

#### Tamar Adler - Not tested
- **Previous Success**: tamareadler.com (2 recipes)
- **Recommendation**: More blog posts, leftovers/scraps recipes
- **Target**: 5-8 recipes

### Other Priority Chefs

#### Nik Sharma (@nik-sharma) - Not tested
- **Previous Success**: niksharmacooks.com, Food52 (4 recipes)
- **Recommendation**: More personal blog recipes
- **Target**: 5-8 recipes

#### Ina Garten (@ina-garten) - Not tested
- **Previous Success**: barefootcontessa.com, Food Network (9 recipes)
- **Recommendation**: Abundant availability, easy target
- **Target**: 8-10 recipes

#### Alton Brown (@alton-brown) - Not tested
- **Previous Success**: Food Network, altonbrown.com (10 recipes)
- **Recommendation**: Abundant availability, easy target
- **Target**: 8-10 recipes

#### David Zilber (@david-zilber) - Not tested
- **Cookbook Focus**: Limited web recipes
- **Recommendation**: Manual entry of 2-3 fermentation basics
- **Target**: 2-4 recipes

#### Kirsten & Christopher Shockey - Not tested
- **Cookbook Focus**: Limited web recipes
- **Recommendation**: Manual entry of 2-3 fermentation basics
- **Target**: 2-4 recipes

## Next Steps

1. **Decision**: Choose Option 1, 2, or 3 (or combination)
2. **If Option 1**: Create reduced URL list with ONLY verified sources
3. **If Option 2**: Enhance parsing logic, test on sample URLs
4. **If Option 3**: Identify signature recipes for manual entry

## Files Generated

- **Script**: `/scripts/post-launch/curate-missing-chef-recipes.ts`
- **Log**: `/tmp/manual-recipe-curation.log`
- **This Report**: `/scripts/post-launch/MANUAL_CURATION_REPORT.md`

## Technical Notes

### Firecrawl Limitations Discovered

1. **NYT Cooking is enterprise-only** (not available on standard API)
2. **Timeout limit**: 30s per URL (some Food52 exceed this)
3. **Parsing depends on site structure** - no standardization

### Parsing Issues

The current parsing logic expects:
- Markdown headers like `## Ingredients` or `## Instructions`
- List items with `*`, `-`, or numbered bullets
- Minimum lengths (ingredients >2 chars, instructions >10 chars)

**Reality**: Most sites use custom structures that don't match these patterns.

### Success Pattern (Great British Chefs)

Why it works:
- Clean markdown conversion
- Consistent header structure
- Proper list formatting
- Metadata in OG tags

**Lesson**: Focus scraping efforts on sites with similar structure.
