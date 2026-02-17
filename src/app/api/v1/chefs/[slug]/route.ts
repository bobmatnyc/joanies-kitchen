/**
 * REST API v1 - Individual Chef Endpoints
 *
 * GET    /api/v1/chefs/:slug - Get single chef by slug
 * PATCH  /api/v1/chefs/:slug - Update chef (admin only)
 * DELETE /api/v1/chefs/:slug - Delete chef (admin only)
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiNotFound,
  apiSuccess,
  getRequiredParam,
  parseParamAndBody,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { chefService } from '@/lib/services/chef-service';
import { updateChefSchema, type UpdateChefInput } from '@/lib/validations/chef-api';

/**
 * GET /api/v1/chefs/:slug
 *
 * Get a single chef by slug
 *
 * Path Parameters:
 * - slug: Chef slug (URL-friendly identifier)
 *
 * Response:
 * {
 *   success: true,
 *   data: Chef
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:chefs scope)
 * - 404: Chef not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_CHEFS],
  async (_request: NextRequest, _auth, context: RouteContext) => {
    try {
      // Extract slug from route params
      const slugResult = await getRequiredParam(context, 'slug');
      if ('error' in slugResult) return slugResult.error;

      const { data: slug } = slugResult;

      // Fetch chef by slug
      const chef = await chefService.findBySlug(slug);

      if (!chef) {
        return apiNotFound('Chef not found');
      }

      return apiSuccess(chef);
    } catch (error) {
      console.error('Error fetching chef:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * PATCH /api/v1/chefs/:slug
 *
 * Update a chef (partial update, admin only)
 *
 * Path Parameters:
 * - slug: Chef slug
 *
 * Request Body: (all fields optional)
 * {
 *   slug?: string,
 *   name?: string,
 *   display_name?: string,
 *   bio?: string,
 *   profile_image_url?: string,
 *   website?: string,
 *   social_links?: {
 *     instagram?: string,
 *     twitter?: string,
 *     youtube?: string,
 *     tiktok?: string,
 *     facebook?: string
 *   },
 *   specialties?: string[],
 *   is_verified?: boolean,
 *   is_active?: boolean,
 *   latitude?: string,
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
 * - 404: Chef not found
 * - 400: Invalid request body or slug conflict
 * - 500: Internal server error
 */
export const PATCH = requireScopes(
  [SCOPES.WRITE_CHEFS],
  async (request: NextRequest, _auth, context: RouteContext) => {
    try {
      // Extract route param and parse request body
      const parsed = await parseParamAndBody(context, request, 'slug', updateChefSchema);
      if ('error' in parsed) return parsed.error;

      const { param: slug, body: validatedData } = parsed.data;

      // Fetch existing chef
      const existingChef = await chefService.findBySlug(slug);
      if (!existingChef) {
        return apiNotFound('Chef not found');
      }

      // If updating slug, check for conflicts
      if (validatedData.slug && validatedData.slug !== slug) {
        const slugConflict = await chefService.findBySlug(validatedData.slug);
        if (slugConflict) {
          return apiError('Chef with this slug already exists', 400);
        }
      }

      // Update chef using service
      const updatedChef = await chefService.update(
        existingChef.id,
        validatedData as UpdateChefInput
      );

      if (!updatedChef) {
        return apiError('Failed to update chef', 500);
      }

      return apiSuccess(updatedChef);
    } catch (error) {
      console.error('Error updating chef:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * DELETE /api/v1/chefs/:slug
 *
 * Delete a chef (hard delete, admin only)
 *
 * WARNING: This will cascade delete all associated chef_recipes entries
 * and unlink recipes from this chef.
 *
 * Path Parameters:
 * - slug: Chef slug
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     deleted: true,
 *     chefId: string
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing delete:chefs scope)
 * - 404: Chef not found
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.DELETE_CHEFS],
  async (_request: NextRequest, _auth, context: RouteContext) => {
    try {
      // Extract slug from route params
      const slugResult = await getRequiredParam(context, 'slug');
      if ('error' in slugResult) return slugResult.error;

      const { data: slug } = slugResult;

      // Fetch existing chef
      const existingChef = await chefService.findBySlug(slug);
      if (!existingChef) {
        return apiNotFound('Chef not found');
      }

      // Delete chef using service
      const deleted = await chefService.delete(existingChef.id);

      if (!deleted) {
        return apiError('Failed to delete chef', 500);
      }

      return apiSuccess({
        deleted: true,
        chefId: existingChef.id,
      });
    } catch (error) {
      console.error('Error deleting chef:', error);
      return apiError('Internal server error');
    }
  }
);
