# Post-Launch Execution Checklist

**Launch Date**: October 27, 2025 (4 days)
**Status**: Pre-launch tasks 95% complete
**Last Updated**: October 23, 2025

---

## Launch Day (October 27, 2025)

### Pre-Launch Final Checks (Morning - 6 hours before)
- [ ] Run full production build: `pnpm build`
- [ ] Verify no build errors or warnings
- [ ] Test critical paths in production mode
  - [ ] Homepage loads
  - [ ] Fridge feature works
  - [ ] Recipe search works
  - [ ] Authentication works (sign-in/sign-up)
  - [ ] Recipe pages load correctly
- [ ] Verify environment variables are set correctly
- [ ] Check database connection (Neon PostgreSQL)
- [ ] Verify Clerk authentication (both dev and prod environments)
- [ ] Test OpenRouter AI (generate 1 test recipe)

### Launch (Deployment)
- [ ] Deploy to Vercel (main branch)
- [ ] Verify deployment succeeded (check Vercel dashboard)
- [ ] Test production URL (joanies-kitchen.com)
- [ ] Clear CDN cache if needed
- [ ] Monitor error logs for first 30 minutes

### Post-Launch Immediate (First 24 Hours)
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Set up Google Analytics monitoring dashboard
- [ ] Monitor Vercel Analytics for traffic
- [ ] Check error logs every 2 hours
- [ ] Test all critical features on production
- [ ] Monitor performance metrics (TTFB, page load times)

---

## PHASE 1: Content Quality & Enhancement (Week 1-2)

### Priority 1A: Generate Top 50 Recipe Images (Oct 28-30)
**Script**: `scripts/post-launch/generate-top50-images.ts`
**Timeline**: 2-3 days
**Cost**: ~$4.00 (50 recipes × 2 variations × $0.04)

**Day 1 (October 28)**:
- [ ] Verify OPENAI_API_KEY is set
- [ ] Run dry-run to preview recipes:
  ```bash
  pnpm tsx scripts/post-launch/generate-top50-images.ts --dry-run
  ```
- [ ] Review recipe list for quality
- [ ] Start generation (first 10 recipes):
  ```bash
  pnpm tsx scripts/post-launch/generate-top50-images.ts --count=10
  ```
- [ ] Monitor progress and costs
- [ ] Review generated images for quality

**Day 2 (October 29)**:
- [ ] Continue with next 20 recipes:
  ```bash
  pnpm tsx scripts/post-launch/generate-top50-images.ts --count=20 --resume
  ```
- [ ] Review image quality
- [ ] Adjust prompts if needed
- [ ] Check database updates (images field populated)

**Day 3 (October 30)**:
- [ ] Complete remaining 20 recipes
- [ ] Review final summary report
- [ ] Verify all images are accessible
- [ ] Check production site for updated images
- [ ] Document any issues or improvements needed

**Success Metrics**:
- ✅ 50 recipes with 2 high-quality images each (100 total)
- ✅ <5% error rate
- ✅ Total cost ≤ $4.50
- ✅ Images visible on production site

---

### Priority 1B: Local Embedding Generation (Oct 28-29)
**Script**: `scripts/generate_embeddings_local.py` (already exists)
**Monitor**: `scripts/post-launch/monitor-embeddings.sh`
**Timeline**: 8-10 hours (overnight run)
**Cost**: $0 (runs locally)

**Setup (October 28 - Evening)**:
- [ ] Verify Python environment:
  ```bash
  python --version  # Should be 3.8+
  pip install sentence-transformers
  ```
- [ ] Test on 10 recipes first:
  ```bash
  python scripts/generate_embeddings_local.py --limit=10
  ```
- [ ] Review output for errors
- [ ] Start full generation (overnight):
  ```bash
  nohup python scripts/generate_embeddings_local.py --execute > tmp/embedding-run.log 2>&1 &
  ```
- [ ] Start monitoring in separate terminal:
  ```bash
  ./scripts/post-launch/monitor-embeddings.sh
  ```

**Monitoring (October 29 - Morning)**:
- [ ] Check overnight progress:
  ```bash
  tail -f tmp/embedding-generation-progress.log
  ```
- [ ] Verify no critical errors
- [ ] Check database for embedding coverage:
  ```sql
  SELECT COUNT(*) FROM recipes WHERE embedding IS NOT NULL;
  ```
- [ ] Monitor completion time estimate

**Verification (October 29 - Completion)**:
- [ ] Verify 4,644 recipes have embeddings
- [ ] Test search functionality with embeddings
- [ ] Compare search quality (before/after)
- [ ] Document performance improvements
- [ ] Update Fridge feature to use local embeddings

**Success Metrics**:
- ✅ 4,644 recipes with embeddings (100% coverage)
- ✅ <1% error rate
- ✅ Search latency <300ms
- ✅ Zero HuggingFace API dependency

---

### Priority 1C: Content Cleanup Campaign (Oct 30 - Nov 5)
**Script**: `scripts/post-launch/cleanup-content-batch.ts` (to be created)
**Timeline**: 1 week
**Cost**: $0 (uses local Ollama)

**Phase 1: Detection (Oct 30)**:
- [ ] Create detection script
- [ ] Identify recipes needing cleanup:
  - [ ] Empty or poor descriptions
  - [ ] Degree symbol issues (F vs °F)
  - [ ] Inconsistent measurements
  - [ ] Missing cuisine/tags
- [ ] Generate cleanup report
- [ ] Prioritize by recipe popularity

**Phase 2: Setup Ollama (Oct 31)**:
- [ ] Install Ollama: `brew install ollama`
- [ ] Pull Llama 3.2 model: `ollama pull llama3.2`
- [ ] Test with 5 sample recipes
- [ ] Verify output quality
- [ ] Adjust prompts if needed

**Phase 3: Batch Cleanup (Nov 1-4)**:
- [ ] Run cleanup on 100 recipes/day
- [ ] Manual review of first 20 changes
- [ ] Adjust automation based on review
- [ ] Continue batch processing
- [ ] Track improvements

**Phase 4: Verification (Nov 5)**:
- [ ] Review all changes
- [ ] Test search quality improvements
- [ ] Generate before/after report
- [ ] Document lessons learned

**Success Metrics**:
- ✅ 500+ recipes cleaned up
- ✅ >90% approval rate on changes
- ✅ Improved search relevance
- ✅ Better user experience

---

## PHASE 2: Content Acquisition (Week 2-4)

### Priority 2A: Chef Acquisition Outreach (Nov 1-15)
**Package**: `docs/post-launch/chef-acquisition/OUTREACH_PACKAGE.md`
**Timeline**: 2 weeks
**Potential Yield**: 1,500-3,000 recipes

**Week 1 (Nov 1-7)**:
- [ ] Finalize contact information for all 3 chefs
- [ ] Customize email templates with your details
- [ ] Prepare platform demo materials:
  - [ ] Screenshots of chef profile pages
  - [ ] Video walkthrough (5 minutes)
  - [ ] Traffic analytics sample report
- [ ] Send outreach email to Anne-Marie Bonneau (Priority 1)
- [ ] Send outreach email to Phaidon Press (Jeremy Fox)
- [ ] Send outreach email to Storey Publishing (Shockeys)
- [ ] Track in outreach spreadsheet

**Week 2 (Nov 8-15)**:
- [ ] Follow up with non-responders (1 week later)
- [ ] Schedule calls with responders
- [ ] Prepare partnership agreements
- [ ] Negotiate terms
- [ ] Finalize at least 1 partnership

**Success Metrics**:
- ✅ 3 outreach emails sent
- ✅ At least 1 response received
- ✅ At least 1 partnership call scheduled
- ✅ Target: 1 agreement signed by Nov 15

---

### Priority 2B: Fill Missing Chef Portraits (Nov 1-3)
**Script**: `scripts/generate-chef-images.ts` (already exists)
**Timeline**: 1-2 days
**Cost**: ~$0.40-0.80 (10-20 chefs)

**Day 1 (November 1)**:
- [ ] Identify chefs without portraits:
  ```bash
  pnpm tsx scripts/check-chef-images.ts
  ```
- [ ] Review list (should be ~15-20 chefs)
- [ ] Run generation script:
  ```bash
  pnpm tsx scripts/generate-chef-images.ts
  ```
- [ ] Review first 5 portraits for quality

**Day 2 (November 2)**:
- [ ] Complete generation for all chefs
- [ ] Upload portraits to `/public/images/chefs/`
- [ ] Update database with image URLs
- [ ] Verify portraits on production site

**Day 3 (November 3)**:
- [ ] Final quality review
- [ ] Regenerate any poor-quality images
- [ ] Update chef profile pages
- [ ] Test all chef pages for image loading

**Success Metrics**:
- ✅ 100% chef portrait coverage
- ✅ Consistent visual style
- ✅ All images <500KB (optimized)
- ✅ No broken image links

---

## PHASE 3: Advanced Features (Week 3-6)

### Priority 3A: Seasonal Recipe Collections (Nov 10-20)
**Timeline**: 10 days
**Examples**: Fall harvest, Thanksgiving, Winter comfort foods

**Week 1 (Nov 10-13)**:
- [ ] Design seasonal collection schema
- [ ] Query recipes by seasonal ingredients:
  - [ ] Fall: pumpkin, squash, apples, cranberries
  - [ ] Winter: root vegetables, hearty greens, citrus
  - [ ] Thanksgiving: turkey, stuffing, pies
- [ ] Create collection database structure
- [ ] Generate seasonal landing pages

**Week 2 (Nov 14-20)**:
- [ ] Create seasonal hero images (Stable Diffusion XL)
- [ ] Implement collection pages (`/recipes/seasonal/fall`)
- [ ] Add SEO metadata for seasonal pages
- [ ] Test and deploy first collection

**Success Metrics**:
- ✅ 3 seasonal collections live
- ✅ 50+ recipes per collection
- ✅ SEO-optimized landing pages
- ✅ Seasonal imagery

---

### Priority 3B: Background Images for Hero Sections (Nov 15-20)
**Timeline**: 5 days
**Technology**: Stable Diffusion XL (free, local)
**Count**: 5-10 images

**Images Needed**:
- [ ] Homepage hero (farm/garden scene)
- [ ] About page hero (kitchen scene)
- [ ] Fridge feature hero (vegetables)
- [ ] Seasonal collection headers (3-4 images)
- [ ] Tools directory header

**Process**:
- [ ] Install Stable Diffusion XL locally
- [ ] Generate images with consistent style
- [ ] Optimize for web (<200KB each)
- [ ] Save to `/public/images/backgrounds/`
- [ ] Update pages to use new backgrounds

**Success Metrics**:
- ✅ 5-10 high-quality backgrounds
- ✅ Consistent brand aesthetic
- ✅ Optimized file sizes
- ✅ Improved visual polish

---

## PHASE 4: SEO & Growth (Ongoing)

### Priority 4A: Submit Sitemap (PRE-LAUNCH - Oct 26)
**Timeline**: Before launch
**Cost**: $0

**Google Search Console**:
- [ ] Create/verify Google Search Console account
- [ ] Add property (joanies-kitchen.com)
- [ ] Verify ownership (DNS or meta tag)
- [ ] Submit sitemap.xml (5,159 URLs)
- [ ] Monitor indexing status
- [ ] Set up performance monitoring

**Bing Webmaster Tools**:
- [ ] Create Bing Webmaster Tools account
- [ ] Add site (joanies-kitchen.com)
- [ ] Verify ownership
- [ ] Submit sitemap.xml
- [ ] Monitor indexing

**Ongoing Monitoring**:
- [ ] Check indexing status weekly
- [ ] Monitor search queries (Search Console)
- [ ] Track impressions and clicks
- [ ] Identify top-performing pages
- [ ] Optimize low-performing pages

**Success Metrics**:
- ✅ Sitemap submitted within 24 hours of launch
- ✅ >1,000 pages indexed within 1 week
- ✅ >3,000 pages indexed within 1 month
- ✅ Organic traffic within 2 weeks

---

### Priority 4B: Recipe Import Automation (Nov 20-30)
**Timeline**: 10 days
**Technology**: recipe-scrapers (Python library)

**Week 1 (Nov 20-23)**:
- [ ] Install recipe-scrapers: `pip install recipe-scrapers`
- [ ] Test with sample URLs from target sites
- [ ] Build import pipeline script
- [ ] Implement quality validation
- [ ] Add attribution tracking

**Week 2 (Nov 24-30)**:
- [ ] Create monitoring dashboard
- [ ] Set up automated scheduling (cron)
- [ ] Test with 50 sample recipes
- [ ] Review and approve imports
- [ ] Deploy automated pipeline

**Success Metrics**:
- ✅ Automated import pipeline operational
- ✅ 100+ recipes imported/week
- ✅ >95% quality validation pass rate
- ✅ Proper attribution for all imports

---

## Weekly Review Schedule

### Week 1 (Oct 28 - Nov 3)
**Focus**: Content quality and infrastructure

**Monday Check-in**:
- [ ] Review weekend launch metrics
- [ ] Check top 50 image generation progress
- [ ] Monitor embedding generation

**Wednesday Check-in**:
- [ ] Top 50 images mid-point review
- [ ] Embedding generation completion check
- [ ] Start content cleanup planning

**Friday Review**:
- [ ] Week 1 metrics summary
- [ ] Image generation final report
- [ ] Embedding search quality analysis
- [ ] Plan Week 2 priorities

---

### Week 2 (Nov 4 - Nov 10)
**Focus**: Content acquisition and cleanup

**Monday Check-in**:
- [ ] Review chef outreach responses
- [ ] Content cleanup progress (100 recipes)
- [ ] Generate missing chef portraits

**Wednesday Check-in**:
- [ ] Chef partnership negotiations
- [ ] Content cleanup mid-point (250 recipes)
- [ ] Search quality improvements

**Friday Review**:
- [ ] Week 2 metrics summary
- [ ] Chef acquisition status
- [ ] Content cleanup report (500 recipes)
- [ ] Plan Week 3 priorities

---

### Week 3 (Nov 11 - Nov 17)
**Focus**: Seasonal collections and partnerships

**Monday Check-in**:
- [ ] Seasonal collection implementation
- [ ] Chef partnership finalization
- [ ] Recipe import pipeline setup

**Wednesday Check-in**:
- [ ] Seasonal collection progress
- [ ] First partnership recipes imported
- [ ] Background image generation

**Friday Review**:
- [ ] Week 3 metrics summary
- [ ] Launch first seasonal collection
- [ ] Chef acquisition final status
- [ ] Plan Week 4 priorities

---

### Week 4 (Nov 18 - Nov 24)
**Focus**: Automation and scaling

**Monday Check-in**:
- [ ] Recipe import automation testing
- [ ] Seasonal collections performance
- [ ] Partnership recipe integration

**Wednesday Check-in**:
- [ ] Import automation deployment
- [ ] Performance optimization review
- [ ] SEO rankings check

**Friday Review**:
- [ ] Month 1 complete metrics report
- [ ] Lessons learned documentation
- [ ] Plan Month 2 priorities

---

## Success Metrics Dashboard

### Week 1 Targets:
- ✅ 4,644 recipes with local embeddings
- ✅ Top 50 recipes with professional images
- ✅ Sitemap indexed by Google/Bing
- ✅ 50+ recipes cleaned up
- ✅ Zero critical errors in production

### Week 2 Targets:
- ✅ Outreach emails sent to 3 chefs
- ✅ All chef portraits generated
- ✅ 200+ recipes cleaned up
- ✅ At least 1 response from chef outreach

### Week 3 Targets:
- ✅ 1 seasonal collection launched
- ✅ 5 hero background images
- ✅ 1 partnership agreement signed
- ✅ 400+ recipes cleaned up

### Week 4 Targets:
- ✅ Recipe import pipeline operational
- ✅ 500+ total recipes cleaned up
- ✅ Performance review completed
- ✅ 100+ recipes imported via automation

### Month 1 Overall (Oct 27 - Nov 27):
- ✅ 4,644 recipes with embeddings (100%)
- ✅ 100+ high-quality recipe images
- ✅ 500+ recipes cleaned up
- ✅ 1-2 chef partnerships signed
- ✅ 1,500+ new recipes acquired
- ✅ 3 seasonal collections live
- ✅ Recipe import automation operational
- ✅ >1,000 pages indexed by Google

---

## Critical Path Items (Must Not Miss)

### Pre-Launch (Oct 26):
1. ✅ Final production build passes
2. ✅ All environment variables configured
3. ✅ Database backup created
4. ✅ Sitemap generated and ready

### Launch Day (Oct 27):
1. ✅ Deployment successful
2. ✅ Sitemap submitted to Google/Bing
3. ✅ Analytics tracking verified
4. ✅ Error monitoring active

### Week 1 (Oct 28 - Nov 3):
1. ✅ Embedding generation completes
2. ✅ Top 50 images generated
3. ✅ No critical production errors

### Week 2 (Nov 4 - Nov 10):
1. ✅ Chef outreach sent to all 3 targets
2. ✅ Content cleanup shows progress
3. ✅ All chef portraits generated

### Week 3 (Nov 11 - Nov 17):
1. ✅ First seasonal collection launches
2. ✅ At least 1 chef partnership signed

### Week 4 (Nov 18 - Nov 24):
1. ✅ Recipe import automation operational
2. ✅ Performance optimization review complete

---

## Emergency Protocols

### If Deployment Fails:
1. Rollback to previous version immediately
2. Check build logs for errors
3. Verify environment variables
4. Test locally in production mode
5. Fix issues and redeploy
6. Document incident

### If Database Connection Fails:
1. Check Neon PostgreSQL status
2. Verify DATABASE_URL is correct
3. Test connection from local machine
4. Check connection pooling limits
5. Contact Neon support if needed
6. Switch to backup database if critical

### If AI Features Fail:
1. Check OpenRouter API status
2. Verify OPENAI_API_KEY/OPENROUTER_API_KEY
3. Test with single generation request
4. Check API quota and billing
5. Fall back to basic search if needed
6. Notify users of temporary limitation

### If Search Performance Degrades:
1. Check database index status
2. Monitor query execution times
3. Verify embedding coverage
4. Check server resource usage
5. Implement query caching if needed
6. Scale database resources if necessary

---

## Documentation to Create

- [ ] Week 1 Progress Report (Nov 3)
- [ ] Week 2 Progress Report (Nov 10)
- [ ] Week 3 Progress Report (Nov 17)
- [ ] Week 4 Progress Report (Nov 24)
- [ ] Month 1 Final Report (Nov 27)
- [ ] Lessons Learned Document (Nov 30)
- [ ] Month 2 Roadmap (Dec 1)

---

**Next Update**: October 27, 2025 (Launch Day)
**Owner**: [Your Name]
**Status**: Pre-launch preparation complete
