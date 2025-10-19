'use client';

import {
  BookOpen,
  Calendar,
  ChefHat,
  FolderHeart,
  Globe,
  Heart,
  Menu,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { NavLink } from '@/components/navigation/NavLink';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/**
 * Mobile Navigation Component
 *
 * Provides a hamburger menu for mobile/tablet screens with all navigation items
 * in a slide-out drawer. Automatically closes the drawer when a link is clicked.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  // Close the sheet when a navigation link is clicked
  const handleLinkClick = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-jk-olive border-jk-sage w-[280px] sm:w-[320px]">
        <SheetHeader>
          <SheetTitle className="text-jk-linen font-heading text-xl">Menu</SheetTitle>
        </SheetHeader>

        {/* Navigation Links - Stacked Vertically */}
        <nav className="flex flex-col gap-2 mt-8">
          <NavLink
            href="/recipes"
            icon={BookOpen}
            label="Recipes"
            variant="mobile"
            onClick={handleLinkClick}
          />
          <NavLink
            href="/collections"
            icon={FolderHeart}
            label="Collections"
            variant="mobile"
            onClick={handleLinkClick}
          />
          <NavLink
            href="/meals"
            icon={Calendar}
            label="Meals"
            variant="mobile"
            onClick={handleLinkClick}
          />
          <NavLink
            href="/recipes/top-50"
            icon={Trophy}
            label="Top 50"
            variant="mobile"
            onClick={handleLinkClick}
          />
          <NavLink
            href="/favorites"
            icon={Heart}
            label="Favorites"
            variant="mobile"
            onClick={handleLinkClick}
          />
          <NavLink
            href="/shared"
            icon={Globe}
            label="Shared"
            variant="mobile"
            onClick={handleLinkClick}
          />
          <NavLink
            href="/discover"
            icon={Sparkles}
            label="Discover"
            variant="mobile"
            onClick={handleLinkClick}
          />
          <NavLink
            href="/discover/chefs"
            icon={ChefHat}
            label="Chefs"
            variant="mobile"
            onClick={handleLinkClick}
          />
        </nav>

        {/* Divider */}
        <div className="border-t border-jk-sage my-6" />

        {/* Auth Section */}
        <div className="flex flex-col gap-2">
          <AuthButtons />
        </div>
      </SheetContent>
    </Sheet>
  );
}
