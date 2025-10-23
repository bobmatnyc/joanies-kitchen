import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { Inter, Lora, Playfair_Display } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import { Toaster } from 'sonner';
import { AlphaStamp } from '@/components/AlphaStamp';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { GuestDataMigration } from '@/components/meals/GuestDataMigration';
import { MobileNav } from '@/components/mobile/MobileNav';
import { DesktopNav } from '@/components/navigation/DesktopNav';
import { ProfileCompletionBanner } from '@/components/profile/ProfileCompletionBanner';
import './globals.css';

// Joanie's Kitchen Typography
const playfair = Playfair_Display({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const lora = Lora({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-ui',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

// Viewport configuration (Next.js 15+ best practice)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5.0,
  userScalable: true,
  viewportFit: 'cover', // For notched devices (iPhone X+)
  themeColor: '#5B6049', // Deep Olive
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://recipes.help'),
  title: {
    default: "Joanie's Kitchen | Stop Food Waste, Cook From Your Fridge",
    template: "%s | Joanie's Kitchen"
  },
  description:
    "Transform what's in your fridge into delicious meals. AI-powered recipe matching finds recipes you can make right now with smart substitutions for missing ingredients. Join the zero-waste cooking movement.",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: "Joanie's Kitchen",
  },
  formatDetection: {
    telephone: false, // Prevent auto-linking of phone numbers
  },
  keywords: [
    'food waste',
    'cook from fridge',
    'ingredient substitution',
    'resourceful cooking',
    'leftovers',
    'fridge ingredients',
    'zero waste cooking',
    'budget meals',
    'recipe finder',
    'smart substitutions',
    'waste nothing',
    'FIFO cooking',
  ],
  openGraph: {
    type: 'website',
    siteName: "Joanie's Kitchen",
    title: "Joanie's Kitchen | Stop Food Waste, Cook From Your Fridge",
    description: "Transform what's in your fridge into delicious meals. Stop food waste. Start cooking smart.",
    url: '/',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: "Joanie's Kitchen - Cook from your fridge, waste nothing",
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Joanie's Kitchen | Zero Food Waste Cooking",
    description: "Cook from your fridge. Waste nothing. Smart substitutions for every ingredient.",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external domains for faster resource loading */}
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className={`${playfair.variable} ${lora.variable} ${inter.variable} antialiased`}>
        {/* Alpha Stamp (Production Only) */}
        <AlphaStamp />

        {/* Analytics Components */}
        <GoogleAnalytics />

        <AuthProvider>
          {/* Navigation Header - Joanie's Kitchen */}
          <header className="bg-jk-olive border-b border-jk-sage shadow-sm">
            <div className="container mx-auto px-4">
              <nav className="flex items-center justify-between h-16">
                {/* Logo - Always Visible */}
                <Link href="/" className="flex items-center gap-2 lg:gap-3 group">
                  <Image
                    src="/ai-tomato-logo.png"
                    alt="Joanie's Kitchen - AI Tomato Logo"
                    width={48}
                    height={48}
                    priority
                    className="h-10 w-10 lg:h-12 lg:w-12 object-contain group-hover:opacity-90 transition-opacity"
                  />
                  <div className="flex flex-col leading-tight">
                    <span className="text-jk-linen font-heading font-semibold text-lg lg:text-xl tracking-wide">
                      Joanie's Kitchen
                    </span>
                    <span className="text-jk-sage text-xs font-ui italic -mt-0.5 hidden sm:block">
                      Zero Food Waste
                    </span>
                  </div>
                </Link>

                {/* Desktop Navigation (>1024px) */}
                <DesktopNav />

                {/* Mobile/Tablet Navigation (<1024px) */}
                <div className="flex xl:hidden items-center gap-2">
                  {/* Hamburger Menu */}
                  <MobileNav />
                </div>
              </nav>
            </div>
          </header>

          {/* Profile Completion Banner */}
          <ProfileCompletionBanner />

          {/* Guest Data Migration Dialog */}
          <GuestDataMigration />

          <main className="min-h-screen bg-jk-linen">{children}</main>

          {/* Footer */}
          <footer className="bg-jk-olive border-t border-jk-sage py-8 mt-16">
            <div className="container mx-auto px-4 text-center">
              <p className="text-jk-linen font-body text-sm">
                © {new Date().getFullYear()} Joanie's Kitchen
              </p>
              <p className="text-jk-sage font-ui text-xs mt-2 flex items-center justify-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-yellow-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
                </svg>
                <span>
                  All AI-generated content on this site (images, recipes, etc.) was created using
                  in-house inference powered by 100% solar energy.
                </span>
              </p>
              <p className="text-jk-sage font-ui text-xs mt-2 italic">
                Cook With What You Have. Waste Nothing.
              </p>
            </div>
          </footer>

          <Toaster position="bottom-right" richColors />
          <Analytics />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  );
}
