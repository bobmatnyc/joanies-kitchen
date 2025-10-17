/**
 * Clerk Configuration API Route
 * Provides configuration for using production keys on localhost
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const isProdKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isProdKeys || !isDev) {
    return NextResponse.json({
      configured: false,
      message: 'Standard configuration',
    });
  }

  // Return configuration for production keys on localhost
  return NextResponse.json({
    configured: true,
    domain: 'recipes.help',
    proxyUrl: 'http://localhost:3004/api/clerk-proxy',
    isSatellite: true,
    primaryDomain: 'recipes.help',
    allowedOrigins: ['http://localhost:3004', 'https://recipes.help'],
    headers: {
      'X-Forwarded-Host': 'recipes.help',
      'X-Development-Mode': 'true',
    },
    // Override Clerk URLs
    clerkUrls: {
      signIn: '/sign-in',
      signUp: '/sign-up',
      userProfile: '/user-profile',
      organizationProfile: '/organization-profile',
    },
  });
}
