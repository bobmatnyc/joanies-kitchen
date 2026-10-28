import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { isAuthConfigured } from '@/lib/auth-env';
import { safeCallbackPath } from '@/lib/auth-routes';

// #22: Google is the only sign-in method (issue #22 §9 Q2, Q3).
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: 'This Google account is not registered. Registration is closed.',
  OAuthAccountNotLinked: 'This Google account could not be linked to an existing user.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : undefined;
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  const configured = isAuthConfigured();

  // #22: Auth.js links a new OAuth login to whoever is already signed in, so a
  // signed-in visitor must never start a second Google sign-in from here.
  if ((await auth()).userId) redirect(callbackUrl);

  return (
    <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Sign in to your account</h2>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {ERROR_MESSAGES[error] ?? 'Sign-in failed. Please try again.'}
          </p>
        )}
        {configured ? (
          <form
            action={async () => {
              'use server';
              // #22: re-check at submit time (the visitor may have signed in elsewhere).
              if ((await auth()).userId) redirect(callbackUrl);
              await signIn('google', { redirectTo: callbackUrl });
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sign-in is not configured. Set AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.
          </p>
        )}
      </div>
    </div>
  );
}
