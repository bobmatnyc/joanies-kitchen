# Post-Launch Quick Start Guide

**Launch Date**: October 27, 2025 (4 days away)
**Status**: All scripts ready for execution

---

## Launch Day Checklist (October 27)

```bash
# 1. Final production build
pnpm build

# 2. Deploy to Vercel
git push origin main

# 3. Submit sitemap (manual step)
# - Go to Google Search Console
# - Submit: https://joanies-kitchen.com/sitemap.xml
# - Go to Bing Webmaster Tools
# - Submit: https://joanies-kitchen.com/sitemap.xml

# 4. Monitor launch
# - Check Vercel Analytics
# - Check Google Analytics (G-FZDVSZLR8V)
# - Monitor error logs
```

---

## Week 1 Priorities (Oct 28 - Nov 3)

### Priority 1A: Generate Top 50 Images (Day 1-3)

**Cost**: ~$4.00 | **Time**: 2-3 hours

```bash
# Step 1: Preview recipes (dry-run)
pnpm tsx scripts/post-launch/generate-top50-images.ts --dry-run

# Step 2: Test with 5 recipes first
pnpm tsx scripts/post-launch/generate-top50-images.ts --count=5

# Step 3: Run full generation (50 recipes, 2 variations each)
pnpm tsx scripts/post-launch/generate-top50-images.ts --count=50 --variations=2

# Step 4: Resume if interrupted
pnpm tsx scripts/post-launch/generate-top50-images.ts --resume

# Monitor progress
tail -f tmp/top50-image-generation-progress.json
```

**Success Criteria**:
- ✅ 100 high-quality images generated
- ✅ All images under 500KB
- ✅ Images visible on production site

---

### Priority 1B: Local Embedding Generation (Day 1-2)

**Cost**: $0 | **Time**: 8-10 hours (overnight)

```bash
# Step 1: Install dependencies
pip install sentence-transformers

# Step 2: Test with 10 recipes
python scripts/generate_embeddings_local.py --limit=10

# Step 3: Run full generation (overnight)
nohup python scripts/generate_embeddings_local.py --execute > tmp/embedding-run.log 2>&1 &

# Step 4: Monitor in separate terminal
./scripts/post-launch/monitor-embeddings.sh

# Check progress
tail -f tmp/embedding-generation-progress.log

# Verify completion
# D3a: pooled pg_dump broke prod reads; unpooled host only
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM recipes WHERE embedding IS NOT NULL;"
```

**Success Criteria**:
- ✅ 4,644 recipes with embeddings (100%)
- ✅ Search latency <300ms
- ✅ Zero HuggingFace API dependency

---

### Priority 1C: Content Cleanup (Day 3-7)

**Cost**: $0 | **Time**: 1 week

```bash
# Step 1: Install Ollama
brew install ollama

# Step 2: Pull Llama 3.2 model
ollama pull llama3.2

# Step 3: Detect recipes needing cleanup
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --detect

# Step 4: Test with 5 recipes (manual review)
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --limit=5

# Step 5: Run batch cleanup (100 recipes/day)
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --batch=100

# Step 6: Auto-approve mode (after testing)
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --batch=100 --approve

# Step 7: Resume if interrupted
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --resume

# View report
cat tmp/cleanup-report.md
```

**Success Criteria**:
- ✅ 500+ recipes cleaned up
- ✅ >90% approval rate
- ✅ Improved search quality

---

## Week 2 Priorities (Nov 4 - Nov 10)

### Priority 2A: Chef Acquisition Outreach

**Potential Yield**: 1,500-3,000 recipes

```bash
# Step 1: Review outreach package
cat docs/post-launch/chef-acquisition/OUTREACH_PACKAGE.md

# Step 2: Customize email templates
# - Add your contact details
# - Add your name/title
# - Prepare demo materials

# Step 3: Find contact emails
# - zerowastechef.com/contact
# - Phaidon Press licensing team
# - Storey Publishing rights team

# Step 4: Send outreach emails (November 1)
# - Anne-Marie Bonneau (Priority 1)
# - Jeremy Fox (Phaidon Press)
# - Shockeys (Storey Publishing)

# Step 5: Track responses
# - Update tracking spreadsheet
# - Schedule partnership calls
# - Negotiate terms

# Step 6: Follow up (1 week later - November 8)
# - Send follow-up emails to non-responders
```

**Success Criteria**:
- ✅ 3 outreach emails sent
- ✅ At least 1 response received
- ✅ 1 partnership agreement signed by Nov 15

---

### Priority 2B: Generate Missing Chef Portraits

**Cost**: ~$0.40-0.80 | **Time**: 1-2 days

```bash
# Step 1: Check which chefs need portraits
pnpm tsx scripts/check-chef-images.ts

# Step 2: Generate portraits (DALL-E 3)
pnpm tsx scripts/generate-chef-images.ts

# Step 3: Verify images on production
# - Visit /chefs/[chef-slug]
# - Check all portraits load correctly

# Step 4: Regenerate any poor-quality images
pnpm tsx scripts/generate-chef-images.ts --regenerate
```

**Success Criteria**:
- ✅ 100% chef portrait coverage
- ✅ Consistent visual style

---

## Week 3-4 Priorities (Nov 11 - Nov 24)

### Priority 3A: Seasonal Collections

```bash
# Step 1: Query seasonal recipes
# (Script to be created in Week 3)

# Step 2: Create seasonal landing pages
# - /recipes/seasonal/fall
# - /recipes/seasonal/winter
# - /recipes/seasonal/thanksgiving

# Step 3: Generate seasonal hero images
# (Stable Diffusion XL script to be created)
```

---

### Priority 4B: Recipe Import Automation

```bash
# Step 1: Install recipe-scrapers
pip install recipe-scrapers

# Step 2: Test with sample URLs
# (Script to be created in Week 4)

# Step 3: Deploy automated pipeline
# (Cron job setup)
```

---

## Monitoring & Troubleshooting

### Check Production Status

```bash
# Vercel deployment status
vercel --version
vercel ls

# Database connection
# D3a: pooled pg_dump broke prod reads; unpooled host only
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM recipes;"

# Check embedding coverage
# D3a: pooled pg_dump broke prod reads; unpooled host only
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM recipes WHERE embedding IS NOT NULL;"

# Check image coverage
# D3a: pooled pg_dump broke prod reads; unpooled host only
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM recipes WHERE images IS NOT NULL AND images != '[]';"
```

---

### Common Issues

**1. Ollama not responding**:
```bash
# Restart Ollama
brew services restart ollama

# Or manually
ollama serve
```

**2. OpenAI API rate limit**:
```bash
# Add delays between requests (already built into scripts)
# Check quota: https://platform.openai.com/usage

# Reduce batch size
pnpm tsx scripts/post-launch/generate-top50-images.ts --count=10
```

**3. Database connection timeout**:
```bash
# Check Neon PostgreSQL status
# Verify DATABASE_URL in .env.local

# Test connection
pnpm db:studio
```

---

## Progress Tracking

### Daily Check-ins

```bash
# View top 50 image progress
cat tmp/top50-image-generation-progress.json | jq '.processedCount, .totalCost'

# View embedding progress
./scripts/post-launch/monitor-embeddings.sh

# View cleanup progress
cat tmp/cleanup-progress.json | jq '.processedCount, .approvedCount'
```

### Weekly Reports

```bash
# Generate Week 1 report (November 3)
cat docs/post-launch/POST_LAUNCH_CHECKLIST.md

# Update progress in checklist
# Mark completed items with ✅

# Document any blockers or issues
# Update success metrics
```

---

## Cost Tracking

| Task | Estimated Cost | Actual Cost | Status |
|------|----------------|-------------|--------|
| Top 50 Images | $4.00 | - | Not Started |
| Local Embeddings | $0.00 | $0.00 | Ready |
| Content Cleanup | $0.00 | $0.00 | Ready |
| Chef Portraits | $0.80 | - | Not Started |
| Total | **$4.80** | - | - |

---

## Timeline at a Glance

```
Oct 27: LAUNCH DAY
  ├─ Deploy to production
  ├─ Submit sitemap
  └─ Monitor first 24 hours

Oct 28-30: Week 1A (Images + Embeddings)
  ├─ Generate top 50 images ($4)
  ├─ Run embedding generation (overnight)
  └─ Start content cleanup

Oct 31-Nov 5: Week 1B (Content Quality)
  ├─ Content cleanup (500 recipes)
  ├─ Quality review
  └─ Search improvements

Nov 1-7: Week 2A (Chef Outreach)
  ├─ Send 3 outreach emails
  ├─ Generate chef portraits
  └─ Follow up

Nov 8-15: Week 2B (Partnerships)
  ├─ Partnership calls
  ├─ Negotiate agreements
  └─ Sign first partnership

Nov 11-20: Week 3 (Seasonal Collections)
  ├─ Create seasonal pages
  ├─ Generate seasonal images
  └─ Launch first collection

Nov 20-30: Week 4 (Automation)
  ├─ Recipe import pipeline
  ├─ Performance review
  └─ Month 1 report
```

---

## Success Metrics

### Week 1 Targets:
- ✅ 4,644 recipes with embeddings (100%)
- ✅ 50 recipes with professional images
- ✅ 50+ recipes cleaned up
- ✅ Sitemap indexed

### Week 2 Targets:
- ✅ 3 chef outreach emails sent
- ✅ All chef portraits generated
- ✅ 200+ recipes cleaned up
- ✅ 1 response from chef

### Month 1 Targets:
- ✅ 100+ professional images
- ✅ 500+ recipes cleaned up
- ✅ 1-2 partnerships signed
- ✅ 1,500+ new recipes
- ✅ 3 seasonal collections
- ✅ Import automation live

---

## Next Steps

**Before Launch (Oct 26)**:
1. Review all scripts
2. Test in staging environment
3. Verify environment variables
4. Create database backup

**Launch Day (Oct 27)**:
1. Deploy to production
2. Submit sitemap
3. Monitor analytics
4. Celebrate! 🎉

**Day After Launch (Oct 28)**:
1. Start top 50 image generation
2. Run embedding generation overnight
3. Begin content cleanup
4. Monitor production metrics

---

**Last Updated**: October 23, 2025
**Owner**: [Your Name]
**Status**: Ready for launch
