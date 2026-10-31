// @vitest-environment node
/**
 * #239: POST /api/admin/clean-recipes admits a caller only when `users.is_admin`
 * is true. Real route, `requireAuth`, auth middleware and key service against
 * PGlite `users` / `api_keys` tables. The session lookup and the cleaning work
 * are stubbed.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  sessionUserId: null as string | null,
  /** Set to make the admin lookup reject (fail-closed test). */
  adminError: undefined as Error | undefined,
  cleanCalls: 0,
}));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.sessionUserId,
  getSessionUser: async () => (state.sessionUserId ? { id: state.sessionUserId } : null),
}));
vi.mock('@/lib/auth-users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-users')>();
  return {
    ...actual,
    getUserAdminFlag: (userId: string) =>
      state.adminError ? Promise.reject(state.adminError) : actual.getUserAdminFlag(userId),
  };
});
vi.mock('@/lib/services/recipe-cleaner.service', () => ({
  cleanRecipesWithOllama: async () => {
    state.cleanCalls += 1;
    return { processed: 1, skipped: 0 };
  },
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { generateApiKey } from '@/lib/api-auth/key-generator';
import type { RouteContext } from '@/lib/api-auth/types';
import { apiKeys, apiKeyUsage } from '@/lib/db/api-keys-schema';
import { users } from '@/lib/db/auth-schema';
import { POST } from '../route';

const ADMIN = 'user_admin';
const MEMBER = 'user_member';

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Stores a key row directly with the given scopes and returns the full key. */
async function storeKey(userId: string, scopes: string[]) {
  const generated = generateApiKey('production');
  await rows(
    `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, created_by)
     VALUES ($1, 'stored', $2, $3, $4::jsonb, $1)`,
    [userId, generated.hash, generated.prefix, JSON.stringify(scopes)]
  );
  return generated.key;
}

function call(apiKey?: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const request = new NextRequest('http://localhost/api/admin/clean-recipes?limit=1', {
    method: 'POST',
    headers,
  });
  return POST(request, { params: Promise.resolve({}) } as RouteContext);
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, apiKeys, apiKeyUsage],
    { users, apiKeys, apiKeyUsage },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  state.cleanCalls = 0;
  await client.exec('DELETE FROM api_key_usage; DELETE FROM api_keys; DELETE FROM users;');
  await rows(
    `INSERT INTO users (id, email, is_admin) VALUES
      ($1, 'a@example.test', true),
      ($2, 'm@example.test', false)`,
    [ADMIN, MEMBER]
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  state.sessionUserId = null;
  state.adminError = undefined;
});

describe('signed-in callers', () => {
  it('runs the operation for a signed-in admin', async () => {
    state.sessionUserId = ADMIN;

    const res = await call();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(state.cleanCalls).toBe(1);
  });

  it('answers 403 to a signed-in non-admin', async () => {
    state.sessionUserId = MEMBER;

    expect((await call()).status).toBe(403);
    expect(state.cleanCalls).toBe(0);
  });

  it('answers 403 to a signed-in admin when the admin lookup throws', async () => {
    state.sessionUserId = ADMIN;
    state.adminError = new Error('db down');

    expect((await call()).status).toBe(403);
    expect(state.cleanCalls).toBe(0);
  });

  it('answers 403 when the session user has no users row', async () => {
    state.sessionUserId = 'user_without_row';

    expect((await call()).status).toBe(403);
    expect(state.cleanCalls).toBe(0);
  });
});

describe('API key callers', () => {
  it("answers 403 to a non-admin's key that stores admin:system", async () => {
    const key = await storeKey(MEMBER, ['admin:system', 'admin:*', '*']);

    expect((await call(key)).status).toBe(403);
    expect(state.cleanCalls).toBe(0);
  });

  it("runs the operation for an admin's key holding admin:system", async () => {
    const key = await storeKey(ADMIN, ['admin:system']);

    expect((await call(key)).status).toBe(200);
    expect(state.cleanCalls).toBe(1);
  });

  it("answers 403 to an admin's key without admin:system", async () => {
    const key = await storeKey(ADMIN, ['read:recipes', 'admin:content']);

    expect((await call(key)).status).toBe(403);
    expect(state.cleanCalls).toBe(0);
  });

  it("answers 403 to an admin's key once the owner is no longer an admin", async () => {
    const key = await storeKey(ADMIN, ['admin:system']);
    await rows('UPDATE users SET is_admin = false WHERE id = $1', [ADMIN]);

    expect((await call(key)).status).toBe(403);
    expect(state.cleanCalls).toBe(0);
  });

  it("answers 403 to an admin's key when the admin lookup throws", async () => {
    const key = await storeKey(ADMIN, ['admin:system']);
    state.adminError = new Error('db down');

    expect((await call(key)).status).toBe(403);
    expect(state.cleanCalls).toBe(0);
  });
});

describe('unauthenticated callers', () => {
  it('answers 401 with no session and no key', async () => {
    expect((await call()).status).toBe(401);
    expect(state.cleanCalls).toBe(0);
  });
});
