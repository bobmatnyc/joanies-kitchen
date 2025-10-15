import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { sessionClaims, userId } = await auth();

    return NextResponse.json({
      userId,
      hasSessionClaims: !!sessionClaims,
      sessionClaims,
      metadata: (sessionClaims as any)?.metadata,
      publicMetadata: (sessionClaims as any)?.publicMetadata,
      isAdminFromMetadata: (sessionClaims as any)?.metadata?.isAdmin,
      isAdminFromPublicMetadata: (sessionClaims as any)?.publicMetadata?.isAdmin,
      allKeys: sessionClaims ? Object.keys(sessionClaims) : [],
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
