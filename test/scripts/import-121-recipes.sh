#!/bin/bash
# Standalone Firecrawl import using curl to call Next.js API route

echo "🚀 Starting batch import of 121 chef recipes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Read URLs from file
URLS_FILE="tmp/urls-to-import.txt"
TOTAL=$(wc -l < "$URLS_FILE")
COUNT=0
SUCCESS=0
FAIL=0

echo "📊 Total URLs to process: $TOTAL"
echo ""

# Process each URL
while IFS= read -r url; do
    COUNT=$((COUNT + 1))
    echo "[$COUNT/$TOTAL] Processing: $url"

    # Call the recipe-crawl API endpoint
    response=$(curl -s -X POST http://localhost:3002/api/recipe-crawl \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$url\"}" \
        --max-time 60)

    if echo "$response" | grep -q '"success":true'; then
        SUCCESS=$((SUCCESS + 1))
        echo "  ✅ Success"
    else
        FAIL=$((FAIL + 1))
        echo "  ❌ Failed"
    fi

    # Rate limiting: 2 seconds between requests
    if [ $COUNT -lt $TOTAL ]; then
        sleep 2
    fi
done < "$URLS_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Import Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Successful: $SUCCESS"
echo "❌ Failed: $FAIL"
echo "📈 Success rate: $(awk "BEGIN {printf \"%.1f\", ($SUCCESS/($SUCCESS+$FAIL))*100}")%"
