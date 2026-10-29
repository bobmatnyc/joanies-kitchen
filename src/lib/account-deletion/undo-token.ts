import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed undo-deletion token — #103.
 *
 * Why: a user with a pending deletion is refused a session, but a fresh
 * Google sign-in must still let them undo. The blocked sign-in issues this
 * token as proof of that sign-in; it grants the undo action and nothing else.
 * What: `<base64url(userId.requestedAtMs.expiresAtMs)>.<hmac>` signed with
 * HMAC-SHA256 under AUTH_SECRET, with a purpose prefix so no other signed
 * value can be replayed as one. It is valid for UNDO_TOKEN_TTL_MS and only
 * while the user's `deletion_requested_at` still equals `requestedAtMs`, so
 * a completed undo kills every outstanding token. No AUTH_SECRET → issuing
 * throws and verifying returns null (fail closed).
 * Test: `src/lib/account-deletion/__tests__/undo-token.test.ts`
 */

/** How long an undo token stays valid after the blocked sign-in. */
export const UNDO_TOKEN_TTL_MS = 15 * 60 * 1000;

const PURPOSE = 'joanies-kitchen:undo-account-deletion:v1';

export interface UndoTokenClaims {
  userId: string;
  requestedAtMs: number;
}

function secret(): string | null {
  const value = process.env.AUTH_SECRET;
  return value ? value : null;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(`${PURPOSE}\n${payload}`).digest('base64url');
}

/** Issues a token for this user and request time. Throws when AUTH_SECRET is unset. */
export function issueUndoToken(claims: UndoTokenClaims, now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error('AUTH_SECRET is not set; cannot issue an undo token.');
  const payload = Buffer.from(
    `${claims.userId}.${claims.requestedAtMs}.${now + UNDO_TOKEN_TTL_MS}`
  ).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

/** Returns the claims of a valid, unexpired token, or null for anything else. */
export function verifyUndoToken(token: unknown, now = Date.now()): UndoTokenClaims | null {
  const key = secret();
  if (!key || typeof token !== 'string') return null;
  const [payload, mac, extra] = token.split('.');
  if (!payload || !mac || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  // userId may itself contain dots; the two numbers are always the last parts.
  const parts = Buffer.from(payload, 'base64url').toString('utf8').split('.');
  if (parts.length < 3) return null;
  const expiresAtMs = Number(parts.pop());
  const requestedAtMs = Number(parts.pop());
  const userId = parts.join('.');
  if (!userId || !Number.isFinite(requestedAtMs) || !Number.isFinite(expiresAtMs)) return null;
  if (now >= expiresAtMs) return null;
  return { userId, requestedAtMs };
}
