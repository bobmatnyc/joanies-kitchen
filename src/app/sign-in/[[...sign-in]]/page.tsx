import { AuthPageWrapper, SignInWrapper } from '@/components/auth/AuthPageWrapper';

export default function SignInPage() {
  return (
    <AuthPageWrapper type="sign-in">
      <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Sign in to your account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Or continue with Google for quick access
            </p>
          </div>
          <SignInWrapper />
        </div>
      </div>
    </AuthPageWrapper>
  );
}
