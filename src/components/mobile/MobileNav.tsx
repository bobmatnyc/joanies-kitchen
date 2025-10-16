'use client';

import Link from "next/link";
import { useState } from "react";
import { Menu, X, BookOpen, Sparkles, Globe, Heart, Trophy, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AuthButtons } from "@/components/auth/AuthButtons";

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
      <SheetContent
        side="right"
        className="bg-jk-olive border-jk-sage w-[280px] sm:w-[320px]"
      >
        <SheetHeader>
          <SheetTitle className="text-jk-linen font-heading text-xl">
            Menu
          </SheetTitle>
        </SheetHeader>

        {/* Navigation Links - Stacked Vertically */}
        <nav className="flex flex-col gap-2 mt-8">
          <Button
            variant="ghost"
            className="w-full justify-start text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui"
            asChild
          >
            <Link href="/about" onClick={handleLinkClick}>
              <Heart className="h-5 w-5 mr-3" />
              About
            </Link>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui"
            asChild
          >
            <Link href="/recipes" onClick={handleLinkClick}>
              <BookOpen className="h-5 w-5 mr-3" />
              My Recipes
            </Link>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui"
            asChild
          >
            <Link href="/recipes/top-50" onClick={handleLinkClick}>
              <Trophy className="h-5 w-5 mr-3" />
              Top 50
            </Link>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui"
            asChild
          >
            <Link href="/shared" onClick={handleLinkClick}>
              <Globe className="h-5 w-5 mr-3" />
              Shared
            </Link>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui"
            asChild
          >
            <Link href="/discover" onClick={handleLinkClick}>
              <Sparkles className="h-5 w-5 mr-3" />
              Discover
            </Link>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui"
            asChild
          >
            <Link href="/discover/chefs" onClick={handleLinkClick}>
              <ChefHat className="h-5 w-5 mr-3" />
              Chefs
            </Link>
          </Button>
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
