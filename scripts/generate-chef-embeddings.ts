#!/usr/bin/env tsx

/**
 * Generate embeddings for ALL chefs in the database
 *
 * Production-ready script with checkpoint/resume, detailed logging, and safety features
 * Processes chefs in batches to avoid overwhelming the API
 *
 * Features:
 * - Checkpoint/resume capability every 50 chefs
 * - Retry logic for failed embeddings (max 3 attempts)
 * - Detailed error logging to file
 * - Progress tracking with ETA
 * - Embedding quality validation
 * - Dry-run and limit modes for testing
 * - Cost and time estimation
 *
 * Usage:
 *   npx tsx scripts/generate-chef-embeddings.ts                    # Dry run (default)
 *   npx tsx scripts/generate-chef-embeddings.ts --execute          # Execute (with confirmation)
 *   npx tsx scripts/generate-chef-embeddings.ts --limit=10         # Test on 10 chefs
 *   npx tsx scripts/generate-chef-embeddings.ts --resume           # Resume from last checkpoint
 *   npx tsx scripts/generate-chef-embeddings.ts --batch-size=10    # Custom batch size
 *   npx tsx scripts/generate-chef-embeddings.ts --delay=1000       # Custom delay (ms)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { EmbeddingError, generateChefEmbedding } from '../src/lib/ai/embeddings';
import { db } from '../src/lib/db';
import {
  countChefEmbeddings,
  saveChefEmbedding,
} from '../src/lib/db/meal-chef-embeddings';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Configuration
const BATCH_SIZE = parseInt(
  process.argv.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] || '10',
  10
);
const DELAY_MS = parseInt(
  process.argv.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || '2000',
  10
);
const DRY_RUN = !process.argv.includes('--execute');
const LIMIT = process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1]
  ? parseInt(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1]!, 10)
  : undefined;
const RESUME = process.argv.includes('--resume');
const CHECKPOINT_INTERVAL = 50; // Save checkpoint every 50 chefs
const MAX_RETRIES = 3;

// Types
interface Checkpoint {
  timestamp: string;
  processedChefIds: string[];
  stats: ProcessingStats;
}

interface ProcessingStats {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  retried: number;
  startTime: number;
  checkpointsSaved: number;
}

interface FailedChef {
  chefId: string;
  chefName: string;
  error: string;
  attempts: number;
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

async function ensureTmpDir(): Promise<string> {
  const tmpDir = path.resolve(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

async function saveCheckpoint(checkpoint: Checkpoint, tmpDir: string): Promise<string> {
  const checkpointPath = path.join(tmpDir, 'chef-embedding-generation-checkpoint.json');
  await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  return checkpointPath;
}

async function loadCheckpoint(tmpDir: string): Promise<Checkpoint | null> {
  const checkpointPath = path.join(tmpDir, 'chef-embedding-generation-checkpoint.json');
  try {
    const data = await fs.readFile(checkpointPath, 'utf-8');
    return JSON.parse(data);
  } catch (_error) {
    return null;
  }
}

async function clearCheckpoint(tmpDir: string): Promise<void> {
  const checkpointPath = path.join(tmpDir, 'chef-embedding-generation-checkpoint.json');
  try {
    await fs.unlink(checkpointPath);
  } catch (_error) {
    // Ignore if file doesn't exist
  }
}

async function appendErrorLog(error: FailedChef, tmpDir: string): Promise<void> {
  const logPath = path.join(tmpDir, 'chef-embedding-errors.log');
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] Chef: ${error.chefName} (${error.chefId}) | Attempts: ${error.attempts} | Error: ${error.error}\n`;
  await fs.appendFile(logPath, logLine);
}

function validateEmbeddingQuality(embedding: number[]): { valid: boolean; reason?: string } {
  if (embedding.length !== 384) {
    return { valid: false, reason: `Invalid dimension: ${embedding.length}` };
  }

  if (embedding.some((val) => typeof val !== 'number' || Number.isNaN(val))) {
    return { valid: false, reason: 'Contains NaN or non-numeric values' };
  }

  if (embedding.some((val) => !Number.isFinite(val))) {
    return { valid: false, reason: 'Contains Infinity' };
  }

  // Check if embedding is all zeros (indicates generation failure)
  if (embedding.every((val) => val === 0)) {
    return { valid: false, reason: 'All zeros (invalid embedding)' };
  }

  return { valid: true };
}

async function generateEmbeddingWithRetry(
  chef: any,
  maxRetries: number,
  tmpDir: string
): Promise<{ success: boolean; attempts: number; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateChefEmbedding(chef);

      // Validate embedding quality
      const validation = validateEmbeddingQuality(result.embedding);
      if (!validation.valid) {
        throw new Error(`Quality validation failed: ${validation.reason}`);
      }

      await saveChefEmbedding(chef.id, result.embedding, result.embeddingText, result.modelName);

      return { success: true, attempts: attempt };
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      const errorMessage =
        error instanceof EmbeddingError ? `[${error.code}] ${error.message}` : error.message;

      if (isLastAttempt) {
        // Log to error file
        await appendErrorLog(
          {
            chefId: chef.id,
            chefName: chef.name,
            error: errorMessage,
            attempts: attempt,
          },
          tmpDir
        );

        return { success: false, attempts: attempt, error: errorMessage };
      }

      // Wait before retry (exponential backoff)
      const retryDelay = Math.min(DELAY_MS * 2 ** (attempt - 1), 10000);
      log(
        `    ⏳ Retry ${attempt}/${maxRetries} in ${(retryDelay / 1000).toFixed(1)}s...`,
        colors.yellow
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return { success: false, attempts: maxRetries, error: 'Max retries exceeded' };
}

async function main() {
  const tmpDir = await ensureTmpDir();

  log(`\n${'='.repeat(80)}`, colors.bright);
  log('PRODUCTION-READY EMBEDDING GENERATION FOR ALL CHEFS', colors.bright);
  log(`${'='.repeat(80)}\n`, colors.bright);

  if (DRY_RUN) {
    log('⚠️  DRY RUN MODE - No embeddings will be generated', colors.yellow);
    log('   Use --execute flag to apply changes', colors.yellow);
  } else {
    log('🚀 EXECUTE MODE - Embeddings will be generated and saved', colors.green);
  }

  // Check API key
  if (!process.env.HUGGINGFACE_API_KEY && !DRY_RUN) {
    log('\n❌ HUGGINGFACE_API_KEY not configured', colors.red);
    log('   Get your API key from: https://huggingface.co/settings/tokens', colors.yellow);
    log('   Add it to .env.local as: HUGGINGFACE_API_KEY=hf_...', colors.yellow);
    process.exit(1);
  }

  // Load checkpoint if resuming
  let checkpoint: Checkpoint | null = null;
  let processedChefIds = new Set<string>();

  if (RESUME) {
    checkpoint = await loadCheckpoint(tmpDir);
    if (checkpoint) {
      log(
        `\n📂 Resuming from checkpoint (${checkpoint.processedChefIds.length} chefs already processed)`,
        colors.cyan
      );
      processedChefIds = new Set(checkpoint.processedChefIds);
    } else {
      log('\n⚠️  No checkpoint found, starting from beginning', colors.yellow);
    }
  }

  // Get total counts
  log('\n🔍 Checking database...', colors.cyan);
  const totalChefs = await db.execute(sql`SELECT COUNT(*) as count FROM chefs`);
  const chefCount = Number(totalChefs.rows[0]?.count || 0);
  const embeddingCount = await countChefEmbeddings();
  let missing = chefCount - embeddingCount;

  // Adjust for already processed in this session
  if (checkpoint) {
    missing = Math.max(0, missing - processedChefIds.size);
  }

  // Apply limit if specified
  const targetCount = LIMIT ? Math.min(LIMIT, missing) : missing;

  log(`\n📊 Database Status:`, colors.cyan);
  log(`  Total chefs: ${chefCount.toLocaleString()}`, colors.blue);
  log(
    `  With embeddings: ${embeddingCount.toLocaleString()} (${((embeddingCount / chefCount) * 100).toFixed(1)}%)`,
    colors.blue
  );
  log(`  Missing embeddings: ${missing.toLocaleString()}`, missing > 0 ? colors.yellow : colors.green);

  if (LIMIT) {
    log(`  Limit applied: ${LIMIT.toLocaleString()}`, colors.magenta);
    log(`  Will process: ${targetCount.toLocaleString()}`, colors.magenta);
  }

  if (checkpoint) {
    log(
      `  Already processed (this session): ${processedChefIds.size.toLocaleString()}`,
      colors.cyan
    );
  }

  if (targetCount === 0) {
    log('\n✅ All chefs already have embeddings!', colors.green);
    await clearCheckpoint(tmpDir);
    process.exit(0);
  }

  // Estimate time and cost
  const avgTimePerChef = 3; // seconds (includes API call + delay)
  const estimatedSeconds = targetCount * avgTimePerChef;
  const estimatedTime = formatTime(estimatedSeconds);
  const estimatedCost = 0; // HuggingFace Inference API is free tier friendly

  log(`\n⚙️  Configuration:`, colors.cyan);
  log(`  Model: BAAI/bge-small-en-v1.5 (384 dimensions)`, colors.blue);
  log(`  Batch size: ${BATCH_SIZE} chefs`, colors.blue);
  log(`  Delay between batches: ${DELAY_MS}ms`, colors.blue);
  log(`  Max retries: ${MAX_RETRIES} attempts`, colors.blue);
  log(`  Checkpoint interval: Every ${CHECKPOINT_INTERVAL} chefs`, colors.blue);
  log(`  Estimated time: ~${estimatedTime}`, colors.blue);
  log(`  Estimated cost: $${estimatedCost} (free tier)`, colors.green);

  // Confirm
  if (!DRY_RUN) {
    log(`\n⚠️  CONFIRMATION REQUIRED`, colors.yellow);
    log(`   This will generate ${targetCount.toLocaleString()} embeddings`, colors.yellow);
    log(`   Estimated time: ${estimatedTime}`, colors.yellow);
    log(`   Press Ctrl+C to cancel, or wait 5 seconds to continue...`, colors.yellow);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Initialize stats
  const stats: ProcessingStats = checkpoint?.stats || {
    total: targetCount,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    retried: 0,
    startTime: Date.now(),
    checkpointsSaved: 0,
  };

  const failedChefs: FailedChef[] = [];
  const startTime = checkpoint ? checkpoint.stats.startTime : Date.now();

  log(`\n${'='.repeat(80)}`, colors.cyan);
  log('🚀 Starting batch processing...', colors.cyan);
  log('='.repeat(80), colors.cyan);

  while (stats.processed < targetCount) {
    // Get next batch, excluding already processed chefs
    let query = sql`
      SELECT c.*
      FROM chefs c
      LEFT JOIN chefs_embeddings e ON c.id = e.chef_id
      WHERE e.id IS NULL
    `;

    // Exclude already processed chefs if resuming
    if (processedChefIds.size > 0) {
      const idsArray = Array.from(processedChefIds);
      query = sql`
        SELECT c.*
        FROM chefs c
        LEFT JOIN chefs_embeddings e ON c.id = e.chef_id
        WHERE e.id IS NULL AND c.id NOT IN (${sql.raw(idsArray.map(id => `'${id}'`).join(', '))})
      `;
    }

    query = sql`${query} LIMIT ${BATCH_SIZE}`;

    const batch = await db.execute(query);
    const chefs = batch.rows as any[];

    if (chefs.length === 0) {
      log('\n✅ No more chefs to process', colors.green);
      break;
    }

    const batchNum = Math.floor(stats.processed / BATCH_SIZE) + 1;
    log(`\n[Batch ${batchNum}] Processing ${chefs.length} chefs...`, colors.cyan);

    for (let i = 0; i < chefs.length; i++) {
      if (stats.processed >= targetCount) {
        log(`\n⚠️  Reached target count of ${targetCount}, stopping...`, colors.yellow);
        break;
      }

      const chef = chefs[i];
      const overall = stats.processed + 1;
      const percentage = ((overall / targetCount) * 100).toFixed(1);

      log(`\n[${overall}/${targetCount}] (${percentage}%) ${chef.name}`, colors.blue);
      log(`  ID: ${chef.id}`, colors.blue);

      if (DRY_RUN) {
        log(`  ✓ Would generate embedding (dry run)`, colors.green);
        stats.success++;
      } else {
        const result = await generateEmbeddingWithRetry(chef, MAX_RETRIES, tmpDir);

        if (result.success) {
          log(
            `  ✅ Success (${result.attempts} attempt${result.attempts > 1 ? 's' : ''})`,
            colors.green
          );
          stats.success++;
          if (result.attempts > 1) {
            stats.retried++;
          }
        } else {
          log(`  ❌ Failed after ${result.attempts} attempts: ${result.error}`, colors.red);
          stats.failed++;
          failedChefs.push({
            chefId: chef.id,
            chefName: chef.name,
            error: result.error || 'Unknown error',
            attempts: result.attempts,
          });
        }

        // Delay to avoid rate limits (except on last chef)
        if (i < chefs.length - 1 && overall < targetCount) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
      }

      stats.processed++;
      processedChefIds.add(chef.id);

      // Save checkpoint periodically
      if (stats.processed % CHECKPOINT_INTERVAL === 0 && !DRY_RUN) {
        const checkpointData: Checkpoint = {
          timestamp: new Date().toISOString(),
          processedChefIds: Array.from(processedChefIds),
          stats,
        };
        await saveCheckpoint(checkpointData, tmpDir);
        stats.checkpointsSaved++;
        log(`  💾 Checkpoint saved (${stats.checkpointsSaved})`, colors.magenta);
      }
    }

    // Progress report
    const elapsed = (Date.now() - startTime) / 1000;
    const remaining = targetCount - stats.processed;
    const rate = stats.processed / elapsed; // chefs per second
    const eta = remaining > 0 ? remaining / rate : 0;

    log(`\n📊 Progress Report:`, colors.cyan);
    log(
      `  Processed: ${stats.processed.toLocaleString()}/${targetCount.toLocaleString()} (${((stats.processed / targetCount) * 100).toFixed(1)}%)`,
      colors.blue
    );
    log(
      `  Success: ${stats.success.toLocaleString()} | Failed: ${stats.failed.toLocaleString()} | Retried: ${stats.retried.toLocaleString()}`,
      stats.success > stats.failed ? colors.green : colors.yellow
    );
    log(`  Elapsed: ${formatTime(elapsed)} | ETA: ${formatTime(eta)}`, colors.blue);
    log(`  Rate: ${(rate * 60).toFixed(1)} chefs/min`, colors.blue);

    if (stats.processed < targetCount) {
      log(`  ⏳ Waiting ${DELAY_MS}ms before next batch...`, colors.cyan);
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  const finalCount = await countChefEmbeddings();
  const totalChefsResult = await db.execute(sql`SELECT COUNT(*) as count FROM chefs`);
  const totalChefsCount = Number(totalChefsResult.rows[0]?.count || 0);
  const coverage = ((finalCount / totalChefsCount) * 100).toFixed(1);

  log(`\n${'='.repeat(80)}`, colors.bright);
  log('✅ GENERATION COMPLETE', colors.bright);
  log('='.repeat(80), colors.bright);

  log(`\n📊 Final Results:`, colors.cyan);
  log(`  Total processed: ${stats.processed.toLocaleString()}`, colors.blue);
  log(`  Successful: ${stats.success.toLocaleString()}`, colors.green);
  log(`  Failed: ${stats.failed.toLocaleString()}`, stats.failed > 0 ? colors.red : colors.green);
  log(
    `  Retried: ${stats.retried.toLocaleString()}`,
    stats.retried > 0 ? colors.yellow : colors.blue
  );
  log(`  Checkpoints saved: ${stats.checkpointsSaved}`, colors.magenta);
  log(`  Total time: ${formatTime(totalTime)}`, colors.blue);
  log(`  Average rate: ${((stats.processed / totalTime) * 60).toFixed(1)} chefs/min`, colors.blue);

  log(`\n📈 Database Coverage:`, colors.cyan);
  log(`  Total chefs: ${totalChefsCount.toLocaleString()}`, colors.blue);
  log(`  With embeddings: ${finalCount.toLocaleString()} (${coverage}%)`, colors.green);

  if (stats.failed > 0) {
    log(`\n⚠️  Failed Chefs (${stats.failed}):`, colors.yellow);
    const displayCount = Math.min(10, failedChefs.length);
    for (let i = 0; i < displayCount; i++) {
      const failed = failedChefs[i];
      log(`  ${i + 1}. ${failed.chefName}`, colors.red);
      log(`     ID: ${failed.chefId}`, colors.red);
      log(`     Error: ${failed.error}`, colors.red);
      log(`     Attempts: ${failed.attempts}`, colors.red);
    }
    if (failedChefs.length > displayCount) {
      log(`  ... and ${failedChefs.length - displayCount} more`, colors.red);
    }
    log(`\n   Error log saved to: ${path.join(tmpDir, 'chef-embedding-errors.log')}`, colors.yellow);
    log(`   You can re-run with --resume to retry failed chefs`, colors.yellow);
  } else if (stats.success > 0) {
    log(`\n✨ All embeddings generated successfully!`, colors.green);
  }

  // Save final report
  if (!DRY_RUN) {
    const reportPath = path.join(tmpDir, `chef-embedding-generation-report-${getTimestamp()}.json`);
    await fs.writeFile(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          stats,
          failedChefs,
          configuration: {
            batchSize: BATCH_SIZE,
            delayMs: DELAY_MS,
            maxRetries: MAX_RETRIES,
            checkpointInterval: CHECKPOINT_INTERVAL,
            model: 'BAAI/bge-small-en-v1.5',
          },
          coverage: {
            total: totalChefsCount,
            withEmbeddings: finalCount,
            percentage: coverage,
          },
        },
        null,
        2
      )
    );
    log(`\n📁 Report saved to: ${reportPath}`, colors.cyan);
  }

  // Clear checkpoint on successful completion
  if (stats.failed === 0) {
    await clearCheckpoint(tmpDir);
    log(`\n🗑️  Checkpoint cleared (no failures)`, colors.green);
  }

  if (DRY_RUN) {
    log(`\n💡 Next Steps:`, colors.cyan);
    log(`   - Review the output above`, colors.blue);
    log(`   - Run with --execute to generate embeddings`, colors.blue);
    log(`   - Use --limit=10 to test on a small batch first`, colors.blue);
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
