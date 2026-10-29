// @vitest-environment node
/** #55 S3: Next's own console.error output is redacted; the wrapper never throws. */
import { describe, expect, it, vi } from 'vitest';
import { register } from '@/instrumentation';
import { installConsoleRedaction } from '../redact-console';
import { reportError } from '../report-error';

const EMAIL = 'probe@example.com';
const TOKEN = 'abc.DEF_123-xyz';

function fakeConsole() {
  const error = vi.fn();
  const warn = vi.fn();
  const target = { error, warn } as unknown as Console;
  installConsoleRedaction(target);
  return { target, error, warn };
}

describe('installConsoleRedaction', () => {
  it('redacts an Error message and stack without mutating the original', () => {
    const { target, error } = fakeConsole();
    const original = Object.assign(
      new SyntaxError(`Unexpected token 'p', "${EMAIL}" is not valid JSON; Bearer ${TOKEN}`),
      { digest: '637223128' }
    );
    const originalStack = original.stack;
    target.error(original);

    const logged = error.mock.calls[0]?.[0] as SyntaxError & { digest: string };
    expect(logged).toBeInstanceOf(SyntaxError);
    expect(logged).not.toBe(original);
    expect(logged.message).not.toContain(EMAIL);
    expect(logged.message).not.toContain(TOKEN);
    expect(logged.message).toContain('[email]');
    expect(logged.stack).not.toContain(EMAIL);
    expect(logged.stack).not.toContain(TOKEN);
    expect(logged.digest).toBe('637223128');
    expect(original.message).toContain(EMAIL);
    expect(original.stack).toBe(originalStack);
  });

  it('redacts string arguments and Error causes through console.warn', () => {
    const { target, warn } = fakeConsole();
    target.warn(`login for ${EMAIL}`, new Error('outer', { cause: new Error(`inner ${EMAIL}`) }));
    const [text, err] = warn.mock.calls[0] ?? [];
    expect(text).toBe('login for [email]');
    expect(((err as Error).cause as Error).message).toBe('inner [email]');
  });

  it('still logs circular and throwing arguments without throwing', () => {
    const { target, error } = fakeConsole();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const hostile = new Error('x');
    Object.defineProperty(hostile, 'message', {
      get() {
        throw new Error('getter');
      },
    });
    const looped = new Error(`loop ${EMAIL}`);
    (looped as { cause?: unknown }).cause = looped;

    expect(() => target.error(circular, hostile)).not.toThrow();
    expect(error.mock.calls[0]).toEqual([circular, hostile]);
    expect(() => target.error(looped)).not.toThrow();
    expect((error.mock.calls[1]?.[0] as Error).message).toBe('loop [email]');
  });

  it('keeps the app-error JSON line valid and does not wrap twice', () => {
    const { target, error } = fakeConsole();
    installConsoleRedaction(target);
    const before = console.error;
    console.error = target.error;
    try {
      reportError(new Error(`a "quoted" \\ postgres://u:p@h/db ${EMAIL}`), {
        source: 'action',
        path: '/sign-in',
      });
    } finally {
      console.error = before;
    }
    expect(error).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(error.mock.calls[0]?.[0]));
    expect(line.tag).toBe('app-error');
    expect(line.message).toContain('[email]');
  });

  it('register() installs the wrapper on the nodejs runtime only', () => {
    const before = console.error;
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    register();
    expect(console.error).toBe(before);
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const sink = vi.fn();
    console.error = sink;
    try {
      register();
      console.error(new Error(`boom ${EMAIL}`));
      expect((sink.mock.calls[0]?.[0] as Error).message).toBe('boom [email]');
    } finally {
      console.error = before;
      vi.unstubAllEnvs();
    }
  });
});
