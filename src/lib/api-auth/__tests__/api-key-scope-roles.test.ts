// @vitest-environment node
/**
 * API key scopes are limited by the key owner's role (`users.is_admin`):
 * at key creation, at key update, and again each time the key is used.
 * Real key routes, key service, auth middleware and `requireScopes` against
 * PGlite `users` / `api_keys` tables. Only the session lookup and the chef
 * data service are stubbed.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest, NextResponse } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  sessionUserId: null as string | null,
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
vi.mock('@/lib/services/chef-service', () => {
  const chef = { id: 'chef-1', slug: 'existing', name: 'Existing Chef' };
  return {
    chefService: {
      findBySlug: async (slug: string) => (slug === chef.slug ? chef : null),
      create: async (data: Record<string, unknown>) => ({ id: 'chef-2', ...data }),
      update: async (_id: string, data: Record<string, unknown>) => ({ ...chef, ...data }),
      delete: async () => true,
    },
  };
});

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { PATCH as keyPATCH } from '@/app/api/v1/auth/keys/[id]/route';
import { POST as keysPOST } from '@/app/api/v1/auth/keys/route';
import { DELETE as chefDELETE, PATCH as chefPATCH } from '@/app/api/v1/chefs/[slug]/route';
import { POST as chefsPOST } from '@/app/api/v1/chefs/route';
import { generateApiKey } from '@/lib/api-auth/key-generator';
import { createApiKey, updateApiKey } from '@/lib/api-auth/key-service';
import { requireScopes } from '@/lib/api-auth/require-auth';
import { SCOPE_GROUPS, SCOPES } from '@/lib/api-auth/scopes';
import type { RouteContext } from '@/lib/api-auth/types';
import { apiKeys, apiKeyUsage } from '@/lib/db/api-keys-schema';
import { users } from '@/lib/db/auth-schema';

const ADMIN = 'user_admin';
const MEMBER = 'user_member';
const PENDING = 'user_pending_deletion';
const MISSING = 'user_without_row';

const ADMIN_ONLY = [
  '*',
  'admin:*',
  'admin:users',
  'admin:content',
  'admin:system',
  'read:analytics',
  'analytics:*',
  'write:chefs',
  'delete:chefs',
  'chefs:*',
  'write:ingredients',
  'delete:ingredients',
  'ingredients:*',
];

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

const noParams = { params: Promise.resolve({}) } as RouteContext;
const withParams = (params: Record<string, string>) =>
  ({ params: Promise.resolve(params) }) as RouteContext;

function jsonRequest(method: string, path: string, body?: unknown, apiKey?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Creates a key through POST /api/v1/auth/keys as the signed-in `userId`. */
async function postKey(userId: string, scopes: string[]) {
  state.sessionUserId = userId;
  const res = await keysPOST(jsonRequest('POST', '/api/v1/auth/keys', { name: 'k', scopes }));
  state.sessionUserId = null;
  return res;
}

/** Creates a key through the route and returns the full key value. */
async function createdKey(userId: string, scopes: string[]) {
  const res = await postKey(userId, scopes);
  expect(res.status).toBe(201);
  return (await res.json()).data.apiKey as string;
}

/** Stores a key row directly, as a key written before any role check would be. */
async function storeKey(userId: string, scopes: string[]) {
  const generated = generateApiKey('production');
  await rows(
    `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, created_by)
     VALUES ($1, 'stored', $2, $3, $4::jsonb, $1)`,
    [userId, generated.hash, generated.prefix, JSON.stringify(scopes)]
  );
  return generated.key;
}

const ok = async () => NextResponse.json({ ok: true });
const adminRoute = requireScopes([SCOPES.ADMIN_SYSTEM], ok);
const userRoute = requireScopes([SCOPES.READ_RECIPES], ok);
const echoScopes = requireScopes([SCOPES.READ_RECIPES], async (_r, auth) =>
  NextResponse.json({ scopes: auth.scopes })
);

const callWithKey = (route: typeof adminRoute, apiKey: string) =>
  route(jsonRequest('GET', '/api/v1/test', undefined, apiKey), noParams);

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
  await client.exec('DELETE FROM api_key_usage; DELETE FROM api_keys; DELETE FROM users;');
  await rows(
    `INSERT INTO users (id, email, is_admin, deletion_requested_at) VALUES
      ($1, 'a@example.test', true, NULL),
      ($2, 'm@example.test', false, NULL),
      ($3, 'p@example.test', false, '2026-10-01T00:00:00Z')`,
    [ADMIN, MEMBER, PENDING]
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  state.sessionUserId = null;
});

describe('creating a key', () => {
  it.each(ADMIN_ONLY)('rejects %s for a non-admin with 403 and stores no key', async (scope) => {
    const res = await postKey(MEMBER, ['read:recipes', scope]);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, reason: 'scope_not_allowed' });
    expect(body.disallowedScopes).toEqual([scope]);
    expect(body.error).toContain(scope);
    expect(await rows('SELECT id FROM api_keys')).toEqual([]);
  });

  it('allows a non-admin the USER scope group', async () => {
    const res = await postKey(MEMBER, [...SCOPE_GROUPS.USER]);

    expect(res.status).toBe(201);
    expect(await rows('SELECT user_id, scopes FROM api_keys')).toEqual([
      { user_id: MEMBER, scopes: [...SCOPE_GROUPS.USER] },
    ]);
  });

  it('allows an admin admin-only scopes', async () => {
    const res = await postKey(ADMIN, ADMIN_ONLY);

    expect(res.status).toBe(201);
    expect(await rows('SELECT user_id, scopes FROM api_keys')).toEqual([
      { user_id: ADMIN, scopes: ADMIN_ONLY },
    ]);
  });

  it('enforces the role in the service for every caller', async () => {
    const result = await createApiKey({ userId: MEMBER, name: 'k', scopes: ['admin:*'] });

    expect(result).toMatchObject({
      success: false,
      reason: 'scope_not_allowed',
      disallowedScopes: ['admin:*'],
    });
    expect(await rows('SELECT id FROM api_keys')).toEqual([]);
  });

  it('treats an owner with no users row as a non-admin', async () => {
    const result = await createApiKey({ userId: MISSING, name: 'k', scopes: ['write:chefs'] });

    expect(result).toMatchObject({ success: false, reason: 'scope_not_allowed' });
  });
});

describe('updating a key', () => {
  async function memberKeyId() {
    expect((await postKey(MEMBER, ['read:recipes'])).status).toBe(201);
    return (await rows('SELECT id FROM api_keys'))[0].id as string;
  }

  const patch = (userId: string, id: string, body: unknown) => {
    state.sessionUserId = userId;
    return keyPATCH(jsonRequest('PATCH', `/api/v1/auth/keys/${id}`, body), {
      params: Promise.resolve({ id }),
    });
  };

  it('rejects a non-admin adding an admin-only scope with 403 and leaves the key unchanged', async () => {
    const id = await memberKeyId();
    const before = await rows('SELECT * FROM api_keys');

    const res = await patch(MEMBER, id, { scopes: ['read:recipes', 'write:chefs'], name: 'new' });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      reason: 'scope_not_allowed',
      disallowedScopes: ['write:chefs'],
    });
    expect(await rows('SELECT * FROM api_keys')).toEqual(before);
  });

  it('allows a non-admin to change scopes within the USER group', async () => {
    const id = await memberKeyId();

    const res = await patch(MEMBER, id, { scopes: ['read:recipes', 'write:meals'] });

    expect(res.status).toBe(200);
    expect(await rows('SELECT scopes FROM api_keys')).toEqual([
      { scopes: ['read:recipes', 'write:meals'] },
    ]);
  });

  it('allows an admin to add admin-only scopes', async () => {
    expect((await postKey(ADMIN, ['read:recipes'])).status).toBe(201);
    const id = (await rows('SELECT id FROM api_keys'))[0].id as string;

    const res = await patch(ADMIN, id, { scopes: ['read:recipes', 'admin:*'] });

    expect(res.status).toBe(200);
    expect(await rows('SELECT scopes FROM api_keys')).toEqual([
      { scopes: ['read:recipes', 'admin:*'] },
    ]);
  });

  it('enforces the role in the service for every caller', async () => {
    const id = await memberKeyId();

    expect(await updateApiKey(id, { scopes: ['*'] })).toMatchObject({
      success: false,
      reason: 'scope_not_allowed',
      disallowedScopes: ['*'],
    });
    expect(await rows('SELECT scopes FROM api_keys')).toEqual([{ scopes: ['read:recipes'] }]);
  });
});

describe('using a key', () => {
  it('drops admin-only scopes from a non-admin owner key but keeps its user scopes', async () => {
    const key = await storeKey(MEMBER, ['admin:*', 'read:recipes']);

    expect((await callWithKey(adminRoute, key)).status).toBe(403);
    expect((await callWithKey(userRoute, key)).status).toBe(200);
    expect(await (await callWithKey(echoScopes, key)).json()).toEqual({
      scopes: ['read:recipes'],
    });
  });

  it('removes admin scopes from a key once its owner is no longer an admin', async () => {
    const key = await createdKey(ADMIN, ['admin:*', 'read:recipes']);
    expect((await callWithKey(adminRoute, key)).status).toBe(200);

    await rows('UPDATE users SET is_admin = false WHERE id = $1', [ADMIN]);

    expect((await callWithKey(adminRoute, key)).status).toBe(403);
    expect((await callWithKey(userRoute, key)).status).toBe(200);
  });

  it('keeps a non-admin key with the USER group working unchanged', async () => {
    const key = await storeKey(MEMBER, [...SCOPE_GROUPS.USER]);

    const res = await callWithKey(echoScopes, key);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scopes: [...SCOPE_GROUPS.USER] });
  });

  it('rejects a key whose owner has a pending account deletion with 401', async () => {
    const key = await storeKey(PENDING, ['read:recipes']);

    const res = await callWithKey(userRoute, key);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'inactive', authType: 'api_key' });
  });

  it('rejects a key whose owner has no users row with 401', async () => {
    const key = await storeKey(MISSING, ['read:recipes']);

    const res = await callWithKey(userRoute, key);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'inactive', authType: 'api_key' });
  });
});

describe('chef write routes', () => {
  const chefBody = { slug: 'new-chef', name: 'New Chef' };
  const calls = {
    POST: (apiKey?: string) =>
      chefsPOST(jsonRequest('POST', '/api/v1/chefs', chefBody, apiKey), noParams),
    PATCH: (apiKey?: string) =>
      chefPATCH(
        jsonRequest('PATCH', '/api/v1/chefs/existing', { name: 'Renamed' }, apiKey),
        withParams({ slug: 'existing' })
      ),
    DELETE: (apiKey?: string) =>
      chefDELETE(
        jsonRequest('DELETE', '/api/v1/chefs/existing', undefined, apiKey),
        withParams({ slug: 'existing' })
      ),
  };
  const methods = Object.keys(calls) as Array<keyof typeof calls>;

  it.each(methods)('%s answers 403 to a non-admin key holding chef write scopes', async (m) => {
    const key = await storeKey(MEMBER, ['chefs:*', 'write:chefs', 'delete:chefs']);

    expect((await calls[m](key)).status).toBe(403);
  });

  it.each(methods)('%s answers 403 to a non-admin session', async (m) => {
    state.sessionUserId = MEMBER;

    expect((await calls[m]()).status).toBe(403);
  });

  it.each([
    ['POST', 201],
    ['PATCH', 200],
    ['DELETE', 200],
  ] as const)('%s works for an admin key', async (m, status) => {
    const key = await createdKey(ADMIN, ['write:chefs', 'delete:chefs']);

    expect((await calls[m](key)).status).toBe(status);
  });
});
