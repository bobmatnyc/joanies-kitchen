/** The support contact defaults to support@1mc.io unless a valid override is configured. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SUPPORT_EMAIL, getSupportContact } from '@/lib/site-contact';

afterEach(() => vi.unstubAllEnvs());

describe('getSupportContact', () => {
  it('defaults to support@1mc.io as a mailto link when the env var is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', '');
    expect(DEFAULT_SUPPORT_EMAIL).toBe('support@1mc.io');
    expect(getSupportContact()).toEqual({
      href: 'mailto:support@1mc.io',
      label: 'support@1mc.io',
      isEmail: true,
    });
  });

  it.each([
    ['not-an-email', 'mailto:support@1mc.io'],
    ['  help@example.test  ', 'mailto:help@example.test'],
  ])('NEXT_PUBLIC_SUPPORT_EMAIL=%o → %s', (value, href) => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', value);
    expect(getSupportContact().href).toBe(href);
  });
});
