'use client';

import {
  Bookmark,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Leaf,
  Menu,
  Package,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { NavLink } from '@/components/navigation/NavLink';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/**
 * Mobile Navigation Component - Week 4 Task 5.1 (Updated Oct 21)
 *
 * Provides a hamburger menu for mobile/tablet screens with all navigation items
 * in a slide-out drawer. Automatically closes the drawer when a link is clicked.
 *
 * Reorganized around zero-waste mission per ROADMAP.md
 *
 * Note: "What's in Your Fridge" is linked from homepage hero
 * Note: "Philosophy" and "Rescue Ingredients" are linked from /learn page
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
          className="text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 size-11"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-jk-olive border-jk-sage w-[280px] sm:w-[320px]">
        <SheetHeader>
          <SheetTitle className="text-jk-linen font-heading text-xl">Menu</SheetTitle>
        </SheetHeader>

        {/* Primary Navigation - Zero-Waste Focus */}
        <nav className="flex flex-col gap-2 mt-8">
          {/* Learn Techniques */}
          <NavLink
            href="/learn"
            icon={GraduationCap}
            label="Learn"
            variant="mobile"
            onClick={handleLinkClick}
          />

          {/* All Recipes */}
          <NavLink
            href="/recipes"
            icon={BookOpen}
            label="Recipes"
            variant="mobile"
            onClick={handleLinkClick}
          />

          {/* Collections */}
          <NavLink
            href="/collections"
            icon={Bookmark}
            label="Collections"
            variant="mobile"
            onClick={handleLinkClick}
          />

          {/* Meal Plans */}
          <NavLink
            href="/meal-plans"
            icon={CalendarDays}
            label="Meals"
            variant="mobile"
            onClick={handleLinkClick}
          />

          {/* Ingredients Directory */}
          <NavLink
            href="/ingredients"
            icon={Package}
            label="Ingredients"
            variant="mobile"
            onClick={handleLinkClick}
          />

          {/* Sustainability Chefs */}
          <NavLink
            href="/discover/chefs"
            icon={Leaf}
            label="Chefs"
            variant="mobile"
            onClick={handleLinkClick}
          />

          {/* Divider */}
          <div className="border-t border-jk-sage/30 my-4" />

          {/* Secondary Navigation */}
          <NavLink
            href="/recipes/zero-waste"
            icon={Leaf}
            label="Zero-Waste Collection"
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
