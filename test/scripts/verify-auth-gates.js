#!/usr/bin/env node

/**
 * Authentication Gates Verification Script
 *
 * Verifies that all LLM-powered features have proper authentication gates.
 * Run: node scripts/verify-auth-gates.js
 */

const fs = require('node:fs');
const path = require('node:path');

console.log('🔒 Authentication Gates Verification\n');
console.log('='.repeat(60));

const results = {
  passed: [],
  failed: [],
  warnings: [],
};

// Files to check
const checks = [
  {
    file: 'src/lib/auth-guard.ts',
    description: 'Auth guard utility',
    required: ['requireAuth', 'checkAuth', 'AuthenticationError'],
  },
  {
    file: 'src/components/auth/RequireAuth.tsx',
    description: 'RequireAuth component',
    required: ['RequireAuth', 'RequireAuthAI'],
  },
  {
    file: 'src/app/actions/ai-recipes.ts',
    description: 'AI recipe generation',
    required: ['requireAuth'],
    functions: ['discoverRecipe', 'saveDiscoveredRecipe'],
  },
  {
    file: 'src/app/actions/recipe-discovery.ts',
    description: 'Recipe discovery pipeline',
    required: ['requireAuth'],
    functions: ['discoverRecipes', 'discoverRecipeFromUrl'],
  },
  {
    file: 'src/app/actions/recipe-import.ts',
    description: 'Markdown recipe import',
    required: ['requireAuth'],
    functions: ['importRecipeFromMarkdown', 'importRecipesFromMarkdown'],
  },
  {
    file: 'src/app/discover/page.tsx',
    description: 'Discover page UI',
    required: ['RequireAuthAI'],
  },
  {
    file: 'src/components/recipe/RecipeDiscoveryPanel.tsx',
    description: 'Recipe discovery panel',
    required: ['RequireAuthAI'],
  },
  {
    file: 'src/components/recipe/MarkdownImporter.tsx',
    description: 'Markdown importer',
    required: ['RequireAuth'],
  },
];

// Verify each file
checks.forEach((check) => {
  const filePath = path.join(process.cwd(), check.file);

  try {
    if (!fs.existsSync(filePath)) {
      results.failed.push(`❌ ${check.description}: File not found`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const missing = [];

    // Check for required imports/usage
    check.required.forEach((keyword) => {
      if (!content.includes(keyword)) {
        missing.push(keyword);
      }
    });

    // Check for function usage
    if (check.functions) {
      check.functions.forEach((funcName) => {
        const funcPattern = new RegExp(
          `(export\\s+async\\s+function\\s+${funcName}|const\\s+${funcName}\\s*=)`
        );
        if (!funcPattern.test(content)) {
          results.warnings.push(`⚠️  ${check.description}: Function ${funcName} not found`);
        } else if (!content.includes('requireAuth')) {
          results.failed.push(
            `❌ ${check.description}: Function ${funcName} missing requireAuth()`
          );
        }
      });
    }

    if (missing.length > 0) {
      results.failed.push(`❌ ${check.description}: Missing ${missing.join(', ')}`);
    } else {
      results.passed.push(`✅ ${check.description}`);
    }
  } catch (error) {
    results.failed.push(`❌ ${check.description}: ${error.message}`);
  }
});

// Verify semantic search does NOT require auth
const semanticSearchPath = path.join(process.cwd(), 'src/app/actions/semantic-search.ts');
if (fs.existsSync(semanticSearchPath)) {
  const content = fs.readFileSync(semanticSearchPath, 'utf-8');
  if (content.includes('requireAuth')) {
    results.failed.push('❌ Semantic search: Should NOT require auth (public feature)');
  } else if (content.includes('getSessionUserId()')) {
    results.passed.push('✅ Semantic search: Correctly uses optional auth');
  } else {
    results.warnings.push('⚠️  Semantic search: No auth check found');
  }
} else {
  results.warnings.push('⚠️  Semantic search: File not found');
}

// Print results
console.log('\n📋 Results:\n');

if (results.passed.length > 0) {
  console.log('✅ Passed Checks:');
  results.passed.forEach((msg) => console.log(`   ${msg}`));
  console.log();
}

if (results.warnings.length > 0) {
  console.log('⚠️  Warnings:');
  results.warnings.forEach((msg) => console.log(`   ${msg}`));
  console.log();
}

if (results.failed.length > 0) {
  console.log('❌ Failed Checks:');
  results.failed.forEach((msg) => console.log(`   ${msg}`));
  console.log();
}

// Summary
console.log('='.repeat(60));
console.log(`\n📊 Summary:`);
console.log(`   ✅ Passed: ${results.passed.length}`);
console.log(`   ⚠️  Warnings: ${results.warnings.length}`);
console.log(`   ❌ Failed: ${results.failed.length}`);

// Exit code
const exitCode = results.failed.length > 0 ? 1 : 0;
console.log(
  `\n${exitCode === 0 ? '✅ All authentication gates verified!' : '❌ Some checks failed'}\n`
);
process.exit(exitCode);
