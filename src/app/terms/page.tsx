/** Terms of service — public, linked from the footer and /sign-in. */

import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection, SupportContactLink } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: "The terms for using Joanie's Kitchen.",
  alternates: { canonical: '/terms' },
};

const EFFECTIVE_DATE = 'October 28, 2026';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effectiveDate={EFFECTIVE_DATE}>
      <p>
        These terms apply to your use of Joanie&apos;s Kitchen (joanies.kitchen), operated by
        Joanie&apos;s Kitchen (&quot;we&quot;). By using the site you agree to them.
      </p>

      <LegalSection title="The service">
        <p>
          Joanie&apos;s Kitchen is free to use. It is provided &quot;as is&quot; and &quot;as
          available&quot;, without warranties of any kind. Recipes, nutrition estimates,
          substitutions and AI-generated content may contain errors; check ingredients, allergens
          and food safety yourself.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You can browse recipes without an account. Account features such as saving recipes,
          collections, meal plans and inventory require signing in with a Google account. You are
          responsible for activity under your account.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You own the recipes, comments, images and other content you submit. You grant us a
          non-exclusive, royalty-free licence to store, display and reproduce that content on the
          site to operate the service. You confirm that you have the right to submit what you post.
        </p>
      </LegalSection>

      <LegalSection title="Recipes from other sources">
        <p>
          Some recipes come from other websites and chefs. We attribute them to their source. If you
          own content on this site and want it removed, send a takedown request to{' '}
          <SupportContactLink />.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Do not:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>post unlawful, abusive, hateful or infringing content, or spam;</li>
          <li>impersonate others or misuse another person&apos;s account;</li>
          <li>
            try to break, overload or bypass the security of the site, or scrape it in a way that
            harms its operation;
          </li>
          <li>use the site&apos;s AI features to generate harmful or unlawful content.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Suspension">
        <p>
          We may suspend or close an account, or remove content, that breaks these terms or abuses
          the service.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we are not liable for any indirect, incidental or
          consequential damages, or for any loss arising from your use of the site or from reliance
          on its content.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. When we do, we will post the new version on this page and
          change the effective date above. Continuing to use the site after a change means you
          accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms: <SupportContactLink />. See also our{' '}
          <Link href="/privacy" className="text-jk-tomato underline hover:no-underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
