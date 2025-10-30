'use client';

import { Edit2, Trash2, User } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteRecipeComment, updateRecipeComment } from '@/app/actions/social';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface CommentItemProps {
  comment: {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    isEdited: boolean;
    createdAt: Date;
  };
  currentUserId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const MAX_CHARS = 1000;

/**
 * CommentItem Component
 *
 * Display a single comment with:
 * - User avatar and name
 * - Relative timestamp
 * - Comment text with line breaks preserved
 * - Edit button (owner only)
 * - Delete button with confirmation (owner only)
 * - Inline editing mode
 * - Edited indicator
 *
 * @example
 * <CommentItem
 *   comment={{
 *     id: "123",
 *     userId: "user-456",
 *     userName: "John Doe",
 *     content: "Great recipe!",
 *     isEdited: false,
 *     createdAt: new Date()
 *   }}
 *   currentUserId="user-456"
 *   onEdit={() => console.log('edited')}
 *   onDelete={() => console.log('deleted')}
 * />
 */
export function CommentItem({ comment, currentUserId, onEdit, onDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwner = currentUserId === comment.userId;

  // Auto-resize textarea in edit mode
  useEffect(() => {
    if (!isEditing) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [isEditing, editContent]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    if (editContent.length > MAX_CHARS) {
      toast.error(`Comment must be ${MAX_CHARS} characters or less`);
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateRecipeComment(comment.id, editContent.trim());

        if (result.success) {
          toast.success('Comment updated!');
          setIsEditing(false);
          onEdit?.(); // Refresh comments list
        } else {
          toast.error(result.error || 'Failed to update comment');
        }
      } catch (error) {
        console.error('Error updating comment:', error);
        toast.error('Failed to update comment');
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteRecipeComment(comment.id);

        if (result.success) {
          toast.success('Comment deleted');
          setShowDeleteDialog(false);
          onDelete?.(); // Refresh comments list
        } else {
          toast.error(result.error || 'Failed to delete comment');
        }
      } catch (error) {
        console.error('Error deleting comment:', error);
        toast.error('Failed to delete comment');
      }
    });
  };

  const charsRemaining = MAX_CHARS - editContent.length;
  const isOverLimit = editContent.length > MAX_CHARS;

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {isEditing ? (
            // Edit Mode
            <div className="space-y-3">
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                disabled={isPending}
                className={cn(
                  'min-h-[80px] max-h-[300px] resize-none',
                  isOverLimit && 'border-destructive focus-visible:ring-destructive'
                )}
                aria-label="Edit comment"
              />

              {/* Character Counter */}
              <div className="flex items-center justify-end text-xs">
                <p
                  className={cn(
                    'font-medium',
                    isOverLimit ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {charsRemaining} characters remaining
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveEdit}
                  disabled={isPending || !editContent.trim() || isOverLimit}
                  size="sm"
                >
                  {isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={handleCancelEdit} variant="outline" disabled={isPending} size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // Display Mode
            <div className="space-y-3">
              {/* User Info & Actions */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full bg-jk-sage/20 flex items-center justify-center flex-shrink-0"
                    aria-hidden="true"
                  >
                    {comment.userAvatar ? (
                      <img
                        src={comment.userAvatar}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-jk-olive" />
                    )}
                  </div>

                  {/* User Name & Date */}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{comment.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(comment.createdAt)}
                      {comment.isEdited && <span className="ml-1">(edited)</span>}
                    </p>
                  </div>
                </div>

                {/* Edit/Delete Buttons (Owner Only) */}
                {isOwner && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      onClick={handleStartEdit}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={isPending}
                      aria-label="Edit comment"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => setShowDeleteDialog(true)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      disabled={isPending}
                      aria-label="Delete comment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Comment Content */}
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this comment? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
