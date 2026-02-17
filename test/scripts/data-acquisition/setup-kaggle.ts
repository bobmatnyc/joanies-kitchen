#!/usr/bin/env tsx

/**
 * Sets up Kaggle API credentials
 *
 * Users need to:
 * 1. Go to https://www.kaggle.com/settings
 * 2. Click "Create New API Token"
 * 3. Save kaggle.json to ~/.kaggle/
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function checkKaggleSetup(): boolean {
  const kaggleDir = path.join(os.homedir(), '.kaggle');
  const kaggleJson = path.join(kaggleDir, 'kaggle.json');

  if (!fs.existsSync(kaggleJson)) {
    console.log('\n❌ Kaggle API not configured');
    console.log('\nSetup Instructions:');
    console.log('1. Visit: https://www.kaggle.com/settings');
    console.log('2. Scroll to "API" section');
    console.log('3. Click "Create New API Token"');
    console.log('4. Save kaggle.json to:', kaggleDir);
    console.log('5. Run: chmod 600 ~/.kaggle/kaggle.json');
    return false;
  }

  // Check file permissions (should be 600)
  const stats = fs.statSync(kaggleJson);
  const mode = (stats.mode & 0o777).toString(8);

  if (mode !== '600') {
    console.log('\n⚠️  Kaggle API configured but permissions are incorrect');
    console.log(`Current permissions: ${mode} (should be 600)`);
    console.log('Run: chmod 600 ~/.kaggle/kaggle.json');
    return false;
  }

  console.log('✓ Kaggle API configured');
  return true;
}

if (require.main === module) {
  const isSetup = checkKaggleSetup();
  process.exit(isSetup ? 0 : 1);
}
