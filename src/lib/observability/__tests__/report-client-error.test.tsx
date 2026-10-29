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
