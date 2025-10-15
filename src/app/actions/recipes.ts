'use server';

import { db } from '@/lib/db';
import { recipes, type NewRecipe, type Recipe } from '@/lib/db/schema';
import { eq, desc, like, or, and, gte, asc, sql, SQL } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

// Get all unique tags from recipes
export async function getAllTags() {
  try {
    const { userId } = await auth();

    // Get recipes based on user authentication
    // For authenticated users: their recipes + all public recipes
    // For non-authenticated users: only public recipes
    const accessCondition = userId
      ? or(eq(recipes.userId, userId), eq(recipes.isPublic, true))
      : eq(recipes.isPublic, true);

    const allRecipes = await db
      .select({ tags: recipes.tags })
      .from(recipes)
      .where(accessCondition);

    // Extract and aggregate unique tags
    const tagSet = new Set<string>();
    const tagCounts: Record<string, number> = {};

    allRecipes.forEach(recipe => {
      if (recipe.tags) {
        try {
          const parsedTags = JSON.parse(recipe.tags);
          if (Array.isArray(parsedTags)) {
            parsedTags.forEach((tag: string) => {
              const normalizedTag = tag.trim().toLowerCase();
              tagSet.add(normalizedTag);
              tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
            });
          }
        } catch (e) {
          // Handle non-JSON tags (might be comma-separated string)
          const tags = recipe.tags.split(',').map(t => t.trim().toLowerCase());
          tags.forEach(tag => {
            if (tag) {
              tagSet.add(tag);
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          });
        }
      }
    });

    // Sort tags by count (most popular first) and then alphabetically
    const sortedTags = Array.from(tagSet).sort((a, b) => {
      const countDiff = tagCounts[b] - tagCounts[a];
      return countDiff !== 0 ? countDiff : a.localeCompare(b);
    });

    return {
      success: true,
      data: {
        tags: sortedTags,
        counts: tagCounts
      }
    };
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    return { success: false, error: 'Failed to fetch tags' };
  }
}

// Get all recipes for the current user with optional tag filtering
export async function getRecipes(selectedTags?: string[]) {
  try {
    const { userId } = await auth();

    // Build conditions array
    const conditions = [];

    // Add user/public condition
    if (!userId) {
      conditions.push(eq(recipes.isPublic, true));
    } else {
      conditions.push(eq(recipes.userId, userId));
    }

    // Add tag filtering conditions if tags are selected
    if (selectedTags && selectedTags.length > 0) {
      const normalizedTags = selectedTags.map(tag => tag.toLowerCase());
      const tagConditions = normalizedTags.map(tag =>
        or(
          like(recipes.tags, `%"${tag}"%`),
          like(recipes.tags, `%${tag}%`)
        )
      ).filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
      conditions.push(...tagConditions);
    }

    // Build and execute query
    const query = db
      .select()
      .from(recipes)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    const results = await query.orderBy(desc(recipes.createdAt));

    // Additional client-side filtering for exact tag matches
    let filteredResults = results;
    if (selectedTags && selectedTags.length > 0) {
      const normalizedTags = selectedTags.map(tag => tag.toLowerCase());
      filteredResults = results.filter(recipe => {
        if (!recipe.tags) return false;

        try {
          const recipeTags = JSON.parse(recipe.tags);
          if (Array.isArray(recipeTags)) {
            const normalizedRecipeTags = recipeTags.map((t: string) => t.toLowerCase());
            return normalizedTags.every(tag => normalizedRecipeTags.includes(tag));
          }
        } catch (e) {
          // Handle non-JSON tags
          const recipeTags = recipe.tags.split(',').map(t => t.trim().toLowerCase());
          return normalizedTags.every(tag => recipeTags.includes(tag));
        }
        return false;
      });
    }

    return { success: true, data: filteredResults };
  } catch (error) {
    console.error('Failed to fetch recipes:', error);
    return { success: false, error: 'Failed to fetch recipes' };
  }
}

// Get a single recipe by ID
export async function getRecipe(id: string) {
  try {
    const { userId } = await auth();
    const recipe = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, id))
      .limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    // Check if user has access to this recipe
    const recipeData = recipe[0];
    if (!recipeData.isPublic && recipeData.userId !== userId) {
      return { success: false, error: 'Access denied' };
    }

    return { success: true, data: recipeData };
  } catch (error) {
    console.error('Failed to fetch recipe:', error);
    return { success: false, error: 'Failed to fetch recipe' };
  }
}

// Search recipes
export async function searchRecipes(query: string) {
  try {
    const { userId } = await auth();
    const searchPattern = `%${query}%`;

    // Build search conditions
    const searchConditions = or(
      like(recipes.name, searchPattern),
      like(recipes.description, searchPattern),
      like(recipes.cuisine, searchPattern),
      like(recipes.tags, searchPattern)
    );

    // For authenticated users, search their recipes and public recipes
    // For non-authenticated users, search only public recipes
    const accessCondition = userId
      ? or(eq(recipes.userId, userId), eq(recipes.isPublic, true))
      : eq(recipes.isPublic, true);

    const searchResults = await db
      .select()
      .from(recipes)
      .where(and(searchConditions, accessCondition))
      .orderBy(desc(recipes.createdAt));

    return { success: true, data: searchResults };
  } catch (error) {
    console.error('Failed to search recipes:', error);
    return { success: false, error: 'Failed to search recipes' };
  }
}

// Create a new recipe
export async function createRecipe(data: Omit<NewRecipe, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Ensure ingredients and instructions are JSON strings if they're arrays
    const recipeData = {
      ...data,
      userId,
      ingredients: typeof data.ingredients === 'string'
        ? data.ingredients
        : JSON.stringify(data.ingredients),
      instructions: typeof data.instructions === 'string'
        ? data.instructions
        : JSON.stringify(data.instructions),
      tags: data.tags
        ? (typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags))
        : null,
    };

    const result = await db
      .insert(recipes)
      .values(recipeData)
      .returning();

    revalidatePath('/recipes');
    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to create recipe:', error);
    return { success: false, error: 'Failed to create recipe' };
  }
}

// Update a recipe
export async function updateRecipe(
  id: string,
  data: Partial<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if user owns this recipe
    const existingRecipe = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .limit(1);

    if (existingRecipe.length === 0) {
      return { success: false, error: 'Recipe not found or access denied' };
    }

    // Ensure ingredients and instructions are JSON strings if they're arrays
    const updateData: any = { ...data };

    if (data.ingredients) {
      updateData.ingredients = typeof data.ingredients === 'string'
        ? data.ingredients
        : JSON.stringify(data.ingredients);
    }

    if (data.instructions) {
      updateData.instructions = typeof data.instructions === 'string'
        ? data.instructions
        : JSON.stringify(data.instructions);
    }

    if (data.tags) {
      updateData.tags = typeof data.tags === 'string'
        ? data.tags
        : JSON.stringify(data.tags);
    }

    updateData.updatedAt = new Date();

    const result = await db
      .update(recipes)
      .set(updateData)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();

    revalidatePath('/recipes');
    revalidatePath(`/recipes/${id}`);
    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to update recipe:', error);
    return { success: false, error: 'Failed to update recipe' };
  }
}

// Delete a recipe
export async function deleteRecipe(id: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await db
      .delete(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();

    if (result.length === 0) {
      return { success: false, error: 'Recipe not found or access denied' };
    }

    revalidatePath('/recipes');
    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    return { success: false, error: 'Failed to delete recipe' };
  }
}

// Get public recipes for discover page
export async function getPublicRecipes() {
  try {
    const publicRecipes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.isPublic, true))
      .orderBy(desc(recipes.createdAt));

    return { success: true, data: publicRecipes };
  } catch (error) {
    console.error('Failed to fetch public recipes:', error);
    return { success: false, error: 'Failed to fetch public recipes' };
  }
}

// Toggle recipe public/private status (alias for compatibility)
export const toggleRecipeSharing = toggleRecipeVisibility;

// Toggle recipe public/private status
export async function toggleRecipeVisibility(id: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Get the current recipe
    const recipe = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found or access denied' };
    }

    // Toggle the isPublic field
    const result = await db
      .update(recipes)
      .set({
        isPublic: !recipe[0].isPublic,
        updatedAt: new Date()
      })
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();

    revalidatePath('/recipes');
    revalidatePath(`/recipes/${id}`);
    revalidatePath('/discover');

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to toggle recipe visibility:', error);
    return { success: false, error: 'Failed to toggle recipe visibility' };
  }
}

// Get all shared recipes (public recipes including system recipes) with optional tag filtering
export async function getSharedRecipes(selectedTags?: string[]) {
  try {
    // Build conditions array
    const conditions = [eq(recipes.isPublic, true)];

    // Add tag filtering conditions if tags are selected
    if (selectedTags && selectedTags.length > 0) {
      const normalizedTags = selectedTags.map(tag => tag.toLowerCase());
      const tagConditions = normalizedTags.map(tag =>
        or(
          like(recipes.tags, `%"${tag}"%`),
          like(recipes.tags, `%${tag}%`)
        )
      ).filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
      conditions.push(...tagConditions);
    }

    // Build and execute query
    const query = db
      .select()
      .from(recipes)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    const results = await query.orderBy(desc(recipes.isSystemRecipe), desc(recipes.createdAt));

    // Additional client-side filtering for exact tag matches
    let filteredResults = results;
    if (selectedTags && selectedTags.length > 0) {
      const normalizedTags = selectedTags.map(tag => tag.toLowerCase());
      filteredResults = results.filter(recipe => {
        if (!recipe.tags) return false;

        try {
          const recipeTags = JSON.parse(recipe.tags);
          if (Array.isArray(recipeTags)) {
            const normalizedRecipeTags = recipeTags.map((t: string) => t.toLowerCase());
            return normalizedTags.every(tag => normalizedRecipeTags.includes(tag));
          }
        } catch (e) {
          // Handle non-JSON tags
          const recipeTags = recipe.tags.split(',').map(t => t.trim().toLowerCase());
          return normalizedTags.every(tag => recipeTags.includes(tag));
        }
        return false;
      });
    }

    return { success: true, data: filteredResults };
  } catch (error) {
    console.error('Failed to fetch shared recipes:', error);
    return { success: false, error: 'Failed to fetch shared recipes' };
  }
}

// Get system recipes only
export async function getSystemRecipes() {
  try {
    const systemRecipes = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.isPublic, true), eq(recipes.isSystemRecipe, true)))
      .orderBy(desc(recipes.createdAt));

    return { success: true, data: systemRecipes };
  } catch (error) {
    console.error('Failed to fetch system recipes:', error);
    return { success: false, error: 'Failed to fetch system recipes' };
  }
}

// Copy a shared recipe to user's collection
export async function copyRecipeToCollection(recipeId: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Get the recipe to copy
    const recipeToCopy = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), eq(recipes.isPublic, true)))
      .limit(1);

    if (recipeToCopy.length === 0) {
      return { success: false, error: 'Recipe not found or not public' };
    }

    const originalRecipe = recipeToCopy[0];

    // Create a copy for the user
    const copiedRecipe = await db
      .insert(recipes)
      .values({
        ...originalRecipe,
        userId,
        isPublic: false, // Make it private by default
        isSystemRecipe: false, // User copies are never system recipes
        createdAt: new Date(),
        updatedAt: new Date(),
        name: `${originalRecipe.name} (Copy)`,
      })
      .returning();

    revalidatePath('/recipes');
    return { success: true, data: copiedRecipe[0] };
  } catch (error) {
    console.error('Failed to copy recipe:', error);
    return { success: false, error: 'Failed to copy recipe to collection' };
  }
}

// Mark a recipe as a system recipe (admin action - can be restricted later)
export async function markAsSystemRecipe(recipeId: string, isSystem: boolean = true) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check for admin role
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    const isAdmin = metadata?.isAdmin === 'true';
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    const result = await db
      .update(recipes)
      .set({
        isSystemRecipe: isSystem,
        isPublic: true, // System recipes should always be public
        updatedAt: new Date()
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    if (result.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    revalidatePath('/shared');
    revalidatePath(`/recipes/${recipeId}`);

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to mark recipe as system:', error);
    return { success: false, error: 'Failed to update recipe status' };
  }
}

// Pagination types
export interface RecipeFilters {
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  minRating?: number;
  tags?: string[];
  userId?: string;
  isSystemRecipe?: boolean;
  isPublic?: boolean;
  searchQuery?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  filters?: RecipeFilters;
  sort?: 'rating' | 'recent' | 'name';
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedRecipeResponse {
  recipes: Recipe[];
  pagination: PaginationMetadata;
}

// Get recipes with pagination, filtering, and sorting
export async function getRecipesPaginated({
  page = 1,
  limit = 24,
  filters = {},
  sort = 'rating',
}: PaginationParams): Promise<{ success: boolean; data?: PaginatedRecipeResponse; error?: string }> {
  try {
    const { userId } = await auth();
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [];

    // Access control: user's recipes OR public recipes
    if (filters.userId) {
      // Specific user filter
      conditions.push(eq(recipes.userId, filters.userId));
    } else if (filters.isPublic !== undefined) {
      // Public/private filter
      conditions.push(eq(recipes.isPublic, filters.isPublic));

      // If requesting public recipes and user is authenticated, include their recipes too
      if (filters.isPublic && userId) {
        const accessCondition = or(
          eq(recipes.isPublic, true),
          eq(recipes.userId, userId)
        );
        if (accessCondition) {
          // Replace last condition with combined access condition
          conditions.pop();
          conditions.push(accessCondition);
        }
      }
    } else if (userId) {
      // Default: authenticated user sees their recipes + public recipes
      const accessCondition = or(
        eq(recipes.userId, userId),
        eq(recipes.isPublic, true)
      );
      if (accessCondition) {
        conditions.push(accessCondition);
      }
    } else {
      // Not authenticated: only public recipes
      conditions.push(eq(recipes.isPublic, true));
    }

    // Apply additional filters
    if (filters.cuisine) {
      conditions.push(eq(recipes.cuisine, filters.cuisine));
    }

    if (filters.difficulty) {
      conditions.push(eq(recipes.difficulty, filters.difficulty));
    }

    if (filters.minRating !== undefined) {
      conditions.push(gte(recipes.systemRating, filters.minRating.toString()));
    }

    if (filters.isSystemRecipe !== undefined) {
      conditions.push(eq(recipes.isSystemRecipe, filters.isSystemRecipe));
    }

    // Search query filter
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const searchPattern = `%${filters.searchQuery.trim()}%`;
      const searchCondition = or(
        like(recipes.name, searchPattern),
        like(recipes.description, searchPattern),
        like(recipes.cuisine, searchPattern),
        like(recipes.tags, searchPattern)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Tag filtering (if specified)
    if (filters.tags && filters.tags.length > 0) {
      const normalizedTags = filters.tags.map(tag => tag.toLowerCase());
      const tagConditions = normalizedTags.map(tag =>
        or(
          like(recipes.tags, `%"${tag}"%`),
          like(recipes.tags, `%${tag}%`)
        )
      ).filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

      conditions.push(...tagConditions);
    }

    // Build base query
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort order
    let orderByClause;
    if (sort === 'rating') {
      orderByClause = [
        desc(recipes.systemRating),
        desc(recipes.avgUserRating),
        desc(recipes.createdAt)
      ];
    } else if (sort === 'recent') {
      orderByClause = [desc(recipes.createdAt)];
    } else if (sort === 'name') {
      orderByClause = [asc(recipes.name)];
    } else {
      // Default to rating
      orderByClause = [desc(recipes.systemRating), desc(recipes.avgUserRating)];
    }

    // Execute paginated query
    const query = db
      .select()
      .from(recipes)
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset);

    const results = await query;

    // Get total count for pagination metadata
    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(recipes)
      .where(whereClause);

    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;

    // Additional client-side tag filtering for exact matches (if tags specified)
    let filteredResults = results;
    if (filters.tags && filters.tags.length > 0) {
      const normalizedTags = filters.tags.map(tag => tag.toLowerCase());
      filteredResults = results.filter(recipe => {
        if (!recipe.tags) return false;

        try {
          const recipeTags = JSON.parse(recipe.tags);
          if (Array.isArray(recipeTags)) {
            const normalizedRecipeTags = recipeTags.map((t: string) => t.toLowerCase());
            return normalizedTags.every(tag => normalizedRecipeTags.includes(tag));
          }
        } catch (e) {
          // Handle non-JSON tags
          const recipeTags = recipe.tags.split(',').map(t => t.trim().toLowerCase());
          return normalizedTags.every(tag => recipeTags.includes(tag));
        }
        return false;
      });
    }

    return {
      success: true,
      data: {
        recipes: filteredResults,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    };
  } catch (error) {
    console.error('Failed to fetch paginated recipes:', error);
    return { success: false, error: 'Failed to fetch recipes' };
  }
}