#!/bin/bash
##
# Manual Performance Test Script for Fridge Ingredient Search
# Tests direct API calls and measures performance
#

echo "🧪 Fridge Ingredient Search Performance Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="http://localhost:3002"

# Test function
test_performance() {
    local test_name="$1"
    local url="$2"

    echo "🔍 $test_name"
    echo "   URL: $url"

    # Measure request time
    start_time=$(date +%s%3N)
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" "$url" 2>/dev/null)
    end_time=$(date +%s%3N)

    # Extract timing and status code
    http_code=$(echo "$response" | tail -2 | head -1)
    time_total=$(echo "$response" | tail -1)
    timing_ms=$(echo "$time_total * 1000" | bc | cut -d'.' -f1)

    echo "   HTTP Status: $http_code"
    echo "   Response Time: ${timing_ms}ms"

    # Check if successful
    if [ "$http_code" = "200" ]; then
        echo "   ✅ SUCCESS"
        if [ "$timing_ms" -lt 1000 ]; then
            echo "   🎉 EXCELLENT: < 1 second"
        elif [ "$timing_ms" -lt 2000 ]; then
            echo "   ✅ GOOD: < 2 seconds"
        else
            echo "   ⚠️  SLOW: > 2 seconds"
        fi
    else
        echo "   ❌ FAILED: HTTP $http_code"
    fi

    echo ""
    return $timing_ms
}

# Test 1: Basic page load
test_performance "Test 0: Fridge Page Load" "$BASE_URL/fridge"

# Test 2: Results page with basic ingredients
test_performance "Test 1: Basic Search (chicken, rice, tomatoes)" "$BASE_URL/fridge/results?ingredients=chicken,rice,tomatoes"

# Test 3: Alias search
test_performance "Test 2: Alias Search (scallions)" "$BASE_URL/fridge/results?ingredients=scallions"

# Test 4: Large list
test_performance "Test 3: Large List (10 ingredients)" "$BASE_URL/fridge/results?ingredients=chicken,rice,tomatoes,onions,garlic,carrots,celery,bell%20peppers,olive%20oil,salt"

# Test 5: No results
test_performance "Test 4: No Results (nonsense)" "$BASE_URL/fridge/results?ingredients=xyz123nonsense"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Performance tests complete!"
