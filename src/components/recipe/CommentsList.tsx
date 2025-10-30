'use client';

import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getRecipeComments } from '@/app/actions/social';
import { CommentItem } from '@/components/recipe/CommentItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  is_edited: boolean;
  created_at: Date;
  user_name: string;
  user_avatar?: string;
}

interface CommentsListProps {
  recipeId: string;
  currentUserId?: string;
  initialComments?: Comment[];
  totalCount?: number;
}

const COMMENTS_PER_PAGE = 10;

/**
 * CommentsList Component
 *
 * Displays paginated list of comments with:
 * - Newest first sorting
 * - "Load more" pagination
 * - Loading skeleton states
 * - Empty state with friendly message
 * - Automatic refresh after edits/deletes
 * - Optimistic updates
 *
 * @example
 * <CommentsList
 *   recipeId="recipe-123"
 *   currentUserId="user-456"
 *   initialComments={comments}
 *   totalCount={15}
 * />
 */
export function CommentsList({
  recipeId,
  currentUserId,
  initialComments = [],
  totalCount = 0,
}: CommentsListProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialComments.length < totalCount);
  const [offset, setOffset] = useState(initialComments.length);

  // Load comments from server
  const loadComments = async (startOffset: number, replace = false) => {
    setIsLoading(true);
    try {
      const result = await getRecipeComments(recipeId);

      if (result.success && result.data) {
        const newComments = result.data.slice(startOffset, startOffset + COMMENTS_PER_PAGE);

        if (replace) {
          setComments(result.data.slice(0, startOffset + COMMENTS_PER_PAGE));
        } else {
          setComments((prev) => [...prev, ...newComments]);
        }

        // Check if there are more comments to load
        setHasMore(startOffset + newComments.length < result.data.length);
        setOffset(startOffset + newComments.length);
      } else {
        throw new Error(result.error || 'Failed to load comments');
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial comments if not provided
  useEffect(() => {
    if (initialComments.length === 0) {
      loadComments(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = () => {
    loadComments(offset, false);
  };

  const handleRefresh = async () => {
    // Reload all comments from the beginning
    await loadComments(0, true);
  };

  // Transform comments for CommentItem
  const transformedComments = comments.map((comment) => ({
    id: comment.id,
    userId: comment.user_id,
    userName: comment.user_name,
    userAvatar: comment.user_avatar,
    content: comment.content,
    isEdited: comment.is_edited,
    createdAt: new Date(comment.created_at),
  }));

  // Empty state
  if (!isLoading && comments.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No comments yet</h3>
        <p className="text-sm text-muted-foreground">Be the first to comment!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comments */}
      {transformedComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onEdit={handleRefresh}
          onDelete={handleRefresh}
        />
      ))}

      {/* Loading Skeleton */}
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

      {/* Load More Button */}
      {hasMore && !isLoading && (
        <div className="text-center pt-4">
          <Button onClick={handleLoadMore} variant="outline" disabled={isLoading}>
            Load More Comments
          </Button>
        </div>
      )}
    </div>
  );
}
