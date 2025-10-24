# Post-Launch Documentation

**Launch Date**: October 27, 2025 (4 days away)
**Purpose**: Comprehensive execution plan for post-launch growth and optimization

---

## Overview

This directory contains all documentation and execution scripts for post-launch priorities spanning October 27 - November 27, 2025 (Month 1).

The post-launch strategy focuses on:
1. **Content Quality Enhancement** (Week 1-2)
2. **Content Acquisition** (Week 2-4)
3. **Advanced Features** (Week 3-6)
4. **SEO & Growth** (Ongoing)

---

## Quick Navigation

### Core Documentation
- **[QUICK_START.md](./QUICK_START.md)** - Fast reference for all scripts and commands
- **[POST_LAUNCH_CHECKLIST.md](./POST_LAUNCH_CHECKLIST.md)** - Comprehensive task list with timelines
- **[chef-acquisition/OUTREACH_PACKAGE.md](./chef-acquisition/OUTREACH_PACKAGE.md)** - Chef partnership templates

### Scripts (Located in `/scripts/post-launch/`)
- **`generate-top50-images.ts`** - DALL-E 3 image generation for top recipes
- **`monitor-embeddings.sh`** - Real-time embedding generation monitoring
- **`cleanup-content-batch.ts`** - Local LLM-powered content cleanup

---

## Post-Launch Priorities

### PHASE 1: Content Quality & Enhancement (Week 1-2)

#### **🔴 Priority 1A: Top 50 Recipe Images**
**Timeline**: Oct 28-30 (2-3 days)
**Cost**: ~$4.00
**Script**: `scripts/post-launch/generate-top50-images.ts`

Generate professional DALL-E 3 images for the 50 most popular recipes to maximize visual appeal and user engagement.

**Quick Start**:
```bash
# Dry-run preview
pnpm tsx scripts/post-launch/generate-top50-images.ts --dry-run

# Generate images
pnpm tsx scripts/post-launch/generate-top50-images.ts --count=50 --variations=2
```

**Deliverable**: 100 high-quality recipe images (50 recipes × 2 variations)

---

#### **🔴 Priority 1B: Local Embedding Generation**
**Timeline**: Oct 28-29 (overnight, 8-10 hours)
**Cost**: $0 (local)
**Script**: `scripts/generate_embeddings_local.py` (already exists)

Run local embedding generation to eliminate HuggingFace API dependency and enable offline semantic search.

**Quick Start**:
```bash
# Run overnight
nohup python scripts/generate_embeddings_local.py --execute > tmp/embedding-run.log 2>&1 &

# Monitor progress
./scripts/post-launch/monitor-embeddings.sh
```

**Deliverable**: 4,644 recipes with local embeddings (100% coverage)

---

#### **🟡 Priority 1C: Content Cleanup Campaign**
**Timeline**: Oct 30 - Nov 5 (1 week)
**Cost**: $0 (local Ollama)
**Script**: `scripts/post-launch/cleanup-content-batch.ts`

Batch cleanup of recipe content using local LLM (Ollama + Llama 3.2) to improve descriptions, fix formatting, and enhance metadata.

**Quick Start**:
```bash
# Install Ollama
brew install ollama
ollama pull llama3.2

# Detect recipes needing cleanup
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --detect

# Run cleanup (manual review)
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --batch=100
```

**Deliverable**: 500+ recipes with improved quality

---

### PHASE 2: Content Acquisition (Week 2-4)

#### **🔴 Priority 2A: Chef Acquisition Outreach**
**Timeline**: Nov 1-15 (2 weeks)
**Potential Yield**: 1,500-3,000 recipes
**Package**: `docs/post-launch/chef-acquisition/OUTREACH_PACKAGE.md`

Outreach campaign to acquire licensed recipes from sustainability-focused chefs:
1. **Anne-Marie Bonneau** (Zero Waste Chef) - 300-400 recipes
2. **Jeremy Fox** (Phaidon Press) - 320 recipes
3. **The Shockeys** (Storey Publishing) - 400+ recipes

**Quick Start**:
```bash
# Review outreach materials
cat docs/post-launch/chef-acquisition/OUTREACH_PACKAGE.md

# Customize templates with your details
# Send outreach emails (November 1)
# Track responses and follow up
```

**Deliverable**: At least 1 partnership agreement signed by Nov 15

---

#### **🟡 Priority 2B: Fill Missing Chef Portraits**
**Timeline**: Nov 1-3 (1-2 days)
**Cost**: ~$0.40-0.80
**Script**: `scripts/generate-chef-images.ts` (already exists)

Generate professional portraits for all chefs without images using DALL-E 3.

**Quick Start**:
```bash
# Check missing portraits
pnpm tsx scripts/check-chef-images.ts

# Generate portraits
pnpm tsx scripts/generate-chef-images.ts
```

**Deliverable**: 100% chef portrait coverage (15+ new portraits)

---

### PHASE 3: Advanced Features (Week 3-6)

#### **🟢 Priority 3A: Seasonal Recipe Collections**
**Timeline**: Nov 10-20 (10 days)
**Examples**: Fall harvest, Thanksgiving, Winter comfort foods

Create themed seasonal collections with dedicated landing pages for timely content and SEO boost.

**Deliverable**: 3 seasonal collections live

---

#### **🟢 Priority 3B: Background Images for Hero Sections**
**Timeline**: Nov 15-20 (5 days)
**Technology**: Stable Diffusion XL (local, free)
**Count**: 5-10 images

Generate brand-consistent hero backgrounds for homepage, about page, fridge feature, and seasonal collections.

**Deliverable**: 5-10 optimized background images

---

### PHASE 4: SEO & Growth (Ongoing)

#### **🔴 Priority 4A: Submit Sitemap (PRE-LAUNCH)**
**Timeline**: Oct 26 (before launch)
**Cost**: $0

Submit sitemap.xml (5,159 URLs) to Google Search Console and Bing Webmaster Tools for indexing.

**Deliverable**: Sitemap submitted, monitoring dashboard active

---

#### **🟡 Priority 4B: Recipe Import Automation**
**Timeline**: Nov 20-30 (10 days)
**Technology**: recipe-scrapers (Python)

Build automated pipeline for continuous recipe acquisition from partner websites with quality validation and attribution tracking.

**Deliverable**: Automated import pipeline operational (100+ recipes/week)

---

## File Structure

```
docs/post-launch/
├── README.md                          # This file
├── QUICK_START.md                     # Quick reference guide
├── POST_LAUNCH_CHECKLIST.md           # Comprehensive task list
└── chef-acquisition/
    └── OUTREACH_PACKAGE.md            # Chef partnership materials

scripts/post-launch/
├── generate-top50-images.ts           # DALL-E 3 image generation
├── monitor-embeddings.sh              # Embedding progress monitor
└── cleanup-content-batch.ts           # Content cleanup automation
```

---

## Timeline Overview

```
WEEK 1 (Oct 28 - Nov 3): Content Quality
├─ Day 1-3: Top 50 image generation ($4)
├─ Day 1-2: Local embeddings (overnight)
└─ Day 3-7: Content cleanup (500 recipes)

WEEK 2 (Nov 4 - Nov 10): Content Acquisition
├─ Day 1: Chef outreach emails (3 chefs)
├─ Day 1-3: Generate chef portraits
└─ Day 4-7: Content cleanup continues

WEEK 3 (Nov 11 - Nov 17): Partnerships & Collections
├─ Day 1-5: Seasonal collections
├─ Day 1-7: Chef partnership negotiations
└─ Day 6-7: Background image generation

WEEK 4 (Nov 18 - Nov 24): Automation & Scaling
├─ Day 1-5: Recipe import pipeline
├─ Day 6-7: Performance review
└─ Day 7: Month 1 report
```

---

## Success Metrics

### Week 1 Targets:
- ✅ 4,644 recipes with embeddings (100%)
- ✅ 50 recipes with 2 professional images each (100 total)
- ✅ 50+ recipes cleaned up
- ✅ Sitemap indexed by Google/Bing
- ✅ Zero critical production errors

### Week 2 Targets:
- ✅ 3 chef outreach emails sent
- ✅ All chef portraits generated (15+)
- ✅ 200+ recipes cleaned up (cumulative)
- ✅ At least 1 response from chef outreach

### Week 3 Targets:
- ✅ 1 seasonal collection launched
- ✅ 5 hero background images
- ✅ 1 partnership agreement signed
- ✅ 400+ recipes cleaned up (cumulative)

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

## Cost Breakdown

| Item | Estimated Cost | Timeline |
|------|----------------|----------|
| Top 50 Recipe Images (DALL-E 3) | $4.00 | Oct 28-30 |
| Local Embeddings | $0.00 | Oct 28-29 |
| Content Cleanup (Ollama) | $0.00 | Oct 30 - Nov 5 |
| Chef Portraits (DALL-E 3) | $0.80 | Nov 1-3 |
| Background Images (SDXL) | $0.00 | Nov 15-20 |
| **Total Month 1** | **$4.80** | - |

**Note**: All AI costs are minimal due to strategic use of local models (Ollama, Stable Diffusion XL) for bulk operations.

---

## Pre-Launch Requirements

Before starting post-launch execution, ensure:

1. **Environment Variables**:
   - `OPENAI_API_KEY` (for DALL-E 3 image generation)
   - `DATABASE_URL` (Neon PostgreSQL)
   - All Clerk auth keys configured

2. **Dependencies**:
   - Python 3.8+ with `sentence-transformers` installed
   - Ollama installed with `llama3.2` model
   - Node.js dependencies: `pnpm install`

3. **Database**:
   - Backup created
   - Schema up to date
   - 4,644 recipes indexed

4. **Production**:
   - Vercel deployment configured
   - Custom domain working
   - Analytics tracking verified

---

## Getting Started

### 1. Review Documentation (30 minutes)
```bash
# Read quick start guide
cat docs/post-launch/QUICK_START.md

# Review full checklist
cat docs/post-launch/POST_LAUNCH_CHECKLIST.md

# Review chef outreach package
cat docs/post-launch/chef-acquisition/OUTREACH_PACKAGE.md
```

### 2. Verify Environment (15 minutes)
```bash
# Check Node.js dependencies
pnpm install

# Check Python dependencies
python --version
pip install sentence-transformers

# Check Ollama installation
ollama --version
ollama pull llama3.2

# Verify API keys
echo $OPENAI_API_KEY
echo $DATABASE_URL
```

### 3. Test Scripts (30 minutes)
```bash
# Test image generation (dry-run)
pnpm tsx scripts/post-launch/generate-top50-images.ts --dry-run --count=5

# Test embedding generation (10 recipes)
python scripts/generate_embeddings_local.py --limit=10

# Test content cleanup (detect mode)
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --detect --limit=10
```

### 4. Launch Day (October 27)
```bash
# Deploy to production
git push origin main

# Submit sitemap (manual)
# - Google Search Console: Submit sitemap.xml
# - Bing Webmaster Tools: Submit sitemap.xml

# Monitor first 24 hours
# - Check Vercel Analytics
# - Check error logs
# - Test all critical features
```

### 5. Start Week 1 Execution (October 28)
```bash
# Priority 1A: Top 50 images
pnpm tsx scripts/post-launch/generate-top50-images.ts --count=50

# Priority 1B: Embeddings (overnight)
nohup python scripts/generate_embeddings_local.py --execute > tmp/embedding-run.log 2>&1 &

# Priority 1C: Content cleanup (after embeddings)
pnpm tsx scripts/post-launch/cleanup-content-batch.ts --batch=100
```

---

## Monitoring & Reporting

### Daily Monitoring
```bash
# Image generation progress
cat tmp/top50-image-generation-progress.json | jq

# Embedding generation progress
./scripts/post-launch/monitor-embeddings.sh

# Content cleanup progress
cat tmp/cleanup-progress.json | jq

# Production metrics
# - Vercel Analytics dashboard
# - Google Analytics (G-FZDVSZLR8V)
# - Neon PostgreSQL metrics
```

### Weekly Reports
Create weekly progress reports tracking:
- Tasks completed vs. planned
- Success metrics achieved
- Blockers and issues encountered
- Adjustments to timeline/strategy
- Cost tracking
- Next week priorities

---

## Support & Troubleshooting

### Common Issues

**1. Script fails with "Module not found"**:
```bash
# Reinstall dependencies
pnpm install

# Check TypeScript compilation
pnpm build
```

**2. Ollama not responding**:
```bash
# Restart Ollama service
brew services restart ollama

# Or run manually
ollama serve
```

**3. Database connection timeout**:
```bash
# Check Neon PostgreSQL status
# Verify DATABASE_URL

# Test connection
pnpm db:studio
```

**4. OpenAI API rate limit**:
```bash
# Check quota: https://platform.openai.com/usage
# Reduce batch size or add delays
```

### Emergency Contacts
- **Vercel Support**: vercel.com/support
- **Neon PostgreSQL**: neon.tech/support
- **OpenAI Support**: platform.openai.com/support

---

## Next Steps After Month 1

**December 2025 Priorities**:
1. Recipe video generation (experimental)
2. Advanced search filters
3. User-generated content moderation
4. Mobile app exploration
5. Partnership expansion (5+ new chefs)

**See**: `docs/roadmap/MONTH_2_ROADMAP.md` (to be created November 27)

---

## Contributing

This is a living document. Update it as you:
- Complete tasks
- Encounter issues
- Learn lessons
- Adjust timelines
- Add new priorities

**Last Updated**: October 23, 2025
**Owner**: [Your Name]
**Status**: Ready for execution
