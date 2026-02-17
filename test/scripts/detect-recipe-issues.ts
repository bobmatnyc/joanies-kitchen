#!/usr/bin/env tsx

/**
 * Recipe Content Issue Detection Script
 *
 * Scans all recipes for common content quality issues using regex patterns.
 * Generates a detailed report of issues found.
 *
 * Usage:
 *   pnpm tsx scripts/detect-recipe-issues.ts
 *   pnpm tsx scripts/detect-recipe-issues.ts --verbose
 */

import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

interface IssuePattern {
  name: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface RecipeIssue {
  recipeId: string;
  recipeName: string;
  issueType: string;
  severity: 'high' | 'medium' | 'low';
  location: 'ingredients' | 'instructions' | 'both';
  matches: string[];
  context?: string;
}

interface IssueReport {
  totalRecipes: number;
  recipesWithIssues: number;
  issuesByType: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  affectedRecipes: RecipeIssue[];
  generatedAt: string;
}

// Pattern definitions for common content issues
const ISSUE_PATTERNS: IssuePattern[] = [
  // Missing spaces after numbers
  {
    name: 'missing_space_after_number',
    pattern: /\d+(cups?|tablespoons?|teaspoons?|tbsp|tsp|oz|lbs?|grams?|g|kg|ml|liters?|l)\b/gi,
    severity: 'high',
    description: 'Missing space between number and unit (e.g., "2cups" should be "2 cups")',
  },
  {
    name: 'missing_space_fraction',
    pattern:
      /[½¼¾⅓⅔⅛⅜⅝⅞](cups?|tablespoons?|teaspoons?|tbsp|tsp|oz|lbs?|grams?|g|kg|ml|liters?|l)\b/gi,
    severity: 'high',
    description: 'Missing space between fraction and unit',
  },

  // Extra brackets
  {
    name: 'extra_brackets',
    pattern: /\[[^\]]+\]/g,
    severity: 'medium',
    description: 'Extra brackets around content (e.g., "[ingredient name]")',
  },

  // URLs and links
  {
    name: 'http_urls',
    pattern: /https?:\/\/[^\s]+/gi,
    severity: 'high',
    description: 'HTTP/HTTPS URLs in content',
  },
  {
    name: 'amazon_links',
    pattern: /(amzn\.to|amazon\.com|a\.co)\/[^\s]+/gi,
    severity: 'high',
    description: 'Amazon affiliate or product links',
  },
  {
    name: 'url_fragments',
    pattern: /\b[A-Z]{2,3}\s+\d[A-Z0-9]{2,}\b/g,
    severity: 'medium',
    description: 'Potential URL fragments or postal codes (e.g., "PH3 OGV")',
  },

  // Markup artifacts
  {
    name: 'checkbox_symbol',
    pattern: /▢/g,
    severity: 'high',
    description: 'Checkbox symbols (▢) from imported recipes',
  },
  {
    name: 'markdown_bold',
    pattern: /\*\*[^*]+\*\*/g,
    severity: 'medium',
    description: 'Markdown bold formatting (**text**)',
  },
  {
    name: 'markdown_italic',
    pattern: /__[^_]+__/g,
    severity: 'medium',
    description: 'Markdown italic formatting (__text__)',
  },
  {
    name: 'markdown_headers',
    pattern: /^#{1,6}\s+/gm,
    severity: 'medium',
    description: 'Markdown header symbols (# ## ###)',
  },
  {
    name: 'html_tags',
    pattern: /<[^>]+>/g,
    severity: 'high',
    description: 'HTML tags in content',
  },

  // Encoding issues
  {
    name: 'encoding_apostrophe',
    pattern: /â€™/g,
    severity: 'high',
    description: "Malformed apostrophe encoding (â€™ should be ')",
  },
  {
    name: 'encoding_dash',
    pattern: /â€"/g,
    severity: 'high',
    description: 'Malformed dash encoding (â€" should be —)',
  },
  {
    name: 'encoding_quote',
    pattern: /â€œ|â€/g,
    severity: 'high',
    description: 'Malformed quote encoding',
  },
  {
    name: 'encoding_ellipsis',
    pattern: /â€¦/g,
    severity: 'medium',
    description: 'Malformed ellipsis encoding (â€¦ should be ...)',
  },

  // Whitespace issues
  {
    name: 'multiple_spaces',
    pattern: /\s{2,}/g,
    severity: 'low',
    description: 'Multiple consecutive spaces',
  },
  {
    name: 'trailing_spaces',
    pattern: /\s+$/gm,
    severity: 'low',
    description: 'Trailing spaces at end of lines',
  },
  {
    name: 'leading_spaces',
    pattern: /^\s+/gm,
    severity: 'low',
    description: 'Leading spaces at start of lines',
  },

  // Inconsistent formatting
  {
    name: 'mixed_bullets',
    pattern: /^[•\-*]\s/gm,
    severity: 'low',
    description: 'Mixed bullet point styles',
  },
  {
    name: 'degree_symbol_issues',
    pattern: /\d+\s*(F|C|degrees)\b/gi,
    severity: 'low',
    description: 'Temperature without degree symbol (should use °F or °C)',
  },
];

async function scanRecipes(verbose: boolean = false): Promise<IssueReport> {
  console.log('🔍 Scanning recipes for content issues...\n');

  const allRecipes = await db.select().from(recipes);
  const affectedRecipes: RecipeIssue[] = [];
  const issuesByType: Record<string, number> = {};
  const issuesBySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };

  for (const recipe of allRecipes) {
    const recipeIssues = scanRecipe(recipe);

    if (recipeIssues.length > 0) {
      affectedRecipes.push(...recipeIssues);

      // Count issues by type and severity
      for (const issue of recipeIssues) {
        issuesByType[issue.issueType] = (issuesByType[issue.issueType] || 0) + 1;
        issuesBySeverity[issue.severity]++;
      }

      if (verbose) {
        console.log(`📋 Recipe: ${recipe.name} (${recipe.id})`);
        for (const issue of recipeIssues) {
          console.log(
            `  ⚠️  [${issue.severity.toUpperCase()}] ${issue.issueType} in ${issue.location}`
          );
          console.log(
            `      Matches: ${issue.matches.slice(0, 3).join(', ')}${issue.matches.length > 3 ? '...' : ''}`
          );
        }
        console.log('');
      }
    }
  }

  const report: IssueReport = {
    totalRecipes: allRecipes.length,
    recipesWithIssues: new Set(affectedRecipes.map((r) => r.recipeId)).size,
    issuesByType,
    issuesBySeverity,
    affectedRecipes,
    generatedAt: new Date().toISOString(),
  };

  return report;
}

function scanRecipe(recipe: any): RecipeIssue[] {
  const issues: RecipeIssue[] = [];

  // Parse ingredients and instructions
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : [];

  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : typeof recipe.instructions === 'string'
      ? JSON.parse(recipe.instructions)
      : [];

  const ingredientsText = ingredients.join(' ');
  const instructionsText = instructions.join(' ');

  // Scan each pattern
  for (const pattern of ISSUE_PATTERNS) {
    const ingredientMatches = findMatches(ingredientsText, pattern.pattern);
    const instructionMatches = findMatches(instructionsText, pattern.pattern);

    if (ingredientMatches.length > 0 || instructionMatches.length > 0) {
      const location =
        ingredientMatches.length > 0 && instructionMatches.length > 0
          ? 'both'
          : ingredientMatches.length > 0
            ? 'ingredients'
            : 'instructions';

      issues.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        issueType: pattern.name,
        severity: pattern.severity,
        location,
        matches: [...new Set([...ingredientMatches, ...instructionMatches])],
        context: pattern.description,
      });
    }
  }

  return issues;
}

function findMatches(text: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let match;

  // Reset regex state
  const regex = new RegExp(pattern.source, pattern.flags);

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[0]);
  }

  return matches;
}

function printReport(report: IssueReport) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           RECIPE CONTENT QUALITY REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📊 Total Recipes Scanned: ${report.totalRecipes}`);
  console.log(
    `⚠️  Recipes with Issues: ${report.recipesWithIssues} (${((report.recipesWithIssues / report.totalRecipes) * 100).toFixed(1)}%)\n`
  );

  console.log('📈 Issues by Severity:');
  console.log(`   🔴 High:   ${report.issuesBySeverity.high || 0}`);
  console.log(`   🟡 Medium: ${report.issuesBySeverity.medium || 0}`);
  console.log(`   🟢 Low:    ${report.issuesBySeverity.low || 0}`);
  console.log(
    `   📊 Total:  ${Object.values(report.issuesBySeverity).reduce((a, b) => a + b, 0)}\n`
  );

  console.log('🔍 Issues by Type (Top 10):');
  const sortedIssues = Object.entries(report.issuesByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  for (const [type, count] of sortedIssues) {
    const pattern = ISSUE_PATTERNS.find((p) => p.name === type);
    const severityIcon =
      pattern?.severity === 'high' ? '🔴' : pattern?.severity === 'medium' ? '🟡' : '🟢';
    console.log(`   ${severityIcon} ${type.padEnd(30)} ${count}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

function saveReport(report: IssueReport, outputPath: string) {
  // Ensure tmp directory exists
  const tmpDir = path.dirname(outputPath);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`✅ Full report saved to: ${outputPath}\n`);
}

function printSampleIssues(report: IssueReport, count: number = 5) {
  console.log(`📋 Sample Issues (showing ${count} recipes):\n`);

  const recipesWithIssues = new Map<string, RecipeIssue[]>();

  for (const issue of report.affectedRecipes) {
    if (!recipesWithIssues.has(issue.recipeId)) {
      recipesWithIssues.set(issue.recipeId, []);
    }
    recipesWithIssues.get(issue.recipeId)?.push(issue);
  }

  // Get first N recipes with issues
  const samples = Array.from(recipesWithIssues.entries()).slice(0, count);

  for (const [recipeId, issues] of samples) {
    const firstIssue = issues[0];
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Recipe: ${firstIssue.recipeName}`);
    console.log(`ID: ${recipeId}`);
    console.log(`Issues Found: ${issues.length}\n`);

    for (const issue of issues) {
      const severityIcon =
        issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
      console.log(`${severityIcon} [${issue.severity.toUpperCase()}] ${issue.issueType}`);
      console.log(`   Location: ${issue.location}`);
      console.log(`   Description: ${issue.context}`);
      console.log(
        `   Examples: ${issue.matches.slice(0, 3).join(', ')}${issue.matches.length > 3 ? ` (+${issue.matches.length - 3} more)` : ''}`
      );
      console.log('');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');

  try {
    const report = await scanRecipes(verbose);

    printReport(report);

    // Save full report
    const outputPath = path.join(process.cwd(), 'tmp', 'recipe-content-issues.json');
    saveReport(report, outputPath);

    // Print sample issues
    if (report.recipesWithIssues > 0) {
      printSampleIssues(report, 5);
    } else {
      console.log('✨ No issues found! All recipes are clean.\n');
    }

    console.log('💡 Next Steps:');
    console.log('   1. Review the full report: tmp/recipe-content-issues.json');
    console.log('   2. Run cleanup script: pnpm tsx scripts/cleanup-recipes-local-llm.ts');
    console.log('   3. Use --verbose flag for detailed output during scan\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error scanning recipes:', error);
    process.exit(1);
  }
}

main();
