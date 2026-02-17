# Recipe Curation Options for 11 Zero-Recipe Chefs

**Date**: October 24, 2025
**Context**: Post-launch manual curation after automated scraping achieved only 10% success rate

---

## Current Situation

**Chefs Needing Recipes**: 11 chefs currently at 0 recipes
- **Sustainable/Zero-Waste** (6 chefs): Dan Barber, René Redzepi, Bren Smith, Cristina Scarpaleggia, Jeremy Fox, Tamar Adler
- **Other Priority** (5 chefs): Nik Sharma, Ina Garten, Alton Brown, David Zilber, Kirsten & Christopher Shockey

**Initial Target**: 100-130 recipes (8-15 per chef)

**Challenge Discovered**: Web scraping success rate is 5-10% due to:
- Inconsistent site structures
- Blocked sites (NYT Cooking requires enterprise Firecrawl)
- Parsing failures (each site uses different HTML/markdown patterns)
- Timeouts (some sites take >30 seconds)

---

## Option 1: High-Confidence Scraping (RECOMMENDED)

**What**: Focus ONLY on sources with proven >50% success rates

**Sources**:
- ✅ Food Network (Alton Brown, Ina Garten) - 90%+ success
- ✅ Great British Chefs - 70-80% success
- ✅ Chef Personal Sites (Nik Sharma, Tamar Adler) - 60-80% success
- ✅ GreenWave.org (Bren Smith) - 60-70% success

**Realistic Yield**: 40-60 recipes across 11 chefs

| Chef | Expected Recipes | Confidence |
|------|------------------|------------|
| Ina Garten | 8-10 | High (Food Network, Barefoot Contessa) |
| Alton Brown | 8-10 | High (Food Network, altonbrown.com) |
| Nik Sharma | 5-6 | High (niksharmacooks.com) |
| Bren Smith | 5-6 | Medium (GreenWave - needs testing) |
| Tamar Adler | 3-4 | Medium (tamareadler.com) |
| Cristina Scarpaleggia | 2-3 | Medium (Jul's Kitchen Substack) |
| Jeremy Fox | 2 | Medium (LA Mag, Chalkboard) |
| René Redzepi | 2-3 | Low (Great British Chefs limited) |
| Dan Barber | 1-2 | Low (very limited availability) |
| David Zilber | 1 | Low (Great British Chefs) |
| Kirsten & Christopher Shockey | 0 | None (cookbook-focused) |

**Pros**:
- ✅ Realistic success rate (60-80%)
- ✅ High-quality recipes from reliable sources
- ✅ Can execute in 1-2 hours
- ✅ Low failure rate means less wasted API calls

**Cons**:
- ❌ Won't reach 100-130 recipe goal
- ❌ Some chefs will have minimal coverage
- ❌ Uneven distribution (popular chefs get more)

**Script**: `/scripts/post-launch/curate-high-confidence-recipes.ts`

**Command**:
```bash
# Dry run
pnpm tsx scripts/post-launch/curate-high-confidence-recipes.ts

# Live run
APPLY_CHANGES=true pnpm tsx scripts/post-launch/curate-high-confidence-recipes.ts
```

---

## Option 2: Enhanced Parsing + Broader Scraping

**What**: Improve parsing logic to handle more site variations, then attempt 100+ URLs

**Improvements Needed**:
1. **JSON-LD extraction** - Many sites embed structured recipe data (`<script type="application/ld+json">`)
2. **HTML fallback parsing** - Parse HTML when markdown fails
3. **Multi-pattern matching** - Try 3-4 different regex patterns for ingredients/instructions
4. **Per-site handlers** - Custom logic for Food52, Bon Appétit, etc.

**Expected Improvement**: 30-40% success rate (vs current 5-10%)

**Realistic Yield**: 60-80 recipes from 140+ URLs

**Pros**:
- ✅ Higher coverage across all chefs
- ✅ More recipe diversity
- ✅ Better long-term infrastructure for future scraping

**Cons**:
- ❌ 4-8 hours development time
- ❌ Still 60%+ failure rate
- ❌ Complex per-site logic to maintain
- ❌ May hit Firecrawl rate limits

**Estimated Effort**: 4-8 hours of development + 2-3 hours testing

---

## Option 3: Hybrid Approach (High-Confidence + Manual Entry)

**What**:
1. Run high-confidence scraping (40-60 recipes)
2. Manually enter 2-3 signature recipes for chefs with poor web availability

**Manual Entry Candidates**:
- **Dan Barber**: 2-3 Blue Hill/farm-to-table recipes from cookbook excerpts
- **David Zilber**: 2-3 basic fermentation recipes (miso, koji, hot sauce)
- **Kirsten & Christopher Shockey**: 2-3 fermentation basics (sauerkraut, kimchi, pickles)
- **René Redzepi**: 1-2 Noma classics from media articles

**Manual Entry Format**:
```typescript
// Example: scripts/post-launch/manual-recipe-entries.ts
const MANUAL_RECIPES = {
  'dan-barber': [
    {
      title: 'Waste-Free Vegetable Stock',
      ingredients: ['Vegetable scraps', 'Water', 'Salt'],
      instructions: ['Save scraps...', 'Simmer for 2 hours...'],
      source: 'The Third Plate (cookbook)',
      // ...
    }
  ]
};
```

**Total Yield**: 50-70 recipes

**Pros**:
- ✅ Balanced quality + coverage
- ✅ Ensures every chef has recipes
- ✅ 100% success rate on manual entries
- ✅ Can select most representative recipes

**Cons**:
- ❌ Manual data entry time (~20-30 mins per recipe)
- ❌ Need to verify licensing/attribution
- ❌ May need cookbook access

**Estimated Effort**: 2-3 hours scraping + 2-3 hours manual entry

---

## Option 4: Accept Current State + Focus on Quality

**What**: Keep the 143 existing recipes, don't add more until post-launch

**Rationale**:
- Platform already has 143 recipes across 20 chefs
- Zero-waste focus is about **resourcefulness**, not **quantity**
- Better to have 143 high-quality recipes than 250 mediocre ones
- Focus post-launch efforts on user engagement, not chef recipe counts

**Alternative Strategy**:
- Mark chefs with 0 recipes as "Coming Soon"
- Add recipes organically over time as sources become available
- Prioritize user-generated recipes instead

**Pros**:
- ✅ Zero additional effort
- ✅ Maintain quality standards
- ✅ Focus resources on launch preparation
- ✅ Aligns with zero-waste philosophy (don't force it)

**Cons**:
- ❌ 11 chefs with no recipes (35% of total)
- ❌ Missed opportunity for sustainable chef coverage
- ❌ User expectation mismatch (chef page with 0 recipes)

---

## Recommendation

**Go with Option 1 + selective manual entry (Hybrid)**

### Phase 1: High-Confidence Scraping (1-2 hours)
1. Run `curate-high-confidence-recipes.ts` in dry run mode
2. Review success rate - if >50%, proceed to live run
3. Expected yield: 40-60 recipes

### Phase 2: Strategic Manual Entry (2-3 hours)
For chefs with <3 recipes after scraping:
1. **Dan Barber**: Add 2 waste-reduction recipes from "The Third Plate"
2. **David Zilber**: Add 2 fermentation basics (miso, hot sauce)
3. **Kirsten & Christopher Shockey**: Add 2 fermentation recipes (sauerkraut, kimchi)
4. **René Redzepi**: Add 1-2 foraging/preservation recipes from media

### Expected Final State
- **Total Platform Recipes**: 180-200 (up from 143)
- **Chef Coverage**: 100% (all 31 chefs have recipes)
- **Quality**: High (60-80% from proven sources, 20-40% curated entries)
- **Zero-Waste Alignment**: Strong (focus on chefs with sustainability focus)

### Timeline
- **Scraping**: 1-2 hours
- **Manual Entry**: 2-3 hours
- **Testing/Verification**: 1 hour
- **Total**: 4-6 hours

---

## Next Steps

1. **Decision**: Choose your preferred option
2. **If Option 1/Hybrid**: Review and approve `curate-high-confidence-recipes.ts`
3. **Run Dry Run**: Test scraping success rates
4. **If acceptable**: Run live scraping
5. **If manual entry needed**: Create manual recipe entry script

---

## Files Created

1. **`/scripts/post-launch/curate-missing-chef-recipes.ts`**
   - Initial attempt (140+ URLs, ~5-10% success rate)
   - **Status**: Not recommended - too many failures

2. **`/scripts/post-launch/curate-high-confidence-recipes.ts`**
   - Focused approach (50-60 URLs, expected 60-80% success rate)
   - **Status**: Ready for dry run testing
   - **Recommendation**: Use this one

3. **`/scripts/post-launch/MANUAL_CURATION_REPORT.md`**
   - Detailed analysis of dry run results
   - **Status**: Reference document

4. **`/tmp/manual-recipe-curation.log`**
   - Dry run execution log
   - **Status**: Shows parsing failures and patterns

---

## Questions to Answer

1. **Priority**: Is 100% chef coverage essential for launch (Oct 27)?
2. **Quality vs Quantity**: Prefer 50 high-quality recipes or 100 mixed-quality?
3. **Manual Entry**: Acceptable to manually enter 10-15 recipes?
4. **Timeline**: How many hours can be allocated to this task?
5. **Launch Blocker**: Is this blocking Oct 27 launch date?

Based on your answers, we can proceed with the most appropriate option.
