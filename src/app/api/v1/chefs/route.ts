/**
 * REST API v1 - Chefs Collection Endpoints
 *
 * GET    /api/v1/chefs - List all chefs with optional filtering
 * POST   /api/v1/chefs - Create new chef (admin only)
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiSuccess,
  apiSuccessPaginated,
  applyPagination,
  applySorting,
  parseJsonBody,
  parseQueryParams,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { chefService } from '@/lib/services/chef-service';
import {
  createChefSchema,
  listChefsQuerySchema,
  type CreateChefInput,
} from '@/lib/validations/chef-api';

/**
 * GET /api/v1/chefs
 *
 * List chefs with optional filtering
 *
 * Query Parameters:
 * - search: Text search query (searches name, display name, bio, specialties)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (created_at, updated_at, name, recipe_count)
 * - order: Sort order (asc, desc)
 * - includeInactive: Include inactive chefs (default: false)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     chefs: Chef[],
 *     pagination: {
 *       page: number,
 *       limit: number,
 *       total: number,
 *       totalPages: number,
 *       hasMore: boolean
 *     }
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:chefs scope)
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_CHEFS], async (request: NextRequest, _auth) => {
  try {
    // Parse and validate query parameters
    const parsed = parseQueryParams(request, listChefsQuerySchema);
    if ('error' in parsed) return parsed.error;

    const { data: validatedQuery } = parsed;

    // Fetch chefs (search or regular listing)
    let chefs = validatedQuery.search
      ? await chefService.search(validatedQuery.search, 100) // Get more for client-side pagination
      : validatedQuery.includeInactive
        ? await chefService.findAllIncludingInactive()
        : await chefService.findAll();

    // Apply sorting (defaults guaranteed by schema)
    chefs = applySorting(chefs, validatedQuery.sortBy!, validatedQuery.order!);

    // Apply pagination (defaults guaranteed by schema)
    const { items: paginatedChefs, total } = applyPagination(
      chefs,
      validatedQuery.page!,
      validatedQuery.limit!
    );

    return apiSuccessPaginated(paginatedChefs, validatedQuery.page!, validatedQuery.limit!, total);
  } catch (error) {
    console.error('Error fetching chefs:', error);
    return apiError('Internal server error');
  }
});

/**
 * POST /api/v1/chefs
 *
 * Create a new chef (admin only)
 *
 * Request Body:
 * {
 *   slug: string,                // URL-friendly slug (lowercase, hyphens only)
 *   name: string,                // Full name
 *   display_name?: string,       // Alternative display name
 *   bio?: string,                // Biography
 *   profile_image_url?: string,  // Profile image URL
 *   website?: string,            // Website URL
 *   social_links?: {             // Social media links
 *     instagram?: string,
 *     twitter?: string,
 *     youtube?: string,
 *     tiktok?: string,
 *     facebook?: string
 *   },
 *   specialties?: string[],      // Cooking specialties
 *   is_verified?: boolean,       // Verified status
 *   is_active?: boolean,         // Active status
 *   latitude?: string,           // Geographic coordinates
 *   longitude?: string,
 *   location_city?: string,
 *   location_state?: string,
 *   location_country?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: Chef
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing write:chefs scope)
 * - 400: Invalid request body or slug already exists
 * - 500: Internal server error
 */
export const POST = requireScopes([SCOPES.WRITE_CHEFS], async (request: NextRequest, _auth) => {
  try {
    // Parse and validate request body
    const parsed = await parseJsonBody(request, createChefSchema);
    if ('error' in parsed) return parsed.error;

    const { data: validatedData } = parsed;

    // Check if slug already exists
    const existingChef = await chefService.findBySlug(validatedData.slug);
    if (existingChef) {
      return apiError('Chef with this slug already exists', 400);
    }

    // Create chef using service
    const chef = await chefService.create(validatedData as CreateChefInput);

    return apiSuccess(chef, 201);
  } catch (error) {
    console.error('Error creating chef:', error);
    return apiError('Internal server error');
  }
});
