/**
 * Privacy policy — public, linked from the footer and /sign-in.
 *
 * Every statement here is derived from the code (Auth.js config and schema,
 * the Drizzle tables, the layout's analytics, and the provider call sites).
 * Update it in the same change as any new data flow or third-party call.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection, SupportContactLink } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: "What Joanie's Kitchen collects, why, and who processes it.",
  alternates: { canonical: '/privacy' },
};

const EFFECTIVE_DATE = 'October 28, 2026';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate={EFFECTIVE_DATE}>
      <p>
        This policy describes what Joanie&apos;s Kitchen (joanies.kitchen, &quot;we&quot;) collects
        when you use the site, how it is used, and which service providers process it. You can
        browse recipes without an account. Saving anything to an account requires signing in with
        Google.
      </p>

      <LegalSection title="Information from Google sign-in">
        <p>
          Google is the only sign-in method. Registration is currently closed, so only accounts we
          have set up in advance can sign in. When you sign in, we store:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>your name, email address and profile picture URL, as provided by Google;</li>
          <li>your Google account identifier;</li>
          <li>
            the OAuth data Google returns at sign-in: access token, refresh token (if Google issues
            one), ID token, token type, granted scopes and expiry time;
          </li>
          <li>the date your account was created and whether it has administrator access.</li>
        </ul>
        <p>We do not receive or store your Google password.</p>
      </LegalSection>

      <LegalSection title="Content you create">
        <p>When you use account features, we store what you enter, linked to your account:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            your profile: username, display name, bio, profile image, location, website, cooking
            specialties, and whether the profile is public;
          </li>
          <li>recipes you create or import, and images you upload;</li>
          <li>favorites and recipe collections;</li>
          <li>meals, meal plans and shopping lists;</li>
          <li>ratings, likes, comments, recipe copies (forks) and reports you file on recipes;</li>
          <li>your fridge inventory, and the usage and food-waste records it keeps;</li>
          <li>which recipes you view and when.</li>
        </ul>
        <p>
          If you create an API key, we store its name, a hash of the key, its permissions and its
          last use, and for each request made with it, the IP address and user agent.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and browser storage">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Session cookie</strong> (<code>authjs.session-token</code>): an encrypted token
            that keeps you signed in for up to 7 days.
          </li>
          <li>
            <strong>Sign-in security cookies</strong> (<code>authjs.csrf-token</code>,{' '}
            <code>authjs.callback-url</code> and <code>authjs.pkce.code_verifier</code>): protect
            the sign-in form and return you to the page you came from.
          </li>
          <li>
            <strong>Google Analytics</strong>: the production site loads Google Analytics, which
            sets its own cookies to count visits and page views.
          </li>
          <li>
            <strong>Vercel Web Analytics and Speed Insights</strong> measure page views and page
            performance.
          </li>
          <li>
            <strong>Browser storage</strong>: the site keeps your recent searches, unsaved recipe
            drafts, meals you build before signing in, and a dismissed-banner setting in your
            browser&apos;s local storage. That data stays on your device.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use this information">
        <p>
          We use it to sign you in, to provide the features you use (saving recipes, meal plans,
          inventory and so on), to run searches and AI features you request, to measure how the site
          is used, and to keep the site working and secure.
        </p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>These providers receive data so the site can work:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Vercel</strong> hosts the site and keeps request logs (such as IP address,
            browser user agent and requested page), stores uploaded images, and runs Web Analytics
            and Speed Insights.
          </li>
          <li>
            <strong>Neon</strong> hosts the database that holds the account data and content listed
            above.
          </li>
          <li>
            <strong>Google</strong> provides sign-in and Google Analytics.
          </li>
          <li>
            <strong>OpenRouter</strong> (and the AI model providers it routes to, including
            Perplexity&apos;s Sonar model) receives what you submit to AI features while signed in:
            recipe-generation prompts and ingredients, web recipe search queries, recipe text or
            images you ask it to read, and meal-pairing requests.
          </li>
          <li>
            <strong>Jina AI</strong> receives the text of searches on the recipe search page, to
            match them to recipes.
          </li>
          <li>
            <strong>Brave Search</strong> receives recipe discovery queries you submit while signed
            in.
          </li>
          <li>
            <strong>Firecrawl</strong> receives web addresses you submit for recipe import, and
            fetches those pages.
          </li>
        </ul>
        <p>
          Our automated recipe collection also uses Tavily, SerpAPI, Perplexity, Anthropic, OpenAI,
          Firecrawl and Jina AI. Those calls carry search terms and web addresses chosen by our
          crawler, not information about you.
        </p>
      </LegalSection>

      <LegalSection title="Retention">
        <p>
          We keep your account information and content while your account exists. There is no
          automatic deletion schedule.
        </p>
      </LegalSection>

      {/* D7c: confirm with counsel. The 30-day window is chosen to sit inside the GDPR
          one-month response window and the CCPA 45-day window. Counsel has not confirmed either
          figure or whether those laws apply to this site, so the public text states only our own
          commitment and cites neither law. */}
      <LegalSection title="Your choices: access, export and deletion">
        <p>
          You can ask for a copy of your data (access and export), or for deletion of your account
          and its data, by emailing us at <SupportContactLink />. We complete access, export and
          deletion requests within 30 days.
        </p>
        <p>
          Today these requests are handled by email only. Self-serve export and deletion from your
          account are coming soon; they are not available yet.
        </p>
        <p>When we delete an account:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            the account is hidden and held for a 30-day grace period, during which you can ask us to
            restore it;
          </li>
          <li>after the grace period, the account and its data are permanently deleted;</li>
          <li>
            you choose what happens to your public recipes: they are deleted (the default), or kept
            and shown as written by &quot;deleted user&quot;;
          </li>
          <li>
            your private recipes, uploaded images, and your comments and ratings on other
            people&apos;s recipes are always deleted.
          </li>
        </ul>
        <p>
          You can also remove the site&apos;s access to your Google account at any time from your
          Google Account permissions page.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The site is not directed at children under 13, and we do not knowingly collect personal
          information from them. If you believe a child under 13 has given us personal information,
          contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy. When we do, we will post the new version on this page and
          change the effective date above.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this policy: <SupportContactLink />. See also our{' '}
          <Link href="/terms" className="text-jk-tomato underline hover:no-underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
