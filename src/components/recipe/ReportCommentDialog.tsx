'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { FlagReason } from '@/app/actions/flag-recipe';
import { reportComment } from '@/app/actions/report-comment';
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

interface ReportCommentDialogProps {
  commentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the report is stored; `hidden` is true when it hid the comment. */
  onReported?: (hidden: boolean) => void;
}

/** #105: lets a signed-in user report another user's comment. */
export function ReportCommentDialog({
  commentId,
  open,
  onOpenChange,
  onReported,
}: ReportCommentDialogProps) {
  const [reason, setReason] = useState<FlagReason>('harassment');
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await reportComment(commentId, reason);
      if (!result.success) {
        toast.error(result.error || 'Failed to report comment');
        return;
      }
      toast.success(
        result.alreadyReported ? 'You already reported this comment' : 'Thanks, report received'
      );
      onOpenChange(false);
      onReported?.(result.hidden === true);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report comment</DialogTitle>
          <DialogDescription>An admin will review this report.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as FlagReason)}>
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem value={r.value} id={`report-${commentId}-${r.value}`} />
              <Label htmlFor={`report-${commentId}-${r.value}`}>{r.label}</Label>
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
