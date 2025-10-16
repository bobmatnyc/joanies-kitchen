#!/bin/bash
# Clerk Port Configuration Verification Script
# Verifies that localhost:3002 is correctly configured for Clerk authentication

set -e

echo "======================================"
echo "Clerk Port Configuration Verification"
echo "======================================"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ ERROR: .env.local not found"
    exit 1
fi

# Load environment variables
source .env.local 2>/dev/null || true

# Check NEXT_PUBLIC_APP_URL
echo "1. Checking NEXT_PUBLIC_APP_URL..."
if [ "$NEXT_PUBLIC_APP_URL" = "http://localhost:3002" ]; then
    echo "   ✅ NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL"
else
    echo "   ❌ NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL (expected: http://localhost:3002)"
fi

# Check Clerk keys are present
echo ""
echo "2. Checking Clerk keys..."
if [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
    KEY_PREFIX=$(echo "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" | cut -d'_' -f1-2)
    echo "   ✅ Publishable Key: $KEY_PREFIX... (${#NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} chars)"
else
    echo "   ❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set"
fi

if [ -n "$CLERK_SECRET_KEY" ]; then
    KEY_PREFIX=$(echo "$CLERK_SECRET_KEY" | cut -d'_' -f1-2)
    echo "   ✅ Secret Key: $KEY_PREFIX... (${#CLERK_SECRET_KEY} chars)"
else
    echo "   ❌ CLERK_SECRET_KEY not set"
fi

# Check if dev server is running
echo ""
echo "3. Checking dev server..."
if lsof -i :3002 >/dev/null 2>&1; then
    echo "   ✅ Dev server is running on port 3002"

    # Try to access the server
    echo ""
    echo "4. Testing server response..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002 | grep -q "200"; then
        echo "   ✅ Server responds successfully"
    else
        echo "   ⚠️  Server responded but not with HTTP 200"
    fi

    # Try to access Clerk debug endpoint
    echo ""
    echo "5. Testing Clerk configuration endpoint..."
    if curl -s http://localhost:3002/api/debug-clerk 2>&1 | grep -q "publishableKey"; then
        echo "   ✅ Clerk debug endpoint accessible"

        # Show current config
        echo ""
        echo "6. Current Clerk Configuration:"
        curl -s http://localhost:3002/api/debug-clerk | python3 -m json.tool 2>/dev/null | head -20 || \
        curl -s http://localhost:3002/api/debug-clerk | grep -E "(publishableKey|environment|appUrl)" || \
        echo "   ⚠️  Could not parse debug response"
    else
        echo "   ⚠️  Clerk debug endpoint not accessible (404 or error)"
    fi
else
    echo "   ❌ Dev server is NOT running on port 3002"
    echo "   👉 Start the server with: pnpm dev"
fi

echo ""
echo "======================================"
echo "Next Steps:"
echo "======================================"
echo "1. ⚠️  CRITICAL: Update Clerk Dashboard"
echo "   - Go to: https://dashboard.clerk.com/"
echo "   - Select: native-marmoset-74 (development)"
echo "   - Add: http://localhost:3002 to allowed origins"
echo ""
echo "2. 🔄 Restart dev server (if not already done):"
echo "   pnpm dev"
echo ""
echo "3. ✅ Test authentication:"
echo "   - Open: http://localhost:3002"
echo "   - Click 'Sign In'"
echo "   - Should NOT see 'Invalid host' error"
echo ""
echo "📄 Full documentation: CLERK_PORT_FIX.md"
echo ""
