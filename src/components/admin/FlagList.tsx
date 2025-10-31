/**
 * Flag List Component
 *
 * Displays a list of recipe flags with actions:
 * - Shows flag details (reason, description, reporter)
 * - Links to flagged recipe
 * - Actions to review, resolve, or dismiss
 */

'use client';

import { CheckCircle, ExternalLink, Eye, Flag, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { reviewFlag } from '@/app/actions/flag-recipe';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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

interface FlagData {
  id: string;
  recipe_id: string;
  recipeName: string;
  user_id: string;
  reason: string;
  description: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  created_at: Date | null;
}

interface FlagListProps {
  flags: FlagData[];
}

const REASON_LABELS: Record<string, string> = {
  inappropriate: 'Inappropriate Content',
  spam: 'Spam',
  copyright: 'Copyright Violation',
  quality: 'Quality Issues',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800',
  reviewed: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-800',
};

function FlagCard({ flag }: { flag: FlagData }) {
  const router = useRouter();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'reviewed' | 'resolved' | 'dismissed'>(
    'reviewed'
  );
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await reviewFlag(flag.id, selectedAction, reviewNotes);

      if (result.success) {
        setReviewDialogOpen(false);
        router.refresh();
      } else {
        setError(result.error || 'Failed to update flag');
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const openReviewDialog = (action: 'reviewed' | 'resolved' | 'dismissed') => {
    setSelectedAction(action);
    setReviewNotes('');
    setError(null);
    setReviewDialogOpen(true);
  };

  const isPending = flag.status === 'pending';

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Link
                href={`/recipes/${flag.recipe_id}`}
                className="text-lg font-semibold text-gray-900 hover:text-blue-600 flex items-center gap-2 group"
              >
                <span className="truncate">{flag.recipeName}</span>
                <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </Link>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={STATUS_COLORS[flag.status] || 'bg-gray-100 text-gray-800'}>
                  {flag.status}
                </Badge>
                <Badge variant="outline">{REASON_LABELS[flag.reason] || flag.reason}</Badge>
                <span className="text-xs text-gray-500">
                  {flag.created_at
                    ? new Date(flag.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Unknown date'}
                </span>
              </div>
            </div>
            <Flag className="w-5 h-5 text-red-500 flex-shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          {flag.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">{flag.description}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Reported by: <span className="font-mono">{flag.user_id.slice(0, 8)}...</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/recipes/${flag.recipe_id}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Recipe
                </Link>
              </Button>

              {isPending && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReviewDialog('reviewed')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Under Review
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReviewDialog('resolved')}
                    className="text-green-600 hover:text-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Resolve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReviewDialog('dismissed')}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Dismiss
                  </Button>
                </>
              )}
            </div>
          </div>

          {flag.reviewed_by && flag.reviewed_at && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">
                Reviewed by <span className="font-mono">{flag.reviewed_by.slice(0, 8)}...</span> on{' '}
                {new Date(flag.reviewed_at).toLocaleDateString()}
              </div>
              {flag.review_notes && (
                <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded">{flag.review_notes}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAction === 'reviewed' && 'Mark as Under Review'}
              {selectedAction === 'resolved' && 'Resolve Flag'}
              {selectedAction === 'dismissed' && 'Dismiss Flag'}
            </DialogTitle>
            <DialogDescription>
              {selectedAction === 'reviewed' &&
                'Mark this flag as under review while you investigate further.'}
              {selectedAction === 'resolved' &&
                'Confirm that appropriate action has been taken to resolve this flag.'}
              {selectedAction === 'dismissed' && 'Dismiss this flag if it does not require action.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about your decision..."
                rows={4}
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
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={loading}
              className={
                selectedAction === 'resolved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : selectedAction === 'dismissed'
                    ? 'bg-gray-600 hover:bg-gray-700'
                    : ''
              }
            >
              {loading ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FlagList({ flags }: FlagListProps) {
  return (
    <div className="space-y-4">
      {flags.map((flag) => (
        <FlagCard key={flag.id} flag={flag} />
      ))}
    </div>
  );
}
