'use client';

import { Send } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addRecipeComment } from '@/app/actions/social';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface CommentInputProps {
  recipeId: string;
  onCommentAdded?: () => void;
  placeholder?: string;
  isAuthenticated: boolean;
}

const MAX_CHARS = 1000;
const SHOW_COUNTER_AT = 800;

/**
 * CommentInput Component
 *
 * Textarea for adding comments to recipes with:
 * - Character limit (1000 chars)
 * - Character counter (shows at 800+ chars)
 * - Auto-resize textarea
 * - Loading states
 * - Success/error feedback
 * - Sign-in prompt for guests
 *
 * @example
 * <CommentInput
 *   recipeId="recipe-123"
 *   onCommentAdded={handleRefresh}
 *   isAuthenticated={isSignedIn}
 * />
 */
export function CommentInput({
  recipeId,
  onCommentAdded,
  placeholder = 'Add a comment...',
  isAuthenticated,
}: CommentInputProps) {
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight (content height)
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    if (content.length > MAX_CHARS) {
      toast.error(`Comment must be ${MAX_CHARS} characters or less`);
      return;
    }

    startTransition(async () => {
      try {
        const result = await addRecipeComment(recipeId, content.trim());

        if (result.success) {
          toast.success('Comment added!');
          setContent(''); // Clear input
          onCommentAdded?.(); // Refresh comments list
        } else {
          toast.error(result.error || 'Failed to add comment');
        }
      } catch (error) {
        console.error('Error adding comment:', error);
        toast.error('Failed to add comment');
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charsRemaining = MAX_CHARS - content.length;
  const showCounter = content.length >= SHOW_COUNTER_AT;
  const isOverLimit = content.length > MAX_CHARS;

  // Show sign-in prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">Sign in to leave a comment</p>
        <Button asChild size="sm">
          <a href="/sign-in">Sign In</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isPending}
          className={cn(
            'min-h-[80px] max-h-[300px] resize-none pr-20',
            isOverLimit && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-label="Add a comment"
          aria-describedby={showCounter ? 'char-counter' : undefined}
        />

        {/* Submit Button - Positioned inside textarea */}
        <div className="absolute bottom-2 right-2">
          <Button
            onClick={handleSubmit}
            disabled={isPending || !content.trim() || isOverLimit}
            size="sm"
            className="min-h-[36px] min-w-[36px]"
            aria-label="Submit comment"
          >
            <Send className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{isPending ? 'Posting...' : 'Post'}</span>
          </Button>
        </div>
      </div>

      {/* Character Counter */}
      {showCounter && (
        <div className="flex items-center justify-between text-xs">
          <p className="text-muted-foreground">
            Tip: Press <kbd className="px-1.5 py-0.5 bg-muted rounded">Cmd+Enter</kbd> to submit
          </p>
          <p
            id="char-counter"
            className={cn(
              'font-medium',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground'
            )}
            aria-live="polite"
          >
            {isOverLimit ? `-${Math.abs(charsRemaining)}` : charsRemaining} characters{' '}
            {isOverLimit ? 'over limit' : 'remaining'}
          </p>
        </div>
      )}
    </div>
  );
}
