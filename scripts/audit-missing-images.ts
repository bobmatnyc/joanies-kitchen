#!/usr/bin/env tsx
/**
 * Database Image Audit Script
 *
 * Purpose:
 * - Identify recipes and meals with missing or invalid images
 * - Detect broken image references (null, empty, invalid paths, 404s)
 * - Generate comprehensive report with categorized issues
 * - Export results to JSON and CSV for further processing
 *
 * Issues Detected:
 * 1. Recipes without images (image_url IS NULL AND images IS NULL/empty)
 * 2. Meals without images (image_url IS NULL)
 * 3. Invalid local paths (references to /images/ that don't exist)
 * 4. External URL validation (basic format check)
 *
 * Usage:
 *   pnpm tsx scripts/audit-missing-images.ts
 *   pnpm tsx scripts/audit-missing-images.ts --output-dir=./reports
 *   pnpm tsx scripts/audit-missing-images.ts --check-external-urls
 *   pnpm tsx scripts/audit-missing-images.ts --format=json
 *   pnpm tsx scripts/audit-missing-images.ts --format=csv
 *   pnpm tsx scripts/audit-missing-images.ts --format=both
 *
 * Options:
 *   --output-dir=<path>        Output directory for reports (default: ./reports)
 *   --check-external-urls      Validate external URLs with HTTP HEAD requests
 *   --format=<json|csv|both>   Report format (default: both)
 *   --verbose                  Show detailed progress information
 *
 * Output Files:
 * - image-audit-report-YYYY-MM-DD-HHmmss.json
 * - image-audit-report-YYYY-MM-DD-HHmmss.csv
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface RecipeImageIssue {
  id: string;
  name: string;
  image_url: string | null;
  images: string | null;
  issue_type:
    | 'no_images'
    | 'null_image_url'
    | 'empty_images_array'
    | 'invalid_local_path'
    | 'invalid_url_format'
    | 'external_url_404';
  issue_details: string;
  user_id: string;
  created_at: Date;
  is_public: boolean;
  moderation_status: string;
}

interface MealImageIssue {
  id: string;
  name: string;
  image_url: string | null;
  issue_type: 'no_image' | 'invalid_local_path' | 'invalid_url_format' | 'external_url_404';
  issue_details: string;
  user_id: string;
  created_at: Date;
  meal_type: string | null;
}

interface AuditReport {
  generated_at: string;
  summary: {
    total_recipes: number;
    total_meals: number;
    recipes_with_image_issues: number;
    meals_with_image_issues: number;
    issue_breakdown: {
      recipes: Record<string, number>;
      meals: Record<string, number>;
    };
  };
  recipe_issues: RecipeImageIssue[];
  meal_issues: MealImageIssue[];
}

interface AuditOptions {
  outputDir: string;
  checkExternalUrls: boolean;
  format: 'json' | 'csv' | 'both';
  verbose: boolean;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Parse command line arguments
 */
function parseArgs(): AuditOptions {
  const args = process.argv.slice(2);
  const options: AuditOptions = {
    outputDir: './reports',
    checkExternalUrls: false,
    format: 'both',
    verbose: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.split('=')[1];
    } else if (arg === '--check-external-urls') {
      options.checkExternalUrls = true;
    } else if (arg.startsWith('--format=')) {
      const format = arg.split('=')[1];
      if (format === 'json' || format === 'csv' || format === 'both') {
        options.format = format;
      }
    } else if (arg === '--verbose') {
      options.verbose = true;
    }
  }

  return options;
}

/**
 * Log message with timestamp
 */
function log(message: string, verbose = false, isVerbose = false): void {
  if (isVerbose && !verbose) return;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Check if a local image path exists in public directory
 */
function isValidLocalPath(imagePath: string): boolean {
  if (!imagePath.startsWith('/images/')) {
    return true; // Not a local path, skip validation
  }

  // Remove leading slash and resolve relative to project root
  const relativePath = imagePath.slice(1); // Remove leading /
  const publicPath = resolve(process.cwd(), 'public', relativePath);

  return existsSync(publicPath);
}

/**
 * Parse and validate images JSON array
 */
function parseImagesArray(imagesJson: string | null): string[] {
  if (!imagesJson) return [];

  try {
    const parsed = JSON.parse(imagesJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((url) => typeof url === 'string' && url.length > 0);
    }
  } catch {
    // Invalid JSON
  }

  return [];
}

/**
 * Check if URL is valid format (basic validation)
 */
function isValidUrlFormat(url: string): boolean {
  if (!url || url.trim().length === 0) return false;

  // Check for valid URL format
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if external URL is accessible (HTTP HEAD request)
 */
async function isExternalUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Generate timestamp for report filenames
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * Convert report to CSV format
 */
function generateCsvReport(report: AuditReport): string {
  const lines: string[] = [];

  // Header
  lines.push('=== IMAGE AUDIT REPORT ===');
  lines.push(`Generated: ${report.generated_at}`);
  lines.push('');

  // Summary
  lines.push('=== SUMMARY ===');
  lines.push(`Total Recipes,${report.summary.total_recipes}`);
  lines.push(`Total Meals,${report.summary.total_meals}`);
  lines.push(`Recipes with Issues,${report.summary.recipes_with_image_issues}`);
  lines.push(`Meals with Issues,${report.summary.meals_with_image_issues}`);
  lines.push('');

  // Recipe issues breakdown
  lines.push('=== RECIPE ISSUE BREAKDOWN ===');
  lines.push('Issue Type,Count');
  for (const [issueType, count] of Object.entries(report.summary.issue_breakdown.recipes)) {
    lines.push(`${issueType},${count}`);
  }
  lines.push('');

  // Meal issues breakdown
  lines.push('=== MEAL ISSUE BREAKDOWN ===');
  lines.push('Issue Type,Count');
  for (const [issueType, count] of Object.entries(report.summary.issue_breakdown.meals)) {
    lines.push(`${issueType},${count}`);
  }
  lines.push('');

  // Recipe issues detail
  if (report.recipe_issues.length > 0) {
    lines.push('=== RECIPE ISSUES DETAIL ===');
    lines.push(
      'Recipe ID,Recipe Name,Issue Type,Issue Details,Image URL,Images Array,User ID,Created At,Is Public,Moderation Status'
    );

    for (const issue of report.recipe_issues) {
      const escapeCsv = (value: string | null | undefined): string => {
        if (!value) return '';
        // Escape quotes and wrap in quotes if contains comma
        const escaped = value.replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      };

      lines.push(
        [
          issue.id,
          escapeCsv(issue.name),
          issue.issue_type,
          escapeCsv(issue.issue_details),
          escapeCsv(issue.image_url),
          escapeCsv(issue.images),
          issue.user_id,
          new Date(issue.created_at).toISOString(),
          issue.is_public,
          issue.moderation_status,
        ].join(',')
      );
    }
    lines.push('');
  }

  // Meal issues detail
  if (report.meal_issues.length > 0) {
    lines.push('=== MEAL ISSUES DETAIL ===');
    lines.push(
      'Meal ID,Meal Name,Issue Type,Issue Details,Image URL,User ID,Created At,Meal Type'
    );

    for (const issue of report.meal_issues) {
      const escapeCsv = (value: string | null | undefined): string => {
        if (!value) return '';
        const escaped = value.replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      };

      lines.push(
        [
          issue.id,
          escapeCsv(issue.name),
          issue.issue_type,
          escapeCsv(issue.issue_details),
          escapeCsv(issue.image_url),
          issue.user_id,
          new Date(issue.created_at).toISOString(),
          escapeCsv(issue.meal_type),
        ].join(',')
      );
    }
  }

  return lines.join('\n');
}

// =============================================================================
// AUDIT FUNCTIONS
// =============================================================================

/**
 * Audit recipes for image issues
 */
async function auditRecipes(
  options: AuditOptions
): Promise<{ total: number; issues: RecipeImageIssue[] }> {
  log('Starting recipe image audit...', options.verbose);

  // Query all recipes
  const recipes = await db.execute(sql`
    SELECT
      id,
      name,
      image_url,
      images,
      user_id,
      created_at,
      is_public,
      moderation_status
    FROM recipes
    ORDER BY created_at DESC
  `);

  log(`Found ${recipes.rows.length} recipes to audit`, options.verbose, true);

  const issues: RecipeImageIssue[] = [];

  for (const recipe of recipes.rows) {
    const recipeIssues: RecipeImageIssue[] = [];
    const imageUrl = recipe.image_url as string | null;
    const imagesJson = recipe.images as string | null;
    const imagesArray = parseImagesArray(imagesJson);

    // Check 1: No images at all
    if (
      (!imageUrl || imageUrl.trim() === '') &&
      (!imagesJson ||
        imagesJson === 'null' ||
        imagesJson === '[]' ||
        imagesArray.length === 0)
    ) {
      recipeIssues.push({
        id: recipe.id as string,
        name: recipe.name as string,
        image_url: imageUrl,
        images: imagesJson,
        issue_type: 'no_images',
        issue_details: 'Recipe has no images (both image_url and images array are empty)',
        user_id: recipe.user_id as string,
        created_at: recipe.created_at as Date,
        is_public: recipe.is_public as boolean,
        moderation_status: recipe.moderation_status as string,
      });
    } else {
      // Check 2: Null image_url (but has images array)
      if ((!imageUrl || imageUrl.trim() === '') && imagesArray.length > 0) {
        recipeIssues.push({
          id: recipe.id as string,
          name: recipe.name as string,
          image_url: imageUrl,
          images: imagesJson,
          issue_type: 'null_image_url',
          issue_details: 'Recipe has images array but image_url is null/empty',
          user_id: recipe.user_id as string,
          created_at: recipe.created_at as Date,
          is_public: recipe.is_public as boolean,
          moderation_status: recipe.moderation_status as string,
        });
      }

      // Check 3: Empty images array (but has image_url)
      if (imageUrl && imageUrl.trim() !== '' && imagesArray.length === 0) {
        recipeIssues.push({
          id: recipe.id as string,
          name: recipe.name as string,
          image_url: imageUrl,
          images: imagesJson,
          issue_type: 'empty_images_array',
          issue_details: 'Recipe has image_url but images array is empty',
          user_id: recipe.user_id as string,
          created_at: recipe.created_at as Date,
          is_public: recipe.is_public as boolean,
          moderation_status: recipe.moderation_status as string,
        });
      }

      // Check 4: Invalid local paths in image_url
      if (imageUrl && imageUrl.startsWith('/images/') && !isValidLocalPath(imageUrl)) {
        recipeIssues.push({
          id: recipe.id as string,
          name: recipe.name as string,
          image_url: imageUrl,
          images: imagesJson,
          issue_type: 'invalid_local_path',
          issue_details: `Local image path does not exist: ${imageUrl}`,
          user_id: recipe.user_id as string,
          created_at: recipe.created_at as Date,
          is_public: recipe.is_public as boolean,
          moderation_status: recipe.moderation_status as string,
        });
      }

      // Check 5: Invalid local paths in images array
      for (const imgUrl of imagesArray) {
        if (imgUrl.startsWith('/images/') && !isValidLocalPath(imgUrl)) {
          recipeIssues.push({
            id: recipe.id as string,
            name: recipe.name as string,
            image_url: imageUrl,
            images: imagesJson,
            issue_type: 'invalid_local_path',
            issue_details: `Local image path in array does not exist: ${imgUrl}`,
            user_id: recipe.user_id as string,
            created_at: recipe.created_at as Date,
            is_public: recipe.is_public as boolean,
            moderation_status: recipe.moderation_status as string,
          });
        }
      }

      // Check 6: Invalid URL format
      if (imageUrl && !imageUrl.startsWith('/') && !isValidUrlFormat(imageUrl)) {
        recipeIssues.push({
          id: recipe.id as string,
          name: recipe.name as string,
          image_url: imageUrl,
          images: imagesJson,
          issue_type: 'invalid_url_format',
          issue_details: `Invalid URL format: ${imageUrl}`,
          user_id: recipe.user_id as string,
          created_at: recipe.created_at as Date,
          is_public: recipe.is_public as boolean,
          moderation_status: recipe.moderation_status as string,
        });
      }

      // Check 7: External URL accessibility (if enabled)
      if (
        options.checkExternalUrls &&
        imageUrl &&
        (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))
      ) {
        const isAccessible = await isExternalUrlAccessible(imageUrl);
        if (!isAccessible) {
          recipeIssues.push({
            id: recipe.id as string,
            name: recipe.name as string,
            image_url: imageUrl,
            images: imagesJson,
            issue_type: 'external_url_404',
            issue_details: `External URL not accessible (404 or network error): ${imageUrl}`,
            user_id: recipe.user_id as string,
            created_at: recipe.created_at as Date,
            is_public: recipe.is_public as boolean,
            moderation_status: recipe.moderation_status as string,
          });
        }
      }
    }

    issues.push(...recipeIssues);
  }

  log(`Found ${issues.length} recipe image issues`, options.verbose);

  return { total: recipes.rows.length, issues };
}

/**
 * Audit meals for image issues
 */
async function auditMeals(
  options: AuditOptions
): Promise<{ total: number; issues: MealImageIssue[] }> {
  log('Starting meal image audit...', options.verbose);

  // Query all meals
  const meals = await db.execute(sql`
    SELECT
      id,
      name,
      image_url,
      user_id,
      created_at,
      meal_type
    FROM meals
    ORDER BY created_at DESC
  `);

  log(`Found ${meals.rows.length} meals to audit`, options.verbose, true);

  const issues: MealImageIssue[] = [];

  for (const meal of meals.rows) {
    const imageUrl = meal.image_url as string | null;

    // Check 1: No image
    if (!imageUrl || imageUrl.trim() === '') {
      issues.push({
        id: meal.id as string,
        name: meal.name as string,
        image_url: imageUrl,
        issue_type: 'no_image',
        issue_details: 'Meal has no image (image_url is null or empty)',
        user_id: meal.user_id as string,
        created_at: meal.created_at as Date,
        meal_type: meal.meal_type as string | null,
      });
    } else {
      // Check 2: Invalid local path
      if (imageUrl.startsWith('/images/') && !isValidLocalPath(imageUrl)) {
        issues.push({
          id: meal.id as string,
          name: meal.name as string,
          image_url: imageUrl,
          issue_type: 'invalid_local_path',
          issue_details: `Local image path does not exist: ${imageUrl}`,
          user_id: meal.user_id as string,
          created_at: meal.created_at as Date,
          meal_type: meal.meal_type as string | null,
        });
      }

      // Check 3: Invalid URL format
      if (!imageUrl.startsWith('/') && !isValidUrlFormat(imageUrl)) {
        issues.push({
          id: meal.id as string,
          name: meal.name as string,
          image_url: imageUrl,
          issue_type: 'invalid_url_format',
          issue_details: `Invalid URL format: ${imageUrl}`,
          user_id: meal.user_id as string,
          created_at: meal.created_at as Date,
          meal_type: meal.meal_type as string | null,
        });
      }

      // Check 4: External URL accessibility (if enabled)
      if (
        options.checkExternalUrls &&
        (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))
      ) {
        const isAccessible = await isExternalUrlAccessible(imageUrl);
        if (!isAccessible) {
          issues.push({
            id: meal.id as string,
            name: meal.name as string,
            image_url: imageUrl,
            issue_type: 'external_url_404',
            issue_details: `External URL not accessible (404 or network error): ${imageUrl}`,
            user_id: meal.user_id as string,
            created_at: meal.created_at as Date,
            meal_type: meal.meal_type as string | null,
          });
        }
      }
    }
  }

  log(`Found ${issues.length} meal image issues`, options.verbose);

  return { total: meals.rows.length, issues };
}

/**
 * Generate comprehensive audit report
 */
function generateReport(
  recipeAudit: { total: number; issues: RecipeImageIssue[] },
  mealAudit: { total: number; issues: MealImageIssue[] }
): AuditReport {
  // Calculate issue breakdown
  const recipeIssueBreakdown: Record<string, number> = {};
  for (const issue of recipeAudit.issues) {
    recipeIssueBreakdown[issue.issue_type] =
      (recipeIssueBreakdown[issue.issue_type] || 0) + 1;
  }

  const mealIssueBreakdown: Record<string, number> = {};
  for (const issue of mealAudit.issues) {
    mealIssueBreakdown[issue.issue_type] = (mealIssueBreakdown[issue.issue_type] || 0) + 1;
  }

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_recipes: recipeAudit.total,
      total_meals: mealAudit.total,
      recipes_with_image_issues: recipeAudit.issues.length,
      meals_with_image_issues: mealAudit.issues.length,
      issue_breakdown: {
        recipes: recipeIssueBreakdown,
        meals: mealIssueBreakdown,
      },
    },
    recipe_issues: recipeAudit.issues,
    meal_issues: mealAudit.issues,
  };
}

/**
 * Save report to files
 */
function saveReport(report: AuditReport, options: AuditOptions): void {
  // Create output directory if it doesn't exist
  const outputDir = resolve(process.cwd(), options.outputDir);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = generateTimestamp();

  // Save JSON report
  if (options.format === 'json' || options.format === 'both') {
    const jsonPath = join(outputDir, `image-audit-report-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`✓ JSON report saved: ${jsonPath}`);
  }

  // Save CSV report
  if (options.format === 'csv' || options.format === 'both') {
    const csvPath = join(outputDir, `image-audit-report-${timestamp}.csv`);
    const csvContent = generateCsvReport(report);
    writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`✓ CSV report saved: ${csvPath}`);
  }
}

/**
 * Print summary to console
 */
function printSummary(report: AuditReport): void {
  console.log('\n=================================================');
  console.log('IMAGE AUDIT SUMMARY');
  console.log('=================================================');
  console.log(`Generated: ${report.generated_at}`);
  console.log('');
  console.log(`Total Recipes: ${report.summary.total_recipes}`);
  console.log(`Total Meals: ${report.summary.total_meals}`);
  console.log('');
  console.log(
    `Recipes with Issues: ${report.summary.recipes_with_image_issues} (${((report.summary.recipes_with_image_issues / report.summary.total_recipes) * 100).toFixed(1)}%)`
  );
  console.log(
    `Meals with Issues: ${report.summary.meals_with_image_issues} (${((report.summary.meals_with_image_issues / report.summary.total_meals) * 100).toFixed(1)}%)`
  );
  console.log('');

  console.log('Recipe Issue Breakdown:');
  for (const [issueType, count] of Object.entries(report.summary.issue_breakdown.recipes)) {
    console.log(`  - ${issueType}: ${count}`);
  }
  console.log('');

  console.log('Meal Issue Breakdown:');
  for (const [issueType, count] of Object.entries(report.summary.issue_breakdown.meals)) {
    console.log(`  - ${issueType}: ${count}`);
  }
  console.log('=================================================\n');

  // Show sample issues
  if (report.recipe_issues.length > 0) {
    console.log('Sample Recipe Issues (first 5):');
    for (const issue of report.recipe_issues.slice(0, 5)) {
      console.log(`  - ${issue.name} (${issue.id}): ${issue.issue_details}`);
    }
    console.log('');
  }

  if (report.meal_issues.length > 0) {
    console.log('Sample Meal Issues (first 5):');
    for (const issue of report.meal_issues.slice(0, 5)) {
      console.log(`  - ${issue.name} (${issue.id}): ${issue.issue_details}`);
    }
    console.log('');
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('=================================================');
  console.log('DATABASE IMAGE AUDIT SCRIPT');
  console.log('=================================================\n');

  const options = parseArgs();

  console.log('Configuration:');
  console.log(`  Output Directory: ${options.outputDir}`);
  console.log(`  Check External URLs: ${options.checkExternalUrls}`);
  console.log(`  Report Format: ${options.format}`);
  console.log(`  Verbose: ${options.verbose}`);
  console.log('');

  try {
    // Audit recipes
    const recipeAudit = await auditRecipes(options);

    // Audit meals
    const mealAudit = await auditMeals(options);

    // Generate report
    const report = generateReport(recipeAudit, mealAudit);

    // Print summary
    printSummary(report);

    // Save report
    saveReport(report, options);

    console.log('\n✓ Audit completed successfully!');
    console.log(
      `\nNext steps:\n  1. Review the generated report(s) in ${options.outputDir}\n  2. Fix image issues using admin tools or SQL updates\n  3. Re-run this script to verify fixes\n`
    );

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run the audit
main();
