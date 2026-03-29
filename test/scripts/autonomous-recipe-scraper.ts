#!/usr/bin/env tsx

/**
 * Autonomous Recipe Scraper - PM2 Cron Runner
 *
 * Runs the daily zero-waste recipe discovery pipeline once and exits.
 * Designed to be triggered by PM2 cron (6am daily) or run manually.
 *
 * Usage:
 *   pnpm scraper:daily                                    # Run (stores to DB)
 *   DRY_RUN=true pnpm scraper:daily:dry                  # Dry run (no DB writes)
 *   MAX_RECIPES=5 pnpm scraper:daily                     # Store up to 5 recipes
 *   SEARCH_QUERY="leftover pasta recipe" pnpm scraper:daily  # Custom search
 *
 * Environment Variables (read from .env.local):
 *   TAVILY_API_KEY     - Required for recipe URL discovery
 *   FIRECRAWL_API_KEY  - Primary recipe extractor (recommended)
 *   JINA_API_KEY       - Fallback extractor 1
 *   ANTHROPIC_API_KEY  - For Claude structuring + chef bio generation
 *   DATABASE_URL       - PostgreSQL connection string
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local BEFORE any other imports that touch process.env
config({ path: resolve(process.cwd(), '.env.local') });

import { getAutonomousRecipeIngestionService } from '@/lib/services/autonomous-recipe-ingestion.service';

// ---------------------------------------------------------------------------
// Configuration from environment variables
// ---------------------------------------------------------------------------

const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_RECIPES = parseInt(process.env.MAX_RECIPES ?? '3', 10);
const SEARCH_QUERY = process.env.SEARCH_QUERY ?? undefined;

// ---------------------------------------------------------------------------
// Pretty-print helpers
// ---------------------------------------------------------------------------

function printBanner(isDryRun: boolean) {
  const separator = '='.repeat(65);
  console.log(separator);
  console.log('AUTONOMOUS RECIPE SCRAPER — Joanie\'s Kitchen');
  console.log(separator);
  console.log(`Mode:         ${isDryRun ? 'DRY RUN (no DB writes)' : 'LIVE (writes to DB)'}`);
  console.log(`Max Recipes:  ${MAX_RECIPES}`);
  console.log(`Search Query: ${SEARCH_QUERY ?? '(rotating zero-waste queries)'}`);
  console.log(`Time:         ${new Date().toLocaleString()}`);
  console.log(separator);
  console.log();
}

function printSummary(result: {
  runId: string;
  status: string;
  urlsDiscovered: number;
  recipesExtracted: number;
  recipesStored: number;
  recipesSkipped: number;
  chefsCreated: number;
  errors: string[];
  durationMs: number;
}, isDryRun: boolean) {
  const separator = '='.repeat(65);
  const durationSec = (result.durationMs / 1000).toFixed(1);

  console.log();
  console.log(separator);
  console.log('SCRAPER SUMMARY');
  console.log(separator);
  console.log(`Status:           ${result.status.toUpperCase()}`);
  console.log(`Run ID:           ${result.runId}`);
  console.log(`Duration:         ${durationSec}s`);
  console.log();
  console.log('Metrics:');
  console.log(`  URLs Discovered:    ${result.urlsDiscovered}`);
  console.log(`  Recipes Extracted:  ${result.recipesExtracted}`);
  console.log(`  Recipes Stored:     ${result.recipesStored}${isDryRun ? ' (dry run — not written)' : ''}`);
  console.log(`  Recipes Skipped:    ${result.recipesSkipped}`);
  console.log(`  Chefs Created:      ${result.chefsCreated}`);

  if (result.errors.length > 0) {
    console.log();
    console.log(`Errors (${result.errors.length}):`);
    result.errors.slice(0, 5).forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.substring(0, 100)}`);
    });
    if (result.errors.length > 5) {
      console.log(`  ... and ${result.errors.length - 5} more`);
    }
  }

  console.log(separator);

  if (isDryRun) {
    console.log();
    console.log('DRY RUN COMPLETE — no recipes were written to the database.');
    console.log('Run without DRY_RUN=true to persist recipes.');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  printBanner(DRY_RUN);

  // Validate required env vars
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set. Add it to .env.local');
    process.exit(1);
  }

  if (!process.env.TAVILY_API_KEY) {
    console.error('ERROR: TAVILY_API_KEY is not set — required for recipe discovery');
    console.error('Add it to .env.local: TAVILY_API_KEY=tvly-prod-...');
    process.exit(1);
  }

  // Log which extractors are available
  const extractors = [
    process.env.FIRECRAWL_API_KEY ? 'Firecrawl (primary)' : null,
    process.env.JINA_API_KEY ? 'Jina Reader (fallback 1)' : null,
    'Tavily Extract (fallback 2 — same key as discovery)',
    process.env.ANTHROPIC_API_KEY ? 'Claude Haiku (structuring)' : null,
  ].filter(Boolean);

  console.log(`Extractors available: ${extractors.join(', ')}`);
  console.log();

  const service = getAutonomousRecipeIngestionService();

  const result = await service.runDailyDiscovery({
    dryRun: DRY_RUN,
    maxRecipes: MAX_RECIPES,
    searchQuery: SEARCH_QUERY,
  });

  printSummary(result, DRY_RUN);

  // Exit with appropriate code
  if (result.status === 'failed') {
    process.exit(1);
  }

  process.exit(0);
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log('\n[Scraper] SIGINT received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Scraper] SIGTERM received — shutting down gracefully');
  process.exit(0);
});

// Run
main().catch((error) => {
  console.error('\nFATAL ERROR:', error);
  process.exit(1);
});
