#!/usr/bin/env node

/**
 * Top 50 Recipes Feature Verification Script
 *
 * This script verifies that the Top 50 feature is correctly implemented
 * by checking database state, component presence, and routing.
 *
 * Usage: node scripts/verify-top50-feature.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'cyan');
}

async function checkDatabaseState() {
  log('\n=== Database State Check ===\n', 'blue');

  try {
    // Count total recipes
    const totalRecipes = await db.select({ count: sql`count(*)::int` }).from(recipes);

    const total = totalRecipes[0]?.count || 0;
    info(`Total recipes: ${total}`);

    // Count public recipes
    const publicRecipes = await db
      .select({ count: sql`count(*)::int` })
      .from(recipes)
      .where(eq(recipes.isPublic, true));

    const publicCount = publicRecipes[0]?.count || 0;
    info(`Public recipes: ${publicCount}`);

    // Count recipes with ratings
    const ratedRecipes = await db
      .select({ count: sql`count(*)::int` })
      .from(recipes)
      .where(
        sql`${recipes.isPublic} = true AND (${recipes.systemRating} IS NOT NULL OR ${recipes.avgUserRating} IS NOT NULL)`
      );

    const ratedCount = ratedRecipes[0]?.count || 0;
    info(`Rated public recipes: ${ratedCount}`);

    // Warnings/errors
    if (publicCount === 0) {
      error('No public recipes found! Top 50 feature will show empty.');
    } else if (publicCount < 50) {
      warning(`Only ${publicCount} public recipes. Top 50 will show ${publicCount} recipes.`);
    } else {
      success(`${publicCount} public recipes available for Top 50.`);
    }

    if (ratedCount === 0) {
      warning('No recipes have ratings. Sorting will be by creation date only.');
    } else if (ratedCount < 50) {
      warning(`Only ${ratedCount} rated recipes. Some Top 50 recipes may be unrated.`);
    } else {
      success(`${ratedCount} rated recipes available for Top 50.`);
    }

    // Get top 5 recipes to preview
    log('\n--- Top 5 Preview ---\n', 'cyan');
    const top5 = await db
      .select({
        name: recipes.name,
        systemRating: recipes.systemRating,
        avgUserRating: recipes.avgUserRating,
      })
      .from(recipes)
      .where(eq(recipes.isPublic, true))
      .orderBy(
        desc(
          sql`COALESCE(
            (COALESCE(${recipes.systemRating}, 0) + COALESCE(${recipes.avgUserRating}, 0)) /
            NULLIF(
              (CASE WHEN ${recipes.systemRating} IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN ${recipes.avgUserRating} IS NOT NULL THEN 1 ELSE 0 END),
              0
            ),
            COALESCE(${recipes.systemRating}, ${recipes.avgUserRating}, 0)
          )`
        ),
        desc(recipes.createdAt)
      )
      .limit(5);

    top5.forEach((recipe, index) => {
      const systemRating = recipe.systemRating || 'N/A';
      const userRating = recipe.avgUserRating || 'N/A';
      console.log(`${index + 1}. ${recipe.name}`);
      console.log(`   System: ${systemRating} | User: ${userRating}`);
    });
  } catch (err) {
    error(`Database check failed: ${err.message}`);
    return false;
  }

  return true;
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    success(`${description}: ${filePath}`);
    return true;
  } else {
    error(`${description} not found: ${filePath}`);
    return false;
  }
}

function checkFileContains(filePath, searchText, description) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    error(`File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  if (content.includes(searchText)) {
    success(`${description}: ${searchText}`);
    return true;
  } else {
    error(`${description} not found: ${searchText}`);
    return false;
  }
}

function checkComponentImplementation() {
  log('\n=== Component Implementation Check ===\n', 'blue');

  const checks = [
    {
      file: 'src/components/recipe/RecipeFilters.tsx',
      text: 'showTop50Toggle',
      desc: 'RecipeFilters has showTop50Toggle prop',
    },
    {
      file: 'src/components/recipe/RecipeFilters.tsx',
      text: 'handleTop50Toggle',
      desc: 'RecipeFilters has toggle handler',
    },
    {
      file: 'src/components/recipe/RecipeFilters.tsx',
      text: 'Tabs',
      desc: 'RecipeFilters uses Tabs component',
    },
    {
      file: 'src/app/shared/page.tsx',
      text: 'top50',
      desc: 'Shared page handles top50 parameter',
    },
    {
      file: 'src/app/shared/page.tsx',
      text: 'showTop50Toggle={true}',
      desc: 'Shared page enables Top 50 toggle',
    },
    {
      file: 'src/components/recipe/RecipeInfiniteList.tsx',
      text: 'isTop50',
      desc: 'RecipeInfiniteList has isTop50 prop',
    },
    {
      file: 'src/components/recipe/RecipeInfiniteList.tsx',
      text: 'showRank',
      desc: 'RecipeInfiniteList passes rank to cards',
    },
  ];

  let allPassed = true;
  checks.forEach((check) => {
    if (!checkFileContains(check.file, check.text, check.desc)) {
      allPassed = false;
    }
  });

  return allPassed;
}

function checkAPIRoute() {
  log('\n=== API Route Check ===\n', 'blue');

  return checkFileExists('src/app/api/recipes/paginated/route.ts', 'Paginated recipes API route');
}

function checkDocumentation() {
  log('\n=== Documentation Check ===\n', 'blue');

  const docs = [
    'docs/features/TOP_50_RECIPES_IMPLEMENTATION.md',
    'docs/features/TOP_50_QUICK_REFERENCE.md',
  ];

  let allExist = true;
  docs.forEach((doc) => {
    if (!checkFileExists(doc, 'Documentation')) {
      allExist = false;
    }
  });

  return allExist;
}

async function runVerification() {
  log('\n╔═══════════════════════════════════════════╗', 'cyan');
  log('║   Top 50 Recipes Feature Verification   ║', 'cyan');
  log('╚═══════════════════════════════════════════╝\n', 'cyan');

  const results = {
    database: false,
    components: false,
    api: false,
    documentation: false,
  };

  // Run all checks
  results.database = await checkDatabaseState();
  results.components = checkComponentImplementation();
  results.api = checkAPIRoute();
  results.documentation = checkDocumentation();

  // Summary
  log('\n=== Verification Summary ===\n', 'blue');

  const checks = [
    { name: 'Database State', result: results.database },
    { name: 'Component Implementation', result: results.components },
    { name: 'API Route', result: results.api },
    { name: 'Documentation', result: results.documentation },
  ];

  checks.forEach((check) => {
    if (check.result) {
      success(check.name);
    } else {
      error(check.name);
    }
  });

  const allPassed = Object.values(results).every((r) => r);

  log(`\n${'='.repeat(45)}\n`, 'blue');

  if (allPassed) {
    log('🎉 All checks passed! Top 50 feature is ready.', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Start dev server: pnpm dev', 'reset');
    log('2. Navigate to: http://localhost:3002/shared', 'reset');
    log('3. Click the "Top 50 ⭐" tab', 'reset');
    log('4. Verify 50 recipes with rank badges appear', 'reset');
  } else {
    log('❌ Some checks failed. Review errors above.', 'red');
    process.exit(1);
  }
}

// Run verification
runVerification().catch((err) => {
  error(`Verification failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
