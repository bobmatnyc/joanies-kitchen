import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/app/actions/user-profiles';

/**
 * Check if current user has a profile
 *
 * GET /api/profile/check
 *
 * Returns:
 * - { hasProfile: boolean, profile?: UserProfile }
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ hasProfile: false }, { status: 401 });
    }

    const profile = await getCurrentUserProfile();

    return NextResponse.json({
      hasProfile: !!profile,
      profile: profile || undefined,
    });
  } catch (error) {
    console.error('Error checking profile:', error);
    return NextResponse.json(
      { hasProfile: false, error: 'Failed to check profile' },
      { status: 500 }
    );
  }
}
