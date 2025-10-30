'use client';

import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getRecipeCommentCount, getRecipeComments } from '@/app/actions/social';
import { CommentInput } from '@/components/recipe/CommentInput';
import { CommentsList } from '@/components/recipe/CommentsList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RecipeCommentsProps {
  recipeId: string;
  currentUserId?: string;
  isAuthenticated: boolean;
}

/**
 * RecipeComments Component
 *
 * Main container for recipe comments section with:
 * - Comment count header
 * - Comment input (authenticated users)
 * - Sign-in prompt (guests)
 * - Comments list with pagination
 * - Server-side data fetching
 * - Auto-refresh after new comments
 *
 * @example
 * <RecipeComments
 *   recipeId="recipe-123"
 *   currentUserId="user-456"
 *   isAuthenticated={true}
 * />
 */
export function RecipeComments({
  recipeId,
  currentUserId,
  isAuthenticated,
}: RecipeCommentsProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load comments and count
  const loadCommentsData = async () => {
    setIsLoading(true);
    try {
      const [commentsResult, countResult] = await Promise.all([
        getRecipeComments(recipeId),
        getRecipeCommentCount(recipeId),
      ]);

      if (commentsResult.success && commentsResult.data) {
        setComments(commentsResult.data);
      }

      if (countResult.success) {
        setCommentCount(countResult.data || 0);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadCommentsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  // Refresh comments after new comment added
  const handleCommentAdded = async () => {
    await loadCommentsData();
  };

  return (
    <Card id="comments-section">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-jk-olive" />
          <CardTitle className="text-2xl">
            Comments {commentCount > 0 && `(${commentCount})`}
          </CardTitle>
        </div>
        <CardDescription>Share your thoughts, tips, and experiences with this recipe</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Comment Input */}
        <CommentInput
          recipeId={recipeId}
          onCommentAdded={handleCommentAdded}
          isAuthenticated={isAuthenticated}
        />

        {/* Divider */}
        {(commentCount > 0 || isLoading) && (
          <div className="border-t border-border pt-6">
            {/* Comments List */}
            {!isLoading && (
              <CommentsList
                recipeId={recipeId}
                currentUserId={currentUserId}
                initialComments={comments}
                totalCount={commentCount}
              />
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <div className="animate-pulse space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="h-4 bg-muted rounded w-1/4" />
                            <div className="h-3 bg-muted rounded w-1/6" />
                          </div>
                        </div>
                        <div className="h-16 bg-muted rounded" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
