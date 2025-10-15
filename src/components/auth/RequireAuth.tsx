'use client';

/**
 * RequireAuth Component
 *
 * A wrapper component that protects features requiring authentication.
 * Shows a sign-in prompt if the user is not authenticated.
 *
 * Usage:
 * <RequireAuth
 *   featureName="AI Recipe Generator"
 *   description="Sign in to generate custom recipes using AI"
 * >
 *   <ProtectedFeature />
 * </RequireAuth>
 */

import { useAuth, SignInButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Sparkles } from 'lucide-react';

interface RequireAuthProps {
  /**
   * The content to display when authenticated
   */
  children: React.ReactNode;

  /**
   * Name of the feature requiring authentication
   * Displayed in the sign-in prompt
   */
  featureName: string;

  /**
   * Additional description for the feature
   * Shown below the feature name in the prompt
   */
  description?: string;

  /**
   * Custom icon to display (defaults to Lock icon)
   */
  icon?: React.ReactNode;

  /**
   * Whether to show the feature name as a card title
   * If false, shows a more compact inline version
   */
  showAsCard?: boolean;
}

/**
 * Card-based sign-in prompt for protected features
 */
function CardSignInPrompt({
  featureName,
  description,
  icon,
}: {
  featureName: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="border-2 border-dashed border-jk-sage">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-4">
          {icon || <Lock className="h-12 w-12 text-jk-clay" />}
        </div>
        <CardTitle className="text-xl text-jk-olive">
          {featureName}
        </CardTitle>
        {description && (
          <CardDescription className="text-jk-charcoal/70">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="text-center pb-6">
        <SignInButton mode="modal">
          <Button className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Lock className="h-4 w-4 mr-2" />
            Sign In to Continue
          </Button>
        </SignInButton>
        <p className="text-xs text-jk-charcoal/60 mt-4">
          Don't have an account? Sign up is quick and free.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Inline sign-in prompt for compact layouts
 */
function InlineSignInPrompt({
  featureName,
  description,
}: {
  featureName: string;
  description?: string;
}) {
  return (
    <div className="bg-jk-linen/50 border border-jk-sage rounded-lg p-6 text-center">
      <Lock className="h-8 w-8 text-jk-clay mx-auto mb-3" />
      <h3 className="text-lg font-heading text-jk-olive mb-2">
        {featureName}
      </h3>
      {description && (
        <p className="text-sm text-jk-charcoal/70 mb-4">
          {description}
        </p>
      )}
      <SignInButton mode="modal">
        <Button size="sm" className="bg-jk-tomato hover:bg-jk-tomato/90">
          <Lock className="h-3 w-3 mr-2" />
          Sign In
        </Button>
      </SignInButton>
    </div>
  );
}

/**
 * Main authentication gate component
 */
export function RequireAuth({
  children,
  featureName,
  description,
  icon,
  showAsCard = true,
}: RequireAuthProps) {
  const { isSignedIn, isLoaded } = useAuth();

  // Show loading state while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse">
          <Lock className="h-8 w-8 text-jk-clay/30" />
        </div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!isSignedIn) {
    if (showAsCard) {
      return (
        <CardSignInPrompt
          featureName={featureName}
          description={description}
          icon={icon}
        />
      );
    } else {
      return (
        <InlineSignInPrompt
          featureName={featureName}
          description={description}
        />
      );
    }
  }

  // Render protected content
  return <>{children}</>;
}

/**
 * Specialized version for AI-powered features
 * Includes AI branding (sparkles icon)
 */
export function RequireAuthAI({
  children,
  featureName,
  description,
  showAsCard = true,
}: Omit<RequireAuthProps, 'icon'>) {
  return (
    <RequireAuth
      featureName={featureName}
      description={description}
      icon={<Sparkles className="h-12 w-12 text-primary" />}
      showAsCard={showAsCard}
    >
      {children}
    </RequireAuth>
  );
}
