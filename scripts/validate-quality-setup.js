#!/usr/bin/env node

/**
 * Validates that Biome and Vitest are properly configured
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Code Quality Setup\n');

let allPassed = true;

// Check Biome configuration
console.log('📋 Checking Biome configuration...');
try {
  const biomeConfig = path.join(process.cwd(), 'biome.json');
  if (!fs.existsSync(biomeConfig)) {
    console.log('❌ biome.json not found');
    allPassed = false;
  } else {
    console.log('✅ biome.json exists');
  }
} catch (error) {
  console.log('❌ Error checking biome.json:', error.message);
  allPassed = false;
}

// Check Vitest configuration
console.log('\n📋 Checking Vitest configuration...');
try {
  const vitestConfig = path.join(process.cwd(), 'vitest.config.ts');
  const vitestSetup = path.join(process.cwd(), 'vitest.setup.ts');
  
  if (!fs.existsSync(vitestConfig)) {
    console.log('❌ vitest.config.ts not found');
    allPassed = false;
  } else {
    console.log('✅ vitest.config.ts exists');
  }
  
  if (!fs.existsSync(vitestSetup)) {
    console.log('❌ vitest.setup.ts not found');
    allPassed = false;
  } else {
    console.log('✅ vitest.setup.ts exists');
  }
} catch (error) {
  console.log('❌ Error checking Vitest files:', error.message);
  allPassed = false;
}

// Check .editorconfig
console.log('\n📋 Checking .editorconfig...');
try {
  const editorconfig = path.join(process.cwd(), '.editorconfig');
  if (!fs.existsSync(editorconfig)) {
    console.log('❌ .editorconfig not found');
    allPassed = false;
  } else {
    console.log('✅ .editorconfig exists');
  }
} catch (error) {
  console.log('❌ Error checking .editorconfig:', error.message);
  allPassed = false;
}

// Check package.json scripts
console.log('\n📋 Checking package.json scripts...');
try {
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  const requiredScripts = [
    'lint',
    'lint:fix',
    'format',
    'format:check',
    'test',
    'test:run',
    'test:ui',
    'test:coverage'
  ];
  
  let scriptsOk = true;
  for (const script of requiredScripts) {
    if (!packageJson.scripts[script]) {
      console.log(`❌ Missing script: ${script}`);
      scriptsOk = false;
      allPassed = false;
    }
  }
  
  if (scriptsOk) {
    console.log('✅ All required scripts present');
  }
} catch (error) {
  console.log('❌ Error checking package.json scripts:', error.message);
  allPassed = false;
}

// Check dependencies
console.log('\n📋 Checking dependencies...');
try {
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  const requiredDeps = [
    '@biomejs/biome',
    'vitest',
    '@vitest/ui',
    '@testing-library/react',
    '@testing-library/jest-dom'
  ];
  
  let depsOk = true;
  for (const dep of requiredDeps) {
    if (!packageJson.devDependencies[dep]) {
      console.log(`❌ Missing dependency: ${dep}`);
      depsOk = false;
      allPassed = false;
    }
  }
  
  if (depsOk) {
    console.log('✅ All required dependencies installed');
  }
} catch (error) {
  console.log('❌ Error checking dependencies:', error.message);
  allPassed = false;
}

// Check documentation
console.log('\n📋 Checking documentation...');
try {
  const codeQualityDoc = path.join(process.cwd(), 'docs/guides/CODE_QUALITY.md');
  if (!fs.existsSync(codeQualityDoc)) {
    console.log('❌ CODE_QUALITY.md not found');
    allPassed = false;
  } else {
    console.log('✅ CODE_QUALITY.md exists');
  }
} catch (error) {
  console.log('❌ Error checking documentation:', error.message);
  allPassed = false;
}

// Test Biome execution
console.log('\n📋 Testing Biome execution...');
try {
  execSync('pnpm biome --version', { stdio: 'pipe' });
  console.log('✅ Biome executes successfully');
} catch (error) {
  console.log('❌ Biome execution failed');
  allPassed = false;
}

// Test Vitest execution
console.log('\n📋 Testing Vitest execution...');
try {
  execSync('pnpm vitest --version', { stdio: 'pipe' });
  console.log('✅ Vitest executes successfully');
} catch (error) {
  console.log('❌ Vitest execution failed');
  allPassed = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ All checks passed! Code quality tools are properly configured.');
  console.log('\nYou can now use:');
  console.log('  - pnpm lint        (check code quality)');
  console.log('  - pnpm lint:fix    (auto-fix issues)');
  console.log('  - pnpm format      (format code)');
  console.log('  - pnpm test        (run tests)');
  console.log('  - pnpm test:ui     (open test UI)');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the output above.');
  process.exit(1);
}
