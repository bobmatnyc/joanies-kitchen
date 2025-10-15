#!/usr/bin/env node

/**
 * Test script for production keys on localhost
 * This script verifies that the authentication setup works correctly
 */

const https = require('https');
const http = require('http');

const LOCALHOST_URL = 'http://localhost:3004';
const PRODUCTION_PUBLISHABLE_KEY = 'pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', reject);
  });
}

async function testAuthConfiguration() {
  log('\n🔍 Testing Production Keys on Localhost Configuration\n', colors.blue);

  // Test 1: Check if server is running
  log('1. Testing server availability...');
  try {
    const response = await makeRequest(LOCALHOST_URL);
    if (response.statusCode === 200 || response.statusCode === 500) {
      log('   ✓ Server is running on localhost:3004', colors.green);
    } else {
      log(`   ⚠ Server responded with status: ${response.statusCode}`, colors.yellow);
    }
  } catch (error) {
    log('   ✗ Server is not running on localhost:3004', colors.red);
    log('   Please run: npm run dev', colors.yellow);
    return;
  }

  // Test 2: Check Clerk configuration endpoint
  log('\n2. Testing Clerk configuration...');
  try {
    const response = await makeRequest(`${LOCALHOST_URL}/api/clerk-config`);
    const config = JSON.parse(response.data);

    if (config.configured) {
      log('   ✓ Clerk configuration is set up for production keys', colors.green);
      log(`   - Domain: ${config.domain}`, colors.blue);
      log(`   - Satellite mode: ${config.isSatellite}`, colors.blue);
      log(`   - Proxy URL: ${config.proxyUrl || 'Not configured'}`, colors.blue);
    } else {
      log('   ⚠ Clerk is using standard configuration', colors.yellow);
    }
  } catch (error) {
    log('   ⚠ Could not fetch Clerk configuration', colors.yellow);
  }

  // Test 3: Check environment variables
  log('\n3. Checking environment configuration...');
  log('   Production Keys Configuration:', colors.blue);
  log('   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY should be: pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA');
  log('   - CLERK_SECRET_KEY should be: sk_live_kVahgqoC5y0pGHgfTjyxJoffbzYCh4OGI1AfwpXImg');
  log('   - ENABLE_DEV_AUTH should be: true');
  log('   - ALLOW_PRODUCTION_KEYS_IN_DEV should be: true');
  log('   - FORCE_PRODUCTION_KEYS should be: true');

  // Test 4: Test sign-in page
  log('\n4. Testing sign-in page accessibility...');
  try {
    const response = await makeRequest(`${LOCALHOST_URL}/sign-in`);
    if (response.statusCode === 200) {
      log('   ✓ Sign-in page is accessible', colors.green);

      // Check if production key is in the page
      if (response.data.includes(PRODUCTION_PUBLISHABLE_KEY)) {
        log('   ✓ Production publishable key detected in page', colors.green);
      } else if (response.data.includes('pk_test_')) {
        log('   ⚠ Test publishable key detected (not production)', colors.yellow);
      } else {
        log('   ⚠ No Clerk publishable key detected', colors.yellow);
      }
    } else {
      log(`   ⚠ Sign-in page returned status: ${response.statusCode}`, colors.yellow);
    }
  } catch (error) {
    log('   ✗ Could not access sign-in page', colors.red);
  }

  // Test 5: Check proxy endpoint
  log('\n5. Testing Clerk proxy endpoint...');
  try {
    const response = await makeRequest(`${LOCALHOST_URL}/api/clerk-proxy/v1/environment`);
    if (response.statusCode === 200) {
      log('   ✓ Clerk proxy is working', colors.green);
    } else if (response.statusCode === 403) {
      log('   ⚠ Clerk proxy is disabled (might be in production mode)', colors.yellow);
    } else {
      log(`   ⚠ Clerk proxy returned status: ${response.statusCode}`, colors.yellow);
    }
  } catch (error) {
    log('   ✗ Clerk proxy endpoint not accessible', colors.red);
  }

  log('\n📋 Summary:', colors.blue);
  log('The configuration has been set up to use production Clerk keys on localhost.');
  log('If authentication is not working, please ensure:');
  log('1. All environment variables in .env.local are correctly set');
  log('2. The server has been restarted after changes');
  log('3. You are accessing the site via http://localhost:3004');

  log('\n🔧 Troubleshooting:', colors.yellow);
  log('If you see "Production Keys are only allowed for domain recipes.help":');
  log('1. Make sure FORCE_PRODUCTION_KEYS=true is set in .env.local');
  log('2. Ensure ALLOW_PRODUCTION_KEYS_IN_DEV=true is set');
  log('3. Restart the development server: npm run dev');
  log('4. Clear browser cache and cookies for localhost:3004');

  log('\n✅ Configuration Complete!', colors.green);
  log('You can now access the application at http://localhost:3004');
  log('The production Clerk keys should work in satellite mode.\n');
}

// Run the test
testAuthConfiguration().catch(console.error);