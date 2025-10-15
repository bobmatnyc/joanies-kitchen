#!/usr/bin/env node

/**
 * Authentication Configuration Validator Script
 * Run this to check your authentication setup
 */

require('dotenv').config({ path: '.env.local' });

// Simple color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printSection(title) {
  console.log('\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize(`   ${title}`, 'cyan'));
  console.log(colorize('='.repeat(60), 'cyan'));
}

function checkEnvVar(name, required = false, validator = null) {
  const value = process.env[name];
  const exists = !!value;

  let status = '';
  let details = '';

  if (!exists) {
    status = required ? colorize('✗ Missing', 'red') : colorize('○ Not Set', 'yellow');
    details = required ? '(Required)' : '(Optional)';
  } else {
    // Check for placeholder values
    if (value.includes('YOUR_') || value.includes('XXXX')) {
      status = colorize('⚠ Placeholder', 'yellow');
      details = 'Replace with actual value';
    } else if (validator && !validator(value)) {
      status = colorize('⚠ Invalid', 'yellow');
      details = 'Check format';
    } else {
      status = colorize('✓ Set', 'green');
      // Show partial value for sensitive data
      if (name.includes('SECRET') || name.includes('KEY')) {
        details = `${value.substring(0, 10)}...`;
      } else if (name.includes('URL')) {
        details = value;
      } else {
        details = `${value.substring(0, 20)}...`;
      }
    }
  }

  console.log(`  ${name.padEnd(40)} ${status.padEnd(20)} ${details}`);
  return exists && !value.includes('YOUR_') && !value.includes('XXXX');
}

function validateAuth() {
  printSection('Authentication Configuration Validator');

  // Basic environment check
  console.log('\n' + colorize('📋 Environment:', 'blue'));
  console.log(`  NODE_ENV: ${colorize(process.env.NODE_ENV || 'development', 'cyan')}`);
  console.log(`  Current Directory: ${process.cwd()}`);

  // Check for .env.local file
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), '.env.local');
  const hasEnvFile = fs.existsSync(envPath);

  console.log(`  .env.local: ${hasEnvFile ? colorize('✓ Found', 'green') : colorize('✗ Not Found', 'red')}`);

  if (!hasEnvFile) {
    console.log('\n' + colorize('⚠️  Warning: .env.local file not found!', 'yellow'));
    console.log('  Create .env.local from .env.example:');
    console.log('  ' + colorize('cp .env.example .env.local', 'cyan'));
    return;
  }

  // Application Configuration
  console.log('\n' + colorize('🌐 Application Configuration:', 'blue'));
  const hasAppUrl = checkEnvVar('NEXT_PUBLIC_APP_URL', false);

  // Database Configuration
  console.log('\n' + colorize('🗄️  Database Configuration:', 'blue'));
  const hasDb = checkEnvVar('DATABASE_URL', true, (v) => v.includes('postgresql://'));
  checkEnvVar('DATABASE_URL_UNPOOLED', false);

  // Clerk Authentication
  console.log('\n' + colorize('🔐 Clerk Authentication:', 'blue'));
  const hasPublishableKey = checkEnvVar('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', false,
    (v) => v.startsWith('pk_test_') || v.startsWith('pk_live_'));
  const hasSecretKey = checkEnvVar('CLERK_SECRET_KEY', false,
    (v) => v.startsWith('sk_test_') || v.startsWith('sk_live_'));

  checkEnvVar('NEXT_PUBLIC_CLERK_SIGN_IN_URL', false);
  checkEnvVar('NEXT_PUBLIC_CLERK_SIGN_UP_URL', false);
  checkEnvVar('NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL', false);
  checkEnvVar('NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL', false);

  // Development Auth Flag
  const enableDevAuth = process.env.ENABLE_DEV_AUTH === 'true';
  console.log(`\n  ENABLE_DEV_AUTH: ${enableDevAuth ? colorize('✓ Enabled', 'green') : colorize('○ Disabled', 'yellow')}`);

  // AI Features
  console.log('\n' + colorize('🤖 AI Features:', 'blue'));
  const hasAI = checkEnvVar('OPENROUTER_API_KEY', false,
    (v) => v.startsWith('sk-or-'));

  // Determine authentication status
  const isClerkConfigured = hasPublishableKey && hasSecretKey;
  const isProduction = process.env.NODE_ENV === 'production';
  const authEnabled = isClerkConfigured && (isProduction || enableDevAuth);

  // Summary
  printSection('Summary');

  if (!hasDb) {
    console.log(colorize('❌ Database not configured', 'red'));
    console.log('   Set DATABASE_URL in .env.local');
  } else {
    console.log(colorize('✅ Database configured', 'green'));
  }

  if (!isClerkConfigured) {
    console.log(colorize('⚠️  Authentication not configured', 'yellow'));
    console.log('   App will work without authentication');
    console.log('   All features will be publicly accessible');
  } else if (!authEnabled) {
    console.log(colorize('⚠️  Authentication configured but disabled', 'yellow'));
    console.log('   Set ENABLE_DEV_AUTH=true in .env.local to enable');
  } else {
    console.log(colorize('✅ Authentication configured and enabled', 'green'));
  }

  if (!hasAI) {
    console.log(colorize('⚠️  AI features not configured', 'yellow'));
    console.log('   Recipe generation will not work');
  } else {
    console.log(colorize('✅ AI features configured', 'green'));
  }

  // Localhost testing instructions
  if (authEnabled && !isProduction) {
    console.log('\n' + colorize('🚀 Ready for localhost testing!', 'green'));
    console.log('\n' + colorize('To test authentication:', 'blue'));
    console.log('  1. Run: ' + colorize('npm run dev', 'cyan'));
    console.log('  2. Visit: ' + colorize('http://localhost:3004', 'cyan'));
    console.log('  3. Click "Sign In" to test authentication');
  } else if (isClerkConfigured && !enableDevAuth) {
    console.log('\n' + colorize('💡 To enable authentication on localhost:', 'blue'));
    console.log('  1. Add to .env.local: ' + colorize('ENABLE_DEV_AUTH=true', 'cyan'));
    console.log('  2. Restart your development server');
  }

  // Check for common issues
  if (isClerkConfigured) {
    const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const secKey = process.env.CLERK_SECRET_KEY;

    const pubEnv = pubKey.includes('pk_test_') ? 'test' : 'live';
    const secEnv = secKey.includes('sk_test_') ? 'test' : 'live';

    if (pubEnv !== secEnv) {
      console.log('\n' + colorize('⚠️  Warning: Key environment mismatch!', 'yellow'));
      console.log(`   Publishable key is ${pubEnv}, Secret key is ${secEnv}`);
    }

    if (isProduction && pubEnv === 'test') {
      console.log('\n' + colorize('⚠️  Warning: Using test keys in production!', 'yellow'));
      console.log('   Switch to live keys for production deployment');
    }
  }

  console.log('\n' + colorize('='.repeat(60), 'cyan') + '\n');
}

// Run validation
validateAuth();