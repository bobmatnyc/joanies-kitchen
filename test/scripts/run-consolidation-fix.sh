#!/bin/bash
# Comprehensive Ingredient Consolidation Fix Script
#
# This script runs the complete fix process with safety checks:
# 1. Create full backup
# 2. Run dry run for validation
# 3. Execute the fix
# 4. Validate results
#
# Usage: ./scripts/run-consolidation-fix.sh [--skip-backup] [--auto-confirm]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_BACKUP=false
AUTO_CONFIRM=false

for arg in "$@"; do
  case $arg in
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --auto-confirm)
      AUTO_CONFIRM=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown argument: $arg${NC}"
      echo "Usage: ./scripts/run-consolidation-fix.sh [--skip-backup] [--auto-confirm]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Ingredient Consolidation Duplicate Constraint Fix        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Create backup
if [ "$SKIP_BACKUP" = false ]; then
  echo -e "${YELLOW}[Step 1/4] Creating full backup...${NC}"
  echo ""
  npx tsx scripts/create-ingredient-backup.ts

  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backup creation failed!${NC}"
    exit 1
  fi

  echo -e "${GREEN}✅ Backup created successfully${NC}"
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping backup (--skip-backup flag)${NC}"
  echo ""
fi

# Step 2: Dry run validation
echo -e "${YELLOW}[Step 2/4] Running dry run validation...${NC}"
echo ""
npx tsx scripts/fix-duplicate-constraints.ts --dry-run > /tmp/consolidation-dryrun.log 2>&1

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Dry run failed! Check /tmp/consolidation-dryrun.log${NC}"
  cat /tmp/consolidation-dryrun.log
  exit 1
fi

# Extract key metrics from dry run
RECIPES_ANALYZED=$(grep "Recipes analyzed:" /tmp/consolidation-dryrun.log | tail -1 | awk '{print $4}')
DUPLICATES_FOUND=$(grep "Recipes with duplicates:" /tmp/consolidation-dryrun.log | tail -1 | awk '{print $5}')
DUPLICATES_TO_REMOVE=$(grep "Duplicate entries removed:" /tmp/consolidation-dryrun.log | tail -1 | awk '{print $5}')
RETRY_SUCCESSES=$(grep "Successful:" /tmp/consolidation-dryrun.log | tail -1 | awk '{print $3}')
RETRY_FAILED=$(grep "Failed:" /tmp/consolidation-dryrun.log | tail -1 | awk '{print $3}')

echo -e "${GREEN}✅ Dry run completed successfully${NC}"
echo ""
echo -e "${BLUE}📊 Dry Run Summary:${NC}"
echo "   - Recipes analyzed: ${RECIPES_ANALYZED}"
echo "   - Recipes with duplicates: ${DUPLICATES_FOUND}"
echo "   - Duplicate entries to remove: ${DUPLICATES_TO_REMOVE}"
echo "   - Consolidations to retry: ${RETRY_SUCCESSES}"
echo "   - Expected failures: ${RETRY_FAILED}"
echo ""

if [ "$RETRY_FAILED" != "0" ]; then
  echo -e "${RED}⚠️  Dry run shows expected failures: ${RETRY_FAILED}${NC}"
  echo -e "${RED}   Review dry run log before proceeding!${NC}"
  cat /tmp/consolidation-dryrun.log
  exit 1
fi

# Step 3: Confirm execution
if [ "$AUTO_CONFIRM" = false ]; then
  echo -e "${YELLOW}[Step 3/4] Ready to execute fix${NC}"
  echo ""
  echo -e "${YELLOW}⚠️  This will modify the database!${NC}"
  echo "   - ${DUPLICATES_TO_REMOVE} duplicate entries will be removed"
  echo "   - ${RETRY_SUCCESSES} consolidations will be retried"
  echo ""
  read -p "Do you want to proceed? (yes/no): " -r
  echo ""

  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}❌ Execution cancelled by user${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}[Step 3/4] Auto-confirming execution (--auto-confirm flag)${NC}"
  echo ""
fi

# Step 4: Execute the fix
echo -e "${YELLOW}[Step 4/4] Executing consolidation fix...${NC}"
echo ""
npx tsx scripts/fix-duplicate-constraints.ts

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Fix execution failed!${NC}"
  echo ""
  echo -e "${YELLOW}To rollback, find your backup file in tmp/ and run:${NC}"
  echo "   npx tsx scripts/rollback-ingredient-backup.ts tmp/ingredient-full-backup-<timestamp>.json"
  exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Consolidation Fix Completed Successfully!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Find latest report
LATEST_REPORT=$(ls -t tmp/duplicate-fix-report-*.json 2>/dev/null | head -1)

if [ -n "$LATEST_REPORT" ]; then
  echo -e "${BLUE}📁 Detailed report saved to: ${LATEST_REPORT}${NC}"
  echo ""

  # Extract final metrics
  FINAL_SUCCESS=$(grep -o '"retrySuccesses":[0-9]*' "$LATEST_REPORT" | cut -d: -f2)
  FINAL_FAILED=$(grep -o '"retryFailed":[0-9]*' "$LATEST_REPORT" | cut -d: -f2)

  echo -e "${BLUE}📊 Final Results:${NC}"
  echo "   - Successful consolidations: ${FINAL_SUCCESS}"
  echo "   - Failed consolidations: ${FINAL_FAILED}"
  echo ""

  if [ "$FINAL_FAILED" = "0" ]; then
    echo -e "${GREEN}✅ All consolidations completed successfully!${NC}"
  else
    echo -e "${YELLOW}⚠️  ${FINAL_FAILED} consolidations still failed${NC}"
    echo "   Review the report for details."
  fi
fi

echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "   1. Verify database integrity"
echo "   2. Run ingredient statistics update"
echo "   3. Test Fridge feature functionality"
echo "   4. Archive execution reports"
echo ""

# Find latest backup
LATEST_BACKUP=$(ls -t tmp/ingredient-full-backup-*.json 2>/dev/null | head -1)

if [ -n "$LATEST_BACKUP" ]; then
  echo -e "${BLUE}💾 Backup location (for rollback if needed):${NC}"
  echo "   ${LATEST_BACKUP}"
  echo ""
  echo -e "${YELLOW}To rollback:${NC}"
  echo "   npx tsx scripts/rollback-ingredient-backup.ts ${LATEST_BACKUP}"
  echo ""
fi
