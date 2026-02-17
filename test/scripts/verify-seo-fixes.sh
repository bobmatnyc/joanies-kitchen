#!/bin/bash

###############################################################################
# SEO Fixes Verification Script
# Tests all critical SEO fixes implemented for Google Search Console issues
###############################################################################

set -e

echo "=========================================="
echo "SEO Fixes Verification Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL (change for production)
BASE_URL="${1:-http://localhost:3002}"

echo "Testing against: $BASE_URL"
echo ""

###############################################################################
# Test 1: Canonical URLs
###############################################################################

echo "=========================================="
echo "Test 1: Canonical URLs"
echo "=========================================="
echo ""

echo "1.1 Testing recipe page canonical..."
RECIPE_CANONICAL=$(curl -s "$BASE_URL/recipes/chicken-parmesan" | grep -o '<link rel="canonical"[^>]*>' || echo "NOT_FOUND")

if [[ "$RECIPE_CANONICAL" == *"canonical"* ]]; then
    echo -e "${GREEN}✓ Recipe canonical tag found${NC}"
    echo "   $RECIPE_CANONICAL"
else
    echo -e "${RED}✗ Recipe canonical tag MISSING${NC}"
fi
echo ""

echo "1.2 Testing chef page canonical..."
CHEF_CANONICAL=$(curl -s "$BASE_URL/chef/joanie" | grep -o '<link rel="canonical"[^>]*>' || echo "NOT_FOUND")

if [[ "$CHEF_CANONICAL" == *"canonical"* ]]; then
    echo -e "${GREEN}✓ Chef canonical tag found${NC}"
    echo "   $CHEF_CANONICAL"
else
    echo -e "${RED}✗ Chef canonical tag MISSING${NC}"
fi
echo ""

echo "1.3 Testing ingredient page canonical..."
ING_CANONICAL=$(curl -s "$BASE_URL/ingredients/chicken" | grep -o '<link rel="canonical"[^>]*>' || echo "NOT_FOUND")

if [[ "$ING_CANONICAL" == *"canonical"* ]]; then
    echo -e "${GREEN}✓ Ingredient canonical tag found${NC}"
    echo "   $ING_CANONICAL"
else
    echo -e "${RED}✗ Ingredient canonical tag MISSING${NC}"
fi
echo ""

###############################################################################
# Test 2: Sitemap (No Auth Pages)
###############################################################################

echo "=========================================="
echo "Test 2: Sitemap Cleanup"
echo "=========================================="
echo ""

echo "2.1 Checking for /recipes/new in sitemap..."
SITEMAP_NEW_COUNT=$(curl -s "$BASE_URL/sitemap.xml" | grep -c "/recipes/new" || echo "0")

if [[ "$SITEMAP_NEW_COUNT" == "0" ]]; then
    echo -e "${GREEN}✓ /recipes/new correctly excluded from sitemap${NC}"
else
    echo -e "${RED}✗ /recipes/new found in sitemap ($SITEMAP_NEW_COUNT times)${NC}"
fi
echo ""

echo "2.2 Checking sitemap contains recipe URLs..."
SITEMAP_RECIPE_COUNT=$(curl -s "$BASE_URL/sitemap.xml" | grep -c "<loc>.*\/recipes\/" || echo "0")

if [[ "$SITEMAP_RECIPE_COUNT" -gt "100" ]]; then
    echo -e "${GREEN}✓ Sitemap contains $SITEMAP_RECIPE_COUNT recipe URLs${NC}"
else
    echo -e "${YELLOW}⚠ Sitemap contains only $SITEMAP_RECIPE_COUNT recipe URLs (expected >100)${NC}"
fi
echo ""

###############################################################################
# Test 3: Robots.txt
###############################################################################

echo "=========================================="
echo "Test 3: Robots.txt Configuration"
echo "=========================================="
echo ""

echo "3.1 Checking robots.txt accessibility..."
ROBOTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/robots.txt")

if [[ "$ROBOTS_STATUS" == "200" ]]; then
    echo -e "${GREEN}✓ robots.txt accessible (HTTP 200)${NC}"
else
    echo -e "${RED}✗ robots.txt returned HTTP $ROBOTS_STATUS${NC}"
fi
echo ""

echo "3.2 Checking robots.txt blocks /admin/..."
ROBOTS_ADMIN=$(curl -s "$BASE_URL/robots.txt" | grep -c "Disallow: /admin/" || echo "0")

if [[ "$ROBOTS_ADMIN" -gt "0" ]]; then
    echo -e "${GREEN}✓ robots.txt blocks /admin/${NC}"
else
    echo -e "${RED}✗ robots.txt does NOT block /admin/${NC}"
fi
echo ""

echo "3.3 Checking robots.txt allows /recipes/..."
ROBOTS_RECIPES=$(curl -s "$BASE_URL/robots.txt" | grep -c "Allow: /recipes/" || echo "0")

if [[ "$ROBOTS_RECIPES" -gt "0" ]]; then
    echo -e "${GREEN}✓ robots.txt allows /recipes/${NC}"
else
    echo -e "${YELLOW}⚠ robots.txt does NOT explicitly allow /recipes/${NC}"
fi
echo ""

###############################################################################
# Test 4: Server-Side Redirects (if recipe UUID available)
###############################################################################

echo "=========================================="
echo "Test 4: Server-Side Redirects"
echo "=========================================="
echo ""

echo "4.1 Testing UUID → slug redirect..."
echo -e "${YELLOW}⚠ Requires a valid recipe UUID (skipping for now)${NC}"
echo "   To test manually:"
echo "   curl -I $BASE_URL/recipes/{uuid}"
echo "   Should return: 307/308 with Location: /recipes/{slug}"
echo ""

###############################################################################
# Summary
###############################################################################

echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Review any failures above"
echo "2. Test in production after deployment"
echo "3. Submit updated sitemap to Google Search Console"
echo "4. Request re-indexing for key pages"
echo ""
echo "For detailed report, see:"
echo "  docs/seo/SEO_FIXES_REPORT.md"
echo ""
