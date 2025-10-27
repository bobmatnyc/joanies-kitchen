/**
 * API Query Helper Utilities
 *
 * Utilities for filtering, sorting, and paginating data.
 * Eliminates duplicate query manipulation code across API endpoints.
 *
 * NOTE: These are in-memory operations. For production, consider pushing
 * filtering and sorting to the database layer for better performance.
 *
 * @module lib/api/query-helpers
 */

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Apply filters to an array of items
 *
 * Filters items based on provided filter criteria. Supports both exact matching
 * and case-insensitive string matching.
 *
 * @param items - Array of items to filter
 * @param filters - Object with filter criteria (key-value pairs)
 * @returns Filtered array of items
 *
 * @example
 * ```typescript
 * const filtered = applyFilters(recipes, {
 *   cuisine: 'Italian',
 *   difficulty: 'easy',
 *   is_public: true
 * });
 * ```
 */
export function applyFilters<T extends Record<string, unknown>>(
  items: T[],
  filters: Record<string, unknown>
): T[] {
  let filtered = [...items];

  for (const [key, value] of Object.entries(filters)) {
    // Skip undefined/null filters
    if (value === undefined || value === null) continue;

    filtered = filtered.filter((item) => {
      const itemValue = item[key];

      // Case-insensitive string matching
      if (typeof value === 'string' && typeof itemValue === 'string') {
        return itemValue.toLowerCase() === value.toLowerCase();
      }

      // Exact matching for other types
      return itemValue === value;
    });
  }

  return filtered;
}

/**
 * Apply a single filter predicate to items
 *
 * @param items - Array of items to filter
 * @param predicate - Filter function
 * @returns Filtered array of items
 *
 * @example
 * ```typescript
 * const publicRecipes = applyFilter(recipes, r => r.is_public === true);
 * ```
 */
export function applyFilter<T>(items: T[], predicate: (item: T) => boolean): T[] {
  return items.filter(predicate);
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Apply sorting to an array of items
 *
 * Sorts items by a specified field in ascending or descending order.
 * Handles undefined/null values by treating them as empty strings.
 *
 * @param items - Array of items to sort
 * @param sortBy - Field name to sort by (must be a key of T)
 * @param order - Sort order: 'asc' or 'desc' (default: 'desc')
 * @returns Sorted array of items (new array)
 *
 * @example
 * ```typescript
 * const sorted = applySorting(recipes, 'created_at', 'desc');
 * const alphabetical = applySorting(recipes, 'name', 'asc');
 * ```
 */
export function applySorting<T extends Record<string, unknown>>(
  items: T[],
  sortBy: keyof T,
  order: 'asc' | 'desc' = 'desc'
): T[] {
  return [...items].sort((a, b) => {
    const aValue = a[sortBy] ?? '';
    const bValue = b[sortBy] ?? '';

    // Compare values
    const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;

    // Apply order
    return order === 'asc' ? comparison : -comparison;
  });
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Apply pagination to an array of items
 *
 * Returns a subset of items for the specified page, along with total count.
 *
 * @param items - Array of items to paginate
 * @param page - Page number (1-indexed)
 * @param limit - Number of items per page
 * @returns Object with paginated items and total count
 *
 * @example
 * ```typescript
 * const { items: pageItems, total } = applyPagination(recipes, 1, 20);
 * ```
 */
export function applyPagination<T>(
  items: T[],
  page: number,
  limit: number
): { items: T[]; total: number } {
  const total = items.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedItems = items.slice(startIndex, endIndex);

  return { items: paginatedItems, total };
}

// ============================================================================
// COMBINED OPERATIONS
// ============================================================================

/**
 * Apply filters, sorting, and pagination in one operation
 *
 * Convenience function that applies all three operations in the correct order:
 * 1. Filter
 * 2. Sort
 * 3. Paginate
 *
 * @param items - Array of items to process
 * @param options - Options for filtering, sorting, and pagination
 * @returns Object with processed items and total count
 *
 * @example
 * ```typescript
 * const result = applyQueryOperations(recipes, {
 *   filters: { cuisine: 'Italian', difficulty: 'easy' },
 *   sortBy: 'created_at',
 *   order: 'desc',
 *   page: 1,
 *   limit: 20
 * });
 *
 * // result = { items: [...], total: 100 }
 * ```
 */
export function applyQueryOperations<T extends Record<string, unknown>>(
  items: T[],
  options: {
    filters?: Record<string, unknown>;
    sortBy?: keyof T;
    order?: 'asc' | 'desc';
    page: number;
    limit: number;
  }
): { items: T[]; total: number } {
  let processed = [...items];

  // 1. Apply filters
  if (options.filters) {
    processed = applyFilters(processed, options.filters);
  }

  // 2. Apply sorting
  if (options.sortBy) {
    processed = applySorting(processed, options.sortBy, options.order);
  }

  // 3. Apply pagination
  return applyPagination(processed, options.page, options.limit);
}

// ============================================================================
// SEARCH UTILITIES
// ============================================================================

/**
 * Simple text search across multiple fields
 *
 * Performs case-insensitive substring matching across specified fields.
 *
 * @param items - Array of items to search
 * @param searchTerm - Search query string
 * @param fields - Array of field names to search in
 * @returns Filtered array of items matching the search term
 *
 * @example
 * ```typescript
 * const results = searchItems(recipes, 'pasta', ['name', 'description', 'cuisine']);
 * ```
 */
export function searchItems<T extends Record<string, unknown>>(
  items: T[],
  searchTerm: string,
  fields: (keyof T)[]
): T[] {
  const lowerSearch = searchTerm.toLowerCase();

  return items.filter((item) => {
    return fields.some((field) => {
      const value = item[field];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(lowerSearch);
      }
      return false;
    });
  });
}
