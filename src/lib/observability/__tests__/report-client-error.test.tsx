/** #55 S2: every error boundary reports each error exactly once, and a failed send never throws. */
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RootError from '@/app/error';
import GlobalError from '@/app/global-error';
import MealDetailError from '@/app/meals/[slug]/error';
import MealsError from '@/app/meals/error';
import NewMealError from '@/app/meals/new/error';
import { handleClientError } from '../client-error-handler';
import { MAX_CLIENT_ERROR_BODY_BYTES } from '../client-error-payload';
import { sendClientError } from '../report-client-error';

type Boundary = ComponentType<{ error: Error & { digest?: string }; reset: () => void }>;

let beacon: ReturnType<typeof vi.fn>;

beforeEach(() => {
  beacon = vi.fn(() => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  window.history.replaceState(null, '', '/meals/x?q=private#h');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

async function sentBody(call = 0): Promise<Record<string, unknown>> {
  const blob = beacon.mock.calls[call]?.[1] as Blob;
  // jsdom's Blob has no text(); read it through FileReader.
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
  return JSON.parse(text);
}

describe('error boundaries', () => {
  it.each<[string, Boundary]>([
    ['root', RootError],
    ['global', GlobalError],
    ['meals', MealsError],
    ['meals-new', NewMealError],
    ['meals-detail', MealDetailError],
  ])('%s reports once per error, across re-renders and StrictMode', async (boundary, C) => {
    const error = Object.assign(new Error('boom'), { digest: 'd1' });
    const { rerender } = render(
      <StrictMode>
        <C error={error} reset={() => undefined} />
      </StrictMode>
    );
    rerender(
      <StrictMode>
        <C error={error} reset={() => undefined} />
      </StrictMode>
    );
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]?.[0]).toBe('/api/client-error');
    expect(await sentBody()).toEqual({
      name: 'Error',
      message: 'boom',
      digest: 'd1',
      boundary,
      pathname: '/meals/x',
    });

    // A new error object is a new report.
    rerender(<C error={new Error('again')} reset={() => undefined} />);
    expect(beacon).toHaveBeenCalledTimes(2);
  });
});

describe('sendClientError', () => {
  it('falls back to fetch keepalive when sendBeacon refuses', () => {
    beacon.mockReturnValue(false);
    const fetchSpy = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchSpy);
    expect(sendClientError(new Error('x'), 'root')).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/client-error',
      expect.objectContaining({ method: 'POST', keepalive: true, credentials: 'omit' })
    );
    vi.unstubAllGlobals();
  });

  it('never throws when the send itself throws', () => {
    beacon.mockImplementation(() => {
      throw new Error('beacon broken');
    });
    expect(() => sendClientError(new Error('y'), 'root')).not.toThrow();
  });
});

// #55 S3: byte cap, not just char cap; dedupe only after a send attempt.
describe('sendClientError hardening', () => {
  it('fits a long multibyte message under the server byte cap and is accepted', async () => {
    const message = '\u{1F35D}'.repeat(900);
    sendClientError(Object.assign(new Error(message), { name: '\u00e9'.repeat(100) }), 'root');
    const body = JSON.stringify(await sentBody());
    expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(MAX_CLIENT_ERROR_BODY_BYTES);
    const res = await handleClientError(
      new Request('https://joanies.kitchen/api/client-error', { method: 'POST', body }),
      { limit: async () => ({ allowed: true, count: 1, limit: 10 }) }
    );
    expect(res.status).toBe(204);
  });

  it('caps the message at 300 chars', async () => {
    sendClientError(new Error('a'.repeat(1000)), 'root');
    expect(String((await sentBody()).message)).toHaveLength(300);
  });

  it('falls back to fetch when sendBeacon throws', () => {
    beacon.mockImplementation(() => {
      throw new Error('beacon broken');
    });
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchSpy);
    expect(sendClientError(new Error('z'), 'root')).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('does not mark an error as reported when no send attempt went out', () => {
    beacon.mockImplementation(() => {
      throw new Error('beacon broken');
    });
    vi.stubGlobal('fetch', () => {
      throw new Error('fetch broken');
    });
    const error = new Error('retry me');
    expect(sendClientError(error, 'root')).toBe(false);
    vi.unstubAllGlobals();
    beacon.mockImplementation(() => true);
    expect(sendClientError(error, 'root')).toBe(true);
    expect(beacon).toHaveBeenCalledTimes(2);
  });
});
