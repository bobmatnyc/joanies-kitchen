#!/bin/bash

# =============================================================================
# Automated Vercel Clerk Environment Variables Fix
# =============================================================================
# This script automatically updates Vercel production environment variables
# to use the correct production Clerk keys.
#
# WARNING: This will remove and re-add environment variables.
# Make sure you have a backup of .env.vercel.production before running.
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================================================="
echo "Automated Vercel Clerk Environment Variables Fix"
echo "======================================================================="
echo ""

# Check if we have the production keys
if [ ! -f .env.vercel.production ]; then
  echo -e "${RED}✗${NC} .env.vercel.production not found"
  echo "Run: vercel env pull .env.vercel.production --environment=production --yes"
  exit 1
fi

# Extract production keys
PROD_PUB_KEY=$(grep "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD" .env.vercel.production | cut -d'"' -f2 | tr -d '\n')
PROD_SECRET_KEY=$(grep "CLERK_SECRET_KEY_PROD" .env.vercel.production | cut -d'"' -f2 | tr -d '\n')

if [ -z "$PROD_PUB_KEY" ] || [ -z "$PROD_SECRET_KEY" ]; then
  echo -e "${RED}✗${NC} Could not extract production keys from .env.vercel.production"
  exit 1
fi

echo -e "${GREEN}✓${NC} Found production keys"
echo "   Publishable Key: ${PROD_PUB_KEY:0:20}..."
echo "   Secret Key: ${PROD_SECRET_KEY:0:20}..."
echo ""

# Confirmation prompt
echo -e "${YELLOW}WARNING:${NC} This will update production environment variables."
echo "This action will:"
echo "  1. Remove current NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (production scope)"
echo "  2. Remove current CLERK_SECRET_KEY (production scope)"
echo "  3. Add new values with production keys"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo -e "${YELLOW}Aborted.${NC} No changes were made."
  exit 0
fi

echo ""
echo "======================================================================="
echo "Step 1: Removing old environment variables..."
echo "======================================================================="
echo ""

# Remove old variables
echo -e "${BLUE}Removing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY from production...${NC}"
vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --yes 2>&1 || echo "Variable may not exist or already removed"

echo -e "${BLUE}Removing CLERK_SECRET_KEY from production...${NC}"
vercel env rm CLERK_SECRET_KEY production --yes 2>&1 || echo "Variable may not exist or already removed"

echo ""
echo "======================================================================="
echo "Step 2: Adding new environment variables..."
echo "======================================================================="
echo ""

# Add new variables
echo -e "${BLUE}Adding NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to production...${NC}"
echo "$PROD_PUB_KEY" | vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production

echo -e "${BLUE}Adding CLERK_SECRET_KEY to production...${NC}"
echo "$PROD_SECRET_KEY" | vercel env add CLERK_SECRET_KEY production

echo ""
echo "======================================================================="
echo "Step 3: Verification"
echo "======================================================================="
echo ""

echo -e "${BLUE}Fetching updated environment variables...${NC}"
vercel env ls | grep -E "(CLERK_SECRET_KEY|CLERK_PUBLISHABLE_KEY)" || true

echo ""
echo "======================================================================="
echo "Step 4: Deploy to production"
echo "======================================================================="
echo ""

read -p "Deploy to production now? (yes/no): " DEPLOY_CONFIRM

if [ "$DEPLOY_CONFIRM" = "yes" ]; then
  echo -e "${BLUE}Deploying to production...${NC}"
  vercel --prod

  echo ""
  echo -e "${GREEN}✓${NC} Deployment initiated"
  echo ""
  echo "Monitor deployment at: https://vercel.com/1-m/joanies-kitchen/deployments"
else
  echo ""
  echo -e "${YELLOW}Deployment skipped.${NC}"
  echo "To deploy manually, run: vercel --prod"
fi

echo ""
echo "======================================================================="
echo "Next Steps:"
echo "======================================================================="
echo ""
echo "1. Wait for deployment to complete"
echo "2. Verify Clerk configuration in dashboard:"
echo "   https://dashboard.clerk.com"
echo "   - Check that recipes.help is in allowed domains"
echo "   - Verify redirect URLs are configured"
echo ""
echo "3. Test authentication on production:"
echo "   https://recipes.help/sign-in"
echo ""
echo "4. Monitor for errors:"
echo "   vercel logs --prod"
echo ""

echo -e "${GREEN}✓${NC} Script completed successfully!"
