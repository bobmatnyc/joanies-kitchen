'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { FlagReason } from '@/app/actions/flag-recipe';
import { reportRatingReview } from '@/app/actions/report-rating-review';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const REASONS: { value: FlagReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
];

interface ReportReviewDialogProps {
  ratingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the report is stored; `hidden` is true when it hid the review text. */
  onReported?: (hidden: boolean) => void;
}

/** #270: lets a signed-in user report another user's rating review (cloned from the #105 comment dialog). */
export function ReportReviewDialog({
  ratingId,
  open,
  onOpenChange,
  onReported,
}: ReportReviewDialogProps) {
  const [reason, setReason] = useState<FlagReason>('harassment');
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await reportRatingReview(ratingId, reason);
      if (!result.success) {
        toast.error(result.error || 'Failed to report review');
        return;
      }
      toast.success(
        result.alreadyReported ? 'You already reported this review' : 'Thanks, report received'
      );
      onOpenChange(false);
      onReported?.(result.hidden === true);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report review</DialogTitle>
          <DialogDescription>An admin will review this report.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as FlagReason)}>
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem value={r.value} id={`report-${ratingId}-${r.value}`} />
              <Label htmlFor={`report-${ratingId}-${r.value}`}>{r.label}</Label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? 'Reporting...' : 'Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
