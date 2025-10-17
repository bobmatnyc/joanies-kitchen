import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/app/actions/user-profiles';
import { ProfileEditor } from '@/components/profile/ProfileEditor';

export const metadata = {
  title: "Edit Profile - Joanie's Kitchen",
  description: 'Edit your chef profile',
};

export default async function EditProfilePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect=/profile/edit');
  }

  // Fetch current user's profile
  const profile = await getCurrentUserProfile();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {profile ? 'Edit Profile' : 'Create Your Chef Profile'}
          </h1>
          <p className="text-gray-600 mb-8">
            {profile
              ? 'Update your profile information and settings'
              : 'Set up your chef profile to share your recipes with the community'}
          </p>

          <ProfileEditor profile={profile} />
        </div>
      </div>
    </div>
  );
}
