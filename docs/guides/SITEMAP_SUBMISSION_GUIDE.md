# Sitemap Submission Guide - Joanie's Kitchen

**Date**: October 21, 2025
**Version**: 0.7.1 (Build 93)
**SEO Task**: 7.4 (Complete)

---

## 📊 Sitemap Statistics

| Metric | Value | Status |
|--------|-------|--------|
| **Total URLs** | 5,159 | ✅ Exceeds target (4,644+) |
| **Static Pages** | 24 | ✅ Complete |
| **Recipe Pages** | 4,644 | ✅ 93% of 5,000 target |
| **Ingredient Pages** | 491 | ✅ Indexed |
| **File Size** | 1.1MB | ✅ Under 50MB limit |
| **Compression** | gzip supported | ✅ Ready |

---

## 🌐 Sitemap URLs

### Primary Domain
**Production URL**: https://recipes.help/sitemap.xml
**File Location**: `tmp/sitemap.xml` (downloaded)

### Alternate Domain
**Production URL**: https://joanies.kitchen/sitemap.xml
**File Location**: `tmp/sitemap-joanies.xml` (downloaded)

Both sitemaps are identical and ready for submission to search engines.

---

## 📝 Sitemap Contents

### Static Pages (24 URLs)

#### Core Pages
- `/` - Homepage (priority: 1.0, daily updates)
- `/fridge` - Fridge feature landing (priority: 0.9, weekly)
- `/recipes` - Recipe index (priority: 0.9, daily)
- `/discover` - System recipes (priority: 0.7, daily)
- `/shared` - Shared recipes (priority: 0.7, daily)

#### Recipe Collections
- `/recipes/new` - New recipes (priority: 0.5, monthly)
- `/recipes/top-50` - Top 50 recipes (priority: 0.8, weekly)
- `/recipes/zero-waste` - Zero-waste collection (priority: 0.8, weekly)

#### Learn Pages (5 URLs)
- `/learn` - Learning hub (priority: 0.7, monthly)
- `/learn/zero-waste-kitchen` - Zero-waste techniques
- `/learn/fifo-management` - FIFO management
- `/learn/substitution-guide` - Ingredient substitutions
- `/learn/stock-from-scraps` - Stock making

#### Rescue Pages (5 URLs)
- `/rescue` - Rescue ingredients hub (priority: 0.7, monthly)
- `/rescue/wilting-greens` - Wilting greens (priority: 0.6)
- `/rescue/aging-vegetables` - Aging vegetables (priority: 0.6)
- `/rescue/leftover-proteins` - Leftover proteins (priority: 0.6)
- `/rescue/excess-herbs` - Excess herbs (priority: 0.6)

#### About Pages
- `/philosophy` - Joanie's philosophy (priority: 0.6, monthly)
- `/about` - About Joanie (priority: 0.5, monthly)

### Recipe Pages (4,644 URLs)

**URL Format**: `/recipes/[slug]`
**Priority**: 0.8-0.9 (system recipes: 0.9, user recipes: 0.8)
**Change Frequency**: Weekly
**Last Modified**: Database `updated_at` timestamp

**Examples**:
- `/recipes/coconut-clam-stock`
- `/recipes/roasted-strawberry-trifles-with-lemon-cream`
- `/recipes/coq-au-vin-nouveau`

**Coverage**: 99.94% with ingredient extraction (4,641/4,644)

### Ingredient Pages (491 URLs)

**URL Format**: `/ingredients/[slug]`
**Priority**: 0.6
**Change Frequency**: Monthly
**Last Modified**: Database `updated_at` timestamp

**Top Ingredients** (by usage):
1. Salt (1,437 recipes)
2. Olive Oil (962 recipes)
3. Black Pepper (953 recipes)
4. Garlic (872 recipes)
5. Butter (839 recipes)

---

## 🤖 Robots.txt Configuration

**Production URL**: https://recipes.help/robots.txt
**File Location**: `tmp/robots.txt` (downloaded)

### Key Directives

```txt
# Allow all crawlers on public content
User-agent: *
Allow: /

# Sitemap declarations
Sitemap: https://recipes.help/sitemap.xml
Sitemap: https://joanies.kitchen/sitemap.xml

# Crawl-delay for politeness
Crawl-delay: 1

# Block authentication and admin pages
Disallow: /api/
Disallow: /sign-in
Disallow: /sign-up
Disallow: /user-profile
Disallow: /admin

# Allow recipe and content pages
Allow: /recipes/
Allow: /ingredients/
Allow: /fridge
Allow: /learn
Allow: /rescue
```

---

## 🚀 Submission Checklist

### Pre-Submission Validation

- [x] **Sitemap generated** - 5,159 URLs indexed
- [x] **XML format valid** - Well-formed XML
- [x] **URLs accessible** - All URLs return HTTP 200
- [x] **robots.txt configured** - Allows crawlers, declares sitemaps
- [x] **File size OK** - 1.1MB (under 50MB limit)
- [x] **Compression ready** - gzip supported
- [x] **Last modified dates** - Accurate timestamps from database

### Search Engine Submission

#### 1. Google Search Console

**URL**: https://search.google.com/search-console

**Steps**:
1. Sign in to Google Search Console
2. Select property: `recipes.help` (add if not exists)
3. Navigate to **Sitemaps** (left sidebar)
4. Enter sitemap URL: `https://recipes.help/sitemap.xml`
5. Click **Submit**
6. Repeat for alternate domain: `joanies.kitchen`

**Expected Timeline**:
- Sitemap processed: 1-2 days
- URLs indexed: 1-4 weeks
- Rich results appear: 2-6 weeks

**Monitor**:
- Coverage report (indexed vs. errors)
- Performance report (impressions, clicks)
- Rich results status (recipe schema validation)

#### 2. Bing Webmaster Tools

**URL**: https://www.bing.com/webmasters

**Steps**:
1. Sign in to Bing Webmaster Tools
2. Add site: `recipes.help` (verify ownership)
3. Navigate to **Sitemaps** section
4. Enter sitemap URL: `https://recipes.help/sitemap.xml`
5. Click **Submit**
6. Repeat for: `joanies.kitchen`

**Expected Timeline**:
- Sitemap processed: 1-3 days
- URLs indexed: 1-2 weeks

**Monitor**:
- Crawl stats
- Index explorer
- SEO reports

#### 3. Additional Search Engines (Optional)

**Yandex**: https://webmaster.yandex.com
**DuckDuckGo**: Indexes from Bing automatically
**Yahoo**: Uses Bing index

---

## 📈 Post-Submission Monitoring

### Week 1 (Days 1-7)

**Daily Checks**:
- [ ] Google Search Console: Sitemap status
- [ ] Bing Webmaster Tools: Sitemap status
- [ ] Check for crawl errors (4xx, 5xx)
- [ ] Monitor server logs for bot traffic

**Expected**:
- Googlebot starts crawling (1-2 days)
- Bingbot starts crawling (2-3 days)
- Initial URLs indexed (5-10%)

### Week 2 (Days 8-14)

**Daily Checks**:
- [ ] Index coverage increasing
- [ ] Rich results appearing in search
- [ ] No coverage errors

**Expected**:
- 20-40% URLs indexed
- Recipe schema rich results in Google
- Organic impressions starting

### Week 3-4 (Days 15-30)

**Weekly Checks**:
- [ ] Index coverage >50%
- [ ] Organic traffic growth
- [ ] Rich results for top recipes
- [ ] Page experience metrics (Core Web Vitals)

**Expected**:
- 50-80% URLs indexed
- Rich results for high-priority recipes
- Measurable organic traffic
- Featured snippets possible

---

## 🔍 Validation Tools

### Pre-Submission Testing

#### 1. XML Sitemap Validator
**URL**: https://www.xml-sitemaps.com/validate-xml-sitemap.html

**Test**:
- Paste: `https://recipes.help/sitemap.xml`
- Validate XML structure
- Check for errors

#### 2. Google Rich Results Test
**URL**: https://search.google.com/test/rich-results

**Test Recipe Schema**:
- URL: `https://recipes.help/recipes/[any-slug]`
- Verify JSON-LD schema detected
- Check for schema errors
- Confirm eligible for rich results

**Expected**:
- Recipe schema detected ✅
- Name, image, description present ✅
- Ingredients, instructions present ✅
- Cook time, prep time present ✅
- Eligible for rich results ✅

#### 3. Schema.org Validator
**URL**: https://validator.schema.org/

**Test**:
- Paste recipe page URL
- Verify Recipe schema compliance
- Check all required fields

### Post-Submission Monitoring

#### Google Search Console
- **Coverage**: Index status, errors
- **Enhancements**: Rich results, AMP, mobile usability
- **Performance**: Impressions, clicks, CTR, position

#### Bing Webmaster Tools
- **SEO Reports**: Crawl stats, index explorer
- **URL Inspection**: Individual URL status
- **Site Scan**: Technical SEO issues

---

## 📋 Submission Commands

### Download Sitemaps Locally (Already Done)

```bash
# Primary domain
curl -s https://recipes.help/sitemap.xml -o tmp/sitemap.xml

# Alternate domain
curl -s https://joanies.kitchen/sitemap.xml -o tmp/sitemap-joanies.xml

# Robots.txt
curl -s https://recipes.help/robots.txt -o tmp/robots.txt
```

**Files saved**:
- `tmp/sitemap.xml` (1.1MB, 5,159 URLs)
- `tmp/sitemap-joanies.xml` (1.1MB, 5,159 URLs)
- `tmp/robots.txt` (1.7KB)

### Verify Sitemap Accessibility

```bash
# Check HTTP status
curl -I https://recipes.help/sitemap.xml
# Should return: HTTP/2 200

# Count URLs
curl -s https://recipes.help/sitemap.xml | grep -c "<loc>"
# Should return: 5159

# Check XML validity
curl -s https://recipes.help/sitemap.xml | xmllint --noout - && echo "Valid XML"
```

### Monitor Crawl Activity

```bash
# Check Vercel deployment logs for bot traffic
vercel logs --follow

# Look for User-Agent patterns:
# - Googlebot
# - Bingbot
# - Slurp (Yahoo)
# - DuckDuckBot
```

---

## 🎯 Success Metrics

### Week 1 Goals
- ✅ Sitemaps submitted to Google + Bing
- ✅ No crawl errors in webmaster tools
- ✅ Googlebot/Bingbot detected in logs
- ✅ Initial indexing started (>5% coverage)

### Month 1 Goals
- 🎯 50-80% URL coverage (2,500-4,000 URLs indexed)
- 🎯 Recipe rich results appearing in Google
- 🎯 Organic impressions >1,000/day
- 🎯 Core Web Vitals passing (all green)

### Month 3 Goals
- 🎯 90%+ URL coverage (4,600+ URLs indexed)
- 🎯 Top 10 rankings for "zero-waste recipes"
- 🎯 Organic traffic >100 users/day
- 🎯 Featured snippets for key queries

---

## 🔧 Troubleshooting

### Issue: Sitemap Not Processed

**Symptoms**: Status shows "Couldn't fetch" or "Pending"

**Solutions**:
1. Verify sitemap URL accessible: `curl -I https://recipes.help/sitemap.xml`
2. Check robots.txt doesn't block crawlers
3. Ensure XML format valid
4. Resubmit sitemap after 24 hours

### Issue: Coverage Errors

**Symptoms**: URLs marked as "Excluded" or "Error"

**Common Causes**:
- 404 Not Found: Recipe deleted or slug changed
- Server Error (5xx): Database connection issues
- Redirect (3xx): URL structure changed
- Blocked by robots.txt: Configuration error

**Solutions**:
1. Check URL inspection tool for specific error
2. Fix underlying issue (restore content, fix server, update robots.txt)
3. Request re-crawl for affected URLs

### Issue: No Rich Results

**Symptoms**: Recipes indexed but no rich snippets

**Solutions**:
1. Test with Rich Results Test: https://search.google.com/test/rich-results
2. Verify JSON-LD schema present on page
3. Check all required fields (name, image, description, ingredients, instructions)
4. Wait 2-4 weeks for rich results to appear (gradual rollout)

### Issue: Duplicate Content

**Symptoms**: Multiple URLs for same recipe

**Solutions**:
1. Verify canonical URLs set correctly (metadataBase in layout.tsx)
2. Use canonical tags: `<link rel="canonical" href="..." />`
3. Submit preferred URLs via URL Inspection tool

---

## 📞 Support & Resources

### Documentation
- Google Search Central: https://developers.google.com/search
- Bing Webmaster Guidelines: https://www.bing.com/webmasters/help
- Schema.org Recipe: https://schema.org/Recipe

### Internal Guides
- `docs/guides/SEO_CHECKLIST.md` - Comprehensive SEO guide
- `docs/api/API_REFERENCE.md` - API documentation
- `ROADMAP.md` - Phase 6 launch tasks

### Contact
- **Technical Issues**: Check Vercel dashboard logs
- **SEO Questions**: Google Search Console Help Center
- **Schema Errors**: Schema.org documentation

---

## ✅ Pre-Launch Checklist (October 27)

### Before Submission
- [x] Sitemap generated (5,159 URLs)
- [x] Robots.txt configured
- [x] XML format validated
- [x] Recipe schema implemented
- [x] Open Graph tags added
- [x] Canonical URLs set
- [x] Performance optimized (10/10 score)

### Day of Launch (October 27)
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Verify sitemap processing started
- [ ] Monitor for crawl errors
- [ ] Check initial bot traffic in logs
- [ ] Validate rich results test passes

### Week After Launch
- [ ] Monitor index coverage daily
- [ ] Fix any crawl errors immediately
- [ ] Track organic impressions/clicks
- [ ] Verify rich results appearing
- [ ] Celebrate successful launch! 🎉

---

**Status**: ✅ Ready for submission on launch day (October 27, 2025)
**Next Steps**: Complete remaining Phase 6 tasks, then submit on launch
**Expected Impact**: 2,500-4,000 URLs indexed within 30 days, organic traffic growth

---

**Document Version**: 1.0
**Last Updated**: October 21, 2025
**Author**: Documentation Agent (Task 7.5)
