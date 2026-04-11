'use client';

import { AuthButtons } from '@/components/auth/AuthButtons';
import { NavLink } from '@/components/navigation/NavLink';
import { PRIMARY_NAV_ITEMS } from '@/config/navigation';

/**
 * Desktop Navigation — visible at xl (>=1280px) breakpoint.
 * Nav items are defined in src/config/navigation.ts — edit there to update both
 * desktop and mobile nav simultaneously.
 */
export function DesktopNav() {
  return (
    // Semantic: use <nav> here so screen readers discover this landmark;
    // the outer <nav> in layout.tsx wraps both desktop + mobile as one landmark.
    <div className="hidden xl:flex items-center gap-2">
      {PRIMARY_NAV_ITEMS.map((item) => (
        <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
      ))}
      <AuthButtons />
    </div>
  );
}
