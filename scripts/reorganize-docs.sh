#!/bin/bash
# Documentation Reorganization Script
# Moves root .md files to organized docs/ structure

set -e

echo "📚 Starting documentation reorganization..."

# Create archive directory for old docs
mkdir -p docs/archive

# Move implementation docs
echo "Moving implementation docs..."
[ -f "THEMEALDB_IMPLEMENTATION_STATUS.md" ] && mv "THEMEALDB_IMPLEMENTATION_STATUS.md" "docs/implementation/themealdb-status.md"
[ -f "IMPLEMENTATION_SUMMARY.md" ] && mv "IMPLEMENTATION_SUMMARY.md" "docs/implementation/summary.md"
[ -f "SCRAPER_IMPLEMENTATION.md" ] && mv "SCRAPER_IMPLEMENTATION.md" "docs/implementation/scraper.md"
[ -f "SCRAPER_README.md" ] && mv "SCRAPER_README.md" "docs/implementation/scraper-readme.md"

# Move guide docs (already created, so archive originals)
echo "Archiving original guide docs..."
[ -f "RECIPE_RATING_SYSTEM.md" ] && mv "RECIPE_RATING_SYSTEM.md" "docs/archive/"
[ -f "SEMANTIC_SEARCH_GUIDE.md" ] && mv "SEMANTIC_SEARCH_GUIDE.md" "docs/archive/"
[ -f "SEMANTIC_SEARCH_IMPLEMENTATION.md" ] && mv "SEMANTIC_SEARCH_IMPLEMENTATION.md" "docs/archive/"

# Move recipe discovery docs
echo "Moving recipe discovery docs..."
[ -f "RECIPE_DISCOVERY_COMPLETE.md" ] && mv "RECIPE_DISCOVERY_COMPLETE.md" "docs/implementation/recipe-discovery-complete.md"
[ -f "RECIPE_DISCOVERY_INTEGRATION.md" ] && mv "RECIPE_DISCOVERY_INTEGRATION.md" "docs/implementation/recipe-discovery-integration.md"
[ -f "RECIPE_DISCOVERY_PIPELINE.md" ] && mv "RECIPE_DISCOVERY_PIPELINE.md" "docs/archive/"
[ -f "RECIPE_CRAWL_README.md" ] && mv "RECIPE_CRAWL_README.md" "docs/archive/"

# Move embedding docs
echo "Moving embedding docs..."
[ -f "EMBEDDING_FIX_SUMMARY.md" ] && mv "EMBEDDING_FIX_SUMMARY.md" "docs/troubleshooting/embedding-fix.md"
[ -f "EMBEDDING_IMPLEMENTATION_SUMMARY.md" ] && mv "EMBEDDING_IMPLEMENTATION_SUMMARY.md" "docs/archive/"
[ -f "EMBEDDING_QUICK_REFERENCE.md" ] && mv "EMBEDDING_QUICK_REFERENCE.md" "docs/reference/embedding-reference.md"
[ -f "EMBEDDING_FILES.txt" ] && mv "EMBEDDING_FILES.txt" "docs/archive/"

# Move admin docs
echo "Moving admin docs..."
[ -f "ADMIN_DASHBOARD_GUIDE.md" ] && mv "ADMIN_DASHBOARD_GUIDE.md" "docs/guides/admin-dashboard.md"
[ -f "ADMIN_FIX_SUMMARY.md" ] && mv "ADMIN_FIX_SUMMARY.md" "docs/troubleshooting/admin-fix.md"
[ -f "ADMIN_FLOW_DIAGRAM.md" ] && mv "ADMIN_FLOW_DIAGRAM.md" "docs/reference/admin-flow.md"
[ -f "ADMIN_QUICK_REFERENCE.md" ] && mv "ADMIN_QUICK_REFERENCE.md" "docs/reference/admin-reference.md"
[ -f "ADMIN_SECURITY_TEST_REPORT.md" ] && mv "ADMIN_SECURITY_TEST_REPORT.md" "docs/archive/"
[ -f "ADMIN_SETUP_GUIDE.md" ] && mv "ADMIN_SETUP_GUIDE.md" "docs/guides/admin-setup.md"

# Move pgvector docs
echo "Moving database docs..."
[ -f "PGVECTOR_QUICKSTART.md" ] && mv "PGVECTOR_QUICKSTART.md" "docs/guides/pgvector-quickstart.md"
[ -f "PGVECTOR_SETUP.md" ] && mv "PGVECTOR_SETUP.md" "docs/guides/pgvector-setup.md"

# Move troubleshooting docs
echo "Moving troubleshooting docs..."
[ -f "SCHEMA_FIX_REPORT.md" ] && mv "SCHEMA_FIX_REPORT.md" "docs/troubleshooting/schema-fix.md"
[ -f "SCHEMA_FIX_SUMMARY.md" ] && mv "SCHEMA_FIX_SUMMARY.md" "docs/archive/"
[ -f "SECURITY_FIX_PERPLEXITY.md" ] && mv "SECURITY_FIX_PERPLEXITY.md" "docs/troubleshooting/security-fix.md"
[ -f "INVALID_TIME_VALUE_FIX.md" ] && mv "docs/INVALID_TIME_VALUE_FIX.md" "docs/troubleshooting/invalid-time-fix.md" 2>/dev/null || true

# Move verification and deployment docs
echo "Moving deployment and verification docs..."
[ -f "DEPLOYMENT_READY.md" ] && mv "DEPLOYMENT_READY.md" "docs/archive/"
[ -f "VERIFICATION_COMPLETE.md" ] && mv "VERIFICATION_COMPLETE.md" "docs/archive/"
[ -f "PIPELINE_VERIFICATION_REPORT.md" ] && mv "PIPELINE_VERIFICATION_REPORT.md" "docs/archive/"

# Move API docs
echo "Moving API docs..."
[ -f "BRAVE_SEARCH_API.md" ] && mv "BRAVE_SEARCH_API.md" "docs/api/brave-search.md"
[ -f "docs/API_CRAWL.md" ] && mv "docs/API_CRAWL.md" "docs/api/crawl.md" 2>/dev/null || true

# Move quality docs
echo "Moving quality docs..."
[ -f "QUALITY.md" ] && mv "QUALITY.md" "docs/archive/"

# Archive remaining docs from docs/ root
echo "Archiving docs from docs/ root..."
[ -f "docs/CRAWL_API_SETUP_COMPLETE.md" ] && mv "docs/CRAWL_API_SETUP_COMPLETE.md" "docs/archive/" 2>/dev/null || true
[ -f "docs/EMBEDDINGS.md" ] && mv "docs/EMBEDDINGS.md" "docs/archive/" 2>/dev/null || true
[ -f "docs/RECIPE_CRAWL_PIPELINE.md" ] && mv "docs/RECIPE_CRAWL_PIPELINE.md" "docs/archive/" 2>/dev/null || true
[ -f "docs/RECIPE_CRAWL_SETUP.md" ] && mv "docs/RECIPE_CRAWL_SETUP.md" "docs/archive/" 2>/dev/null || true
[ -f "docs/SCRAPER_QUICK_START.md" ] && mv "docs/SCRAPER_QUICK_START.md" "docs/archive/" 2>/dev/null || true
[ -f "docs/VERCEL_DEPLOYMENT.md" ] && mv "docs/VERCEL_DEPLOYMENT.md" "docs/archive/" 2>/dev/null || true
[ -f "docs/DEPLOYMENT_CHECKLIST.md" ] && mv "docs/DEPLOYMENT_CHECKLIST.md" "docs/archive/" 2>/dev/null || true
[ -f "docs/BRAND_QUICK_REFERENCE.md" ] && mv "docs/BRAND_QUICK_REFERENCE.md" "docs/reference/brand-reference.md" 2>/dev/null || true

echo "✅ Documentation reorganization complete!"
echo ""
echo "📁 New structure:"
echo "  docs/"
echo "    ├── README.md (documentation hub)"
echo "    ├── getting-started/"
echo "    ├── guides/"
echo "    ├── api/"
echo "    ├── reference/"
echo "    ├── implementation/"
echo "    ├── troubleshooting/"
echo "    └── archive/ (old docs)"
echo ""
echo "🧹 To clean up (optional):"
echo "  rm -rf docs/archive"
