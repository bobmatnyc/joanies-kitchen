#!/usr/bin/env tsx

/**
 * OpenRecipes Dataset Downloader
 *
 * Downloads OpenRecipes dataset from GitHub repository
 * Repository: https://github.com/openrecipes/openrecipes
 *
 * OpenRecipes is a community-maintained collection of 200K+ recipes
 * from multiple sources (AllRecipes, Food Network, Epicurious, etc.)
 * in schema.org/Recipe JSON format.
 *
 * Download Options:
 * 1. Direct download via raw.githubusercontent.com (recommended)
 * 2. Git clone entire repository (large, includes all historical dumps)
 * 3. GitHub API to fetch latest release
 *
 * This script uses Option 1 for efficient, targeted downloads.
 *
 * Features:
 * - Downloads specific recipe dump files
 * - Validates downloaded JSON files
 * - Saves metadata (file list, record counts, download timestamp)
 * - Comprehensive error handling and logging
 * - Progress tracking for large files
 *
 * Usage:
 *   tsx scripts/data-acquisition/download-openrecipes.ts [--sources=allrecipes,foodnetwork]
 *   tsx scripts/data-acquisition/download-openrecipes.ts --all
 *   tsx scripts/data-acquisition/download-openrecipes.ts --sample  # Download sample files only
 *
 * Examples:
 *   tsx scripts/data-acquisition/download-openrecipes.ts --all
 *   tsx scripts/data-acquisition/download-openrecipes.ts --sources=allrecipes
 *   tsx scripts/data-acquisition/download-openrecipes.ts --sample
 */

import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

// Constants
const DATA_DIR = path.join(process.cwd(), 'data/recipes/incoming/openrecipes');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

// GitHub raw content base URL
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/openrecipes/openrecipes/master';

// Available recipe source files
// Note: OpenRecipes repository structure may change; these are common dumps
const RECIPE_SOURCES: Record<string, string> = {
  allrecipes: 'allrecipes.json',
  foodnetwork: 'foodnetwork.json',
  epicurious: 'epicurious.json',
  bbcgoodfood: 'bbcgoodfood.json',
  recipeland: 'recipeland.json',
};

// Sample files (smaller subsets for testing)
const SAMPLE_FILES: Record<string, string> = {
  sample: 'sample.json',
};

interface DownloadMetadata {
  downloadDate: string;
  files: Array<{
    source: string;
    filename: string;
    size: number;
    recordCount: number;
  }>;
  totalRecords: number;
  status: 'complete' | 'partial' | 'failed';
}

/**
 * Downloads a file from URL to local path
 */
async function downloadFile(url: string, outputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log(`[Download] Fetching: ${url}`);

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log(`[Download] Following redirect to: ${redirectUrl}`);
            downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;

        const fileStream = fs.createWriteStream(outputPath);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
            process.stdout.write(
              `\r[Download] Progress: ${percent}% (${formatBytes(downloadedSize)} / ${formatBytes(totalSize)})`
            );
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          process.stdout.write('\n');
          console.log(`[Download] ✓ Saved to: ${outputPath}`);
          resolve(downloadedSize);
        });

        fileStream.on('error', (error) => {
          fs.unlink(outputPath, () => {}); // Delete partial file
          reject(error);
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Validates and counts records in a JSON file
 */
function validateAndCountRecords(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Handle different JSON structures
    if (Array.isArray(data)) {
      return data.length;
    } else if (typeof data === 'object' && data !== null) {
      // Object with recipe keys
      return Object.keys(data).length;
    } else {
      console.warn(`[Validation] Unexpected JSON structure in ${filePath}`);
      return 0;
    }
  } catch (error: any) {
    console.error(`[Validation] Failed to parse ${filePath}: ${error.message}`);
    return 0;
  }
}

/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Saves download metadata to file
 */
function saveMetadata(metadata: DownloadMetadata): void {
  try {
    fs.mkdirSync(path.dirname(METADATA_FILE), { recursive: true });
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    console.log(`[Metadata] ✓ Saved to: ${METADATA_FILE}`);
  } catch (error: any) {
    console.warn(`[Metadata] Failed to save: ${error.message}`);
  }
}

/**
 * Main download function
 */
async function downloadOpenRecipes(options: {
  sources?: string[];
  all?: boolean;
  sample?: boolean;
}): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log('  OPENRECIPES DATASET DOWNLOADER');
  console.log('='.repeat(80));
  console.log(`Repository: https://github.com/openrecipes/openrecipes`);
  console.log(`Data Directory: ${DATA_DIR}`);
  console.log('='.repeat(80));

  // Ensure directories exist
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const metadata: DownloadMetadata = {
    downloadDate: new Date().toISOString(),
    files: [],
    totalRecords: 0,
    status: 'complete',
  };

  let filesToDownload: Record<string, string> = {};

  // Determine which files to download
  if (options.sample) {
    console.log('[Download] Mode: Sample files only\n');
    filesToDownload = SAMPLE_FILES;
  } else if (options.all) {
    console.log('[Download] Mode: All available sources\n');
    filesToDownload = RECIPE_SOURCES;
  } else if (options.sources && options.sources.length > 0) {
    console.log(`[Download] Mode: Selected sources (${options.sources.join(', ')})\n`);
    for (const source of options.sources) {
      if (RECIPE_SOURCES[source]) {
        filesToDownload[source] = RECIPE_SOURCES[source];
      } else {
        console.warn(`[Download] Unknown source: ${source} (skipping)`);
      }
    }
  } else {
    console.log('[Download] No sources specified. Use --all or --sources=name1,name2\n');
    console.log('Available sources:');
    Object.keys(RECIPE_SOURCES).forEach((source) => {
      console.log(`  - ${source}`);
    });
    console.log('\nExample: tsx download-openrecipes.ts --sources=allrecipes,foodnetwork');
    return;
  }

  if (Object.keys(filesToDownload).length === 0) {
    console.log('[Download] No valid files to download.');
    return;
  }

  console.log(`[Download] Files to download: ${Object.keys(filesToDownload).length}`);
  console.log('='.repeat(80));

  // Download each file
  for (const [source, filename] of Object.entries(filesToDownload)) {
    console.log(`\n[Download] Processing: ${source} (${filename})`);

    const url = `${GITHUB_RAW_BASE}/${filename}`;
    const outputPath = path.join(DATA_DIR, filename);

    try {
      // Check if file already exists
      if (fs.existsSync(outputPath)) {
        console.log(`[Download] File already exists: ${outputPath}`);
        console.log(`[Download] Checking if re-download needed...`);

        // For simplicity, we'll re-download. In production, check file hash or modification date.
        fs.unlinkSync(outputPath);
        console.log(`[Download] Removed existing file, downloading fresh copy...`);
      }

      // Download file
      const size = await downloadFile(url, outputPath);

      // Validate and count records
      console.log(`[Validation] Validating JSON structure...`);
      const recordCount = validateAndCountRecords(outputPath);

      if (recordCount === 0) {
        console.warn(`[Validation] ⚠ No records found in ${filename}`);
        metadata.status = 'partial';
      } else {
        console.log(`[Validation] ✓ Found ${recordCount.toLocaleString()} recipes`);
      }

      metadata.files.push({
        source,
        filename,
        size,
        recordCount,
      });

      metadata.totalRecords += recordCount;

      console.log(`[Download] ✓ Completed: ${source}`);
    } catch (error: any) {
      console.error(`[Download] ✗ Failed to download ${source}: ${error.message}`);

      // Check for specific error patterns
      if (error.message.includes('404')) {
        console.error(
          `[Download] File not found on GitHub. The repository structure may have changed.`
        );
        console.error(
          `[Download] Manual download may be required from: https://github.com/openrecipes/openrecipes`
        );
      }

      metadata.status = 'partial';
    }
  }

  // Save metadata
  saveMetadata(metadata);

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('  DOWNLOAD COMPLETE');
  console.log('='.repeat(80));
  console.log(`Status: ${metadata.status.toUpperCase()}`);
  console.log(`Files Downloaded: ${metadata.files.length}`);
  console.log(`Total Recipes: ${metadata.totalRecords.toLocaleString()}`);
  console.log(`Total Size: ${formatBytes(metadata.files.reduce((sum, f) => sum + f.size, 0))}`);
  console.log('\nFile Details:');
  metadata.files.forEach((file) => {
    console.log(
      `  - ${file.source.padEnd(15)} ${file.recordCount.toLocaleString().padStart(8)} recipes  ${formatBytes(file.size)}`
    );
  });
  console.log('='.repeat(80));

  if (metadata.status === 'partial') {
    console.log('\n⚠ WARNING: Some files failed to download. Check logs above for details.');
    console.log('If files are missing from GitHub, you may need to:');
    console.log('1. Clone the repository: git clone https://github.com/openrecipes/openrecipes');
    console.log(`2. Copy JSON files manually to: ${DATA_DIR}`);
  }

  console.log('\nNext step: Run ingestion script');
  console.log('  tsx scripts/data-acquisition/ingest-openrecipes.ts\n');
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: {
    sources?: string[];
    all?: boolean;
    sample?: boolean;
  } = {};

  for (const arg of args) {
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--sample') {
      options.sample = true;
    } else if (arg.startsWith('--sources=')) {
      const sourcesStr = arg.replace('--sources=', '');
      options.sources = sourcesStr.split(',').map((s) => s.trim());
    } else if (arg === '--help' || arg === '-h') {
      console.log('OpenRecipes Dataset Downloader\n');
      console.log('Usage:');
      console.log('  tsx download-openrecipes.ts --all');
      console.log('  tsx download-openrecipes.ts --sources=allrecipes,foodnetwork');
      console.log('  tsx download-openrecipes.ts --sample');
      console.log('\nOptions:');
      console.log('  --all                Download all available sources');
      console.log('  --sources=s1,s2      Download specific sources');
      console.log('  --sample             Download sample files only');
      console.log('  --help, -h           Show this help message');
      console.log('\nAvailable Sources:');
      Object.keys(RECIPE_SOURCES).forEach((source) => {
        console.log(`  - ${source}`);
      });
      process.exit(0);
    }
  }

  downloadOpenRecipes(options)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
