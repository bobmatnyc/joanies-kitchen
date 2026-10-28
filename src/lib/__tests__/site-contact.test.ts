/** The support contact falls back to GitHub issues unless a valid address is configured. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupportContact, SUPPORT_ISSUES_URL } from '@/lib/site-contact';

afterEach(() => vi.unstubAllEnvs());

describe('getSupportContact', () => {
  it.each([
    ['', SUPPORT_ISSUES_URL],
    ['not-an-email', SUPPORT_ISSUES_URL],
    ['  help@example.test  ', 'mailto:help@example.test'],
  ])('NEXT_PUBLIC_SUPPORT_EMAIL=%o → %s', (value, href) => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', value);
    expect(getSupportContact().href).toBe(href);
  });
});
