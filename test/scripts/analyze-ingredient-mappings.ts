import fs from 'fs';
import path from 'path';

interface MigrationResult {
  originalPath: string;
  blobUrl: string;
  size: number;
  success: boolean;
  category: string;
}

interface BrokenIngredient {
  name: string;
  currentUrl: string;
  potentialMatches: {
    filename: string;
    blobUrl: string;
    similarity: number;
  }[];
}

// List of 52 broken ingredients
const brokenIngredients = [
  'almond_extract', 'almonds', 'apricot', 'apricot_jam', 'baby_arugula',
  'baby_spinach', 'bacon', 'black_olives', 'bran', 'butter',
  'cabbage', 'celery', 'cheese', 'chicken_broth', 'cilantro',
  'corn', 'dough', 'dry_white_wine', 'egg', 'flour_tortillas',
  'garlic', 'green_beans', 'ground_cumin', 'ground_pork', 'ice',
  'instant_espresso_powder', 'italian_sausage', 'lamb', 'lemon', 'lobster',
  'milk', 'mint', 'mushroom', 'noodles', 'onion',
  'orange', 'orange_juice', 'orange_zest', 'pineapple', 'porridge_oats',
  'red_bell_pepper', 'sage', 'salt', 'seeds', 'sugar',
  'sweet_potatoes', 'tomato', 'tomatoes', 'unsweetened_chocolate', 'vanilla_ice_cream',
  'water', 'worcestershire_sauce'
];

function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
    .replace(/\.png$/, '');
}

function calculateSimilarity(broken: string, blobFilename: string): number {
  const normalizedBroken = normalizeForComparison(broken);
  const normalizedBlob = normalizeForComparison(blobFilename);

  // Exact match
  if (normalizedBroken === normalizedBlob) return 100;

  // Blob contains broken name
  if (normalizedBlob.includes(normalizedBroken)) return 90;

  // Broken contains blob name (less likely but possible)
  if (normalizedBroken.includes(normalizedBlob)) return 85;

  // Calculate Levenshtein-like similarity based on common prefix
  let commonLength = 0;
  const minLength = Math.min(normalizedBroken.length, normalizedBlob.length);
  for (let i = 0; i < minLength; i++) {
    if (normalizedBroken[i] === normalizedBlob[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  const similarity = (commonLength / Math.max(normalizedBroken.length, normalizedBlob.length)) * 80;
  return Math.round(similarity);
}

async function analyzeMappings() {
  // Read migration results
  const migrationFiles = fs.readdirSync('/Users/masa/Projects/joanies-kitchen/tmp')
    .filter(f => f.startsWith('migration-results-ingredients-'));

  if (migrationFiles.length === 0) {
    console.error('No migration results found!');
    process.exit(1);
  }

  const migrationFile = path.join('/Users/masa/Projects/joanies-kitchen/tmp', migrationFiles[0]);
  const migrationResults: MigrationResult[] = JSON.parse(fs.readFileSync(migrationFile, 'utf-8'));

  console.log(`📊 Analyzing ${brokenIngredients.length} broken ingredients against ${migrationResults.length} blob URLs\n`);

  const analysis: BrokenIngredient[] = [];
  const noMatches: string[] = [];
  const perfectMatches: string[] = [];
  const fuzzyMatches: string[] = [];

  for (const broken of brokenIngredients) {
    const matches: BrokenIngredient['potentialMatches'] = [];

    for (const result of migrationResults) {
      const filename = path.basename(result.originalPath, '.png');
      const similarity = calculateSimilarity(broken, filename);

      if (similarity >= 50) {
        matches.push({
          filename,
          blobUrl: result.blobUrl,
          similarity
        });
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    const ingredient: BrokenIngredient = {
      name: broken,
      currentUrl: `/images/ingredients/${broken}.png`,
      potentialMatches: matches.slice(0, 5) // Top 5 matches
    };

    analysis.push(ingredient);

    if (matches.length === 0) {
      noMatches.push(broken);
    } else if (matches[0].similarity === 100) {
      perfectMatches.push(broken);
    } else {
      fuzzyMatches.push(broken);
    }
  }

  // Print summary
  console.log('📈 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Perfect matches (100%): ${perfectMatches.length}`);
  console.log(`🔍 Fuzzy matches (50-99%): ${fuzzyMatches.length}`);
  console.log(`❌ No matches (<50%):       ${noMatches.length}`);
  console.log('');

  // Perfect matches
  if (perfectMatches.length > 0) {
    console.log('✅ PERFECT MATCHES (100%)');
    console.log('═══════════════════════════════════════════════════════════════');
    for (const broken of perfectMatches) {
      const item = analysis.find(a => a.name === broken)!;
      console.log(`${broken}`);
      console.log(`  → ${item.potentialMatches[0].filename}`);
      console.log(`  → ${item.potentialMatches[0].blobUrl}`);
      console.log('');
    }
  }

  // Fuzzy matches
  if (fuzzyMatches.length > 0) {
    console.log('🔍 FUZZY MATCHES (needs review)');
    console.log('═══════════════════════════════════════════════════════════════');
    for (const broken of fuzzyMatches) {
      const item = analysis.find(a => a.name === broken)!;
      console.log(`${broken} (${item.potentialMatches[0].similarity}% match)`);
      for (let i = 0; i < Math.min(3, item.potentialMatches.length); i++) {
        const match = item.potentialMatches[i];
        console.log(`  ${i + 1}. [${match.similarity}%] ${match.filename}`);
      }
      console.log('');
    }
  }

  // No matches
  if (noMatches.length > 0) {
    console.log('❌ NO MATCHES (need new images)');
    console.log('═══════════════════════════════════════════════════════════════');
    for (const broken of noMatches) {
      console.log(`  • ${broken}`);
    }
    console.log('');
  }

  // Save detailed analysis to JSON
  const outputPath = '/Users/masa/Projects/joanies-kitchen/tmp/ingredient-mapping-analysis.json';
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
  console.log(`💾 Detailed analysis saved to: ${outputPath}`);

  // Generate mapping recommendations
  console.log('\n📋 RECOMMENDED MAPPING STRATEGY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`1. AUTO-MAP: ${perfectMatches.length} perfect matches can be automatically mapped`);
  console.log(`2. REVIEW: ${fuzzyMatches.length} fuzzy matches need manual review`);
  console.log(`3. CREATE: ${noMatches.length} ingredients need new images`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review fuzzy matches in tmp/ingredient-mapping-analysis.json');
  console.log('  2. Create a mapping file for manual corrections');
  console.log('  3. Run update script to apply mappings');
}

analyzeMappings().catch(console.error);
