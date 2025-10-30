'use client';

import { FileEdit, Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { formatSavedTime } from '@/hooks/useRecipeDraftAutoSave';

interface DraftResumeDialogProps {
  open: boolean;
  draftName: string;
  draftStep: string;
  savedAt: string;
  progress: number;
  onResume: () => void;
  onStartFresh: () => void;
}

const stepTitles: Record<string, string> = {
  basic: 'Basic Information',
  ingredients: 'Ingredients',
  instructions: 'Instructions',
  images: 'Photos',
  review: 'Review & Submit',
};

export function DraftResumeDialog({
  open,
  draftName,
  draftStep,
  savedAt,
  progress,
  onResume,
  onStartFresh,
}: DraftResumeDialogProps) {
  const stepTitle = stepTitles[draftStep] || 'Unknown step';
  const timeAgo = formatSavedTime(savedAt);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-blue-600" />
            Draft Found
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3 pt-2">
            <p>We found a saved draft from {timeAgo}.</p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {draftName || 'Untitled Recipe'}
                  </p>
                  <p className="text-xs text-muted-foreground">Last step: {stepTitle}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {progress}% complete
                </Badge>
              </div>

              <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Would you like to continue editing your draft or start fresh?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={onStartFresh}
            className="gap-2"
            aria-label="Discard draft and start fresh"
          >
            <Trash2 className="w-4 h-4" />
            Start Fresh
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResume} className="gap-2" aria-label="Resume editing draft">
            <FileEdit className="w-4 h-4" />
            Resume Draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
