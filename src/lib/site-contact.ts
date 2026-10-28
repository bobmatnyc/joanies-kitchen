/**
 * Public support contact for the legal pages and footer.
 *
 * Why: the privacy policy and terms must name one way to reach the operator
 * (deletion, export, takedown requests). No verified public mailbox exists in
 * the repo, so the address comes from `NEXT_PUBLIC_SUPPORT_EMAIL`.
 * What: `getSupportContact()` returns a mailto link when the env var holds an
 * address, else the GitHub issues page.
 * Test: `src/lib/__tests__/site-contact.test.ts`
 */

export const SUPPORT_ISSUES_URL = 'https://github.com/bobmatnyc/joanies-kitchen/issues';

export type SupportContact = { href: string; label: string; isEmail: boolean };

export function getSupportContact(): SupportContact {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { href: `mailto:${email}`, label: email, isEmail: true };
  }
  return { href: SUPPORT_ISSUES_URL, label: 'our GitHub issues page', isEmail: false };
}
