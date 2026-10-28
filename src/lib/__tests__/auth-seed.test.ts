/** #22: the seed script's argument parsing and upsert. Fixtures use example.test only. */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { drizzle } from 'drizzle-orm/pg-proxy';
import { maskEmail, parseSeedArgs, seedAuthUser } from '@/lib/auth-seed';

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
    [['--id', 'u1'], '--email is required'],
    [['--id', '  ', '--email', 'p@example.test'], '--id is required'],
    [['--id', 'u1', '--email', 'not-an-email'], 'not a valid email'],
    [['--id', '--email', 'p@example.test'], '--id needs a value'],
    [['--id', 'u1', '--email'], '--email needs a value'],
    [['--id', 'u1', '--email', 'p@example.test', '--admn'], 'Unknown argument'],
  ])('rejects %o', (argv, message) => {
    expect(() => parseSeedArgs(argv)).toThrow(message);
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
