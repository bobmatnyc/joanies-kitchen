import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake URL shape only; neon() builds an HTTP client without connecting.
const FAKE_URL = 'postgresql://user:pw@example.invalid/db';

describe('lazy db (A37)', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.DATABASE_URL;
    vi.resetModules();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  it('imports without DATABASE_URL', async () => {
    delete process.env.DATABASE_URL;
    await expect(import('@/lib/db')).resolves.toHaveProperty('db');
  });

  it('throws a clear error on first use when DATABASE_URL is unset', async () => {
    delete process.env.DATABASE_URL;
    const { db, getDb } = await import('@/lib/db');
    expect(() => getDb()).toThrow('DATABASE_URL is not set');
    expect(() => db.select()).toThrow('DATABASE_URL is not set');
  });

  it('rejects a non-postgres DATABASE_URL without echoing it', async () => {
    process.env.DATABASE_URL = 'mysql://secret-value@host/db';
    const { getDb } = await import('@/lib/db');
    expect(() => getDb()).toThrow(/not a postgresql:\/\//);
    expect(() => getDb()).not.toThrow(/secret-value/);
  });

  it('creates the client once and reuses it', async () => {
    process.env.DATABASE_URL = FAKE_URL;
    const { db, getDb } = await import('@/lib/db');
    expect(getDb()).toBe(getDb());
    expect(typeof db.select).toBe('function');
  });
});
