'use server';

import { db } from '@/lib/db';
import { tools, recipeTools, recipes } from '@/lib/db/schema';
import { eq, inArray, sql, and, like, desc } from 'drizzle-orm';

export interface Tool {
  id: string;
  name: string;
  displayName: string;
  category: string;
  type: string | null;
  subtype: string | null;
  isEssential: boolean;
  isSpecialized: boolean;
  alternatives: string | null;
  typicalPriceUsd: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  usageCount?: number; // Count of recipes using this tool
  imageUrl?: string | null; // Optional image URL (for future use)
}

export interface RecipeTool {
  id: string;
  recipeId: string;
  toolId: string;
  isOptional: boolean;
  quantity: number;
  notes: string | null;
  createdAt: Date;
}

export type SortOption = 'alphabetical' | 'usage' | 'category' | 'essential';

export interface GetToolsOptions {
  search?: string;
  category?: string;
  type?: string;
  sort?: SortOption;
  limit?: number;
  offset?: number;
  essentialOnly?: boolean;
}

/**
 * Get all kitchen tools with optional filtering and sorting
 */
export async function getAllTools(
  options: GetToolsOptions = {}
): Promise<{
  success: boolean;
  tools: Tool[];
  totalCount: number;
  error?: string;
}> {
  try {
    const {
      search = '',
      category,
      type,
      sort = 'alphabetical',
      limit = 50,
      offset = 0,
      essentialOnly = false,
    } = options;

    // Build where conditions
    const conditions = [];

    if (search) {
      conditions.push(
        sql`LOWER(${tools.display_name}) LIKE ${`%${search.toLowerCase()}%`}`
      );
    }

    if (category) {
      conditions.push(sql`${tools.category} = ${category}`);
    }

    if (type) {
      conditions.push(sql`${tools.type} = ${type}`);
    }

    if (essentialOnly) {
      conditions.push(eq(tools.is_essential, true));
    }

    // Build query with usage count
    const baseQuery = db
      .select({
        id: tools.id,
        name: tools.name,
        displayName: tools.display_name,
        category: tools.category,
        type: tools.type,
        subtype: tools.subtype,
        isEssential: tools.is_essential,
        isSpecialized: tools.is_specialized,
        alternatives: tools.alternatives,
        typicalPriceUsd: tools.typical_price_usd,
        description: tools.description,
        createdAt: tools.created_at,
        updatedAt: tools.updated_at,
        usageCount: sql<number>`COALESCE(COUNT(DISTINCT ${recipeTools.recipe_id}), 0)`,
      })
      .from(tools)
      .leftJoin(recipeTools, eq(tools.id, recipeTools.tool_id))
      .$dynamic();

    // Add where conditions if any
    if (conditions.length > 0) {
      baseQuery.where(and(...conditions));
    }

    // Group by all tool fields
    baseQuery.groupBy(
      tools.id,
      tools.name,
      tools.display_name,
      tools.category,
      tools.type,
      tools.subtype,
      tools.is_essential,
      tools.is_specialized,
      tools.alternatives,
      tools.typical_price_usd,
      tools.description,
      tools.created_at,
      tools.updated_at
    );

    // Determine order by clause
    let orderByClause;
    switch (sort) {
      case 'usage':
        orderByClause = [sql`COALESCE(COUNT(DISTINCT ${recipeTools.recipe_id}), 0) DESC`, sql`LOWER(${tools.display_name}) ASC`];
        break;
      case 'category':
        orderByClause = [sql`${tools.category} ASC`, sql`LOWER(${tools.display_name}) ASC`];
        break;
      case 'essential':
        orderByClause = [sql`${tools.is_essential} DESC`, sql`LOWER(${tools.display_name}) ASC`];
        break;
      case 'alphabetical':
      default:
        orderByClause = sql`LOWER(${tools.display_name}) ASC`;
    }

    // Add ordering
    if (Array.isArray(orderByClause)) {
      baseQuery.orderBy(...orderByClause);
    } else {
      baseQuery.orderBy(orderByClause);
    }

    // Add pagination
    const results = await baseQuery.limit(limit).offset(offset);

    // Map to Tool objects
    const toolsList: Tool[] = results.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      category: row.category,
      type: row.type,
      subtype: row.subtype,
      isEssential: row.isEssential ?? false,
      isSpecialized: row.isSpecialized ?? false,
      alternatives: row.alternatives,
      typicalPriceUsd: row.typicalPriceUsd,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      usageCount: Number(row.usageCount) || 0,
      imageUrl: null, // TODO: Add image support in future
    }));

    // Count total (for pagination)
    const countQuery = db
      .select({ count: sql<number>`COUNT(DISTINCT ${tools.id})` })
      .from(tools);

    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }

    const countResult = await countQuery;
    const totalCount = Number(countResult[0]?.count || 0);

    return {
      success: true,
      tools: toolsList,
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
 * Get a single tool by ID
 */
export async function getToolById(toolId: string): Promise<{
  success: boolean;
  tool: Tool | null;
  error?: string;
}> {
  try {
    const [tool] = await db
      .select({
        id: tools.id,
        name: tools.name,
        displayName: tools.display_name,
        category: tools.category,
        type: tools.type,
        subtype: tools.subtype,
        isEssential: tools.is_essential,
        isSpecialized: tools.is_specialized,
        alternatives: tools.alternatives,
        typicalPriceUsd: tools.typical_price_usd,
        description: tools.description,
        createdAt: tools.created_at,
        updatedAt: tools.updated_at,
      })
      .from(tools)
      .where(eq(tools.id, toolId))
      .limit(1);

    if (!tool) {
      return {
        success: false,
        tool: null,
        error: 'Tool not found',
      };
    }

    return {
      success: true,
      tool: {
        id: tool.id,
        name: tool.name,
        displayName: tool.displayName,
        category: tool.category,
        type: tool.type,
        subtype: tool.subtype,
        isEssential: tool.isEssential ?? false,
        isSpecialized: tool.isSpecialized ?? false,
        alternatives: tool.alternatives,
        typicalPriceUsd: tool.typicalPriceUsd,
        description: tool.description,
        createdAt: tool.createdAt,
        updatedAt: tool.updatedAt,
      },
    };
  } catch (error) {
    console.error('Error fetching tool by ID:', error);
    return {
      success: false,
      tool: null,
      error: error instanceof Error ? error.message : 'Failed to fetch tool',
    };
  }
}

/**
 * Get tools by category
 */
export async function getToolsByCategory(category: string): Promise<{
  success: boolean;
  tools: Tool[];
  error?: string;
}> {
  try {
    const results = await db
      .select({
        id: tools.id,
        name: tools.name,
        displayName: tools.display_name,
        category: tools.category,
        type: tools.type,
        subtype: tools.subtype,
        isEssential: tools.is_essential,
        isSpecialized: tools.is_specialized,
        alternatives: tools.alternatives,
        typicalPriceUsd: tools.typical_price_usd,
        description: tools.description,
        createdAt: tools.created_at,
        updatedAt: tools.updated_at,
      })
      .from(tools)
      .where(sql`${tools.category} = ${category}`)
      .orderBy(sql`LOWER(${tools.display_name}) ASC`);

    const toolsList: Tool[] = results.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      category: row.category,
      type: row.type,
      subtype: row.subtype,
      isEssential: row.isEssential ?? false,
      isSpecialized: row.isSpecialized ?? false,
      alternatives: row.alternatives,
      typicalPriceUsd: row.typicalPriceUsd,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return {
      success: true,
      tools: toolsList,
    };
  } catch (error) {
    console.error('Error fetching tools by category:', error);
    return {
      success: false,
      tools: [],
      error: error instanceof Error ? error.message : 'Failed to fetch tools',
    };
  }
}

/**
 * Get tools used in a specific recipe
 */
export async function getRecipeTools(recipeId: string): Promise<{
  success: boolean;
  tools: Array<Tool & { isOptional: boolean; quantity: number; notes: string | null }>;
  error?: string;
}> {
  try {
    const results = await db
      .select({
        id: tools.id,
        name: tools.name,
        displayName: tools.display_name,
        category: tools.category,
        type: tools.type,
        subtype: tools.subtype,
        isEssential: tools.is_essential,
        isSpecialized: tools.is_specialized,
        alternatives: tools.alternatives,
        typicalPriceUsd: tools.typical_price_usd,
        description: tools.description,
        createdAt: tools.created_at,
        updatedAt: tools.updated_at,
        isOptional: recipeTools.is_optional,
        quantity: recipeTools.quantity,
        notes: recipeTools.notes,
      })
      .from(recipeTools)
      .innerJoin(tools, eq(recipeTools.tool_id, tools.id))
      .where(eq(recipeTools.recipe_id, recipeId))
      .orderBy(sql`LOWER(${tools.display_name}) ASC`);

    const toolsList = results.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      category: row.category,
      type: row.type,
      subtype: row.subtype,
      isEssential: row.isEssential ?? false,
      isSpecialized: row.isSpecialized ?? false,
      alternatives: row.alternatives,
      typicalPriceUsd: row.typicalPriceUsd,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isOptional: row.isOptional ?? false,
      quantity: row.quantity ?? 1,
      notes: row.notes,
    }));

    return {
      success: true,
      tools: toolsList,
    };
  } catch (error) {
    console.error('Error fetching recipe tools:', error);
    return {
      success: false,
      tools: [],
      error: error instanceof Error ? error.message : 'Failed to fetch recipe tools',
    };
  }
}

/**
 * Get tools by type (ontology)
 */
export async function getToolsByType(type: string): Promise<{
  success: boolean;
  tools: Tool[];
  error?: string;
}> {
  try {
    const results = await db
      .select({
        id: tools.id,
        name: tools.name,
        displayName: tools.display_name,
        category: tools.category,
        type: tools.type,
        subtype: tools.subtype,
        isEssential: tools.is_essential,
        isSpecialized: tools.is_specialized,
        alternatives: tools.alternatives,
        typicalPriceUsd: tools.typical_price_usd,
        description: tools.description,
        createdAt: tools.created_at,
        updatedAt: tools.updated_at,
      })
      .from(tools)
      .where(eq(tools.type, type))
      .orderBy(sql`LOWER(${tools.display_name}) ASC`);

    const toolsList: Tool[] = results.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      category: row.category,
      type: row.type,
      subtype: row.subtype,
      isEssential: row.isEssential ?? false,
      isSpecialized: row.isSpecialized ?? false,
      alternatives: row.alternatives,
      typicalPriceUsd: row.typicalPriceUsd,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return {
      success: true,
      tools: toolsList,
    };
  } catch (error) {
    console.error('Error fetching tools by type:', error);
    return {
      success: false,
      tools: [],
      error: error instanceof Error ? error.message : 'Failed to fetch tools',
    };
  }
}

/**
 * Get essential tools only
 */
export async function getEssentialTools(): Promise<{
  success: boolean;
  tools: Tool[];
  error?: string;
}> {
  return getAllTools({ essentialOnly: true, limit: 100 });
}

/**
 * Get tool categories with counts
 */
export async function getToolCategories(): Promise<{
  success: boolean;
  categories: Array<{ category: string; count: number }>;
  error?: string;
}> {
  try {
    const results = await db
      .select({
        category: tools.category,
        count: sql<number>`COUNT(*)`,
      })
      .from(tools)
      .groupBy(tools.category)
      .orderBy(sql`${tools.category} ASC`);

    return {
      success: true,
      categories: results.map((row) => ({
        category: row.category,
        count: Number(row.count),
      })),
    };
  } catch (error) {
    console.error('Error fetching tool categories:', error);
    return {
      success: false,
      categories: [],
      error: error instanceof Error ? error.message : 'Failed to fetch tool categories',
    };
  }
}
