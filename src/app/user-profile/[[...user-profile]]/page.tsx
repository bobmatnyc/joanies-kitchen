import { UserProfilePageWrapper } from '@/components/auth/AuthPageWrapper';

export default function UserProfilePage() {
  return (
    <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">User Profile</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
        <UserProfilePageWrapper />
      </div>
    </div>
  );
}
