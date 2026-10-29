/** #55 S1: report-error emits one redacted app-error line and never throws. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestError } from '@/instrumentation';
import { MAX_MESSAGE_LENGTH, reportError, sanitizeMessage } from '../report-error';

function captureLines(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  return { lines, restore: () => spy.mockRestore() };
}

afterEach(() => vi.restoreAllMocks());

describe('reportError', () => {
  it('redacts emails and bearer tokens and strips the query string', () => {
    const { lines } = captureLines();
    const err = new Error(
      'lookup failed for jane.doe@example.com with Bearer abc123.DEF-456_ghi auth'
    );
    reportError(err, { source: 'route', path: '/api/recipes?email=jane.doe@example.com&t=1' });

    expect(lines).toHaveLength(1);
    const line = lines[0] ?? '';
    expect(line).not.toContain('jane.doe@example.com');
    expect(line).not.toContain('abc123.DEF-456_ghi');
    expect(line).not.toContain('?');
    const rec = JSON.parse(line);
    expect(rec).toMatchObject({
      tag: 'app-error',
      source: 'route',
      path: '/api/recipes',
      name: 'Error',
      message: 'lookup failed for [email] with Bearer [redacted] auth',
    });
  });

  it('truncates long messages', () => {
    const { lines } = captureLines();
    reportError(new Error('x '.repeat(1000)), { source: 'cron' });
    const rec = JSON.parse(lines[0] ?? '');
    expect(rec.message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH + 1);
  });

  it('never throws on a hostile error and falls back to a minimal line', () => {
    const { lines } = captureLines();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const hostile = new Error('boom');
    Object.defineProperty(hostile, 'name', {
      get() {
        throw new Error('getter exploded');
      },
    });
    Object.defineProperty(hostile, 'digest', { value: circular });
    expect(() => reportError(hostile, { source: 'render' })).not.toThrow();
    expect(() => reportError(circular, { source: 'render' })).not.toThrow();
    // A context whose path getter throws forces the serialization fallback.
    const badCtx = {
      source: 'render',
      get path(): string {
        throw new Error('ctx exploded');
      },
    } as const;
    expect(() => reportError(new Error('x'), badCtx)).not.toThrow();
    expect(lines).toHaveLength(3);
    for (const l of lines) expect(JSON.parse(l).tag).toBe('app-error');
    expect(JSON.parse(lines[2] ?? '').name).toBe('ReportErrorFailure');
  });
});

describe('sanitizeMessage input bound', () => {
  // #55: redaction regexes are superlinear on long input, so input is capped first.
  it.each([
    ['no @', 'a'.repeat(200_000)],
    ['near-email fragments', 'a.b-c_d%e+f.'.repeat(17_000)],
  ])('sanitizes a 200k-char message with %s in under 100 ms', (_label, msg) => {
    const start = performance.now();
    const out = sanitizeMessage(msg);
    expect(performance.now() - start).toBeLessThan(100);
    expect(out.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH + 1);
  });

  it('still redacts an email near the start of a long message', () => {
    const out = sanitizeMessage(`user bob@example.com failed ${'x '.repeat(100_000)}`);
    expect(out).toContain('[email]');
    expect(out).not.toContain('bob@example.com');
  });
});

describe('onRequestError', () => {
  it('logs digest, route and source from the Next context', () => {
    const { lines } = captureLines();
    const err = Object.assign(new Error('render broke'), { digest: '12345' });
    onRequestError(
      err,
      { path: '/recipes/pasta?ref=a@b.co' },
      { routePath: '/recipes/[slug]', routeType: 'render', renderSource: 'react-server-components' }
    );
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      tag: 'app-error',
      source: 'render',
      path: '/recipes/pasta',
      route: '/recipes/[slug]',
      digest: '12345',
      name: 'Error',
      message: 'render broke',
    });
  });
});

// #55 S3: path, route and name get the same email/token redaction as the message.
describe('reportError field redaction', () => {
  it('redacts emails and tokens in path, route and name, keeping long slugs', () => {
    const { lines } = captureLines();
    const err = Object.assign(new Error('x'), { name: 'Err jane@example.com Bearer abc.DEF-1' });
    reportError(err, {
      source: 'render',
      path: '/u/jane@example.com/token_ABCDEFGH12345',
      route: '/r/sk-abcdefghijk/chocolate-chip-cookies-with-flaky-sea-salt',
    });
    const line = lines[0] ?? '';
    expect(line).not.toContain('jane@example.com');
    expect(line).not.toContain('abc.DEF-1');
    expect(line).not.toContain('ABCDEFGH12345');
    expect(line).not.toContain('sk-abcdefghijk');
    const rec = JSON.parse(line);
    expect(rec.path).toBe('/u/[email]/[secret]');
    expect(rec.route).toBe('/r/[secret]/chocolate-chip-cookies-with-flaky-sea-salt');
    expect(rec.name).toBe('Err [email] Bearer [redacted]');
  });
});
