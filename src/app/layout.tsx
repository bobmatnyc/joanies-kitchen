import type { Metadata } from "next";
import { Playfair_Display, Lora, Inter } from "next/font/google";
import Link from "next/link";
import { ChefHat, BookOpen, Sparkles, Plus, Globe, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthButtons } from "@/components/auth/AuthButtons";
import { Toaster } from "sonner";
import "./globals.css";

// Force dynamic rendering because of Clerk authentication
// This prevents static generation issues with ClerkProvider
export const dynamic = 'force-dynamic';

// Joanie's Kitchen Typography
const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Joanie's Kitchen",
  description: "From Garden to Table — with Heart and Soil. Celebrate cooking with the seasons.",
  icons: {
    icon: '/icon.svg',
  },
  themeColor: '#5B6049', // Deep Olive
  keywords: ['recipes', 'seasonal cooking', 'garden to table', 'farm to table', 'wholesome', 'organic', 'authentic cooking'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <html lang="en">
        <body
          className={`${playfair.variable} ${lora.variable} ${inter.variable} antialiased`}
        >
        {/* Navigation Header - Joanie's Kitchen */}
        <header className="bg-jk-olive border-b border-jk-sage shadow-sm">
          <div className="container mx-auto px-4">
            <nav className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-3 group">
                <ChefHat className="h-7 w-7 text-jk-linen group-hover:text-jk-sage transition-colors" />
                <div className="flex flex-col leading-tight">
                  <span className="text-jk-linen font-heading font-semibold text-xl tracking-wide">
                    Joanie's Kitchen
                  </span>
                  <span className="text-jk-sage text-xs font-ui italic -mt-0.5">
                    Garden to Table
                  </span>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <Link href="/about">
                  <Button variant="ghost" size="sm" className="text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui">
                    <Heart className="h-4 w-4 mr-2" />
                    About
                  </Button>
                </Link>
                <Link href="/recipes">
                  <Button variant="ghost" size="sm" className="text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui">
                    <BookOpen className="h-4 w-4 mr-2" />
                    My Recipes
                  </Button>
                </Link>
                <Link href="/shared">
                  <Button variant="ghost" size="sm" className="text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui">
                    <Globe className="h-4 w-4 mr-2" />
                    Shared
                  </Button>
                </Link>
                <Link href="/discover">
                  <Button variant="ghost" size="sm" className="text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Discover
                  </Button>
                </Link>
                <Link href="/recipes/new">
                  <Button size="sm" className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Recipe
                  </Button>
                </Link>
                <AuthButtons />
              </div>
            </nav>
          </div>
        </header>

        <main className="min-h-screen bg-jk-linen">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-jk-olive border-t border-jk-sage py-8 mt-16">
          <div className="container mx-auto px-4 text-center">
            <p className="text-jk-linen font-body text-sm">
              © {new Date().getFullYear()} Joanie's Kitchen
            </p>
            <p className="text-jk-sage font-ui text-xs mt-1 italic">
              From Garden to Table — with Heart and Soil
            </p>
          </div>
        </footer>

        <Toaster position="bottom-right" richColors />
        </body>
      </html>
    </AuthProvider>
  );
}
