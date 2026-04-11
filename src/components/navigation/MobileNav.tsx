'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { NavLink } from '@/components/navigation/NavLink';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '@/config/navigation';

/**
 * Mobile Navigation — hamburger drawer for screens < xl (1280px).
 * Nav items are defined in src/config/navigation.ts — edit there to update both
 * desktop and mobile nav simultaneously.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  // Close the sheet when any navigation link is clicked
  const handleLinkClick = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // xl:hidden keeps the hamburger hidden on desktop where DesktopNav takes over
          className="xl:hidden text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 size-11"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-jk-olive border-jk-sage w-[280px] sm:w-[320px]">
        <SheetHeader>
          <SheetTitle className="text-jk-linen font-heading text-xl">Menu</SheetTitle>
        </SheetHeader>

        {/* Semantic: <nav> landmark inside the drawer */}
        <nav className="flex flex-col gap-2 mt-8" aria-label="Mobile navigation">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              variant="mobile"
              onClick={handleLinkClick}
            />
          ))}

          <div className="border-t border-jk-sage/30 my-4" role="separator" />

          {SECONDARY_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              variant="mobile"
              onClick={handleLinkClick}
            />
          ))}
        </nav>

        <div className="border-t border-jk-sage my-6" role="separator" />

        <div className="flex flex-col gap-2">
          <AuthButtons />
        </div>
      </SheetContent>
    </Sheet>
  );
}
