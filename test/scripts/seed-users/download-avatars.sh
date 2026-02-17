#!/bin/bash

##############################################################################
# Avatar Download Script for Synthetic Users
#
# Downloads 100 AI-generated faces from ThisPersonDoesNotExist.com
# Saves to: public/avatars/synthetic/user-XXX.jpg
#
# Usage: bash scripts/seed-users/download-avatars.sh
#
# Requirements:
#   - curl (usually pre-installed)
#   - Internet connection
#
# Time: ~3-5 minutes (2 second delay between requests)
##############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Synthetic User Avatar Download Script${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Configuration
AVATAR_DIR="public/avatars/synthetic"
TOTAL_AVATARS=100
DELAY=2  # Seconds between requests (be respectful)

# Create directory if it doesn't exist
echo -e "${YELLOW}📁 Creating avatar directory...${NC}"
mkdir -p "$AVATAR_DIR"
echo -e "${GREEN}✅ Directory created: $AVATAR_DIR${NC}"
echo ""

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ Error: curl is not installed${NC}"
    echo "Please install curl first:"
    echo "  macOS: brew install curl"
    echo "  Ubuntu/Debian: sudo apt-get install curl"
    exit 1
fi

echo -e "${BLUE}🌐 Downloading $TOTAL_AVATARS AI-generated avatars...${NC}"
echo -e "${YELLOW}⏱️  Estimated time: ~$(($TOTAL_AVATARS * $DELAY / 60)) minutes${NC}"
echo ""

# Counter for successful downloads
SUCCESS_COUNT=0
FAILED_COUNT=0

# Download avatars
for i in $(seq 1 $TOTAL_AVATARS); do
    # Format number with leading zeros (e.g., 001, 042, 100)
    NUM=$(printf "%03d" $i)

    # Output file path
    OUTPUT_FILE="$AVATAR_DIR/user-$NUM.jpg"

    # Check if file already exists
    if [ -f "$OUTPUT_FILE" ]; then
        echo -e "${YELLOW}⏭️  Skipping user-$NUM.jpg (already exists)${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        continue
    fi

    # Download the image
    echo -n "📥 Downloading user-$NUM.jpg... "

    if curl -s -o "$OUTPUT_FILE" "https://thispersondoesnotexist.com/image"; then
        # Verify file was downloaded and has content
        if [ -s "$OUTPUT_FILE" ]; then
            FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
            echo -e "${GREEN}✅ ($FILE_SIZE bytes)${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${RED}❌ (empty file)${NC}"
            rm -f "$OUTPUT_FILE"
            FAILED_COUNT=$((FAILED_COUNT + 1))
        fi
    else
        echo -e "${RED}❌ (download failed)${NC}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi

    # Progress update every 10 downloads
    if [ $((i % 10)) -eq 0 ]; then
        echo -e "${BLUE}📊 Progress: $i/$TOTAL_AVATARS downloaded${NC}"
    fi

    # Delay between requests (be respectful to the server)
    if [ $i -lt $TOTAL_AVATARS ]; then
        sleep $DELAY
    fi
done

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Download Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "✅ Successful downloads: ${GREEN}$SUCCESS_COUNT${NC}"
echo -e "❌ Failed downloads:     ${RED}$FAILED_COUNT${NC}"
echo -e "📊 Total:                $TOTAL_AVATARS"
echo ""

# Verify files
echo -e "${YELLOW}🔍 Verifying downloaded files...${NC}"

# Count actual files
ACTUAL_COUNT=$(find "$AVATAR_DIR" -name "user-*.jpg" | wc -l | tr -d ' ')

echo "   Found $ACTUAL_COUNT avatar files"

if [ "$ACTUAL_COUNT" -eq "$TOTAL_AVATARS" ]; then
    echo -e "${GREEN}✅ All avatars downloaded successfully!${NC}"
    echo ""
    echo -e "${BLUE}📝 Next steps:${NC}"
    echo "   1. Review avatar diversity: ls -lh $AVATAR_DIR"
    echo "   2. Test in browser: http://localhost:3002/avatars/synthetic/user-001.jpg"
    echo "   3. Continue with seeding: pnpm seed:users:generate"
else
    echo -e "${YELLOW}⚠️  Warning: Expected $TOTAL_AVATARS files, found $ACTUAL_COUNT${NC}"
    echo "   You may want to re-run this script to download missing files."
fi

echo ""
echo -e "${GREEN}✨ Avatar download complete!${NC}"
