/**
 * #270: the admin's Unhide and Remove controls for hidden rating reviews, in the same
 * confirm-with-notes dialog the report queue uses. Remove clears the text; the rating stays.
 * Test: `src/components/admin/__tests__/hidden-reviews-panel.test.tsx`
 */

'use client';

import { Eye, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  actOnHiddenReview,
  type HiddenReview,
  type HiddenReviewAction,
} from '@/app/actions/hidden-reviews';
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

function HiddenReviewRow({ review }: { review: HiddenReview }) {
  const router = useRouter();
  const [action, setAction] = useState<HiddenReviewAction | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesId = `hidden-review-notes-${review.id}`;

  const open = (next: HiddenReviewAction) => {
    setAction(next);
    setNotes('');
    setError(null);
  };

  const confirm = async () => {
    if (!action) return;
    setLoading(true);
    setError(null);
    try {
      const result = await actOnHiddenReview(review.id, action, notes);
      if (result.success) {
        setAction(null);
        router.refresh();
      } else {
        setError(result.error || 'Failed to update review');
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
        href={`/recipes/${review.recipe_id}`}
        className="font-medium text-gray-900 hover:text-blue-600"
      >
        {review.recipeName}
      </Link>
      <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-md whitespace-pre-wrap my-2">
        {review.review ?? '(no text)'}
      </p>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs text-gray-500">
          Rating {review.rating}/5 by{' '}
          <span className="font-mono">{review.user_id.slice(0, 8)}...</span> on{' '}
          {review.created_at ? new Date(review.created_at).toLocaleDateString() : 'unknown date'}.
          Pending reports: {review.pendingReports}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => open('unhide')}
            className="text-green-600 hover:text-green-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            Unhide review
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => open('remove')}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove review
          </Button>
        </div>
      </div>

      <Dialog open={action !== null} onOpenChange={(isOpen) => !isOpen && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'remove' ? 'Remove Review Text' : 'Unhide Review'}
            </DialogTitle>
            <DialogDescription>
              {action === 'remove'
                ? 'Clear the review text, keep the star rating, and resolve its pending reports.'
                : 'Show this review text publicly again and dismiss its pending reports.'}
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

export function HiddenReviewList({ reviews }: { reviews: HiddenReview[] }) {
  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <HiddenReviewRow key={review.id} review={review} />
      ))}
    </ul>
  );
}
