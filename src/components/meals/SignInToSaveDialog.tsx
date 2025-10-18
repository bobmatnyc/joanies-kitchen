'use client';

import { LogIn, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getGuestDataCount } from '@/lib/utils/guest-meals';

interface SignInToSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnUrl?: string;
}

export function SignInToSaveDialog({ open, onOpenChange, returnUrl }: SignInToSaveDialogProps) {
  const router = useRouter();
  const { meals, shoppingLists } = getGuestDataCount();

  const handleSignIn = () => {
    // Store return URL in sessionStorage so we can redirect back after sign-in
    if (returnUrl) {
      sessionStorage.setItem('post_auth_redirect', returnUrl);
    }

    // Mark that we should prompt for data migration after sign-in
    sessionStorage.setItem('has_guest_data', 'true');

    router.push('/sign-in');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-jk-olive">
            <Save className="w-5 h-5" />
            Sign in to Save Your Work
          </DialogTitle>
          <DialogDescription className="font-body text-jk-charcoal/70">
            Your meal planning data is currently stored in your browser. Sign in to save it
            permanently to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-jk-sage/10 border border-jk-sage/30 rounded-jk p-4 space-y-2">
            <h4 className="font-ui font-semibold text-jk-olive">You have created:</h4>
            <ul className="space-y-1 text-sm font-body text-jk-charcoal/80">
              {meals > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-jk-tomato" />
                  {meals} {meals === 1 ? 'meal' : 'meals'}
                </li>
              )}
              {shoppingLists > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-jk-clay" />
                  {shoppingLists} shopping {shoppingLists === 1 ? 'list' : 'lists'}
                </li>
              )}
            </ul>
          </div>

          <div className="space-y-2 text-sm text-jk-charcoal/70 font-body">
            <p className="font-semibold text-jk-olive">Why sign in?</p>
            <ul className="space-y-1 ml-4">
              <li className="list-disc">Access your meals from any device</li>
              <li className="list-disc">Never lose your data</li>
              <li className="list-disc">Share meals with family and friends</li>
              <li className="list-disc">Get AI-powered recipe suggestions</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui"
          >
            Continue as Guest
          </Button>
          <Button
            type="button"
            onClick={handleSignIn}
            className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Sign In to Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Banner component to show at top of guest meal pages
 */
export function GuestMealBanner() {
  const router = useRouter();
  const { meals } = getGuestDataCount();

  if (meals === 0) return null;

  const handleSignIn = () => {
    sessionStorage.setItem('has_guest_data', 'true');
    router.push('/sign-in');
  };

  return (
    <div className="bg-gradient-to-r from-jk-tomato/10 to-jk-clay/10 border border-jk-tomato/30 rounded-jk p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-ui font-semibold text-jk-olive flex items-center gap-2">
            <Save className="w-4 h-4" />
            Guest Mode
          </h3>
          <p className="text-sm text-jk-charcoal/70 font-body">
            Your {meals} {meals === 1 ? 'meal is' : 'meals are'} stored in your browser. Sign in to
            save permanently.
          </p>
        </div>
        <Button
          onClick={handleSignIn}
          size="sm"
          className="bg-jk-tomato hover:bg-jk-tomato/90 text-white min-h-[44px] touch-manipulation font-ui whitespace-nowrap"
        >
          <LogIn className="w-4 h-4 mr-2" />
          Sign In to Save
        </Button>
      </div>
    </div>
  );
}
