/**
 * #59: the admin's Unhide and Remove controls for hidden comments, in the same
 * confirm-with-notes dialog the report queue uses.
 * Test: `src/components/admin/__tests__/hidden-comments-panel.test.tsx`
 */

'use client';

import { Eye, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  actOnHiddenComment,
  type HiddenComment,
  type HiddenCommentAction,
} from '@/app/actions/hidden-comments';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toErrorMessage } from '@/lib/utils/error-handling';

function HiddenCommentRow({ comment }: { comment: HiddenComment }) {
  const router = useRouter();
  const [action, setAction] = useState<HiddenCommentAction | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesId = `hidden-comment-notes-${comment.id}`;

  const open = (next: HiddenCommentAction) => {
    setAction(next);
    setNotes('');
    setError(null);
  };

  const confirm = async () => {
    if (!action) return;
    setLoading(true);
    setError(null);
    try {
      const result = await actOnHiddenComment(comment.id, action, notes);
      if (result.success) {
        setAction(null);
        router.refresh();
      } else {
        setError(result.error || 'Failed to update comment');
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <li className="border border-gray-200 rounded-md p-4">
      <Link
        href={`/recipes/${comment.recipe_id}`}
        className="font-medium text-gray-900 hover:text-blue-600"
      >
        {comment.recipeName}
      </Link>
      <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-md whitespace-pre-wrap my-2">
        {comment.content}
      </p>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs text-gray-500">
          By <span className="font-mono">{comment.user_id.slice(0, 8)}...</span> on{' '}
          {new Date(comment.created_at).toLocaleDateString()}. Pending reports:{' '}
          {comment.pendingReports}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => open('unhide')}
            className="text-green-600 hover:text-green-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            Unhide comment
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => open('remove')}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove comment
          </Button>
        </div>
      </div>

      <Dialog open={action !== null} onOpenChange={(isOpen) => !isOpen && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === 'remove' ? 'Remove Comment' : 'Unhide Comment'}</DialogTitle>
            <DialogDescription>
              {action === 'remove'
                ? 'Delete this comment and resolve its pending reports.'
                : 'Show this comment publicly again and dismiss its pending reports.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={notesId}>Review Notes (Optional)</Label>
              <Textarea
                id={notesId}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Saved on any pending reports this closes."
                rows={3}
                disabled={loading}
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={confirm}
              disabled={loading}
              className={
                action === 'remove'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              }
            >
              {loading ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function HiddenCommentList({ comments }: { comments: HiddenComment[] }) {
  return (
    <ul className="space-y-3">
      {comments.map((comment) => (
        <HiddenCommentRow key={comment.id} comment={comment} />
      ))}
    </ul>
  );
}
