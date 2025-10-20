import { SpeedInsights } from '@vercel/speed-insights/next';
import { Plus } from 'lucide-react';
import type { Metadata, Viewport } from 'next';
import { Inter, Lora, Playfair_Display } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { GuestDataMigration } from '@/components/meals/GuestDataMigration';
import { MobileNav } from '@/components/mobile/MobileNav';
import { DesktopNav } from '@/components/navigation/DesktopNav';
import { ProfileCompletionBanner } from '@/components/profile/ProfileCompletionBanner';
import { Button } from '@/components/ui/button';
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
  title: "Joanie's Kitchen | Stop Food Waste, Cook From Your Fridge",
  description:
    "Stop food waste with AI that helps you cook from your fridge. Enter what you have and find recipes you can make right now — with substitutions for what's missing.",
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
  ],
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
                  {/* Add Recipe Button - Always visible on mobile */}
                  <Link href="/recipes/new">
                    <Button
                      size="sm"
                      className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium"
                    >
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Add</span>
                    </Button>
                  </Link>
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
              <p className="text-jk-sage font-ui text-xs mt-1 italic">
                Cook With What You Have. Waste Nothing.
              </p>
            </div>
          </footer>

          <Toaster position="bottom-right" richColors />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  );
}
