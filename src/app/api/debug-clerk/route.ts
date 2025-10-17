import { NextResponse } from 'next/server';

export async function GET() {
  // Debug information about Clerk configuration
  const debugInfo = {
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    },
    clerk: {
      publishableKey: {
        configured: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        value: `${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 20)}...`,
        instance: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.split('.')[0]?.replace(
          'pk_test_',
          ''
        ),
      },
      secretKey: {
        configured: !!process.env.CLERK_SECRET_KEY,
        prefix: `${process.env.CLERK_SECRET_KEY?.substring(0, 10)}...`,
      },
    },
    urls: {
      signIn: '/sign-in',
      signUp: '/sign-up',
      clerkInstance: `https://${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.split('.')[0]?.replace('pk_test_', '')}.clerk.accounts.dev`,
      expectedCallbacks: [
        'https://powerful-salmon-99.clerk.accounts.dev/v1/oauth_callback',
        'http://localhost:3004/.clerk/oauth_callback',
      ],
    },
    googleOAuth: {
      note: 'Google OAuth must be enabled in Clerk Dashboard',
      dashboardUrl: 'https://dashboard.clerk.com',
      requiredSteps: [
        '1. Sign in to Clerk Dashboard',
        '2. Select your application (powerful-salmon-99)',
        '3. Go to Configure → SSO Connections',
        '4. Enable Google and add Client ID/Secret from Google Cloud Console',
      ],
    },
  };

  return NextResponse.json(debugInfo, { status: 200 });
}
