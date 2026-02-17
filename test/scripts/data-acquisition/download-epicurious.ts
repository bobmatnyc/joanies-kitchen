#!/usr/bin/env tsx

/**
 * Epicurious Kaggle Dataset Downloader
 *
 * Downloads the Epicurious Recipes dataset from Kaggle using the Kaggle CLI.
 *
 * Dataset: Epicurious - Recipes with Rating and Nutrition
 * Source: https://www.kaggle.com/datasets/hugodarwood/epirecipes
 * Format: JSON (epi_r.json)
 * Records: 20,000+ recipes
 *
 * Prerequisites:
 * 1. Install Kaggle CLI: pip install kaggle
 * 2. Configure Kaggle credentials: https://www.kaggle.com/docs/api
 *    - Create API token at: https://www.kaggle.com/settings/account
 *    - Place kaggle.json in ~/.kaggle/ (Linux/Mac) or %USERPROFILE%\.kaggle\ (Windows)
 *
 * Usage:
 *   tsx scripts/data-acquisition/download-epicurious.ts
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Constants
const DATA_DIR = path.join(process.cwd(), 'data/recipes/incoming/epicurious');
const DATASET_NAME = 'hugodarwood/epirecipes';
const EXPECTED_JSON_FILE = 'epi_r.json';
const METADATA_FILE = 'metadata.json';

interface DownloadMetadata {
  datasetName: string;
  downloadTimestamp: string;
  datasetVersion: string;
  recordCount: number;
  fileSize: number;
  downloadStatus: 'success' | 'failed';
  error?: string;
}

/**
 * Checks if Kaggle CLI is installed and configured
 */
function checkKaggleCLI(): { installed: boolean; configured: boolean; error?: string } {
  console.log('\n[Kaggle] Checking Kaggle CLI installation...');

  try {
    // Check if kaggle command exists
    execSync('kaggle --version', { stdio: 'pipe' });
    console.log('[Kaggle] ✓ Kaggle CLI is installed');

    // Check if credentials are configured
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const kaggleDir = path.join(homeDir, '.kaggle');
    const kaggleJsonPath = path.join(kaggleDir, 'kaggle.json');

    if (fs.existsSync(kaggleJsonPath)) {
      console.log('[Kaggle] ✓ Kaggle credentials found');
      return { installed: true, configured: true };
    } else {
      console.warn('[Kaggle] ⚠ Kaggle credentials not found');
      console.warn(`[Kaggle]   Expected location: ${kaggleJsonPath}`);
      console.warn('[Kaggle]   Visit: https://www.kaggle.com/settings/account');
      return {
        installed: true,
        configured: false,
        error:
          'Kaggle credentials not configured. Please create kaggle.json from Kaggle account settings.',
      };
    }
  } catch (_error: any) {
    console.error('[Kaggle] ✗ Kaggle CLI not found');
    console.error('[Kaggle]   Install with: pip install kaggle');
    return {
      installed: false,
      configured: false,
      error: 'Kaggle CLI not installed. Install with: pip install kaggle',
    };
  }
}

/**
 * Ensures the data directory exists
 */
function ensureDataDirectory(): void {
  console.log('\n[Setup] Creating data directory...');

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const logsDir = path.join(DATA_DIR, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  console.log(`[Setup] ✓ Directory ready: ${DATA_DIR}`);
}

/**
 * Downloads the Epicurious dataset from Kaggle
 */
function downloadDataset(): { success: boolean; error?: string } {
  console.log('\n[Download] Downloading Epicurious dataset from Kaggle...');
  console.log(`[Download] Dataset: ${DATASET_NAME}`);
  console.log(`[Download] Destination: ${DATA_DIR}`);

  try {
    // Download and unzip the dataset
    const command = `kaggle datasets download -d ${DATASET_NAME} --unzip --path "${DATA_DIR}"`;

    console.log('[Download] Executing download command...');
    console.log(`[Download] Command: ${command}`);

    // Execute download (this may take a while)
    execSync(command, {
      stdio: 'inherit', // Show download progress
      cwd: process.cwd(),
    });

    console.log('[Download] ✓ Download complete');
    return { success: true };
  } catch (error: any) {
    console.error('[Download] ✗ Download failed');
    console.error(`[Download] Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verifies the downloaded files
 */
function verifyDownload(): {
  verified: boolean;
  recordCount: number;
  fileSize: number;
  error?: string;
} {
  console.log('\n[Verify] Verifying downloaded files...');

  const jsonPath = path.join(DATA_DIR, EXPECTED_JSON_FILE);

  if (!fs.existsSync(jsonPath)) {
    console.error(`[Verify] ✗ Expected JSON file not found: ${jsonPath}`);
    return {
      verified: false,
      recordCount: 0,
      fileSize: 0,
      error: `Expected file not found: ${EXPECTED_JSON_FILE}`,
    };
  }

  console.log(`[Verify] ✓ Found: ${EXPECTED_JSON_FILE}`);

  // Get file size
  const stats = fs.statSync(jsonPath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`[Verify]   File size: ${fileSizeMB} MB`);

  // Count records in JSON
  try {
    console.log('[Verify] Counting records...');
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(jsonContent);

    const recordCount = Array.isArray(data) ? data.length : Object.keys(data).length;

    console.log(`[Verify] ✓ Found ${recordCount.toLocaleString()} recipes`);

    return {
      verified: true,
      recordCount,
      fileSize: stats.size,
    };
  } catch (error: any) {
    console.error('[Verify] ✗ Failed to parse JSON file');
    console.error(`[Verify] Error: ${error.message}`);
    return {
      verified: false,
      recordCount: 0,
      fileSize: stats.size,
      error: `Failed to parse JSON: ${error.message}`,
    };
  }
}

/**
 * Saves download metadata
 */
function saveMetadata(
  recordCount: number,
  fileSize: number,
  success: boolean,
  error?: string
): void {
  console.log('\n[Metadata] Saving download metadata...');

  const metadata: DownloadMetadata = {
    datasetName: DATASET_NAME,
    downloadTimestamp: new Date().toISOString(),
    datasetVersion: 'latest', // Kaggle doesn't provide version info easily
    recordCount,
    fileSize,
    downloadStatus: success ? 'success' : 'failed',
    error,
  };

  const metadataPath = path.join(DATA_DIR, METADATA_FILE);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(`[Metadata] ✓ Saved: ${metadataPath}`);
}

/**
 * Prints download summary
 */
function printSummary(
  recordCount: number,
  fileSize: number,
  success: boolean,
  startTime: Date
): void {
  const endTime = new Date();
  const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

  console.log(`\n${'='.repeat(80)}`);
  console.log('  DOWNLOAD SUMMARY');
  console.log('='.repeat(80));
  console.log(`Dataset: ${DATASET_NAME}`);
  console.log(`Status: ${success ? '✓ SUCCESS' : '✗ FAILED'}`);
  console.log(`Recipes: ${recordCount.toLocaleString()}`);
  console.log(`File Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Duration: ${durationSeconds.toFixed(2)} seconds`);
  console.log(`Location: ${DATA_DIR}`);
  console.log('='.repeat(80));
}

/**
 * Main download workflow
 */
async function main(): Promise<void> {
  const startTime = new Date();

  console.log(`\n${'='.repeat(80)}`);
  console.log('  EPICURIOUS DATASET DOWNLOADER');
  console.log('='.repeat(80));
  console.log(`Started: ${startTime.toISOString()}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Check prerequisites
    const kaggleCheck = checkKaggleCLI();
    if (!kaggleCheck.installed || !kaggleCheck.configured) {
      console.error('\n[Error] Prerequisites not met:');
      console.error(`  ${kaggleCheck.error}`);
      console.error('\nPlease install and configure Kaggle CLI:');
      console.error('  1. Install: pip install kaggle');
      console.error('  2. Configure: https://www.kaggle.com/docs/api');
      process.exit(1);
    }

    // Step 2: Ensure data directory exists
    ensureDataDirectory();

    // Step 3: Download dataset
    const downloadResult = downloadDataset();
    if (!downloadResult.success) {
      saveMetadata(0, 0, false, downloadResult.error);
      printSummary(0, 0, false, startTime);
      process.exit(1);
    }

    // Step 4: Verify download
    const verifyResult = verifyDownload();
    if (!verifyResult.verified) {
      saveMetadata(0, verifyResult.fileSize, false, verifyResult.error);
      printSummary(0, verifyResult.fileSize, false, startTime);
      process.exit(1);
    }

    // Step 5: Save metadata
    saveMetadata(verifyResult.recordCount, verifyResult.fileSize, true);

    // Step 6: Print summary
    printSummary(verifyResult.recordCount, verifyResult.fileSize, true, startTime);

    console.log('\n[Complete] Ready for ingestion!');
    console.log('[Complete] Run: pnpm data:epicurious:ingest\n');
  } catch (error: any) {
    console.error('\n[Fatal Error]', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
