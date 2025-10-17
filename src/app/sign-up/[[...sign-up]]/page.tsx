import { AuthPageWrapper, SignUpWrapper } from '@/components/auth/AuthPageWrapper';

export default function SignUpPage() {
  return (
    <AuthPageWrapper type="sign-up">
      <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Create your account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign up to start managing your recipes
            </p>
          </div>
          <SignUpWrapper />
        </div>
      </div>
    </AuthPageWrapper>
  );
}
