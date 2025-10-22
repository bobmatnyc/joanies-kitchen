'use server';

import { db } from '@/lib/db';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import { eq, inArray, sql } from 'drizzle-orm';

// Tool IDs from the analysis (31 tools currently in ingredients table)
const TOOL_IDS = [
  'bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473', // skewers
  'ac46cc71-0d63-4076-96bc-d53261c68e2a', // bamboo skewers
  '21644114-5795-491c-992e-6bf46ac13f7b', // thermometer
  'd60e504a-1412-424e-af29-98c9e2e1578f', // cookie cutter
  '1519b8c7-7d9d-4661-90ed-fb851e1dad78', // cardboard round
  'a86979ca-295d-4a6e-9d74-6137b35f46c3', // lamb rack
  '1310abfe-1cad-4618-871d-3d9c1400a9a0', // spatula
  '7d16e6c8-bc34-4e7e-86a1-8b228f52cd95', // oven-roasting bag
  '1e415be0-9d94-422c-8c7e-a7e036e8259c', // nonstick cooking spray
  'bb5e796c-9bc7-4e7b-bc29-a276daa48e51', // measuring spoon
  '9f7b5dad-4fdd-4f5f-ba55-9c1cf5a962f3', // muddler
  '6b4ebbbf-9b80-4238-a619-42075377ad74', // muffin liners
  '601c5898-e2dc-4f4d-8823-012599b27e31', // deep-fat thermometer
  '302d198d-f196-4ba5-a3f1-fd80b3218d9c', // plastic storage tub
  '0c4d1a87-f4c7-452e-aea4-9167b4d40025', // tongs
  '1216513e-b7b9-401e-8257-8341b2a77858', // wooden stick
  '2bdaa2f2-82ae-45ab-a3f2-1efbb98097fb', // ramekins
  '5c1d3bf1-4994-410f-bb8a-c45b80c4567c', // cutter
  '540a29c5-1792-4dd9-8859-73cb89812c76', // ramekin
  '763ad899-1991-43d7-8a1f-05806c6044da', // spice grinder
  '10637dd2-d9d6-4a1b-9c0c-1873c40da26d', // oven cooking bag
  '5a23f573-b6ce-4240-bacb-6d0d836285c7', // wooden sticks
  '3978a9c3-c8e0-4377-8512-09cd2312b06a', // wooden spoon
  'f2d67c0f-4f4e-49ca-b978-d0c855dea7b4', // ice pop molds
  'bfa74904-f337-44ed-8756-a6c623bd69e8', // wooden ice pop sticks
  'ac2374d5-3d07-479c-8393-0c71f0c47a5b', // measuring spoons
  '46cceb69-677a-4ef8-aace-32b8b1561d7a', // muddlers
  'b1a5651c-8ca8-4a64-b522-117a9df74c9b', // pastry bag
  '630bb14d-39c6-4f73-ab18-3896baa6010e', // cake stand
  'aef3b08c-8c37-4661-b1f8-ad48701988c9', // wooden dowels
  '6c3db2ec-56f1-44e7-b31f-9f75f83a1c0a', // nonstick vegetable oil spray
];

// Canonical tool mapping (from analysis)
const CANONICAL_TOOLS: Record<string, { canonical: string; variant: string }> = {
  'bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473': { canonical: 'Skewer', variant: 's' },
  'ac46cc71-0d63-4076-96bc-d53261c68e2a': { canonical: 'Skewer', variant: 'Bamboo s' },
  '21644114-5795-491c-992e-6bf46ac13f7b': { canonical: 'Thermometer', variant: 'Standard' },
  'd60e504a-1412-424e-af29-98c9e2e1578f': { canonical: 'Star Cookie Cutter', variant: 'Standard' },
  '1519b8c7-7d9d-4661-90ed-fb851e1dad78': { canonical: 'Cardboard Round', variant: 'Standard' },
  'a86979ca-295d-4a6e-9d74-6137b35f46c3': { canonical: 'Lamb Rack', variant: 'Standard' },
  '1310abfe-1cad-4618-871d-3d9c1400a9a0': { canonical: 'Spatula', variant: 'Rubber' },
  '7d16e6c8-bc34-4e7e-86a1-8b228f52cd95': { canonical: 'Oven-roasting Bag', variant: 'Standard' },
  '1e415be0-9d94-422c-8c7e-a7e036e8259c': { canonical: 'Nonstick Cooking Spray', variant: 'Standard' },
  'bb5e796c-9bc7-4e7b-bc29-a276daa48e51': { canonical: 'Measuring Spoon', variant: 'Standard' },
  '9f7b5dad-4fdd-4f5f-ba55-9c1cf5a962f3': { canonical: 'Muddler', variant: 'Standard' },
  '6b4ebbbf-9b80-4238-a619-42075377ad74': { canonical: 'Mini Muffin Liners', variant: 'Standard' },
  '601c5898-e2dc-4f4d-8823-012599b27e31': { canonical: 'Thermometer', variant: 'Deep-Fat' },
  '302d198d-f196-4ba5-a3f1-fd80b3218d9c': { canonical: 'Plastic Storage Tub', variant: 'Standard' },
  '0c4d1a87-f4c7-452e-aea4-9167b4d40025': { canonical: 'Long Metal Tongs', variant: 'Standard' },
  '1216513e-b7b9-401e-8257-8341b2a77858': { canonical: 'Wooden Stick', variant: 'Standard' },
  '2bdaa2f2-82ae-45ab-a3f2-1efbb98097fb': { canonical: 'Ramekin', variant: 's or Custard Cups' },
  '5c1d3bf1-4994-410f-bb8a-c45b80c4567c': { canonical: 'Melon-ball Cutter', variant: 'Standard' },
  '540a29c5-1792-4dd9-8859-73cb89812c76': { canonical: 'Ramekin', variant: 'Standard' },
  '763ad899-1991-43d7-8a1f-05806c6044da': { canonical: 'Spice Grinder', variant: 'Standard' },
  '10637dd2-d9d6-4a1b-9c0c-1873c40da26d': { canonical: 'Oven Cooking Bag', variant: 'Standard' },
  '5a23f573-b6ce-4240-bacb-6d0d836285c7': { canonical: 'Wooden Stick', variant: 's' },
  '3978a9c3-c8e0-4377-8512-09cd2312b06a': { canonical: 'Wooden Spoon', variant: 'Standard' },
  'f2d67c0f-4f4e-49ca-b978-d0c855dea7b4': { canonical: 'Ice Pop Molds', variant: 'Standard' },
  'bfa74904-f337-44ed-8756-a6c623bd69e8': { canonical: 'Wooden Ice Pop Sticks', variant: 'Standard' },
  'ac2374d5-3d07-479c-8393-0c71f0c47a5b': { canonical: 'Measuring Spoon', variant: 's' },
  '46cceb69-677a-4ef8-aace-32b8b1561d7a': { canonical: 'Muddler', variant: 's' },
  'b1a5651c-8ca8-4a64-b522-117a9df74c9b': { canonical: 'Pastry Bag', variant: 'Standard' },
  '630bb14d-39c6-4f73-ab18-3896baa6010e': { canonical: 'Cake Stand', variant: '11-Inch-Diameter Revolving' },
  'aef3b08c-8c37-4661-b1f8-ad48701988c9': { canonical: 'Wooden Dowels', variant: 'Standard' },
  '6c3db2ec-56f1-44e7-b31f-9f75f83a1c0a': { canonical: 'Nonstick Vegetable Oil Spray', variant: 'Standard' },
};

export interface KitchenTool {
  id: string;
  name: string;
  displayName: string;
  canonicalName: string;
  variant: string;
  category: string | null;
  usageCount: number;
  imageUrl: string | null;
}

export type SortOption = 'alphabetical' | 'usage' | 'canonical';

export interface GetToolsOptions {
  search?: string;
  sort?: SortOption;
  limit?: number;
  offset?: number;
}

/**
 * Get all kitchen tools with their usage counts
 */
export async function getAllTools(
  options: GetToolsOptions = {}
): Promise<{
  success: boolean;
  tools: KitchenTool[];
  totalCount: number;
  error?: string;
}> {
  try {
    const { search = '', sort = 'alphabetical', limit = 50, offset = 0 } = options;

    // Fetch tools from ingredients table
    let query = db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        displayName: ingredients.display_name,
        category: ingredients.category,
        imageUrl: ingredients.image_url,
        usageCount: ingredients.usage_count,
      })
      .from(ingredients)
      .where(inArray(ingredients.id, TOOL_IDS));

    // Apply search filter if provided
    if (search) {
      query = query.where(
        sql`LOWER(${ingredients.display_name}) LIKE ${'%' + search.toLowerCase() + '%'}`
      );
    }

    // Apply sorting
    switch (sort) {
      case 'usage':
        query = query.orderBy(sql`${ingredients.usage_count} DESC NULLS LAST`);
        break;
      case 'canonical':
        // Sort by canonical name (we'll do this in memory after fetching)
        break;
      case 'alphabetical':
      default:
        query = query.orderBy(sql`LOWER(${ingredients.display_name}) ASC`);
    }

    // Execute query
    const results = await query.limit(limit).offset(offset);

    // Map to KitchenTool objects with canonical names
    let tools: KitchenTool[] = results.map((row) => {
      const canonical = CANONICAL_TOOLS[row.id] || {
        canonical: row.displayName,
        variant: 'Standard',
      };

      return {
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        canonicalName: canonical.canonical,
        variant: canonical.variant,
        category: row.category,
        usageCount: row.usageCount || 0,
        imageUrl: row.imageUrl,
      };
    });

    // Sort by canonical name if requested
    if (sort === 'canonical') {
      tools = tools.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
    }

    // Count total (for pagination)
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(ingredients)
      .where(inArray(ingredients.id, TOOL_IDS));

    const totalCount = Number(countResult[0]?.count || 0);

    return {
      success: true,
      tools,
      totalCount,
    };
  } catch (error) {
    console.error('Error fetching tools:', error);
    return {
      success: false,
      tools: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch tools',
    };
  }
}

/**
 * Get tools grouped by canonical name
 * This shows base tools with their variants
 */
export async function getToolsByCanonical(): Promise<{
  success: boolean;
  canonicalTools: Array<{
    canonical: string;
    variants: Array<{
      id: string;
      name: string;
      variant: string;
      usageCount: number;
      imageUrl: string | null;
    }>;
    totalUsage: number;
  }>;
  error?: string;
}> {
  try {
    const toolsResult = await getAllTools({ limit: 100 });

    if (!toolsResult.success) {
      throw new Error(toolsResult.error || 'Failed to fetch tools');
    }

    // Group by canonical name
    const grouped = new Map<
      string,
      Array<{
        id: string;
        name: string;
        variant: string;
        usageCount: number;
        imageUrl: string | null;
      }>
    >();

    for (const tool of toolsResult.tools) {
      if (!grouped.has(tool.canonicalName)) {
        grouped.set(tool.canonicalName, []);
      }

      grouped.get(tool.canonicalName)!.push({
        id: tool.id,
        name: tool.displayName,
        variant: tool.variant,
        usageCount: tool.usageCount,
        imageUrl: tool.imageUrl,
      });
    }

    // Convert to array and calculate total usage
    const canonicalTools = Array.from(grouped.entries()).map(([canonical, variants]) => ({
      canonical,
      variants: variants.sort((a, b) => b.usageCount - a.usageCount),
      totalUsage: variants.reduce((sum, v) => sum + v.usageCount, 0),
    }));

    // Sort by total usage
    canonicalTools.sort((a, b) => b.totalUsage - a.totalUsage);

    return {
      success: true,
      canonicalTools,
    };
  } catch (error) {
    console.error('Error fetching canonical tools:', error);
    return {
      success: false,
      canonicalTools: [],
      error: error instanceof Error ? error.message : 'Failed to fetch canonical tools',
    };
  }
}
