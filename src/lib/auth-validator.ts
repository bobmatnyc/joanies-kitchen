#!/usr/bin/env node
/**
 * Authentication Configuration Validator
 * This module provides runtime validation and diagnostics for authentication setup
 */

import { validateAuthConfig, isClerkConfigured, isAuthEnabled } from './auth-config';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Format a message with color
 */
function colorize(text: string, color: keyof typeof colors): string {
  // Only colorize in Node.js environments (not in browser)
  if (typeof process !== 'undefined' && process.stdout?.isTTY) {
    return `${colors[color]}${text}${colors.reset}`;
  }
  return text;
}

/**
 * Display validation results in a formatted way
 */
export function displayValidationResults(): void {
  console.log('\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize('   Authentication Configuration Validator', 'cyan'));
  console.log(colorize('='.repeat(60), 'cyan') + '\n');

  // Check Clerk configuration
  const clerkConfigured = isClerkConfigured();
  const authEnabled = isAuthEnabled();

  // Basic status
  console.log(colorize('📋 Configuration Status:', 'blue'));
  console.log(`   • Clerk Configured: ${clerkConfigured ? colorize('✓ Yes', 'green') : colorize('✗ No', 'yellow')}`);
  console.log(`   • Auth Enabled: ${authEnabled ? colorize('✓ Yes', 'green') : colorize('✗ No', 'yellow')}`);
  console.log(`   • Environment: ${colorize(process.env.NODE_ENV || 'development', 'blue')}`);
  console.log(`   • App URL: ${colorize(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004', 'blue')}`);

  // Validate configuration
  const validation = validateAuthConfig();

  if (validation.errors.length > 0) {
    console.log('\n' + colorize('❌ Configuration Errors:', 'red'));
    validation.errors.forEach(error => {
      console.log(`   • ${error}`);
    });
  }

  if (validation.warnings.length > 0) {
    console.log('\n' + colorize('⚠️  Configuration Warnings:', 'yellow'));
    validation.warnings.forEach(warning => {
      console.log(`   • ${warning}`);
    });
  }

  if (validation.isValid && validation.warnings.length === 0) {
    console.log('\n' + colorize('✅ Configuration is valid!', 'green'));
  }

  // Detailed Clerk analysis if configured
  if (clerkConfigured) {
    console.log('\n' + colorize('🔐 Clerk Details:', 'blue'));

    const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
    const secretKey = process.env.CLERK_SECRET_KEY || '';

    // Extract instance name
    const instanceName = pubKey.split('.')[0]?.replace('pk_test_', '').replace('pk_live_', '');
    console.log(`   • Instance: ${colorize(instanceName || 'unknown', 'cyan')}`);

    // Detect environment
    const keyEnv = pubKey.includes('pk_test_') ? 'test' : 'live';
    console.log(`   • Key Environment: ${colorize(keyEnv, keyEnv === 'test' ? 'yellow' : 'green')}`);

    // Key lengths for validation
    console.log(`   • Publishable Key Length: ${pubKey.length} characters`);
    console.log(`   • Secret Key Length: ${secretKey.length} characters`);
  }

  // Development mode helpers
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n' + colorize('💡 Development Tips:', 'blue'));

    if (!clerkConfigured) {
      console.log('   • To enable auth in development:');
      console.log('     1. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local');
      console.log('     2. Set CLERK_SECRET_KEY in .env.local');
      console.log('     3. Set ENABLE_DEV_AUTH=true in .env.local');
      console.log('     4. Restart your development server');
    } else if (!authEnabled) {
      console.log('   • Auth is configured but disabled in development');
      console.log('     Set ENABLE_DEV_AUTH=true in .env.local to enable');
    } else {
      console.log('   • Auth is fully enabled in development mode');
      console.log('     Remove ENABLE_DEV_AUTH from .env.local to disable');
    }
  }

  console.log('\n' + colorize('='.repeat(60), 'cyan') + '\n');
}

/**
 * Check if authentication will work for specific scenarios
 */
export function testAuthScenarios(): void {
  console.log(colorize('🧪 Testing Authentication Scenarios:', 'blue') + '\n');

  const scenarios = [
    {
      name: 'Localhost Development',
      condition: process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_AUTH === 'true',
      expected: isAuthEnabled(),
      description: 'Auth should work on localhost when ENABLE_DEV_AUTH=true',
    },
    {
      name: 'Production Deployment',
      condition: process.env.NODE_ENV === 'production' && isClerkConfigured(),
      expected: isAuthEnabled(),
      description: 'Auth should work in production when Clerk is configured',
    },
    {
      name: 'Development without Config',
      condition: process.env.NODE_ENV !== 'production' && !isClerkConfigured(),
      expected: !isAuthEnabled(),
      description: 'Auth should be disabled without Clerk configuration',
    },
    {
      name: 'Development with Config but no Flag',
      condition: process.env.NODE_ENV !== 'production' && isClerkConfigured() && !process.env.ENABLE_DEV_AUTH,
      expected: !isAuthEnabled(),
      description: 'Auth should be disabled in dev without ENABLE_DEV_AUTH flag',
    },
  ];

  scenarios.forEach(scenario => {
    const passes = scenario.expected === scenario.condition;
    const icon = passes ? '✓' : '✗';
    const color = passes ? 'green' : 'red';

    console.log(`${colorize(icon, color)} ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log(`   Expected: ${scenario.expected}, Actual: ${scenario.condition}\n`);
  });
}

/**
 * Generate a diagnostic report
 */
export function generateDiagnosticReport(): string {
  const report: string[] = [
    '# Authentication Diagnostic Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Environment',
    `- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`,
    `- NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'not set'}`,
    `- ENABLE_DEV_AUTH: ${process.env.ENABLE_DEV_AUTH || 'not set'}`,
    '',
    '## Clerk Configuration',
    `- Configured: ${isClerkConfigured() ? 'Yes' : 'No'}`,
    `- Auth Enabled: ${isAuthEnabled() ? 'Yes' : 'No'}`,
  ];

  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    report.push(`- Publishable Key: ${key.substring(0, 20)}... (${key.length} chars)`);
    report.push(`- Key Type: ${key.includes('pk_test') ? 'Test' : 'Live'}`);
  }

  const validation = validateAuthConfig();

  if (validation.errors.length > 0) {
    report.push('', '## Errors');
    validation.errors.forEach(error => report.push(`- ${error}`));
  }

  if (validation.warnings.length > 0) {
    report.push('', '## Warnings');
    validation.warnings.forEach(warning => report.push(`- ${warning}`));
  }

  report.push('', '## Recommendations');
  if (!isClerkConfigured()) {
    report.push('- Configure Clerk keys in .env.local');
  } else if (!isAuthEnabled() && process.env.NODE_ENV !== 'production') {
    report.push('- Set ENABLE_DEV_AUTH=true to test authentication locally');
  }

  return report.join('\n');
}

// Run validation if executed directly
if (require.main === module) {
  displayValidationResults();
  console.log('\n');
  testAuthScenarios();
}

export {
  validateAuthConfig,
  isClerkConfigured,
  isAuthEnabled,
};