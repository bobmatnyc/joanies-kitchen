import * as fs from 'fs';

const analysis = JSON.parse(fs.readFileSync('tmp/hidden-recipes-analysis.json', 'utf-8'));
const categoryB = analysis.byCategory.categoryB;

// Group by source domain
const bySource: Record<string, any[]> = {};
categoryB.forEach((recipe: any) => {
  if (!recipe.source) {
    if (!bySource['no-source']) bySource['no-source'] = [];
    bySource['no-source'].push(recipe);
    return;
  }

  try {
    // Ensure URL has protocol
    const urlStr = recipe.source.startsWith('http') ? recipe.source : `https://${recipe.source}`;
    const domain = new URL(urlStr).hostname.replace('www.', '');
    if (!bySource[domain]) bySource[domain] = [];
    bySource[domain].push(recipe);
  } catch (error) {
    // Invalid URL, group as 'invalid-url'
    if (!bySource['invalid-url']) bySource['invalid-url'] = [];
    bySource['invalid-url'].push(recipe);
  }
});

// Sort sources by recipe count
const sortedSources = Object.entries(bySource)
  .sort(([, a], [, b]) => b.length - a.length)
  .slice(0, 15);

console.log('📊 Top 15 Sources for Category B Recipes (179 total):\n');
sortedSources.forEach(([source, recipes]) => {
  const avgIngredients = recipes.reduce((sum: number, r: any) => sum + r.ingredientCount, 0) / recipes.length;
  console.log(`${recipes.length.toString().padStart(3)} recipes - ${source} (avg ${avgIngredients.toFixed(1)} ingredients)`);
});

// Prioritize by ingredient count
const tiers = {
  tier1: categoryB.filter((r: any) => r.ingredientCount >= 12), // Rich recipes
  tier2: categoryB.filter((r: any) => r.ingredientCount >= 8 && r.ingredientCount < 12), // Good recipes
  tier3: categoryB.filter((r: any) => r.ingredientCount >= 5 && r.ingredientCount < 8), // Basic recipes
};

console.log('\n\n📈 PRIORITIZATION BY INGREDIENT COUNT:\n');
console.log(`Tier 1 (12+ ingredients): ${tiers.tier1.length} recipes - HIGH PRIORITY`);
console.log(`Tier 2 (8-11 ingredients): ${tiers.tier2.length} recipes - MEDIUM PRIORITY`);
console.log(`Tier 3 (5-7 ingredients): ${tiers.tier3.length} recipes - LOW PRIORITY`);

console.log('\n\n🎯 TIER 1 - HIGH PRIORITY RECIPES (12+ ingredients):\n');
tiers.tier1.slice(0, 20).forEach((r: any, i: number) => {
  const sourceShort = r.source ? r.source.split('/')[2]?.replace('www.', '') || r.source : 'no-source';
  console.log(`${(i + 1).toString().padStart(2)}. ${r.name}`);
  console.log(`    ${r.ingredientCount} ingredients - ${sourceShort}`);
});

if (tiers.tier1.length > 20) {
  console.log(`    ... and ${tiers.tier1.length - 20} more`);
}

// Save prioritized list
const prioritized = {
  timestamp: new Date().toISOString(),
  total: categoryB.length,
  tiers: {
    tier1: {
      count: tiers.tier1.length,
      priority: 'HIGH',
      description: '12+ ingredients - rich, complex recipes',
      recipes: tiers.tier1,
    },
    tier2: {
      count: tiers.tier2.length,
      priority: 'MEDIUM',
      description: '8-11 ingredients - good quality recipes',
      recipes: tiers.tier2,
    },
    tier3: {
      count: tiers.tier3.length,
      priority: 'LOW',
      description: '5-7 ingredients - basic recipes',
      recipes: tiers.tier3,
    },
  },
  sourceDistribution: sortedSources.map(([source, recipes]) => ({
    source,
    count: recipes.length,
    avgIngredients: (recipes.reduce((sum: number, r: any) => sum + r.ingredientCount, 0) / recipes.length).toFixed(1),
  })),
};

fs.writeFileSync('tmp/category-b-prioritized.json', JSON.stringify(prioritized, null, 2));

console.log('\n\n📄 Prioritized list saved to: tmp/category-b-prioritized.json');
console.log('\n✅ Category B prioritization complete!');
