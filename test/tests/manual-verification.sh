#!/bin/bash
# Manual verification script for critical fixes
# Tests the specific issues that were supposed to be fixed

BASE_URL="http://localhost:3005"
REPORT_FILE="test-screenshots/verification-report.txt"

echo "=== FINAL COMPREHENSIVE QA VERIFICATION ===" > "$REPORT_FILE"
echo "Application URL: $BASE_URL" >> "$REPORT_FILE"
echo "Test Date: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASS=0
FAIL=0
WARN=0

# Test 1: Check if application is running
echo -e "\n${YELLOW}TEST 1: Application Availability${NC}"
echo "TEST 1: Application Availability" >> "$REPORT_FILE"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ PASS${NC}: Application is running (HTTP $HTTP_CODE)"
  echo "✓ PASS: Application is running (HTTP $HTTP_CODE)" >> "$REPORT_FILE"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: Application not accessible (HTTP $HTTP_CODE)"
  echo "✗ FAIL: Application not accessible (HTTP $HTTP_CODE)" >> "$REPORT_FILE"
  ((FAIL++))
fi

# Test 2: Recipe page load time (CRITICAL - This was supposed to be fixed)
echo -e "\n${YELLOW}TEST 2: Recipe Detail Page Load Time (<5 seconds)${NC}"
echo "" >> "$REPORT_FILE"
echo "TEST 2: Recipe Detail Page Load Time" >> "$REPORT_FILE"

START_TIME=$(date +%s%3N)
RECIPE_HTTP=$(curl -s -o /dev/null -w "%{http_code}\n%{time_total}" "$BASE_URL/recipes/kale-white-bean-stew-2")
END_TIME=$(date +%s%3N)
RECIPE_CODE=$(echo "$RECIPE_HTTP" | head -1)
RECIPE_TIME=$(echo "$RECIPE_HTTP" | tail -1)
TOTAL_TIME=$(echo "scale=3; ($END_TIME - $START_TIME) / 1000" | bc)

echo "HTTP Status: $RECIPE_CODE"
echo "Load Time: ${RECIPE_TIME}s"

if [ "$RECIPE_CODE" = "200" ]; then
  if (( $(echo "$RECIPE_TIME < 5.0" | bc -l) )); then
    echo -e "${GREEN}✓ PASS${NC}: Recipe page loads in ${RECIPE_TIME}s (< 5s)"
    echo "✓ PASS: Recipe page loads in ${RECIPE_TIME}s (< 5s)" >> "$REPORT_FILE"
    ((PASS++))
  else
    echo -e "${RED}✗ FAIL${NC}: Recipe page too slow: ${RECIPE_TIME}s (should be < 5s)"
    echo "✗ FAIL: Recipe page too slow: ${RECIPE_TIME}s (should be < 5s)" >> "$REPORT_FILE"
    ((FAIL++))
  fi
else
  echo -e "${RED}✗ FAIL${NC}: Recipe page returned HTTP $RECIPE_CODE"
  echo "✗ FAIL: Recipe page returned HTTP $RECIPE_CODE" >> "$REPORT_FILE"
  ((FAIL++))
fi

# Test 3: Autocomplete API endpoint performance
echo -e "\n${YELLOW}TEST 3: Autocomplete API Performance (<500ms)${NC}"
echo "" >> "$REPORT_FILE"
echo "TEST 3: Autocomplete API Performance" >> "$REPORT_FILE"

# First request (uncached)
START_TIME=$(date +%s%3N)
AUTO_RESPONSE=$(curl -s -w "\n%{time_total}" "$BASE_URL/api/ingredients/autocomplete?query=tom")
END_TIME=$(date +%s%3N)
AUTO_TIME=$(echo "$AUTO_RESPONSE" | tail -1)
TOTAL_TIME=$(echo "scale=3; ($END_TIME - $START_TIME) / 1000" | bc)

echo "First request time: ${AUTO_TIME}s"

if (( $(echo "$AUTO_TIME < 0.5" | bc -l) )); then
  echo -e "${GREEN}✓ PASS${NC}: Autocomplete responds in ${AUTO_TIME}s (< 500ms)"
  echo "✓ PASS: Autocomplete responds in ${AUTO_TIME}s (< 500ms)" >> "$REPORT_FILE"
  ((PASS++))
else
  echo -e "${YELLOW}⚠ WARN${NC}: Autocomplete slow: ${AUTO_TIME}s (should be < 500ms)"
  echo "⚠ WARN: Autocomplete slow: ${AUTO_TIME}s (should be < 500ms)" >> "$REPORT_FILE"
  ((WARN++))
fi

# Second request (should be cached)
START_TIME=$(date +%s%3N)
AUTO_RESPONSE2=$(curl -s -w "\n%{time_total}" "$BASE_URL/api/ingredients/autocomplete?query=tom")
END_TIME=$(date +%s%3N)
AUTO_TIME2=$(echo "$AUTO_RESPONSE2" | tail -1)

echo "Cached request time: ${AUTO_TIME2}s"

if (( $(echo "$AUTO_TIME2 < 0.1" | bc -l) )); then
  echo -e "${GREEN}✓ PASS${NC}: Cached autocomplete responds in ${AUTO_TIME2}s (< 100ms)"
  echo "✓ PASS: Cached autocomplete responds in ${AUTO_TIME2}s (< 100ms)" >> "$REPORT_FILE"
  ((PASS++))
else
  echo -e "${YELLOW}⚠ WARN${NC}: Cached autocomplete: ${AUTO_TIME2}s (should be < 100ms)"
  echo "⚠ WARN: Cached autocomplete: ${AUTO_TIME2}s (should be < 100ms)" >> "$REPORT_FILE"
  ((WARN++))
fi

# Test 4: Fridge page availability
echo -e "\n${YELLOW}TEST 4: Fridge Page Availability${NC}"
echo "" >> "$REPORT_FILE"
echo "TEST 4: Fridge Page Availability" >> "$REPORT_FILE"

FRIDGE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/fridge")
if [ "$FRIDGE_HTTP" = "200" ]; then
  echo -e "${GREEN}✓ PASS${NC}: Fridge page accessible (HTTP $FRIDGE_HTTP)"
  echo "✓ PASS: Fridge page accessible (HTTP $FRIDGE_HTTP)" >> "$REPORT_FILE"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: Fridge page not accessible (HTTP $FRIDGE_HTTP)"
  echo "✗ FAIL: Fridge page not accessible (HTTP $FRIDGE_HTTP)" >> "$REPORT_FILE"
  ((FAIL++))
fi

# Test 5: Inventory page availability
echo -e "\n${YELLOW}TEST 5: Inventory Page Availability${NC}"
echo "" >> "$REPORT_FILE"
echo "TEST 5: Inventory Page Availability" >> "$REPORT_FILE"

INV_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/inventory")
if [ "$INV_HTTP" = "200" ]; then
  echo -e "${GREEN}✓ PASS${NC}: Inventory page accessible (HTTP $INV_HTTP)"
  echo "✓ PASS: Inventory page accessible (HTTP $INV_HTTP)" >> "$REPORT_FILE"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: Inventory page not accessible (HTTP $INV_HTTP)"
  echo "✗ FAIL: Inventory page not accessible (HTTP $INV_HTTP)" >> "$REPORT_FILE"
  ((FAIL++))
fi

# Test 6: Check for common errors in HTML response
echo -e "\n${YELLOW}TEST 6: Homepage Error Check${NC}"
echo "" >> "$REPORT_FILE"
echo "TEST 6: Homepage Error Check" >> "$REPORT_FILE"

HOME_RESPONSE=$(curl -s "$BASE_URL/")
if echo "$HOME_RESPONSE" | grep -q "Application error"; then
  echo -e "${RED}✗ FAIL${NC}: Homepage contains application errors"
  echo "✗ FAIL: Homepage contains application errors" >> "$REPORT_FILE"
  ((FAIL++))
elif echo "$HOME_RESPONSE" | grep -q "Something went wrong"; then
  echo -e "${RED}✗ FAIL${NC}: Homepage shows error message"
  echo "✗ FAIL: Homepage shows error message" >> "$REPORT_FILE"
  ((FAIL++))
else
  echo -e "${GREEN}✓ PASS${NC}: No visible errors on homepage"
  echo "✓ PASS: No visible errors on homepage" >> "$REPORT_FILE"
  ((PASS++))
fi

# Test 7: Multiple recipe pages (sampling)
echo -e "\n${YELLOW}TEST 7: Multiple Recipe Pages Sampling${NC}"
echo "" >> "$REPORT_FILE"
echo "TEST 7: Multiple Recipe Pages Sampling" >> "$REPORT_FILE"

RECIPE_FAILURES=0
RECIPE_SUCCESSES=0

for slug in "kale-white-bean-stew-2" "chicken-rice-onion" "pasta-primavera"; do
  START_TIME=$(date +%s%3N)
  SAMPLE_HTTP=$(curl -s -o /dev/null -w "%{http_code}\n%{time_total}" "$BASE_URL/recipes/$slug")
  END_TIME=$(date +%s%3N)
  SAMPLE_CODE=$(echo "$SAMPLE_HTTP" | head -1)
  SAMPLE_TIME=$(echo "$SAMPLE_HTTP" | tail -1)

  echo "  Recipe '$slug': HTTP $SAMPLE_CODE in ${SAMPLE_TIME}s"

  if [ "$SAMPLE_CODE" = "200" ] && (( $(echo "$SAMPLE_TIME < 5.0" | bc -l) )); then
    ((RECIPE_SUCCESSES++))
  else
    ((RECIPE_FAILURES++))
  fi
done

if [ $RECIPE_FAILURES -eq 0 ]; then
  echo -e "${GREEN}✓ PASS${NC}: All sampled recipe pages load correctly"
  echo "✓ PASS: All sampled recipe pages load correctly" >> "$REPORT_FILE"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: $RECIPE_FAILURES/$((RECIPE_SUCCESSES + RECIPE_FAILURES)) recipe pages failed"
  echo "✗ FAIL: $RECIPE_FAILURES/$((RECIPE_SUCCESSES + RECIPE_FAILURES)) recipe pages failed" >> "$REPORT_FILE"
  ((FAIL++))
fi

# Test 8: API health check
echo -e "\n${YELLOW}TEST 8: API Endpoints Health${NC}"
echo "" >> "$REPORT_FILE"
echo "TEST 8: API Endpoints Health" >> "$REPORT_FILE"

# Check ingredients autocomplete
API_HEALTH_PASS=0
API_HEALTH_FAIL=0

AUTO_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/ingredients/autocomplete?query=test")
if [ "$AUTO_CHECK" = "200" ]; then
  echo "  Autocomplete API: HTTP $AUTO_CHECK ✓"
  ((API_HEALTH_PASS++))
else
  echo "  Autocomplete API: HTTP $AUTO_CHECK ✗"
  ((API_HEALTH_FAIL++))
fi

if [ $API_HEALTH_FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ PASS${NC}: All API endpoints responding"
  echo "✓ PASS: All API endpoints responding" >> "$REPORT_FILE"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: Some API endpoints failing"
  echo "✗ FAIL: Some API endpoints failing" >> "$REPORT_FILE"
  ((FAIL++))
fi

# Summary
echo -e "\n${YELLOW}═══════════════════════════════════${NC}"
echo -e "${YELLOW}FINAL VERIFICATION SUMMARY${NC}"
echo -e "${YELLOW}═══════════════════════════════════${NC}"
echo "" >> "$REPORT_FILE"
echo "═══════════════════════════════════" >> "$REPORT_FILE"
echo "FINAL VERIFICATION SUMMARY" >> "$REPORT_FILE"
echo "═══════════════════════════════════" >> "$REPORT_FILE"

echo -e "${GREEN}✓ PASSED: $PASS${NC}"
echo -e "${YELLOW}⚠ WARNINGS: $WARN${NC}"
echo -e "${RED}✗ FAILED: $FAIL${NC}"

echo "✓ PASSED: $PASS" >> "$REPORT_FILE"
echo "⚠ WARNINGS: $WARN" >> "$REPORT_FILE"
echo "✗ FAILED: $FAIL" >> "$REPORT_FILE"

TOTAL=$((PASS + WARN + FAIL))
SUCCESS_RATE=$(echo "scale=2; ($PASS * 100) / $TOTAL" | bc)

echo -e "\n${YELLOW}Success Rate: ${SUCCESS_RATE}%${NC}"
echo "" >> "$REPORT_FILE"
echo "Success Rate: ${SUCCESS_RATE}%" >> "$REPORT_FILE"

# Production Readiness Score
if [ $FAIL -eq 0 ] && [ $WARN -eq 0 ]; then
  READINESS=100
  STATUS="PRODUCTION READY ✓"
elif [ $FAIL -eq 0 ]; then
  READINESS=85
  STATUS="PRODUCTION READY (with minor warnings) ⚠"
elif [ $FAIL -le 2 ]; then
  READINESS=60
  STATUS="NOT PRODUCTION READY - Critical fixes needed ✗"
else
  READINESS=30
  STATUS="NOT PRODUCTION READY - Major issues detected ✗✗"
fi

echo -e "\n${YELLOW}═══════════════════════════════════${NC}"
echo -e "${YELLOW}PRODUCTION READINESS: $READINESS/100${NC}"
echo -e "${YELLOW}STATUS: $STATUS${NC}"
echo -e "${YELLOW}═══════════════════════════════════${NC}"

echo "" >> "$REPORT_FILE"
echo "═══════════════════════════════════" >> "$REPORT_FILE"
echo "PRODUCTION READINESS: $READINESS/100" >> "$REPORT_FILE"
echo "STATUS: $STATUS" >> "$REPORT_FILE"
echo "═══════════════════════════════════" >> "$REPORT_FILE"

# Exit with appropriate code
if [ $FAIL -gt 0 ]; then
  exit 1
else
  exit 0
fi
