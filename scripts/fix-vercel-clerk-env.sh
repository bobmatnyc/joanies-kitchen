#!/bin/bash

# =============================================================================
# Vercel Clerk Environment Variables Fix Script
# =============================================================================
# This script helps update Vercel environment variables to use production Clerk keys
# in the production environment.
#
# ISSUE: Production environment was using test keys (pk_test_, sk_test_) which are
# not valid for the recipes.help domain, causing "Invalid host" errors.
#
# SOLUTION: Update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to use
# production keys (pk_live_, sk_live_) in the production environment.
# =============================================================================

set -e

echo "======================================================================="
echo "Vercel Clerk Environment Variables Fix"
echo "======================================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we have the production keys in environment
if [ -f .env.vercel.production ]; then
  echo -e "${GREEN}✓${NC} Found .env.vercel.production file"

  # Extract production keys
  PROD_PUB_KEY=$(grep "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD" .env.vercel.production | cut -d'"' -f2 | tr -d '\n')
  PROD_SECRET_KEY=$(grep "CLERK_SECRET_KEY_PROD" .env.vercel.production | cut -d'"' -f2 | tr -d '\n')

  echo "Production Publishable Key: ${PROD_PUB_KEY:0:20}..."
  echo "Production Secret Key: ${PROD_SECRET_KEY:0:20}..."
  echo ""
else
  echo -e "${RED}✗${NC} .env.vercel.production not found"
  echo "Run: vercel env pull .env.vercel.production --environment=production --yes"
  exit 1
fi

echo "======================================================================="
echo "Required Actions:"
echo "======================================================================="
echo ""
echo "You need to update the following environment variables in Vercel Dashboard:"
echo ""
echo "1. Go to: https://vercel.com/1-m/joanies-kitchen/settings/environment-variables"
echo ""
echo "2. Update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY for Production:"
echo "   - Current value: pk_test_... (TEST KEY - INCORRECT)"
echo "   - New value: ${PROD_PUB_KEY:0:30}..."
echo "   - Environment: Production only"
echo ""
echo "3. Update CLERK_SECRET_KEY for Production:"
echo "   - Current value: sk_test_... (TEST KEY - INCORRECT)"
echo "   - New value: ${PROD_SECRET_KEY:0:30}..."
echo "   - Environment: Production only"
echo ""
echo "======================================================================="
echo "Automated Update Commands:"
echo "======================================================================="
echo ""
echo "Run these commands to update the environment variables automatically:"
echo ""

# Note: We cannot directly update existing variables with Vercel CLI
# We need to remove and re-add them

echo -e "${YELLOW}# Step 1: Remove incorrect production variables${NC}"
echo "vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production"
echo "vercel env rm CLERK_SECRET_KEY production"
echo ""

echo -e "${YELLOW}# Step 2: Add correct production variables${NC}"
echo "echo \"$PROD_PUB_KEY\" | vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production"
echo "echo \"$PROD_SECRET_KEY\" | vercel env add CLERK_SECRET_KEY production"
echo ""

echo -e "${YELLOW}# Step 3: Redeploy${NC}"
echo "vercel --prod"
echo ""

echo "======================================================================="
echo "Manual Verification After Update:"
echo "======================================================================="
echo ""
echo "1. Check environment variables:"
echo "   vercel env ls | grep CLERK"
echo ""
echo "2. Verify production deployment:"
echo "   curl -I https://recipes.help"
echo ""
echo "3. Test authentication:"
echo "   - Visit: https://recipes.help/sign-in"
echo "   - Verify Clerk sign-in widget loads"
echo "   - Test sign-in flow"
echo ""

echo "======================================================================="
echo "Alternative: Use Vercel Dashboard (Recommended for Safety)"
echo "======================================================================="
echo ""
echo "1. Visit: https://vercel.com/1-m/joanies-kitchen/settings/environment-variables"
echo "2. Find 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY' in Production scope"
echo "3. Click 'Edit' and change value to: $PROD_PUB_KEY"
echo "4. Find 'CLERK_SECRET_KEY' in Production scope"
echo "5. Click 'Edit' and change value to: $PROD_SECRET_KEY"
echo "6. Redeploy: vercel --prod"
echo ""

echo "======================================================================="
echo "Root Cause Analysis:"
echo "======================================================================="
echo ""
echo "The error occurred because:"
echo "1. Production environment had test keys (pk_test_, sk_test_)"
echo "2. Test keys are only valid for development domains (*.clerk.accounts.dev)"
echo "3. Production domain (recipes.help) requires live keys (pk_live_, sk_live_)"
echo "4. Clerk rejected requests with error: 'Invalid host'"
echo ""
echo "The fix ensures production uses live keys while preserving test keys"
echo "for preview and development environments."
echo ""

echo "======================================================================="
echo "Next Steps:"
echo "======================================================================="
echo ""
echo "Choose one of the following options:"
echo ""
echo "A) Automated update (use with caution):"
echo "   ./scripts/fix-vercel-clerk-env-automated.sh"
echo ""
echo "B) Manual update via Vercel Dashboard (recommended):"
echo "   Follow the steps in the 'Alternative' section above"
echo ""
echo "C) Manual update via CLI:"
echo "   Copy and run the commands from 'Automated Update Commands' above"
echo ""
