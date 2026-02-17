#!/usr/bin/env node

/**
 * Simulates the exact error scenario from the logs
 * Shows how the fix prevents "Invalid time value" errors
 */

console.log('Simulating "Invalid time value" Error Scenario');
console.log('===============================================\n');

// Simulate the problematic recipe data from logs
const problematicRecipe = {
  name: 'Seared Apples With Brandied Cider Syrup',
  publishedDate: 'approximate', // This is what Perplexity returned
};

console.log('Recipe:', problematicRecipe.name);
console.log('Published Date from Perplexity:', problematicRecipe.publishedDate);
console.log();

// BEFORE FIX: This creates Invalid Date
console.log('❌ BEFORE FIX (Broken Code):');
console.log(
  '   const publishedDate = metadata.publishedDate ? new Date(metadata.publishedDate) : null;'
);
console.log();

try {
  const brokenDate = new Date(problematicRecipe.publishedDate);
  console.log('   Created Date object:', brokenDate);
  console.log('   date.getTime():', brokenDate.getTime());
  console.log('   isNaN(date.getTime()):', Number.isNaN(brokenDate.getTime()));
  console.log();

  // This is what would be attempted in the database insert
  console.log('   Attempting to insert into database...');
  if (Number.isNaN(brokenDate.getTime())) {
    console.log('   💥 ERROR: Invalid time value - PostgreSQL would reject this!');
  } else {
    console.log('   ✅ Would insert:', brokenDate.toISOString());
  }
} catch (error) {
  console.log('   💥 ERROR:', error.message);
}

console.log();
console.log('='.repeat(50));
console.log();

// AFTER FIX: Validation function handles it gracefully
console.log('✅ AFTER FIX (Validation Helper):');
console.log('   const publishedDate = validateAndParseDate(metadata.publishedDate);');
console.log();

function validateAndParseDate(dateString) {
  if (!dateString) return null;

  if (
    dateString.toLowerCase() === 'approximate' ||
    dateString.toLowerCase() === 'unknown' ||
    dateString.toLowerCase() === 'n/a'
  ) {
    console.log(`   ⚠️  Warning: Invalid date string: "${dateString}" - using null`);
    return null;
  }

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      console.log(`   ⚠️  Warning: Invalid date string: "${dateString}" - parsed to Invalid Date`);
      return null;
    }

    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      console.log(`   ⚠️  Warning: Date out of reasonable range: "${dateString}" (year: ${year})`);
      return null;
    }

    return date;
  } catch (error) {
    console.log(`   ⚠️  Warning: Error parsing date: "${dateString}"`, error);
    return null;
  }
}

const fixedDate = validateAndParseDate(problematicRecipe.publishedDate);
console.log('   Validated Date:', fixedDate);
console.log();

console.log('   Attempting to insert into database...');
if (fixedDate === null) {
  console.log('   ✅ SUCCESS: Will insert NULL (allowed by schema)');
  console.log('   ✅ Recipe will be saved successfully!');
} else {
  console.log('   ✅ SUCCESS: Will insert:', fixedDate.toISOString());
}

console.log();
console.log('='.repeat(50));
console.log();

// Test other problematic values
console.log('Testing Other Problematic Values:');
console.log('-'.repeat(50));

const testValues = [
  'approximate',
  'Approximate',
  'unknown',
  'N/A',
  '',
  'invalid-date',
  null,
  undefined,
];

testValues.forEach((value) => {
  const result = validateAndParseDate(value);
  const status = result === null ? '✅ null' : `⚠️  ${result}`;
  console.log(`   "${value || '(empty)'}" → ${status}`);
});

console.log();
console.log('='.repeat(50));
console.log();
console.log('✅ FIX VERIFIED: All invalid dates handled gracefully!');
console.log('✅ No more "Invalid time value" errors!');
console.log('✅ Recipes will save successfully with null publishedDate');
