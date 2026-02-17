# Documentation Quick Reference

**Last Updated:** February 16, 2026
**Go-Live Date:** June 1, 2026

Quick guide to finding documentation in the reorganized structure.

---

## 🚀 Quick Start

### New to the Project?
1. **[README.md](./README.md)** - Project overview and quick start
2. **[QUICK_START.md](./QUICK_START.md)** - 5-minute setup guide
3. **[docs/getting-started/](./docs/getting-started/)** - Detailed setup instructions

### Developer Onboarding?
1. **[DEVELOPER.md](./DEVELOPER.md)** - Complete technical architecture
2. **[CODE_STRUCTURE.md](./CODE_STRUCTURE.md)** - Project organization guide
3. **[docs/developer/](./docs/developer/)** - Developer documentation hub

### Looking for AI Agent Instructions?
1. **[CLAUDE.md](./CLAUDE.md)** - AI agent integration and project memory
2. **[docs/development/](./docs/development/)** - Development guides

---

## 📚 Documentation by Task

### Setup & Installation
- **[README.md](./README.md)** - Quick start commands
- **[QUICK_START.md](./QUICK_START.md)** - Detailed setup walkthrough
- **[docs/getting-started/installation.md](./docs/getting-started/installation.md)** - Comprehensive installation
- **[docs/getting-started/environment-setup.md](./docs/getting-started/environment-setup.md)** - Environment configuration

### Feature Documentation
- **[docs/guides/](./docs/guides/)** - Feature guides and how-tos
- **[docs/features/](./docs/features/)** - Feature-specific documentation
- **[docs/reference/](./docs/reference/)** - Technical reference

### API & Integration
- **[docs/api/](./docs/api/)** - API documentation
- **[docs/api/overview.md](./docs/api/overview.md)** - API overview
- **[docs/guides/authentication.md](./docs/guides/authentication.md)** - Auth setup

### Testing
- **[docs/testing/](./docs/testing/)** - Testing guides and procedures
- **[docs/qa/](./docs/qa/)** - Quality assurance documentation

### Deployment & Operations
- **[docs/deployment/](./docs/deployment/)** - Deployment procedures
- **[docs/getting-started/deployment.md](./docs/getting-started/deployment.md)** - Deployment guide
- **[docs/operations/](./docs/operations/)** - Operational procedures

### Troubleshooting
- **[docs/troubleshooting/](./docs/troubleshooting/)** - Troubleshooting guides
- **[docs/troubleshooting/common-issues.md](./docs/troubleshooting/common-issues.md)** - Common issues
- **[docs/troubleshooting/DEV_SERVER_STABILITY.md](./docs/troubleshooting/DEV_SERVER_STABILITY.md)** - Dev server fixes

---

## 🗂️ Documentation by Location

### Root Level (Project Overview)
```
├── README.md                    # Project overview & quick start
├── ROADMAP.md                   # Project roadmap & go-live plan
├── CHANGELOG.md                 # Version history
├── QUICK_START.md               # 5-minute setup guide
├── DEVELOPER.md                 # Technical architecture
├── CODE_STRUCTURE.md            # Code organization
└── CLAUDE.md                    # AI agent instructions
```

### docs/ Directory (Detailed Documentation)
```
docs/
├── README.md                    # Documentation index
├── getting-started/             # Setup & installation
├── guides/                      # Feature & usage guides
├── api/                         # API documentation
├── reference/                   # Technical reference
├── development/                 # Developer guides
├── deployment/                  # Deployment procedures
├── testing/                     # Testing & QA
├── troubleshooting/            # Issue resolution
├── reports/                     # Current reports
└── archive/                     # Historical documentation
```

### Archive (Historical Documentation)
```
docs/archive/
├── README.md                    # Archive index
├── pre-launch-reports/         # Beta testing & UAT
├── development-phases/         # Phase 1-6 documentation
├── fixes-resolved/             # Resolved bug fixes
├── investigations/             # Completed investigations
├── recipes-historical/         # Historical recipe docs
├── pre-pivot-2025-10/          # Pre-transformation docs
└── roadmaps/                   # Superseded roadmaps
```

---

## 🎯 Common Questions

### Where is documentation about...?

#### Authentication & Users
- **Setup**: `docs/guides/authentication.md`
- **Admin Access**: `docs/guides/admin-setup.md`
- **Clerk Configuration**: `docs/guides/CLERK_SETUP_GUIDE.md`

#### Recipes & Content
- **Data Acquisition**: `docs/guides/data-acquisition.md`
- **Recipe Scraping**: `docs/scraping/`
- **Content Management**: `docs/features/`

#### Search & AI
- **Semantic Search**: `docs/guides/semantic-search.md`
- **Embeddings**: `docs/guides/EMBEDDINGS_GENERATION_GUIDE.md`
- **AI Integration**: `docs/reference/`

#### Database & Migrations
- **Schema**: `docs/reference/database.md`
- **Migrations**: `docs/migrations/`
- **Backup/Recovery**: Coming soon (see documentation gaps)

#### Performance & Monitoring
- **Performance**: `docs/performance/`
- **Monitoring**: Coming soon (see documentation gaps)
- **Analytics**: `docs/phase-6/` (archived)

#### Deployment
- **Deployment Guide**: `docs/getting-started/deployment.md`
- **Operations**: `docs/operations/`
- **Production Runbook**: Coming soon (see documentation gaps)

---

## 🕐 Historical Documentation

### Where did X document go?

#### Pre-Launch Reports
**Old Location:** `docs/reports/BETA_*.md`, `docs/reports/*UAT*.md`
**New Location:** `docs/archive/pre-launch-reports/`

#### Phase 6 Documentation
**Old Location:** `docs/phase-6/`
**New Location:** `docs/archive/development-phases/phase-6/`

#### Resolved Fixes
**Old Location:** `docs/fixes/`
**New Location:** `docs/archive/fixes-resolved/`

#### Investigation Reports
**Old Location:** `docs/investigations/`
**New Location:** `docs/archive/investigations/`

#### Recipe Documentation
**Old Location:** `docs/recipes/`
**New Location:** `docs/archive/recipes-historical/`

---

## 🔍 Search Documentation

### Command Line
```bash
# Search all documentation
grep -r "search term" docs/

# Search active documentation only (exclude archive)
grep -r "search term" docs/ --exclude-dir=archive

# Search archive only
grep -r "search term" docs/archive/

# Find files by name
find docs -name "*search-term*"

# Find recently modified files
find docs -type f -name "*.md" -mtime -30
```

### By Category
```bash
# Feature guides
ls docs/guides/

# API documentation
ls docs/api/

# Testing procedures
ls docs/testing/

# Archive contents
ls docs/archive/
```

---

## 📅 Documentation Updates

### Last Major Cleanup
**Date:** February 16, 2026
**Changes:**
- Archived 240+ historical files
- Added June 1, 2026 go-live date
- Created comprehensive archive structure
- Removed large binary files from docs/

### Next Review
**Date:** June 1, 2026 (Go-Live Date)
**Focus:**
- Update post-launch documentation
- Archive launch preparation docs
- Create production operations guides

---

## 📝 Documentation Gaps

Critical documentation needed before go-live:

1. **GO_LIVE_PLAN.md** - Go-live preparation checklist
2. **PRODUCTION_RUNBOOK.md** - Operations guide
3. **INCIDENT_RESPONSE.md** - Incident procedures
4. **SCALING_GUIDE.md** - Scaling strategies
5. **BACKUP_RECOVERY.md** - Backup procedures
6. **MONITORING_SETUP.md** - Monitoring configuration
7. **SECURITY_GUIDE.md** - Security practices
8. **CONTRIBUTING.md** - Contribution guidelines

See **[DOCUMENTATION_CLEANUP_REPORT.md](./DOCUMENTATION_CLEANUP_REPORT.md)** for complete gap analysis.

---

## 🆘 Need Help?

### Can't Find Documentation?
1. Check **[docs/README.md](./docs/README.md)** - Main documentation index
2. Search in **[docs/archive/](./docs/archive/)** - Historical documentation
3. Check **[DOCUMENTATION_CLEANUP_REPORT.md](./DOCUMENTATION_CLEANUP_REPORT.md)** - Detailed inventory

### Documentation is Outdated?
1. Check **[CHANGELOG.md](./CHANGELOG.md)** - Recent changes
2. Check **[docs/archive/](./docs/archive/)** - May have been archived
3. Open an issue to update documentation

### Documentation is Missing?
1. Check **[DOCUMENTATION_CLEANUP_REPORT.md](./DOCUMENTATION_CLEANUP_REPORT.md)** - Known gaps
2. Check **[docs/archive/](./docs/archive/)** - May be archived
3. Open an issue to request documentation

---

## 📊 Documentation Statistics

### Active Documentation
- **Total Active Files:** ~180 markdown files
- **Main Categories:** 11 directories
- **Archive Files:** 240+ files
- **README Files:** 20+ indexes

### Coverage
- ✅ Setup & Installation: Complete
- ✅ Feature Guides: Comprehensive
- ✅ API Documentation: Good coverage
- ✅ Testing: Well documented
- ⚠️ Operations: Gaps identified (see above)
- ⚠️ Security: Needs completion
- ⚠️ Contributing: Needs creation

---

## 🔗 External Resources

### Project Resources
- **GitHub Repository**: [Repository URL]
- **Production Site**: [Production URL]
- **Vercel Dashboard**: [Vercel URL]

### Dependencies Documentation
- **Next.js**: https://nextjs.org/docs
- **Drizzle ORM**: https://orm.drizzle.team/docs
- **Clerk**: https://clerk.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com/

---

**Quick Reference Maintained By:** Documentation Team
**Last Updated:** February 16, 2026
**Next Update:** June 1, 2026 (Go-Live)
