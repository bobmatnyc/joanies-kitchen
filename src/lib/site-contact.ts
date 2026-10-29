/**
 * Public support contact for the legal pages and footer.
 *
 * Why: the privacy policy and terms must name one way to reach the operator
 * (deletion, export, takedown requests). Owner ruling (#35): the address is
 * `support@1mc.io`; no MX record or mail provider is needed.
 * What: `getSupportContact()` returns a mailto link for `NEXT_PUBLIC_SUPPORT_EMAIL`
 * when it holds a valid address, else for `DEFAULT_SUPPORT_EMAIL`. The GitHub
 * issues page stays exported as the secondary channel.
 * Test: `src/lib/__tests__/site-contact.test.ts`
 */

export const DEFAULT_SUPPORT_EMAIL = 'support@1mc.io';
export const SUPPORT_ISSUES_URL = 'https://github.com/bobmatnyc/joanies-kitchen/issues';

export type SupportContact = { href: string; label: string; isEmail: boolean };

export function getSupportContact(): SupportContact {
  const configured = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  const email =
    configured && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)
      ? configured
      : DEFAULT_SUPPORT_EMAIL;
  return { href: `mailto:${email}`, label: email, isEmail: true };
}
