/** #22: the seed script's argument parsing and upsert. Fixtures use example.test only. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { drizzle } from 'drizzle-orm/pg-proxy';
import { maskEmail, parseSeedArgs, seedAuthUser } from '@/lib/auth-seed';

// #22: never inherit a real admin list from the host environment.
beforeEach(() => vi.stubEnv('AUTH_ADMIN_EMAILS', ''));
afterEach(() => vi.unstubAllEnvs());

describe('parseSeedArgs', () => {
  it('parses id, a normalized email and flags', () => {
    expect(
      parseSeedArgs([
        '--id',
        'user_abc',
        '--email',
        ' Person@Example.TEST ',
        '--admin',
        '--dry-run',
      ])
    ).toEqual({ id: 'user_abc', email: 'person@example.test', isAdmin: true, dryRun: true });
  });

  it('defaults to a non-admin, non-dry-run seed', () => {
    expect(parseSeedArgs(['--email', 'p@example.test', '--id', 'u1'])).toMatchObject({
      isAdmin: false,
      dryRun: false,
    });
  });

  it.each([
    [['--email', 'p@example.test'], '--id is required'],
    [['--id', 'u1'], 'AUTH_ADMIN_EMAILS is unset or empty'],
    [['--id', '  ', '--email', 'p@example.test'], '--id is required'],
    [['--id', 'u1', '--email', 'not-an-email'], 'not a valid email'],
    [['--id', '--email', 'p@example.test'], '--id needs a value'],
    [['--id', 'u1', '--email'], '--email needs a value'],
    [['--id', 'u1', '--email', 'p@example.test', '--admn'], 'Unknown argument'],
  ])('rejects %o', (argv, message) => {
    expect(() => parseSeedArgs(argv)).toThrow(message);
  });
});

describe('parseSeedArgs with AUTH_ADMIN_EMAILS (#22 A06)', () => {
  const LISTED = 'listed-admin@example.test';

  it('takes the single listed email when --email is omitted and seeds it as admin', () => {
    expect(parseSeedArgs(['--id', 'user_old'], [LISTED])).toEqual({
      id: 'user_old',
      email: LISTED,
      isAdmin: true,
      dryRun: false,
    });
  });

  it('seeds a listed --email as admin even without --admin', () => {
    expect(parseSeedArgs(['--id', 'u1', '--email', LISTED.toUpperCase()], [LISTED])).toMatchObject({
      isAdmin: true,
    });
  });

  it('keeps an unlisted --email non-admin without --admin', () => {
    expect(parseSeedArgs(['--id', 'u1', '--email', 'p@example.test'], [LISTED])).toMatchObject({
      isAdmin: false,
    });
  });

  it('refuses to guess when the list holds more than one email', () => {
    expect(() => parseSeedArgs(['--id', 'u1'], [LISTED, 'b@example.test'])).toThrow(
      'AUTH_ADMIN_EMAILS lists 2 emails'
    );
  });

  it('refuses when the list is empty', () => {
    expect(() => parseSeedArgs(['--id', 'u1'], [])).toThrow('AUTH_ADMIN_EMAILS is unset or empty');
  });
});

describe('seedAuthUser', () => {
  it('upserts by id and sets is_admin to exactly the flag given', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const db = drizzle(async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [['u1', false]] };
    });
    await expect(
      seedAuthUser(db, { id: 'u1', email: 'p@example.test', isAdmin: false })
    ).resolves.toEqual({
      id: 'u1',
      isAdmin: false,
    });
    expect(calls[0].sql).toMatch(/^insert into "users"/);
    expect(calls[0].sql).toMatch(
      /on conflict \("id"\) do update set "email" = \$\d+, "is_admin" = \$\d+/
    );
    expect(calls[0].params).toEqual(expect.arrayContaining(['u1', 'p@example.test', false]));
  });

  it('throws when the upsert returns no row', async () => {
    const db = drizzle(async () => ({ rows: [] }));
    await expect(
      seedAuthUser(db, { id: 'u1', email: 'p@example.test', isAdmin: true })
    ).rejects.toThrow('returned no row');
  });
});

describe('maskEmail', () => {
  it('keeps two characters of the local part', () => {
    expect(maskEmail('person@example.test')).toBe('pe***@example.test');
  });
});
