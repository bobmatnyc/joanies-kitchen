import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/app/actions/user-profiles';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { auth } from '@/lib/auth';

export const metadata = {
  // #138: the root layout's title.template appends the brand.
  title: 'Edit Profile',
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

        {/* #58: self-serve export of the user's own data. */}
        <section className="bg-white rounded-lg shadow-sm p-8 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your data</h2>
          <p className="text-gray-600 mb-4">
            Download a JSON file with your profile, recipes, collections, meals, inventory and other
            data you have saved.
          </p>
          <a
            href="/api/account/export"
            download
            className="inline-block rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
          >
            Download my data
          </a>
        </section>

        {/* #103: account soft delete with a 30-day undo. */}
        <section className="bg-white rounded-lg shadow-sm p-8 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Delete account</h2>
          <DeleteAccountSection />
        </section>
      </div>
    </div>
  );
}
