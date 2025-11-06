#!/usr/bin/env node
/**
 * Batch fix unsafe error handling in server action files
 * Replaces error.message and error instanceof Error patterns with toErrorMessage
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const files = [
  'src/app/actions/semantic-search.ts',
  'src/app/actions/recipe-ingestion.ts',
  'src/app/actions/recipe-search.ts',
  'src/app/actions/ingredient-search.ts',
  'src/app/actions/meal-pairing.ts',
  'src/app/actions/ingredients.ts',
  'src/app/actions/meals.ts',
  'src/app/actions/tools.ts',
  'src/app/actions/recipe-cloning.ts',
  'src/app/actions/substitutions.ts',
  'src/app/actions/chefs.ts',
  'src/app/actions/favorites.ts',
  'src/app/actions/recipe-discovery.ts',
  'src/app/actions/recipe-import.ts',
  'src/app/actions/ai-upload.ts',
  'src/app/actions/chef-scraping.ts',
  'src/app/actions/admin-recipes.ts',
  'src/app/actions/recipes.ts',
  'src/app/actions/inventory.ts',
  'src/app/actions/moderation.ts',
];

const importStatement = "import { toErrorMessage } from '@/lib/utils/error-handling';";

function processFile(filePath) {
  try {
    const fullPath = join(process.cwd(), filePath);
    let content = readFileSync(fullPath, 'utf-8');
    let changes = 0;

    // Check if import already exists
    const hasImport = content.includes("from '@/lib/utils/error-handling'");

    // Add import after last import statement if not present
    if (!hasImport) {
      // Find the last import line
      const lines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (
          lines[i].trim().startsWith('import ') ||
          (i > 0 && lines[i - 1].trim().startsWith('import ') && lines[i].includes('from'))
        ) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, importStatement);
        content = lines.join('\n');
        changes++;
      }
    }

    // Pattern 1: error.message || 'fallback'
    const pattern1 = /error\.message\s*\|\|\s*['"`][^'"`]+['"`]/g;
    const matches1 = content.match(pattern1);
    if (matches1) {
      content = content.replace(pattern1, 'toErrorMessage(error)');
      changes += matches1.length;
    }

    // Pattern 2: error?.message || 'fallback'
    const pattern2 = /error\?\.message\s*\|\|\s*['"`][^'"`]+['"`]/g;
    const matches2 = content.match(pattern2);
    if (matches2) {
      content = content.replace(pattern2, 'toErrorMessage(error)');
      changes += matches2.length;
    }

    // Pattern 3: error instanceof Error ? error.message : 'fallback'
    const pattern3 = /error instanceof Error \? error\.message : ['"`][^'"`]+['"`]/g;
    const matches3 = content.match(pattern3);
    if (matches3) {
      content = content.replace(pattern3, 'toErrorMessage(error)');
      changes += matches3.length;
    }

    // Pattern 4: just error.message (without fallback) - be careful with this one
    const pattern4 = /error\.message(?!\s*[|?])/g;
    const matches4Before = content.match(pattern4);
    if (matches4Before) {
      // Only replace if it's in a return statement for error property
      const pattern4Safe = /error:\s*error\.message(?!\s*[|?])/g;
      const matches4 = content.match(pattern4Safe);
      if (matches4) {
        content = content.replace(pattern4Safe, 'error: toErrorMessage(error)');
        changes += matches4.length;
      }
    }

    if (changes > 0) {
      writeFileSync(fullPath, content, 'utf-8');
      console.log(`✓ ${filePath}: ${changes} changes`);
      return changes;
    } else {
      console.log(`- ${filePath}: no changes needed`);
      return 0;
    }
  } catch (error) {
    console.error(`✗ ${filePath}: ${error.message}`);
    return 0;
  }
}

let totalChanges = 0;
console.log('Processing files...\n');

for (const file of files) {
  totalChanges += processFile(file);
}

console.log(`\n✓ Complete! Total changes: ${totalChanges}`);
