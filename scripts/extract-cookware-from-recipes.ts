#!/usr/bin/env tsx
import 'dotenv/config';

/**
 * Cookware/Vessel Extraction Script
 *
 * Extends the kitchen tools extraction system to identify and extract cookware/cooking vessels
 * from recipe instructions and ingredient lists.
 *
 * Extracts cookware including:
 * - Skillets / frying pans / sauté pans
 * - Sauce pans / saucepans
 * - Pots / stockpots / dutch ovens
 * - Baking dishes / casserole dishes
 * - Sheet pans / baking sheets
 * - Cast iron skillets
 * - Non-stick pans
 *
 * USAGE:
 *   # Dry run (default - shows what would be extracted)
 *   pnpm tsx scripts/extract-cookware-from-recipes.ts
 *
 *   # Apply changes (production mode)
 *   APPLY_CHANGES=true pnpm tsx scripts/extract-cookware-from-recipes.ts
 *
 *   # Limit to specific number of recipes for testing
 *   LIMIT=10 pnpm tsx scripts/extract-cookware-from-recipes.ts
 *
 * SAFETY:
 *   - Entire extraction runs in a database transaction
 *   - Rolls back automatically on any error
 *   - Dry-run mode by default
 *   - Deduplication of tools before insertion
 *
 * @see docs/reference/KITCHEN_TOOLS_MIGRATION_ANALYSIS.md
 */

import { db, cleanup } from './db-with-transactions.js';
import { recipes, tools, recipeTools } from '../src/lib/db/schema.js';
import { eq, sql, inArray, and } from 'drizzle-orm';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.env.APPLY_CHANGES !== 'true';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

// ============================================================================
// COOKWARE PATTERNS
// ============================================================================

/**
 * Cookware detection patterns with variations
 * Each pattern includes:
 * - canonical: The normalized name for the tool
 * - display_name: Human-readable name
 * - patterns: Regex patterns to match in recipe text
 * - category: Tool category
 * - type/subtype: Ontology classification
 */
interface CookwarePattern {
  canonical: string;
  display_name: string;
  patterns: RegExp[];
  category: 'cookware' | 'bakeware';
  type: string;
  subtype: string;
  is_essential: boolean;
  description: string;
  aliases?: string[]; // Alternative names for display
}

const COOKWARE_PATTERNS: CookwarePattern[] = [
  // SKILLETS & FRYING PANS
  {
    canonical: 'skillet',
    display_name: 'Skillet',
    patterns: [
      /\b(?:large\s+)?skillets?\b/gi,
      /\b(?:medium|small)\s+skillets?\b/gi,
      /\bfrying\s+pans?\b/gi,
      /\bfry\s+pans?\b/gi,
      /\bsaut[ée]\s+pans?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pans',
    is_essential: true,
    description: 'Flat-bottomed pan for frying, searing, and sautéing',
    aliases: ['Frying Pan', 'Sauté Pan'],
  },
  {
    canonical: 'cast-iron-skillet',
    display_name: 'Cast Iron Skillet',
    patterns: [
      /\bcast[- ]iron\s+skillets?\b/gi,
      /\bcast[- ]iron\s+pans?\b/gi,
      /\bcast[- ]iron\s+frying\s+pans?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pans',
    is_essential: false,
    description: 'Heavy-duty cast iron pan for high-heat cooking and oven use',
  },
  {
    canonical: 'nonstick-pan',
    display_name: 'Nonstick Pan',
    patterns: [
      /\bnon[- ]?stick\s+(?:skillets?|pans?|frying\s+pans?)\b/gi,
      /\bteflon\s+pans?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pans',
    is_essential: false,
    description: 'Pan with nonstick coating for low-fat cooking',
  },

  // SAUCEPANS
  {
    canonical: 'saucepan',
    display_name: 'Saucepan',
    patterns: [
      /\bsaucepans?\b/gi,
      /\bsauce\s+pans?\b/gi,
      /\b(?:small|medium|large)\s+saucepans?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pans',
    is_essential: true,
    description: 'Pan with high sides and lid for sauces and small portions',
  },

  // POTS & STOCKPOTS
  {
    canonical: 'pot',
    display_name: 'Pot',
    patterns: [
      /\b(?:large|medium|small)\s+pots?\b/gi,
      /\bcooking\s+pots?\b/gi,
      /\bsoup\s+pots?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pots',
    is_essential: true,
    description: 'Large vessel for boiling, simmering, and making soups',
  },
  {
    canonical: 'stockpot',
    display_name: 'Stockpot',
    patterns: [
      /\bstockpots?\b/gi,
      /\bstock\s+pots?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pots',
    is_essential: false,
    description: 'Very large pot for stocks, soups, and boiling pasta',
  },
  {
    canonical: 'dutch-oven',
    display_name: 'Dutch Oven',
    patterns: [
      /\bdutch\s+ovens?\b/gi,
      /\bfrench\s+ovens?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pots',
    is_essential: false,
    description: 'Heavy pot with lid for braising, stewing, and bread baking',
  },

  // BAKING DISHES
  {
    canonical: 'baking-dish',
    display_name: 'Baking Dish',
    patterns: [
      /\bbaking\s+dishes?\b/gi,
      /\bcasserole\s+dishes?\b/gi,
      /\b(?:glass|ceramic|metal)\s+baking\s+dishes?\b/gi,
      /\b9x13\s+(?:inch\s+)?(?:pans?|dishes?)\b/gi,
      /\b8x8\s+(?:inch\s+)?(?:pans?|dishes?)\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: true,
    description: 'Rectangular or square dish for casseroles and baked dishes',
    aliases: ['Casserole Dish', '9x13 Pan'],
  },
  {
    canonical: 'roasting-pan',
    display_name: 'Roasting Pan',
    patterns: [
      /\broasting\s+pans?\b/gi,
      /\broasters?\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_roasting',
    is_essential: false,
    description: 'Large shallow pan for roasting meats and vegetables',
  },

  // SHEET PANS
  {
    canonical: 'sheet-pan',
    display_name: 'Sheet Pan',
    patterns: [
      /\bsheet\s+pans?\b/gi,
      /\bbaking\s+sheets?\b/gi,
      /\bcookie\s+sheets?\b/gi,
      /\bhalf[- ]sheet\s+pans?\b/gi,
      /\brimmed\s+baking\s+sheets?\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: true,
    description: 'Flat metal pan for baking cookies and roasting',
    aliases: ['Baking Sheet', 'Cookie Sheet'],
  },

  // WOK
  {
    canonical: 'wok',
    display_name: 'Wok',
    patterns: [
      /\bwoks?\b/gi,
      /\bstir[- ]fry\s+pans?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pans',
    is_essential: false,
    description: 'Round-bottomed pan for stir-frying',
  },

  // GRILL PAN
  {
    canonical: 'grill-pan',
    display_name: 'Grill Pan',
    patterns: [
      /\bgrill\s+pans?\b/gi,
      /\bgriddle\s+pans?\b/gi,
    ],
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_pans',
    is_essential: false,
    description: 'Ridged pan for indoor grilling',
  },

  // CAKE PANS
  {
    canonical: 'cake-pan',
    display_name: 'Cake Pan',
    patterns: [
      /\bcake\s+pans?\b/gi,
      /\b(?:8|9)[- ]inch\s+(?:round\s+)?cake\s+pans?\b/gi,
      /\bround\s+cake\s+pans?\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: false,
    description: 'Round pan for layer cakes',
  },
  {
    canonical: 'springform-pan',
    display_name: 'Springform Pan',
    patterns: [
      /\bspringform\s+pans?\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: false,
    description: 'Pan with removable sides for cheesecakes',
  },

  // LOAF PAN
  {
    canonical: 'loaf-pan',
    display_name: 'Loaf Pan',
    patterns: [
      /\bloaf\s+pans?\b/gi,
      /\bbread\s+pans?\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: false,
    description: 'Rectangular pan for breads and meatloaf',
  },

  // MUFFIN TIN
  {
    canonical: 'muffin-tin',
    display_name: 'Muffin Tin',
    patterns: [
      /\bmuffin\s+tins?\b/gi,
      /\bcupcake\s+(?:pans?|tins?)\b/gi,
      /\b(?:6|12)[- ]cup\s+muffin\s+(?:pans?|tins?)\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: false,
    description: 'Pan with cups for muffins and cupcakes',
  },

  // PIE DISH
  {
    canonical: 'pie-dish',
    display_name: 'Pie Dish',
    patterns: [
      /\bpie\s+(?:dishes?|plates?|pans?)\b/gi,
      /\b(?:8|9)[- ]inch\s+pie\s+(?:dishes?|plates?)\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: false,
    description: 'Round dish for pies and quiches',
  },

  // BUNDT PAN
  {
    canonical: 'bundt-pan',
    display_name: 'Bundt Pan',
    patterns: [
      /\bbundt\s+pans?\b/gi,
      /\btube\s+pans?\b/gi,
    ],
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: false,
    description: 'Fluted ring-shaped pan for bundt cakes',
  },
];

// ============================================================================
// TYPES
// ============================================================================

interface ExtractionStats {
  recipesProcessed: number;
  cookwareInstancesFound: number;
  uniqueCookwareTypes: number;
  toolsCreated: number;
  recipeToolsCreated: number;
  recipesCookwareExtracted: Map<string, Set<string>>; // recipeId -> Set of canonical tool names
}

interface ToolMatch {
  canonical: string;
  display_name: string;
  category: 'cookware' | 'bakeware';
  type: string;
  subtype: string;
  is_essential: boolean;
  description: string;
  matchedText: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract cookware mentions from recipe text
 */
function extractCookwareFromText(text: string): ToolMatch[] {
  const matches: ToolMatch[] = [];
  const seen = new Set<string>(); // Track canonical names to avoid duplicates

  for (const pattern of COOKWARE_PATTERNS) {
    for (const regex of pattern.patterns) {
      const found = text.match(regex);
      if (found && !seen.has(pattern.canonical)) {
        matches.push({
          canonical: pattern.canonical,
          display_name: pattern.display_name,
          category: pattern.category,
          type: pattern.type,
          subtype: pattern.subtype,
          is_essential: pattern.is_essential,
          description: pattern.description,
          matchedText: found[0],
        });
        seen.add(pattern.canonical);
      }
    }
  }

  return matches;
}

/**
 * Extract cookware from a single recipe
 */
function extractCookwareFromRecipe(recipe: any): ToolMatch[] {
  const allText = [
    recipe.description || '',
    recipe.ingredients || '',
    recipe.instructions || '',
  ].join(' ');

  return extractCookwareFromText(allText);
}

/**
 * Logging utilities
 */
function logSection(emoji: string, title: string) {
  console.log(`\n${emoji} ${title}`);
  console.log('━'.repeat(80));
}

function logSuccess(message: string) {
  console.log(`  ✅ ${message}`);
}

function logInfo(message: string) {
  console.log(`  ℹ️  ${message}`);
}

function logWarning(message: string) {
  console.log(`  ⚠️  ${message}`);
}

function logError(message: string) {
  console.error(`  ❌ ${message}`);
}

// ============================================================================
// MAIN EXTRACTION LOGIC
// ============================================================================

async function extractCookware(): Promise<ExtractionStats> {
  const stats: ExtractionStats = {
    recipesProcessed: 0,
    cookwareInstancesFound: 0,
    uniqueCookwareTypes: 0,
    toolsCreated: 0,
    recipeToolsCreated: 0,
    recipesCookwareExtracted: new Map(),
  };

  await db.transaction(async (tx) => {
    // ========================================================================
    // PHASE 1: Fetch Recipes
    // ========================================================================

    logSection('🔍', 'Phase 1: Fetching Recipes');

    let recipeQuery = tx.select().from(recipes);

    if (LIMIT) {
      recipeQuery = recipeQuery.limit(LIMIT) as any;
      logInfo(`Limiting to ${LIMIT} recipes for testing`);
    }

    const allRecipes = await recipeQuery;
    logSuccess(`Found ${allRecipes.length} recipes to process`);

    // ========================================================================
    // PHASE 2: Extract Cookware from Recipes
    // ========================================================================

    logSection('🍳', 'Phase 2: Extracting Cookware from Recipes');

    const cookwareByCanonical = new Map<string, {
      match: ToolMatch;
      recipeIds: Set<string>;
      count: number;
    }>();

    for (const recipe of allRecipes) {
      const matches = extractCookwareFromRecipe(recipe);

      if (matches.length > 0) {
        stats.cookwareInstancesFound += matches.length;
        stats.recipesCookwareExtracted.set(recipe.id, new Set(matches.map(m => m.canonical)));

        for (const match of matches) {
          if (!cookwareByCanonical.has(match.canonical)) {
            cookwareByCanonical.set(match.canonical, {
              match,
              recipeIds: new Set(),
              count: 0,
            });
          }

          const entry = cookwareByCanonical.get(match.canonical)!;
          entry.recipeIds.add(recipe.id);
          entry.count++;
        }
      }

      stats.recipesProcessed++;
    }

    stats.uniqueCookwareTypes = cookwareByCanonical.size;

    logSuccess(`Processed ${stats.recipesProcessed} recipes`);
    logSuccess(`Found ${stats.cookwareInstancesFound} cookware instances`);
    logSuccess(`Identified ${stats.uniqueCookwareTypes} unique cookware types`);

    // Log cookware frequency
    logInfo('\nCookware frequency:');
    const sortedCookware = Array.from(cookwareByCanonical.entries())
      .sort((a, b) => b[1].count - a[1].count);

    for (const [canonical, data] of sortedCookware) {
      console.log(`    ${data.match.display_name}: ${data.count} instances in ${data.recipeIds.size} recipes`);
    }

    // ========================================================================
    // PHASE 3: Create Tools in Database
    // ========================================================================

    logSection('🔧', 'Phase 3: Creating Tools in Database');

    // Check which tools already exist
    const existingTools = await tx
      .select()
      .from(tools)
      .where(inArray(tools.name, Array.from(cookwareByCanonical.keys())));

    const existingToolNames = new Set(existingTools.map(t => t.name));
    const toolIdMap = new Map<string, string>(); // canonical -> tool_id

    for (const tool of existingTools) {
      toolIdMap.set(tool.name, tool.id);
    }

    logInfo(`Found ${existingToolNames.size} existing tools`);

    // Create new tools
    for (const [canonical, data] of cookwareByCanonical.entries()) {
      if (existingToolNames.has(canonical)) {
        logInfo(`Tool already exists: ${data.match.display_name}`);
        continue;
      }

      if (DRY_RUN) {
        logInfo(`Would create tool: ${data.match.display_name}`);
        toolIdMap.set(canonical, `DRY_RUN_${canonical}`);
        stats.toolsCreated++;
      } else {
        const [newTool] = await tx.insert(tools).values({
          name: canonical,
          display_name: data.match.display_name,
          category: data.match.category,
          type: data.match.type,
          subtype: data.match.subtype,
          is_essential: data.match.is_essential,
          description: data.match.description,
        }).returning();

        toolIdMap.set(canonical, newTool.id);
        stats.toolsCreated++;
        logSuccess(`Created tool: ${data.match.display_name}`);
      }
    }

    logSuccess(`Created ${stats.toolsCreated} new tools`);

    // ========================================================================
    // PHASE 4: Create Recipe-Tool Relationships
    // ========================================================================

    logSection('📋', 'Phase 4: Creating Recipe-Tool Relationships');

    for (const [recipeId, cookwareSet] of stats.recipesCookwareExtracted.entries()) {
      for (const canonical of cookwareSet) {
        const toolId = toolIdMap.get(canonical);

        if (!toolId) {
          logError(`No tool ID found for: ${canonical}`);
          continue;
        }

        if (DRY_RUN) {
          stats.recipeToolsCreated++;
        } else {
          // Check if relationship already exists
          const existing = await tx
            .select()
            .from(recipeTools)
            .where(
              and(
                eq(recipeTools.recipe_id, recipeId),
                eq(recipeTools.tool_id, toolId)
              )
            );

          if (existing.length === 0) {
            await tx.insert(recipeTools).values({
              recipe_id: recipeId,
              tool_id: toolId,
              quantity: 1,
              is_optional: false,
            });
            stats.recipeToolsCreated++;
          }
        }
      }
    }

    logSuccess(`Created ${stats.recipeToolsCreated} recipe-tool relationships`);

    if (DRY_RUN) {
      logWarning('DRY RUN MODE - No changes were made to the database');
      throw new Error('DRY_RUN_ROLLBACK'); // Rollback transaction
    }
  }).catch((error) => {
    if (error.message === 'DRY_RUN_ROLLBACK') {
      // Expected in dry-run mode
      return;
    }
    throw error; // Re-throw actual errors
  });

  return stats;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function printReport(stats: ExtractionStats) {
  console.log('\n');
  console.log('━'.repeat(80));
  console.log('🍳 Cookware Extraction Report');
  console.log('━'.repeat(80));
  console.log('');

  console.log('Extraction Results:');
  console.log(`  ✅ ${stats.recipesProcessed} recipes processed`);
  console.log(`  ✅ ${stats.cookwareInstancesFound} cookware instances found`);
  console.log(`  ✅ ${stats.uniqueCookwareTypes} unique cookware types identified`);
  console.log('');

  console.log('Database Changes:');
  console.log(`  ✅ ${stats.toolsCreated} new tools created`);
  console.log(`  ✅ ${stats.recipeToolsCreated} recipe-tool relationships created`);
  console.log('');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes were made to the database');
    console.log('   Run with APPLY_CHANGES=true to execute extraction');
  } else {
    console.log('✨ Extraction complete!');
  }

  console.log('━'.repeat(80));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('🚀 Cookware Extraction Script');
    console.log('━'.repeat(80));

    if (DRY_RUN) {
      logWarning('Running in DRY RUN mode - no changes will be made');
      logInfo('Set APPLY_CHANGES=true to execute extraction');
    } else {
      logWarning('Running in PRODUCTION mode - changes will be applied!');
    }

    if (LIMIT) {
      logInfo(`Processing limited to ${LIMIT} recipes`);
    }

    // Run extraction
    const stats = await extractCookware();

    // Print report
    printReport(stats);

    console.log('\n✅ Script completed successfully');
    await cleanup();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Extraction failed with error:');
    console.error(error);
    console.error('\nℹ️  Database transaction was rolled back - no changes were made');
    await cleanup();
    process.exit(1);
  }
}

// Run the extraction
main();
