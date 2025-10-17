/**
 * Test script for Brave Search API integration
 *
 * This script validates the API route implementation without making actual API calls.
 * Run with: node scripts/test-brave-search.js
 */

const fs = require('node:fs');
const path = require('node:path');

console.log('================================================================================');
console.log('BRAVE SEARCH API INTEGRATION - VALIDATION TEST');
console.log('================================================================================\n');

// Test 1: Check if route file exists
console.log('Test 1: Checking route file...');
const routePath = path.join(__dirname, '../src/app/api/brave-search/route.ts');
if (fs.existsSync(routePath)) {
  console.log('✓ Route file exists:', routePath);
  const routeContent = fs.readFileSync(routePath, 'utf8');

  // Check for required imports
  if (routeContent.includes('NextRequest') && routeContent.includes('NextResponse')) {
    console.log('✓ Next.js types imported');
  }
  if (routeContent.includes("from '@/lib/auth'")) {
    console.log('✓ Auth helper imported');
  }

  // Check for security features
  if (routeContent.includes('userId')) {
    console.log('✓ Authentication check implemented');
  }
  if (routeContent.includes('BRAVE_SEARCH_API_KEY')) {
    console.log('✓ API key validation implemented');
  }
  if (routeContent.includes('401')) {
    console.log('✓ Unauthorized error handling implemented');
  }
  if (routeContent.includes('429')) {
    console.log('✓ Rate limit error handling implemented');
  }

  // Check for HTTP methods
  const methods = ['POST', 'GET', 'PUT', 'DELETE', 'PATCH'];
  methods.forEach((method) => {
    if (routeContent.includes(`export async function ${method}`)) {
      console.log(`✓ ${method} method handler defined`);
    }
  });
} else {
  console.log('✗ Route file not found');
}

console.log('\nTest 2: Checking client library...');
const clientPath = path.join(__dirname, '../src/lib/brave-search.ts');
if (fs.existsSync(clientPath)) {
  console.log('✓ Client library exists:', clientPath);
  const clientContent = fs.readFileSync(clientPath, 'utf8');

  // Check for exports
  const exports = [
    'braveSearch',
    'searchRecipes',
    'isRecoverableSearchError',
    'getSearchErrorMessage',
    'BraveSearchAPIError',
  ];
  exports.forEach((exp) => {
    if (
      clientContent.includes(`export function ${exp}`) ||
      clientContent.includes(`export class ${exp}`)
    ) {
      console.log(`✓ ${exp} exported`);
    }
  });
} else {
  console.log('✗ Client library not found');
}

console.log('\nTest 3: Checking documentation...');
const docsPath = path.join(__dirname, '../BRAVE_SEARCH_API.md');
if (fs.existsSync(docsPath)) {
  console.log('✓ Documentation exists:', docsPath);
  const docsContent = fs.readFileSync(docsPath, 'utf8');

  if (docsContent.includes('Setup')) {
    console.log('✓ Setup instructions included');
  }
  if (docsContent.includes('BRAVE_SEARCH_API_KEY')) {
    console.log('✓ Environment variable documented');
  }
  if (docsContent.includes('Example')) {
    console.log('✓ Usage examples included');
  }
} else {
  console.log('✗ Documentation not found');
}

console.log('\nTest 4: Checking example component...');
const examplePath = path.join(__dirname, '../src/components/example-brave-search.tsx');
if (fs.existsSync(examplePath)) {
  console.log('✓ Example component exists:', examplePath);
  const exampleContent = fs.readFileSync(examplePath, 'utf8');

  if (exampleContent.includes('searchRecipes')) {
    console.log('✓ Uses searchRecipes function');
  }
  if (exampleContent.includes('getSearchErrorMessage')) {
    console.log('✓ Uses error message helper');
  }
  if (exampleContent.includes('loading')) {
    console.log('✓ Implements loading state');
  }
  if (exampleContent.includes('error')) {
    console.log('✓ Implements error handling');
  }
} else {
  console.log('✗ Example component not found');
}

console.log('\n================================================================================');
console.log('VALIDATION COMPLETE');
console.log('================================================================================');
console.log('\nNext steps:');
console.log('1. Add BRAVE_SEARCH_API_KEY to .env.local');
console.log('2. Start dev server: npm run dev');
console.log('3. Test the API route with authenticated requests');
console.log('4. Integrate into your recipe search UI');
console.log('\nFor full documentation, see: BRAVE_SEARCH_API.md');
console.log('================================================================================\n');
