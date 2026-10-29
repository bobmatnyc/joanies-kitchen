import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureLocalNeonProxy,
  DEFAULT_NEON_LOCAL_PROXY_PORT,
  localNeonFetchEndpoint,
} from '../local-neon';

// #60: fake URL shapes only; nothing here opens a connection.
const url = (host: string) => `postgres://u:p@${host}:5434/db`; // secret-check: ignore (dummy)

const REMOTE_HOSTS = [
  'ep-example-123456.us-east-1.aws.neon.tech',
  'ep-example-123456-pooler.us-east-1.aws.neon.tech',
  'localhost.evil.com',
  '127.0.0.1.nip.io',
  'evil-localhost',
  '127.0.0.2',
  'db.localtest.me',
];

describe('localNeonFetchEndpoint (#60)', () => {
  it.each([
    ['127.0.0.1', 'http://127.0.0.1:4444/sql'],
    ['localhost', 'http://localhost:4444/sql'],
    ['LOCALHOST', 'http://localhost:4444/sql'],
    ['[::1]', 'http://[::1]:4444/sql'],
  ])('maps loopback host %s to the proxy endpoint', (host, expected) => {
    expect(localNeonFetchEndpoint(url(host), {})).toBe(expected);
  });

  it.each(REMOTE_HOSTS)('leaves non-loopback host %s alone', (host) => {
    expect(localNeonFetchEndpoint(url(host), {})).toBeUndefined();
  });

  it('ignores loopback text outside the hostname', () => {
    expect(localNeonFetchEndpoint('postgres://localhost@neon.tech/127.0.0.1', {})).toBeUndefined();
  });

  it('returns undefined for an unparseable URL', () => {
    expect(localNeonFetchEndpoint('not a url', {})).toBeUndefined();
  });

  it('defaults to the proxy port and honours NEON_LOCAL_PROXY_PORT', () => {
    expect(DEFAULT_NEON_LOCAL_PROXY_PORT).toBe(4444);
    expect(localNeonFetchEndpoint(url('127.0.0.1'), { NEON_LOCAL_PROXY_PORT: '4445' })).toBe(
      'http://127.0.0.1:4445/sql'
    );
  });

  it.each(['0', '65536', 'abc', '44.4', '-1'])('rejects NEON_LOCAL_PROXY_PORT=%s', (port) => {
    expect(() => localNeonFetchEndpoint(url('127.0.0.1'), { NEON_LOCAL_PROXY_PORT: port })).toThrow(
      /NEON_LOCAL_PROXY_PORT/
    );
  });
});

describe('configureLocalNeonProxy (#60)', () => {
  it.each(REMOTE_HOSTS)('does not touch config for %s', (host) => {
    const original = () => 'default';
    const config = { fetchEndpoint: original };
    expect(configureLocalNeonProxy(config, url(host), {})).toBe(false);
    expect(config.fetchEndpoint).toBe(original);
  });
});

describe('getDb wires the guard into neonConfig (#60)', () => {
  let savedUrl: string | undefined;
  beforeEach(() => {
    savedUrl = process.env.DATABASE_URL;
    vi.resetModules();
  });
  afterEach(async () => {
    const { neonConfig } = await import('@neondatabase/serverless');
    neonConfig.fetchEndpoint = undefined as unknown as string; // restore the driver default
    if (savedUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedUrl;
  });

  it('points fetchEndpoint at the local proxy for a loopback DATABASE_URL', async () => {
    process.env.DATABASE_URL = url('127.0.0.1');
    const { getDb } = await import('@/lib/db');
    const { neonConfig } = await import('@neondatabase/serverless');
    getDb();
    expect(neonConfig.fetchEndpoint).toBe('http://127.0.0.1:4444/sql');
  });

  it('keeps the driver default fetchEndpoint for a Neon DATABASE_URL', async () => {
    process.env.DATABASE_URL = url('ep-example-123456.us-east-1.aws.neon.tech');
    const { getDb } = await import('@/lib/db');
    const { neonConfig } = await import('@neondatabase/serverless');
    const before = neonConfig.fetchEndpoint;
    getDb();
    expect(neonConfig.fetchEndpoint).toBe(before);
    expect(typeof neonConfig.fetchEndpoint).toBe('function');
    const endpoint = neonConfig.fetchEndpoint as (host: string, port: number) => string;
    expect(endpoint('ep-example-123456.us-east-1.aws.neon.tech', 5432)).toBe(
      'https://api.us-east-1.aws.neon.tech/sql'
    );
  });
});
