#!/usr/bin/env tsx

/**
 * Downloads Food.com dataset from Kaggle
 *
 * Prerequisites:
 * - Kaggle API credentials configured (~/.kaggle/kaggle.json)
 * - Kaggle CLI installed (pip install kaggle)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DATASET = 'shuyangli94/food-com-recipes-and-user-interactions';
const OUTPUT_DIR = path.join(process.cwd(), 'data/recipes/incoming/food-com');

export async function downloadFoodCom(): Promise<{
  success: boolean;
  files?: string[];
  error?: any;
}> {
  console.log('[Food.com] Starting download...');

  // Ensure directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    // Check if kaggle CLI is available
    try {
      execSync('which kaggle', { stdio: 'pipe' });
    } catch (_error) {
      console.error('[Food.com] Kaggle CLI not found');
      console.error('Install with: pip install kaggle');
      return { success: false, error: 'Kaggle CLI not installed' };
    }

    // Download using Kaggle CLI
    console.log('[Food.com] Downloading from Kaggle...');
    console.log(`[Food.com] Dataset: ${DATASET}`);
    console.log(`[Food.com] Output: ${OUTPUT_DIR}`);

    execSync(`kaggle datasets download -d ${DATASET} -p ${OUTPUT_DIR} --unzip`, {
      stdio: 'inherit',
    });

    console.log('[Food.com] ✓ Download complete');

    // List downloaded files
    const files = fs.readdirSync(OUTPUT_DIR);
    console.log('[Food.com] Files downloaded:', files);

    return { success: true, files };
  } catch (error: any) {
    console.error('[Food.com] Download failed:', error.message);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  downloadFoodCom()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
