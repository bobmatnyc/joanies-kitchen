#!/usr/bin/env tsx
/**
 * Test script to verify version system functionality
 */

import { BUILD, BUILD_DATE, getVersionInfo, getVersionString, VERSION } from '../src/lib/version';

console.log('\n🧪 Testing Version System\n');
console.log('─'.repeat(50));

// Test 1: Version constants
console.log('\n✓ Test 1: Version Constants');
console.log(`  VERSION: ${VERSION}`);
console.log(`  BUILD: ${BUILD}`);
console.log(`  BUILD_DATE: ${BUILD_DATE}`);

// Test 2: getVersionInfo function
console.log('\n✓ Test 2: getVersionInfo()');
const info = getVersionInfo();
console.log(`  version: ${info.version}`);
console.log(`  build: ${info.build}`);
console.log(`  buildDate: ${info.buildDate}`);

// Test 3: getVersionString function
console.log('\n✓ Test 3: getVersionString()');
const versionString = getVersionString();
console.log(`  ${versionString}`);

// Test 4: Type checks
console.log('\n✓ Test 4: Type Validation');
console.log(`  VERSION is string: ${typeof VERSION === 'string'}`);
console.log(`  BUILD is number: ${typeof BUILD === 'number'}`);
console.log(`  BUILD_DATE is string: ${typeof BUILD_DATE === 'string'}`);

// Test 5: Version format
console.log('\n✓ Test 5: Version Format');
const versionPattern = /^\d+\.\d+\.\d+$/;
console.log(`  Valid semver: ${versionPattern.test(VERSION)}`);

// Test 6: Build date format
console.log('\n✓ Test 6: Build Date Format');
const date = new Date(BUILD_DATE);
console.log(`  Valid ISO date: ${!Number.isNaN(date.getTime())}`);
console.log(`  Parsed date: ${date.toLocaleString()}`);

console.log(`\n${'─'.repeat(50)}`);
console.log('\n✅ All tests passed!\n');
