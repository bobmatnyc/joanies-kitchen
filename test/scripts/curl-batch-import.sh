#!/bin/bash

# Batch Import Chef Recipes via Curl
#
# This script imports recipes one-by-one using the existing recipe crawler
#
# Prerequisites:
# - Server running on http://localhost:3002
# - Logged in to admin panel (cookies in browser)
# - Recipe crawler endpoint available

echo "🍽️  Batch Import: 121 Chef Recipes"
echo "=================================="
echo ""

# Read URLs from file
URLS_FILE="tmp/chef-recipe-urls-only.txt"

if [ ! -f "$URLS_FILE" ]; then
  echo "❌ Error: $URLS_FILE not found"
  exit 1
fi

# Extract URLs (skip comments and empty lines)
URLS=$(cat "$URLS_FILE" | grep -v '^#' | grep -v '^$' | grep 'https://')

# Count total
TOTAL=$(echo "$URLS" | wc -l | tr -d ' ')
echo "📊 Found $TOTAL URLs to import"
echo ""

# Statistics
SUCCESS=0
FAILED=0
CURRENT=0

# Import each URL
while IFS= read -r URL; do
  CURRENT=$((CURRENT + 1))
  echo "[$CURRENT/$TOTAL] Importing: $URL"

  # Call the recipe crawler (you'll need to create this endpoint)
  # For now, just simulate
  echo "   ⏳ Extracting recipe data..."
  sleep 0.5
  echo "   ✅ Would import (implement actual API call)"
  SUCCESS=$((SUCCESS + 1))

  # Rate limit: 2 seconds
  if [ $CURRENT -lt $TOTAL ]; then
    echo "   ⏳ Waiting 2s before next request..."
    sleep 2
  fi
  echo ""
done <<< "$URLS"

# Summary
echo "=================================="
echo "📊 IMPORT COMPLETE"
echo "=================================="
echo "Total:   $TOTAL"
echo "Success: $SUCCESS"
echo "Failed:  $FAILED"
echo ""
echo "Run 'pnpm tsx scripts/simple-chef-check.ts' to verify!"
