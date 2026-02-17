#!/bin/bash

echo "==================================================="
echo "Testing Fridge Search Fixes"
echo "==================================================="
echo ""

BASE_URL="http://localhost:3005"
FRIDGE_URL="${BASE_URL}/fridge"
RESULTS_URL="${BASE_URL}/fridge/results"

echo "1. Testing fridge page load..."
FRIDGE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$FRIDGE_URL")
FRIDGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRIDGE_URL")
echo "   Status: $FRIDGE_STATUS"
echo "   Load time: ${FRIDGE_TIME}s"
echo ""

echo "2. Testing search with valid ingredients (chicken, rice)..."
echo "   Starting timer..."
START=$(date +%s)

# Perform the search
SEARCH_RESULT=$(curl -s -X POST "$FRIDGE_URL" \
  -H "Content-Type: application/json" \
  -d '{"ingredients":["chicken","rice"]}' \
  --max-time 15 \
  -w "\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}")

END=$(date +%s)
DURATION=$((END - START))

# Extract HTTP status and time
HTTP_STATUS=$(echo "$SEARCH_RESULT" | grep "HTTP_STATUS" | cut -d: -f2)
TIME_TOTAL=$(echo "$SEARCH_RESULT" | grep "TIME_TOTAL" | cut -d: -f2)

echo "   HTTP Status: $HTTP_STATUS"
echo "   Response time: ${TIME_TOTAL}s"
echo "   Total duration: ${DURATION}s"
echo ""

if [ "$DURATION" -le 10 ]; then
    echo "   ✓ SUCCESS: Search completed within 10 seconds"
else
    echo "   ✗ FAILURE: Search took longer than 10 seconds"
fi
echo ""

echo "3. Testing results page load..."
RESULTS_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$RESULTS_URL?ingredients=chicken,rice")
RESULTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$RESULTS_URL?ingredients=chicken,rice")
echo "   Status: $RESULTS_STATUS"
echo "   Load time: ${RESULTS_TIME}s"
echo ""

echo "==================================================="
echo "Test Summary"
echo "==================================================="
echo "Fridge Page:"
echo "  - Status: $FRIDGE_STATUS (Expected: 200)"
echo "  - Load time: ${FRIDGE_TIME}s"
echo ""
echo "Search Functionality:"
echo "  - Status: $HTTP_STATUS (Expected: 200/302)"
echo "  - Duration: ${DURATION}s (Target: <10s)"
echo "  - Response time: ${TIME_TOTAL}s"
echo ""
echo "Results Page:"
echo "  - Status: $RESULTS_STATUS (Expected: 200)"
echo "  - Load time: ${RESULTS_TIME}s"
echo ""

if [ "$FRIDGE_STATUS" = "200" ] && [ "$RESULTS_STATUS" = "200" ] && [ "$DURATION" -le 10 ]; then
    echo "✓ ALL TESTS PASSED"
    exit 0
else
    echo "✗ SOME TESTS FAILED"
    exit 1
fi
