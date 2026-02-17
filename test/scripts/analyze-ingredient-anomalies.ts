/**
 * Analyze Ingredient Anomalies
 *
 * Identifies two categories of items that need special handling:
 * 1. Kitchen tools/equipment miscategorized as ingredients
 * 2. Product-specific ingredients with generic images
 *
 * Outputs CSV files for further processing and recommendations.
 */

import { eq, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { cleanup, db } from './db-with-transactions';
import { ingredients } from '@/lib/db/ingredients-schema';

// Tool detection patterns (using word boundaries for better matching)
const TOOL_PATTERNS = [
  // Kitchen equipment (using RegExp for word boundaries)
  /\bcake stand\b/i,
  /\bmeasuring (spoon|cup|jug)s?\b/i,
  /\bskewers?\b/i,
  /\btoothpicks?\b/i,
  /\bthermometer\b/i,
  /\btimer\b/i,
  /\bgrinder\b/i,
  /\bpeeler\b/i,
  /\bwhisk\b/i,
  /\bspatula\b/i,
  /\btongs\b/i,
  /\bstrainer\b/i,
  /\bcolander\b/i,
  /\bcheesecloth\b/i,
  /\bparchment (paper)?\b/i,
  /\b(aluminum )?foil\b/i,
  /\bplastic wrap\b/i,
  /\bmuddlers?\b/i,
  /\bramekins?\b/i,
  /\b(cookie )?cutters?\b/i,
  /\bsieve\b/i,
  /\bgrater\b/i,
  /\bmasher\b/i,
  /\bladle\b/i,
  /\bturner\b/i,
  /\bopener\b/i,
  /\bpress\b/i,
  /\b(cooling )?racks?\b/i,
  /\bcutting board\b/i,
  /\bbaking mat\b/i,
  /\b(muffin )?liners?\b/i,
  /\b(cooking|roasting|oven) bags?\b/i,
  /\bfilter\b/i,
  /\bfunnel\b/i,
  /\bmolds?\b/i,
  /\bice pop (molds?|sticks?)\b/i,
  /\bwooden (sticks?|spoons?|dowels?|popsicle sticks?)\b/i,
  /\bpastry bags?\b/i,
  /\bcardboard rounds?\b/i,
  /\bstorage (tub|container)s?\b/i,
  /\bmelon-ball cutter\b/i,
  /\bspice grinder\b/i,
  /\bnonstick (cooking )?spray\b/i,
  /\bnonstick vegetable oil spray\b/i,
  // Size descriptors with tools
  /\d+-inch.*\b(diameter|revolving|round)\b/i,
  /\d+ cm\b/i,
];

// Product mix patterns
const PRODUCT_MIX_PATTERNS = [
  'soup mix', 'pancake mix', 'cake mix', 'brownie mix', 'muffin mix',
  'cookie mix', 'bread mix', 'biscuit mix', 'waffle mix', 'cornbread mix',
  'seasoning mix', 'spice blend', 'spice mix', 'seasoning blend',
  'bean soup', 'grain pancake', 'grain mix', 'bean mix'
];

// Numbered products (e.g., "10 bean", "7 grain")
const NUMBERED_PRODUCT_PATTERN = /^\d+\s+(bean|grain|spice|herb)/i;

interface IngredientAnalysis {
  id: string;
  name: string;
  display_name: string;
  category: string | null;
  image_url: string | null;
  usage_count: number;
  is_tool: boolean;
  is_product_specific: boolean;
  detection_reason: string;
}

interface ToolRecommendation {
  id: string;
  name: string;
  category: string | null;
  usage_count: number;
  canonical_tool_name: string;
  variant: string;
}

interface ProductSpecificIngredient {
  id: string;
  name: string;
  category: string | null;
  current_image: string | null;
  needs_specific_image: string;
  usage_count: number;
}

/**
 * Check if ingredient name matches tool patterns
 */
function isLikelyTool(name: string): { isTool: boolean; reason: string } {
  for (const pattern of TOOL_PATTERNS) {
    if (pattern.test(name)) {
      return { isTool: true, reason: `Matches tool pattern: "${pattern.source}"` };
    }
  }

  return { isTool: false, reason: '' };
}

/**
 * Check if ingredient is a product-specific mix
 */
function isProductSpecific(name: string): { isProduct: boolean; reason: string } {
  const lowerName = name.toLowerCase();

  // Check numbered products
  if (NUMBERED_PRODUCT_PATTERN.test(name)) {
    return { isProduct: true, reason: 'Numbered product mix (e.g., "10 bean", "7 grain")' };
  }

  // Check product mix patterns
  for (const pattern of PRODUCT_MIX_PATTERNS) {
    if (lowerName.includes(pattern)) {
      return { isProduct: true, reason: `Product mix: "${pattern}"` };
    }
  }

  return { isProduct: false, reason: '' };
}

/**
 * Generate canonical tool name from variant
 */
function generateCanonicalToolName(name: string): { canonical: string; variant: string } {
  const lowerName = name.toLowerCase();

  // Map common tool patterns to canonical names
  const toolMappings: Array<{ pattern: RegExp; canonical: string }> = [
    { pattern: /cake stand/i, canonical: 'Cake Stand' },
    { pattern: /measuring spoon/i, canonical: 'Measuring Spoon' },
    { pattern: /measuring cup/i, canonical: 'Measuring Cup' },
    { pattern: /skewer/i, canonical: 'Skewer' },
    { pattern: /toothpick/i, canonical: 'Toothpick' },
    { pattern: /wooden stick/i, canonical: 'Wooden Stick' },
    { pattern: /ramekin/i, canonical: 'Ramekin' },
    { pattern: /muddler/i, canonical: 'Muddler' },
    { pattern: /cheesecloth/i, canonical: 'Cheesecloth' },
    { pattern: /parchment/i, canonical: 'Parchment Paper' },
    { pattern: /foil/i, canonical: 'Aluminum Foil' },
    { pattern: /plastic wrap/i, canonical: 'Plastic Wrap' },
    { pattern: /\bpan\b/i, canonical: 'Pan' },
    { pattern: /\bpot\b/i, canonical: 'Pot' },
    { pattern: /\bbowl\b/i, canonical: 'Bowl' },
    { pattern: /whisk/i, canonical: 'Whisk' },
    { pattern: /spatula/i, canonical: 'Spatula' },
    { pattern: /grater/i, canonical: 'Grater' },
    { pattern: /peeler/i, canonical: 'Peeler' },
    { pattern: /strainer/i, canonical: 'Strainer' },
    { pattern: /colander/i, canonical: 'Colander' },
    { pattern: /thermometer/i, canonical: 'Thermometer' },
    { pattern: /timer/i, canonical: 'Timer' },
    { pattern: /scale/i, canonical: 'Scale' },
  ];

  for (const { pattern, canonical } of toolMappings) {
    if (pattern.test(name)) {
      // Extract variant (e.g., "11-inch diameter revolving" from "11-inch diameter revolving cake stand")
      const variant = name.replace(pattern, '').trim();
      return { canonical, variant: variant || 'Standard' };
    }
  }

  // Default: capitalize first letter of each word
  const canonical = name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return { canonical, variant: 'Standard' };
}

/**
 * Suggest specific image for product
 */
function suggestImageDescription(name: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('soup mix')) {
    return 'Package of soup mix showing product label';
  } else if (lowerName.includes('pancake mix')) {
    return 'Box of pancake mix showing product';
  } else if (lowerName.includes('cake mix')) {
    return 'Box of cake mix showing product';
  } else if (lowerName.includes('brownie mix')) {
    return 'Box of brownie mix showing product';
  } else if (lowerName.includes('seasoning mix') || lowerName.includes('spice blend')) {
    return 'Package of seasoning/spice blend';
  } else if (/\d+\s+bean/i.test(name)) {
    return 'Package of multi-bean soup mix showing beans';
  } else if (/\d+\s+grain/i.test(name)) {
    return 'Package of multi-grain mix showing grains';
  } else {
    return 'Specific product package/mix (not generic category image)';
  }
}

/**
 * Main analysis function
 */
async function analyzeIngredients() {
  console.log('🔍 Starting ingredient anomaly analysis...\n');

  try {
    // Fetch all ingredients with usage counts
    console.log('📊 Fetching ingredients from database...');

    const allIngredients = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        display_name: ingredients.display_name,
        category: ingredients.category,
        image_url: ingredients.image_url,
        usage_count: ingredients.usage_count,
      })
      .from(ingredients);

    console.log(`✅ Loaded ${allIngredients.length} ingredients\n`);

    // Analyze each ingredient
    const analysis: IngredientAnalysis[] = [];
    const toolsList: ToolRecommendation[] = [];
    const productsList: ProductSpecificIngredient[] = [];

    for (const ingredient of allIngredients) {
      const toolCheck = isLikelyTool(ingredient.name);
      const productCheck = isProductSpecific(ingredient.name);

      const record: IngredientAnalysis = {
        id: ingredient.id,
        name: ingredient.name,
        display_name: ingredient.display_name,
        category: ingredient.category,
        image_url: ingredient.image_url,
        usage_count: ingredient.usage_count,
        is_tool: toolCheck.isTool,
        is_product_specific: productCheck.isProduct,
        detection_reason: toolCheck.reason || productCheck.reason,
      };

      analysis.push(record);

      // Add to tools list
      if (toolCheck.isTool) {
        const { canonical, variant } = generateCanonicalToolName(ingredient.display_name);
        toolsList.push({
          id: ingredient.id,
          name: ingredient.name,
          category: ingredient.category,
          usage_count: ingredient.usage_count,
          canonical_tool_name: canonical,
          variant: variant,
        });
      }

      // Add to products list
      if (productCheck.isProduct) {
        productsList.push({
          id: ingredient.id,
          name: ingredient.name,
          category: ingredient.category,
          current_image: ingredient.image_url,
          needs_specific_image: suggestImageDescription(ingredient.name),
          usage_count: ingredient.usage_count,
        });
      }
    }

    // Sort lists
    toolsList.sort((a, b) => b.usage_count - a.usage_count);
    productsList.sort((a, b) => b.usage_count - a.usage_count);

    // Print statistics
    console.log('📈 ANALYSIS STATISTICS');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`Total ingredients analyzed: ${allIngredients.length}`);
    console.log(`Tools found: ${toolsList.length}`);
    console.log(`Product-specific ingredients: ${productsList.length}`);
    console.log(`Clean ingredients: ${allIngredients.length - toolsList.length - productsList.length}\n`);

    // Create output directory
    const outputDir = path.join(process.cwd(), 'tmp', 'ingredient-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write tools CSV
    const toolsCsvPath = path.join(outputDir, 'tools-found.csv');
    const toolsCsvHeader = 'id,name,category,usage_count,canonical_tool_name,variant\n';
    const toolsCsvRows = toolsList.map(t =>
      `"${t.id}","${t.name}","${t.category || ''}",${t.usage_count},"${t.canonical_tool_name}","${t.variant}"`
    ).join('\n');
    fs.writeFileSync(toolsCsvPath, toolsCsvHeader + toolsCsvRows);
    console.log(`✅ Tools CSV written to: ${toolsCsvPath}`);

    // Write products CSV
    const productsCsvPath = path.join(outputDir, 'product-specific-ingredients.csv');
    const productsCsvHeader = 'id,name,category,current_image,needs_specific_image,usage_count\n';
    const productsCsvRows = productsList.map(p =>
      `"${p.id}","${p.name}","${p.category || ''}","${p.current_image || ''}","${p.needs_specific_image}",${p.usage_count}`
    ).join('\n');
    fs.writeFileSync(productsCsvPath, productsCsvHeader + productsCsvRows);
    console.log(`✅ Products CSV written to: ${productsCsvPath}\n`);

    // Print top tools by usage
    console.log('🔧 TOP TOOLS BY USAGE (Showing top 20)');
    console.log('═══════════════════════════════════════════════════\n');
    toolsList.slice(0, 20).forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.canonical_tool_name} - "${tool.variant}"`);
      console.log(`   Name: ${tool.name}`);
      console.log(`   Category: ${tool.category || 'N/A'}`);
      console.log(`   Usage: ${tool.usage_count} recipes\n`);
    });

    // Print top products by usage
    console.log('📦 TOP PRODUCT-SPECIFIC INGREDIENTS (Showing top 20)');
    console.log('═══════════════════════════════════════════════════\n');
    productsList.slice(0, 20).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category || 'N/A'}`);
      console.log(`   Current Image: ${product.current_image || 'None'}`);
      console.log(`   Needs: ${product.needs_specific_image}`);
      console.log(`   Usage: ${product.usage_count} recipes\n`);
    });

    // Generate canonical tool recommendations
    const canonicalTools = new Map<string, { count: number; variants: Set<string> }>();
    toolsList.forEach(tool => {
      if (!canonicalTools.has(tool.canonical_tool_name)) {
        canonicalTools.set(tool.canonical_tool_name, { count: 0, variants: new Set() });
      }
      const entry = canonicalTools.get(tool.canonical_tool_name)!;
      entry.count += tool.usage_count;
      entry.variants.add(tool.variant);
    });

    console.log('🎯 RECOMMENDED CANONICAL TOOL NAMES');
    console.log('═══════════════════════════════════════════════════\n');

    const sortedCanonical = Array.from(canonicalTools.entries())
      .sort((a, b) => b[1].count - a[1].count);

    sortedCanonical.forEach(([canonical, data]) => {
      console.log(`${canonical} (${data.count} total uses)`);
      console.log(`  Variants: ${Array.from(data.variants).join(', ')}\n`);
    });

    // Write summary report
    const summaryPath = path.join(outputDir, 'analysis-summary.txt');
    const summary = `
INGREDIENT ANOMALY ANALYSIS REPORT
Generated: ${new Date().toISOString()}

═══════════════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
-----------------
Total ingredients analyzed: ${allIngredients.length}
Tools found: ${toolsList.length}
Product-specific ingredients: ${productsList.length}
Clean ingredients: ${allIngredients.length - toolsList.length - productsList.length}

TOOLS BREAKDOWN
---------------
${sortedCanonical.map(([canonical, data]) =>
  `${canonical}: ${data.count} uses across ${data.variants.size} variants`
).join('\n')}

RECOMMENDATIONS
---------------
1. Create a separate "tools" table for kitchen equipment
2. Migrate ${toolsList.length} tool entries from ingredients table
3. Update ${productsList.length} product-specific ingredients with proper images
4. Consider adding a "product_type" flag for mixes and branded items

FILES GENERATED
---------------
- tools-found.csv: Complete list of tools with canonical names
- product-specific-ingredients.csv: Products needing specific images
- analysis-summary.txt: This summary report

NEXT STEPS
----------
1. Review the CSV files to validate detection accuracy
2. Create migration script to move tools to separate table
3. Source specific product images for identified items
4. Update ingredient categorization rules to prevent future misclassification
`;

    fs.writeFileSync(summaryPath, summary);
    console.log(`✅ Summary report written to: ${summaryPath}\n`);

    console.log('✨ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    throw error;
  } finally {
    await cleanup();
  }
}

// Run analysis
analyzeIngredients()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
