#!/usr/bin/env node

/**
 * Test Date Validation Function
 * Tests the date validation logic that fixes the "Invalid time value" error
 */

/**
 * Validates and parses date strings to Date objects
 * Returns null for invalid dates instead of throwing errors
 */
function validateAndParseDate(dateString) {
  if (!dateString) return null;

  // Reject known invalid values
  if (dateString.toLowerCase() === 'approximate' ||
      dateString.toLowerCase() === 'unknown' ||
      dateString.toLowerCase() === 'n/a') {
    console.warn(`[Store] Invalid date string: "${dateString}" - using null`);
    return null;
  }

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn(`[Store] Invalid date string: "${dateString}" - parsed to Invalid Date`);
      return null;
    }

    // Sanity check: reject dates too far in past or future
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn(`[Store] Date out of reasonable range: "${dateString}" (year: ${year})`);
      return null;
    }

    return date;
  } catch (error) {
    console.warn(`[Store] Error parsing date: "${dateString}"`, error);
    return null;
  }
}

console.log('Testing Date Validation Function');
console.log('=================================\n');

const testCases = [
  // Valid dates
  { input: '2025-01-15', expected: 'valid', description: 'ISO format date' },
  { input: 'January 15, 2025', expected: 'valid', description: 'Human readable date' },
  { input: '2025-01-01T00:00:00Z', expected: 'valid', description: 'ISO timestamp' },

  // Invalid dates that were causing the error
  { input: 'approximate', expected: 'null', description: 'Perplexity "approximate" value' },
  { input: 'Approximate', expected: 'null', description: 'Capitalized approximate' },
  { input: 'unknown', expected: 'null', description: 'Unknown value' },
  { input: 'n/a', expected: 'null', description: 'N/A value' },

  // Edge cases
  { input: null, expected: 'null', description: 'null input' },
  { input: undefined, expected: 'null', description: 'undefined input' },
  { input: '', expected: 'null', description: 'empty string' },
  { input: 'invalid-date-string', expected: 'null', description: 'garbage input' },
  { input: '1850-01-01', expected: 'null', description: 'Date too far in past' },
  { input: '2150-01-01', expected: 'null', description: 'Date too far in future' },
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = validateAndParseDate(test.input);
  const isValid = result !== null;
  const expectedValid = test.expected === 'valid';

  const success = (isValid === expectedValid);

  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1}: ${test.description}`);
    console.log(`   Input: "${test.input}" → ${result ? result.toISOString() : 'null'}`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: ${test.description}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Expected: ${test.expected}, Got: ${result ? 'valid date' : 'null'}`);
  }
  console.log();
});

console.log('=================================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log(passed === testCases.length ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');

process.exit(failed > 0 ? 1 : 0);
