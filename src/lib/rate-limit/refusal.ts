/**
 * Typed refusal results shared by every rate-limited paid action.
 *
 * Why: each paid entry point must refuse with the same codes as #82
 * (`RATE_LIMITED` + `retryAfterSec`, `LIMITER_UNAVAILABLE`) and keep the
 * cost-ceiling code (`COST_CAP_REACHED`, `COST_GUARD_UNAVAILABLE`) typed.
 * What: `refusalFor` maps a limiter verdict to a refusal or null;
 * `rateLimitRefusal` checks the caller's bucket first; `paidCallRefusal` maps a
 * thrown cost-ceiling error; `refusalResponse` renders a refusal as 429/503.
 * Test: `src/app/actions/__tests__/paid-paths-rate-limit.test.ts`
 */

import { NextResponse } from 'next/server';
import { isPaidCallBlocked, type PaidCallBlockedCode } from '@/lib/costs';
import { enforceRateLimit, type RateLimitBucket, type RateLimitResult } from './index';

export type RateLimitRefusal =
  | { success: false; error: string; errorCode: 'RATE_LIMITED'; retryAfterSec: number }
  | { success: false; error: string; errorCode: 'LIMITER_UNAVAILABLE' };

export interface PaidCallRefusal {
  success: false;
  error: string;
  errorCode: PaidCallBlockedCode;
}

/** Null when the verdict allows the call; otherwise the refusal to return. */
export function refusalFor(verdict: RateLimitResult, feature: string): RateLimitRefusal | null {
  if (verdict.allowed) return null;
  if (verdict.reason === 'unavailable') {
    return {
      success: false,
      error: `${feature} is temporarily unavailable`,
      errorCode: 'LIMITER_UNAVAILABLE',
    };
  }
  return {
    success: false,
    error: `Too many ${feature} requests; try again later`,
    errorCode: 'RATE_LIMITED',
    retryAfterSec: verdict.retryAfterSec,
  };
}

/** Counts one call against the caller's bucket; a refusal means no paid call may run. */
export async function rateLimitRefusal(
  bucket: RateLimitBucket,
  userId: string | null,
  feature: string
): Promise<RateLimitRefusal | null> {
  return refusalFor(await enforceRateLimit(bucket, userId), feature);
}

/** The cost-ceiling refusal with its typed code, or null for any other error. */
export function paidCallRefusal(error: unknown): PaidCallRefusal | null {
  if (!isPaidCallBlocked(error)) return null;
  return { success: false, error: error.message, errorCode: error.code };
}

/** API routes: 429 with Retry-After over the limit, 503 for an outage (as `/api/search/semantic`). */
export function refusalResponse(refusal: RateLimitRefusal | PaidCallRefusal): NextResponse {
  const body = { ...refusal, details: refusal.error };
  if (refusal.errorCode === 'RATE_LIMITED') {
    return NextResponse.json(body, {
      status: 429,
      headers: { 'Retry-After': String(refusal.retryAfterSec) },
    });
  }
  return NextResponse.json(body, { status: 503 });
}
