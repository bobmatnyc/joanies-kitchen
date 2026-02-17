/**
 * API Key Scopes and Permission Management
 *
 * This module defines all available API scopes and provides utilities for
 * scope validation and permission checking.
 *
 * Security Model:
 * - Fine-grained permissions per resource
 * - Wildcard support for broad access (e.g., "recipes:*")
 * - Hierarchical scope checking
 * - Resource-level and action-level granularity
 */

// ============================================================================
// SCOPE CONSTANTS
// ============================================================================

/**
 * All available API scopes
 * Format: "resource:action" or "resource:*" for wildcard
 */
export const SCOPES = {
  // Recipe Scopes
  READ_RECIPES: 'read:recipes',
  WRITE_RECIPES: 'write:recipes',
  DELETE_RECIPES: 'delete:recipes',
  RECIPES_ALL: 'recipes:*',

  // Ingredient Scopes
  READ_INGREDIENTS: 'read:ingredients',
  WRITE_INGREDIENTS: 'write:ingredients',
  DELETE_INGREDIENTS: 'delete:ingredients',
  INGREDIENTS_ALL: 'ingredients:*',

  // Meal Scopes
  READ_MEALS: 'read:meals',
  WRITE_MEALS: 'write:meals',
  DELETE_MEALS: 'delete:meals',
  MEALS_ALL: 'meals:*',

  // Collection Scopes
  READ_COLLECTIONS: 'read:collections',
  WRITE_COLLECTIONS: 'write:collections',
  DELETE_COLLECTIONS: 'delete:collections',
  COLLECTIONS_ALL: 'collections:*',

  // Inventory Scopes
  READ_INVENTORY: 'read:inventory',
  WRITE_INVENTORY: 'write:inventory',
  DELETE_INVENTORY: 'delete:inventory',
  INVENTORY_ALL: 'inventory:*',

  // Chef Scopes
  READ_CHEFS: 'read:chefs',
  WRITE_CHEFS: 'write:chefs',
  DELETE_CHEFS: 'delete:chefs',
  CHEFS_ALL: 'chefs:*',

  // Favorites Scopes
  READ_FAVORITES: 'read:favorites',
  WRITE_FAVORITES: 'write:favorites',
  FAVORITES_ALL: 'favorites:*',

  // Analytics Scopes
  READ_ANALYTICS: 'read:analytics',
  ANALYTICS_ALL: 'analytics:*',

  // Admin Scopes
  ADMIN_USERS: 'admin:users',
  ADMIN_CONTENT: 'admin:content',
  ADMIN_SYSTEM: 'admin:system',
  ADMIN_ALL: 'admin:*',

  // Global Wildcard (use with extreme caution)
  ALL: '*',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

// ============================================================================
// SCOPE GROUPS - Common Permission Sets
// ============================================================================

/**
 * Predefined scope groups for common use cases
 */
export const SCOPE_GROUPS = {
  // Read-only access to all public content
  READ_ONLY: [SCOPES.READ_RECIPES, SCOPES.READ_INGREDIENTS, SCOPES.READ_CHEFS, SCOPES.READ_MEALS],

  // Full user access (typical authenticated user)
  USER: [
    SCOPES.READ_RECIPES,
    SCOPES.WRITE_RECIPES,
    SCOPES.READ_INGREDIENTS,
    SCOPES.READ_MEALS,
    SCOPES.WRITE_MEALS,
    SCOPES.READ_COLLECTIONS,
    SCOPES.WRITE_COLLECTIONS,
    SCOPES.READ_INVENTORY,
    SCOPES.WRITE_INVENTORY,
    SCOPES.READ_FAVORITES,
    SCOPES.WRITE_FAVORITES,
  ],

  // Content creator access
  CREATOR: [
    SCOPES.READ_RECIPES,
    SCOPES.WRITE_RECIPES,
    SCOPES.READ_INGREDIENTS,
    SCOPES.WRITE_INGREDIENTS,
    SCOPES.READ_CHEFS,
    SCOPES.WRITE_CHEFS,
    SCOPES.READ_MEALS,
    SCOPES.WRITE_MEALS,
  ],

  // Admin access (all non-destructive operations)
  ADMIN: [SCOPES.ADMIN_CONTENT, SCOPES.ADMIN_USERS, SCOPES.READ_ANALYTICS],

  // Full access (use with extreme caution)
  SUPER_ADMIN: [SCOPES.ALL],
} as const;

// ============================================================================
// SCOPE VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if a user has a specific scope
 *
 * Supports wildcards:
 * - "recipes:*" matches "read:recipes", "write:recipes", "delete:recipes"
 * - "*" matches everything
 *
 * @param userScopes - Array of scopes the user/key has
 * @param requiredScope - The scope to check for
 * @returns true if user has the required scope
 *
 * @example
 * hasScope(['read:recipes', 'write:recipes'], 'read:recipes') // true
 * hasScope(['recipes:*'], 'read:recipes') // true
 * hasScope(['*'], 'admin:users') // true
 * hasScope(['read:recipes'], 'write:recipes') // false
 */
export function hasScope(userScopes: string[], requiredScope: string): boolean {
  if (!userScopes || userScopes.length === 0) {
    return false;
  }

  // Check for exact match first (most common case)
  if (userScopes.includes(requiredScope)) {
    return true;
  }

  // Check for global wildcard
  if (userScopes.includes('*')) {
    return true;
  }

  // Check for resource wildcard (e.g., "recipes:*" matching "read:recipes")
  const [_requiredAction, requiredResource] = requiredScope.split(':');

  for (const userScope of userScopes) {
    // Check if user has wildcard for this resource
    // Example: user has "recipes:*", required is "read:recipes"
    if (userScope.endsWith(':*')) {
      const userResource = userScope.replace(':*', '');
      if (requiredResource === userResource) {
        return true;
      }
    }

    // Also check the reverse format: "read:recipes" vs "recipes:*"
    const [userAction, userResource] = userScope.split(':');
    if (userResource === '*' && requiredResource === userAction) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a user has ALL of the specified scopes
 *
 * @param userScopes - Array of scopes the user/key has
 * @param requiredScopes - Array of scopes that are all required
 * @returns true if user has ALL required scopes
 *
 * @example
 * hasAllScopes(['read:recipes', 'write:recipes'], ['read:recipes', 'write:recipes']) // true
 * hasAllScopes(['recipes:*'], ['read:recipes', 'write:recipes']) // true
 * hasAllScopes(['read:recipes'], ['read:recipes', 'write:recipes']) // false
 */
export function hasAllScopes(userScopes: string[], requiredScopes: string[]): boolean {
  if (!requiredScopes || requiredScopes.length === 0) {
    return true; // No requirements = allowed
  }

  return requiredScopes.every((required) => hasScope(userScopes, required));
}

/**
 * Check if a user has ANY of the specified scopes
 *
 * @param userScopes - Array of scopes the user/key has
 * @param requiredScopes - Array of scopes where at least one is required
 * @returns true if user has AT LEAST ONE required scope
 *
 * @example
 * hasAnyScope(['read:recipes'], ['read:recipes', 'write:recipes']) // true
 * hasAnyScope(['write:recipes'], ['read:recipes', 'write:recipes']) // true
 * hasAnyScope(['read:meals'], ['read:recipes', 'write:recipes']) // false
 */
export function hasAnyScope(userScopes: string[], requiredScopes: string[]): boolean {
  if (!requiredScopes || requiredScopes.length === 0) {
    return true; // No requirements = allowed
  }

  return requiredScopes.some((required) => hasScope(userScopes, required));
}

/**
 * Validate scope format
 *
 * Valid formats:
 * - "action:resource" (e.g., "read:recipes")
 * - "resource:*" (e.g., "recipes:*")
 * - "*" (global wildcard)
 *
 * @param scope - The scope string to validate
 * @returns true if scope format is valid
 */
export function isValidScopeFormat(scope: string): boolean {
  if (!scope || typeof scope !== 'string') {
    return false;
  }

  // Global wildcard
  if (scope === '*') {
    return true;
  }

  // Must contain exactly one colon
  const parts = scope.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [left, right] = parts;

  // Both parts must be non-empty
  if (!left || !right) {
    return false;
  }

  // Right side can be * or alphanumeric with underscores
  if (right !== '*' && !/^[a-z_]+$/.test(right)) {
    return false;
  }

  // Left side must be alphanumeric with underscores
  if (!/^[a-z_]+$/.test(left)) {
    return false;
  }

  return true;
}

/**
 * Validate an array of scopes
 *
 * @param scopes - Array of scope strings to validate
 * @returns Object with validation result and any invalid scopes
 */
export function validateScopes(scopes: string[]): {
  valid: boolean;
  invalidScopes: string[];
  message?: string;
} {
  if (!Array.isArray(scopes)) {
    return {
      valid: false,
      invalidScopes: [],
      message: 'Scopes must be an array',
    };
  }

  const invalidScopes = scopes.filter((scope) => !isValidScopeFormat(scope));

  if (invalidScopes.length > 0) {
    return {
      valid: false,
      invalidScopes,
      message: `Invalid scope format: ${invalidScopes.join(', ')}`,
    };
  }

  return {
    valid: true,
    invalidScopes: [],
  };
}

/**
 * Get all scopes that match a wildcard pattern
 *
 * @param pattern - Wildcard pattern (e.g., "recipes:*")
 * @returns Array of matching scopes from SCOPES constant
 *
 * @example
 * expandWildcard('recipes:*') // ['read:recipes', 'write:recipes', 'delete:recipes']
 * expandWildcard('*') // all scopes
 */
export function expandWildcard(pattern: string): string[] {
  const allScopes = Object.values(SCOPES);

  if (pattern === '*') {
    return allScopes;
  }

  if (!pattern.endsWith(':*')) {
    return [pattern]; // Not a wildcard, return as-is
  }

  const resource = pattern.replace(':*', '');

  return allScopes.filter((scope) => {
    const [action, scopeResource] = scope.split(':');
    return scopeResource === resource || action === resource;
  });
}

/**
 * Get human-readable description of a scope
 *
 * @param scope - The scope to describe
 * @returns Human-readable description
 */
export function getScopeDescription(scope: string): string {
  const descriptions: Record<string, string> = {
    'read:recipes': 'Read recipes',
    'write:recipes': 'Create and update recipes',
    'delete:recipes': 'Delete recipes',
    'recipes:*': 'Full access to recipes',

    'read:ingredients': 'Read ingredients',
    'write:ingredients': 'Create and update ingredients',
    'delete:ingredients': 'Delete ingredients',
    'ingredients:*': 'Full access to ingredients',

    'read:meals': 'Read meal plans',
    'write:meals': 'Create and update meal plans',
    'delete:meals': 'Delete meal plans',
    'meals:*': 'Full access to meal plans',

    'read:collections': 'Read recipe collections',
    'write:collections': 'Create and update collections',
    'delete:collections': 'Delete collections',
    'collections:*': 'Full access to collections',

    'read:inventory': 'Read inventory items',
    'write:inventory': 'Create and update inventory',
    'delete:inventory': 'Delete inventory items',
    'inventory:*': 'Full access to inventory',

    'read:chefs': 'Read chef profiles',
    'write:chefs': 'Create and update chef profiles',
    'delete:chefs': 'Delete chef profiles',
    'chefs:*': 'Full access to chefs',

    'read:favorites': 'Read favorite recipes',
    'write:favorites': 'Add and remove favorites',
    'favorites:*': 'Full access to favorites',

    'read:analytics': 'Read analytics data',
    'analytics:*': 'Full access to analytics',

    'admin:users': 'Manage user accounts',
    'admin:content': 'Manage site content',
    'admin:system': 'Manage system settings',
    'admin:*': 'Full admin access',

    '*': 'Full access to all resources',
  };

  return descriptions[scope] || scope;
}
