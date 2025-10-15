#!/usr/bin/env node

/**
 * Admin Setup Validation Script
 *
 * This script helps validate that admin access is properly configured.
 * Run this while signed in to check your admin setup.
 */

const https = require('https');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

console.log('\n=== Admin Setup Validation ===\n');
console.log('This script validates admin access configuration.');
console.log('Make sure you are signed in to the application before running this.\n');

// Test the debug session endpoint
async function testDebugEndpoint() {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/api/debug-session`;
    console.log(`Testing debug endpoint: ${url}`);

    // Note: This won't work from Node.js without cookies
    // This is meant to be visited in a browser
    console.log('\nNOTE: You need to test this in your browser while signed in:');
    console.log(`   ${url}\n`);

    console.log('What to look for in the JSON response:');
    console.log('✓ "userId": should have a value like "user_xxxxx"');
    console.log('✓ "hasSessionClaims": should be true');
    console.log('✓ "metadata": should contain your publicMetadata');
    console.log('✓ "isAdminFromMetadata": should be "true" for admin users\n');

    resolve({
      success: true,
      message: 'Visit the URL above in your browser while signed in'
    });
  });
}

// Check Clerk configuration
function checkClerkConfig() {
  console.log('Checking Clerk configuration...\n');

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!publishableKey || publishableKey === 'YOUR_PUBLISHABLE_KEY') {
    console.error('❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not configured');
    return false;
  }

  if (!secretKey || secretKey === 'YOUR_SECRET_KEY') {
    console.error('❌ CLERK_SECRET_KEY is not configured');
    return false;
  }

  console.log('✓ Clerk publishable key is set');
  console.log('✓ Clerk secret key is set\n');

  return true;
}

// Print checklist
function printChecklist() {
  console.log('\n=== Admin Setup Checklist ===\n');

  console.log('Step 1: Configure Custom Session Claims in Clerk Dashboard');
  console.log('  → Go to: https://dashboard.clerk.com/');
  console.log('  → Navigate to: Sessions → Customize session token');
  console.log('  → Add this JSON:');
  console.log('     {');
  console.log('       "metadata": "{{user.public_metadata}}"');
  console.log('     }');
  console.log('  → Click Save\n');

  console.log('Step 2: Add Admin Flag to User Public Metadata');
  console.log('  → Go to: Users section in Clerk Dashboard');
  console.log('  → Select your user');
  console.log('  → Edit Public metadata');
  console.log('  → Add this JSON:');
  console.log('     {');
  console.log('       "isAdmin": "true"');
  console.log('     }');
  console.log('  → Click Save\n');

  console.log('Step 3: Refresh Your Session');
  console.log('  → Sign out of the application');
  console.log('  → Sign back in');
  console.log('  → This ensures your session has the updated metadata\n');

  console.log('Step 4: Verify Admin Access');
  console.log('  → Visit the debug endpoint (see URL above)');
  console.log('  → Check your profile popup for "Admin Dashboard" menu item');
  console.log('  → Try visiting: http://localhost:3001/admin');
  console.log('  → You should see the Admin Dashboard\n');
}

// Main execution
async function main() {
  // Check Clerk config
  const configOk = checkClerkConfig();

  if (!configOk) {
    console.log('\nPlease configure Clerk environment variables first.');
    console.log('See CLERK_SETUP_GUIDE.md for instructions.\n');
    process.exit(1);
  }

  // Test debug endpoint
  await testDebugEndpoint();

  // Print checklist
  printChecklist();

  console.log('=== Testing URLs ===\n');
  console.log(`Debug Endpoint:     ${BASE_URL}/api/debug-session`);
  console.log(`Admin Dashboard:    ${BASE_URL}/admin`);
  console.log(`Admin Recipes:      ${BASE_URL}/admin/recipes`);
  console.log(`Home Page:          ${BASE_URL}/`);
  console.log('\n');

  console.log('=== Expected Behavior ===\n');
  console.log('Admin User:');
  console.log('  ✓ Can see "Admin Dashboard" in profile popup');
  console.log('  ✓ Can access /admin and /admin/recipes');
  console.log('  ✓ Debug endpoint shows isAdminFromMetadata: "true"\n');

  console.log('Non-Admin User:');
  console.log('  ✓ Cannot see "Admin Dashboard" in profile popup');
  console.log('  ✓ Gets redirected from /admin to home page');
  console.log('  ✓ Debug endpoint shows isAdminFromMetadata: null\n');

  console.log('Unauthenticated User:');
  console.log('  ✓ Gets redirected from /admin to /sign-in');
  console.log('  ✓ Cannot access debug endpoint\n');
}

main().catch(console.error);
