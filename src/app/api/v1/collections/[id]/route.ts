/**
 * REST API v1 - Individual Collection Endpoints
 *
 * GET    /api/v1/collections/:id - Get collection by ID
 * PATCH  /api/v1/collections/:id - Update collection
 * DELETE /api/v1/collections/:id - Delete collection
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Owner-only for write operations
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiForbidden,
  apiNotFound,
  apiSuccess,
  parseJsonBody,
  getRequiredParam,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { collectionService } from '@/lib/services/collection-service';
import { updateCollectionSchema } from '@/lib/validations/collection-api';

/**
 * GET /api/v1/collections/:id
 *
 * Get a collection by ID with recipe count preview
 *
 * Response:
 * {
 *   success: true,
 *   data: Collection
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions
 * - 404: Collection not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_COLLECTIONS],
  async (request: NextRequest, auth, context) => {
    try {
      const collectionId = await getRequiredParam(context, 'id');
      if ('error' in collectionId) return collectionId.error;

      // Find collection
      const collection = await collectionService.findById(collectionId.data);

      if (!collection) {
        return apiNotFound('Collection not found');
      }

      // Check if user can access this collection
      // Private collections can only be viewed by owner
      if (!collection.is_public && collection.user_id !== auth.userId) {
        return apiForbidden('You do not have permission to view this collection');
      }

      return apiSuccess(collection);
    } catch (error) {
      console.error('Error fetching collection:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * PATCH /api/v1/collections/:id
 *
 * Update a collection (owner only)
 *
 * Request Body:
 * {
 *   name?: string,
 *   description?: string,
 *   is_public?: boolean,
 *   cover_image_url?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: Collection
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not the owner
 * - 404: Collection not found
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const PATCH = requireScopes(
  [SCOPES.WRITE_COLLECTIONS],
  async (request: NextRequest, auth, context) => {
    try {
      const collectionId = await getRequiredParam(context, 'id');
      if ('error' in collectionId) return collectionId.error;

      // Check collection exists and user owns it
      const collection = await collectionService.findById(collectionId.data);

      if (!collection) {
        return apiNotFound('Collection not found');
      }

      if (collection.user_id !== auth.userId) {
        return apiForbidden('You do not have permission to update this collection');
      }

      // Parse and validate request body
      const parsed = await parseJsonBody(request, updateCollectionSchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedData } = parsed;

      // Update collection
      const updatedCollection = await collectionService.update(collectionId.data, validatedData);

      if (!updatedCollection) {
        return apiError('Failed to update collection', 500);
      }

      return apiSuccess(updatedCollection);
    } catch (error) {
      console.error('Error updating collection:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * DELETE /api/v1/collections/:id
 *
 * Delete a collection (owner only)
 *
 * Response:
 * {
 *   success: true,
 *   data: { deleted: true }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not the owner
 * - 404: Collection not found
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.DELETE_COLLECTIONS],
  async (request: NextRequest, auth, context) => {
    try {
      const collectionId = await getRequiredParam(context, 'id');
      if ('error' in collectionId) return collectionId.error;

      // Check collection exists and user owns it
      const collection = await collectionService.findById(collectionId.data);

      if (!collection) {
        return apiNotFound('Collection not found');
      }

      if (collection.user_id !== auth.userId) {
        return apiForbidden('You do not have permission to delete this collection');
      }

      // Delete collection
      const success = await collectionService.delete(collectionId.data);

      if (!success) {
        return apiError('Failed to delete collection', 500);
      }

      return apiSuccess({ deleted: true });
    } catch (error) {
      console.error('Error deleting collection:', error);
      return apiError('Internal server error');
    }
  }
);
