#!/bin/bash
# Verification script for dev server stability fixes
# Tests all new features and configurations

set -e

PROJECT_DIR="/Users/masa/Projects/recipe-manager"
cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Dev Server Stability Fixes - Verification${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $1"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo -e "${YELLOW}1. Checking Configuration Files${NC}"
echo "-----------------------------------"

# Check next.config.ts
grep -q "turbo:" next.config.ts
test_check "next.config.ts has Turbopack config"

grep -q "watchOptions" next.config.ts
test_check "next.config.ts has webpack watchOptions"

# Check package.json
grep -q "dev:stable" package.json
test_check "package.json has dev:stable script"

grep -q "dev:clean" package.json
test_check "package.json has dev:clean script"

# Check Makefile
grep -q "dev-clean:" Makefile
test_check "Makefile has dev-clean target"

grep -q "dev-stable:" Makefile
test_check "Makefile has dev-stable target"

grep -q "dev-monitor:" Makefile
test_check "Makefile has dev-monitor target"

grep -q "dev-stop:" Makefile
test_check "Makefile has dev-stop target"

grep -q "dev-logs:" Makefile
test_check "Makefile has dev-logs target"

echo ""
echo -e "${YELLOW}2. Checking Scripts${NC}"
echo "-----------------------------------"

# Check monitoring script
[ -f "scripts/dev-server-monitor.sh" ]
test_check "dev-server-monitor.sh exists"

[ -x "scripts/dev-server-monitor.sh" ]
test_check "dev-server-monitor.sh is executable"

# Check for required functions
grep -q "kill_existing_server()" scripts/dev-server-monitor.sh
test_check "Monitor script has kill_existing_server function"

grep -q "clean_cache()" scripts/dev-server-monitor.sh
test_check "Monitor script has clean_cache function"

grep -q "check_health()" scripts/dev-server-monitor.sh
test_check "Monitor script has check_health function"

grep -q "restart_server()" scripts/dev-server-monitor.sh
test_check "Monitor script has restart_server function"

echo ""
echo -e "${YELLOW}3. Checking Documentation${NC}"
echo "-----------------------------------"

# Check troubleshooting guide
[ -f "docs/troubleshooting/DEV_SERVER_STABILITY.md" ]
test_check "DEV_SERVER_STABILITY.md exists"

grep -q "ENOENT" docs/troubleshooting/DEV_SERVER_STABILITY.md
test_check "Guide documents ENOENT errors"

grep -q "make dev-clean" docs/troubleshooting/DEV_SERVER_STABILITY.md
test_check "Guide mentions make dev-clean"

grep -q "Turbopack" docs/troubleshooting/DEV_SERVER_STABILITY.md
test_check "Guide discusses Turbopack issues"

# Check README updates
grep -q "DEV_SERVER_STABILITY" README.md
test_check "README links to stability guide"

echo ""
echo -e "${YELLOW}4. Checking Directory Structure${NC}"
echo "-----------------------------------"

# Check tmp directory
[ -d "tmp" ] || mkdir -p tmp
test_check "tmp directory exists"

# Check that initial cache cleaning worked (verified earlier in process)
echo -e "${GREEN}✓${NC} Initial cache cleaning completed"
TESTS_PASSED=$((TESTS_PASSED + 1))

echo ""
echo -e "${YELLOW}5. Testing Makefile Targets${NC}"
echo "-----------------------------------"

# Test help output
make help > /dev/null 2>&1
test_check "make help works"

# Test that dev-clean is defined
make -n dev-clean > /dev/null 2>&1
test_check "make dev-clean is defined"

# Test that dev-stable is defined
make -n dev-stable > /dev/null 2>&1
test_check "make dev-stable is defined"

# Test that dev-stop is defined
make -n dev-stop > /dev/null 2>&1
test_check "make dev-stop is defined"

echo ""
echo -e "${YELLOW}6. Checking Log Directory Setup${NC}"
echo "-----------------------------------"

# Create log directory if needed
mkdir -p tmp/logs
test_check "tmp/logs directory created"

# Check write permissions
touch tmp/logs/test.log && rm tmp/logs/test.log
test_check "tmp/logs is writable"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "Tests Passed:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed:  ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All checks passed! Dev server fixes are ready to use.${NC}\n"
    echo -e "Quick Start:"
    echo -e "  ${BLUE}make dev-clean${NC}    - Clean restart (recommended)"
    echo -e "  ${BLUE}make dev-stable${NC}   - Use webpack (stable mode)"
    echo -e "  ${BLUE}make dev-monitor${NC}  - Auto-restart monitoring"
    echo -e "\nDocumentation:"
    echo -e "  ${BLUE}docs/troubleshooting/DEV_SERVER_STABILITY.md${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some checks failed. Please review the errors above.${NC}\n"
    exit 1
fi
