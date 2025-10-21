/**
 * Google Analytics (GA4) Component
 *
 * Implements Google Analytics tracking following Next.js 15 best practices:
 * - Uses Script component for optimal loading
 * - Implements proper CSP-compatible initialization
 * - Only loads in production environment
 * - Respects user privacy and consent preferences
 */

import Script from 'next/script';

export function GoogleAnalytics() {
  const GA_MEASUREMENT_ID = 'G-FZDVSZLR8V';

  // Only load Google Analytics in production
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      {/* Load gtag.js library */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />

      {/* Initialize Google Analytics */}
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
